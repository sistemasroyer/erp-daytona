import { AprobacionesService } from '../aprobaciones/aprobaciones.service';
import { AnulacionAprobadaDto } from '../aprobaciones/aprobaciones.dto';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { InventarioRepository } from '../inventario/inventario.repository';
import { ConfigMargenesService } from '../config-margenes/config-margenes.service';
import { CreateCompraDto } from './dto/create-compra.dto';
import { CreateNotaCreditoCompraDto } from './dto/create-nota-credito-compra.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { generarNumeroInterno, redondear2, redondear4 } from '../../common/utils/numero-documento.util';
import { finDeDia } from '../../common/utils/fecha.util';
import { obtenerPorcentajeIgv } from '../../common/utils/igv.util';
import { Prisma } from '@prisma/client';
import { historialDocumento } from '../../common/utils/historial-documento.util';
import { aMayusculas } from '../../common/utils/texto.util';
import { serializarFechas } from '../letras/fechas';

/** Documento de letras que cuenta: no eliminado y en un paquete no eliminado ni cancelado. */
const DOC_LETRAS_VIGENTE = { eliminado: false, paquete: { eliminado: false, estado: { not: 'cancelado' as const } } };

@Injectable()
export class ComprasService {
  constructor(
    private aprobaciones: AprobacionesService,
    private prisma: PrismaService,
    private inventarioRepo: InventarioRepository,
    private eventEmitter: EventEmitter2,
    private configMargenes: ConfigMargenesService,
  ) {}

  async create(dto: CreateCompraDto, usuarioId: string) {
    dto = { ...aMayusculas(dto, ['serie', 'observaciones']), detalle: dto.detalle?.map((d) => aMayusculas(d, ['descripcion'])) };
    const proveedor = await this.prisma.tbl_proveedores.findFirst({
      where: { id: dto.id_proveedor, eliminado: false },
    });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');

    const almacen = await this.prisma.tbl_almacenes.findFirst({
      where: { id: dto.id_almacen, eliminado: false },
    });
    if (!almacen) throw new NotFoundException('Almacén no encontrado');

    const condicionPago = dto.condicion_pago || 'contado';
    if (condicionPago === 'credito' && !dto.fecha_vencimiento) {
      throw new BadRequestException('Debe indicar la fecha de vencimiento para compras al crédito');
    }

    if (dto.id_proveedor_flete) {
      const proveedorFlete = await this.prisma.tbl_proveedores.findFirst({
        where: { id: dto.id_proveedor_flete, eliminado: false },
      });
      if (!proveedorFlete) throw new NotFoundException('Proveedor/transportista del flete no encontrado');
    }

    let gastoFlete: { id: string; total: unknown; moneda: string; tipo_cambio: unknown; id_proveedor: string | null } | null = null;
    if (dto.id_gasto_flete) {
      gastoFlete = await this.prisma.tbl_gastos.findFirst({ where: { id: dto.id_gasto_flete, eliminado: false } });
      if (!gastoFlete) throw new NotFoundException('La factura de flete indicada no existe');
      if ((gastoFlete as any).categoria !== 'flete') throw new BadRequestException('El gasto seleccionado no es de categoría Flete');
      if ((gastoFlete as any).estado !== 'registrado') throw new BadRequestException('La factura de flete seleccionada está anulada');
      if ((gastoFlete as any).id_compra_relacionada) throw new BadRequestException('Esa factura de flete ya está vinculada a otra compra');
    }

    const margenes = await this.configMargenes.findActivos();

    return this.prisma.$transaction(async (tx) => {
      const moneda = dto.moneda || 'PEN';
      const tipoCambio = moneda === 'USD' ? (dto.tipo_cambio || 1) : 1;
      const fleteMonto = gastoFlete ? Number(gastoFlete.total) : (dto.flete_monto || 0);
      const fleteMoneda = gastoFlete ? gastoFlete.moneda : (dto.flete_moneda || 'PEN');
      const fleteTipoCambio = gastoFlete ? Number(gastoFlete.tipo_cambio) : (dto.flete_tipo_cambio || 1);
      const fleteMontoPen = redondear2(fleteMonto * (fleteMoneda === 'USD' ? fleteTipoCambio : 1));
      const porcentajeIgv = await obtenerPorcentajeIgv(tx);
      const tasaIgv = porcentajeIgv / 100;

      // Motor de cálculo: importe_linea como fuente primaria
      const detalleCalculado = await Promise.all(
        dto.detalle.map(async (item) => {
          const producto = await tx.tbl_productos.findFirst({
            where: { id: item.id_producto, eliminado: false },
            select: { id: true, nombre: true, afecta_igv: true },
          });
          if (!producto) throw new NotFoundException(`Producto ${item.id_producto} no encontrado`);

          const afectaIgv = item.afecta_igv !== false && producto.afecta_igv;

          // importe_linea en la moneda de la factura
          const importeLinea = item.importe_linea;
          // Convertir a soles
          const importeLineaPen = redondear4(importeLinea * tipoCambio);

          // Extraer base sin IGV desde el importe total de la línea
          const subtotal = afectaIgv
            ? redondear2(importeLineaPen / (1 + tasaIgv))
            : redondear2(importeLineaPen);
          const igvTotal = afectaIgv ? redondear2(importeLineaPen - subtotal) : 0;

          // Costo unitario sin IGV en soles
          const costoUnitarioSinIgv = redondear4(subtotal / item.cantidad);

          // precio_unitario: se calcula desde importe o se usa el provisto como referencia
          const precioUnitario = item.precio_unitario ?? redondear4(importeLinea / item.cantidad);
          const precioUnitarioPen = redondear4(precioUnitario * tipoCambio);

          return {
            id_producto: item.id_producto,
            descripcion: item.descripcion || producto.nombre,
            cantidad: item.cantidad,
            importe_linea: importeLinea,
            precio_unitario: precioUnitario,
            precio_unitario_pen: precioUnitarioPen,
            costo_flete_prorrateado: 0,
            costo_unitario_total: costoUnitarioSinIgv,
            subtotal,
            igv: igvTotal,
            total: redondear2(subtotal + igvTotal),
            afecta_igv: afectaIgv,
            // Guardar costo unitario sin IGV en PEN para cálculo de precios
            _costoUnitarioSinIgvPen: costoUnitarioSinIgv,
          };
        }),
      );

      // Prorratear flete
      if (fleteMontoPen > 0) {
        const base = dto.flete_tipo_prorrateo === 'cantidad'
          ? detalleCalculado.reduce((s, d) => s + d.cantidad, 0)
          : detalleCalculado.reduce((s, d) => s + d.subtotal, 0);

        detalleCalculado.forEach((item) => {
          const proporcion = dto.flete_tipo_prorrateo === 'cantidad'
            ? item.cantidad / base
            : item.subtotal / base;
          const fleteProrr = redondear4((fleteMontoPen * proporcion) / item.cantidad);
          item.costo_flete_prorrateado = fleteProrr;
          item.costo_unitario_total = redondear4(item._costoUnitarioSinIgvPen + fleteProrr);
          item._costoUnitarioSinIgvPen = item.costo_unitario_total;
        });
      }

      const subtotalCompra = redondear2(detalleCalculado.reduce((s, d) => s + d.subtotal, 0));
      const igvCompra = redondear2(detalleCalculado.reduce((s, d) => s + d.igv, 0));
      const totalCompra = redondear2(subtotalCompra + igvCompra);

      const totalCompras = await tx.tbl_compras.count();
      const numeroInterno = generarNumeroInterno('COM', totalCompras + 1);

      const compra = await tx.tbl_compras.create({
        data: {
          numero_interno: numeroInterno,
          tipo_documento: dto.tipo_documento,
          serie: dto.serie,
          numero: dto.numero,
          id_proveedor: dto.id_proveedor,
          id_almacen: dto.id_almacen,
          id_usuario: usuarioId,
          id_orden_compra: dto.id_orden_compra,
          fecha_emision: new Date(dto.fecha_emision),
          fecha_vencimiento: dto.fecha_vencimiento ? new Date(dto.fecha_vencimiento) : null,
          condicion_pago: condicionPago as any,
          moneda: moneda as any,
          tipo_cambio: tipoCambio,
          subtotal: subtotalCompra,
          igv: igvCompra,
          porcentaje_igv: porcentajeIgv,
          total: totalCompra,
          flete_monto: fleteMonto,
          flete_moneda: fleteMoneda as any,
          flete_tipo_cambio: fleteTipoCambio,
          flete_monto_pen: fleteMontoPen,
          flete_tipo_prorrateo: (dto.flete_tipo_prorrateo || 'precio') as any,
          id_proveedor_flete: (gastoFlete?.id_proveedor || dto.id_proveedor_flete) ?? null,
          estado: 'registrada',
          observaciones: dto.observaciones,
          usuario_creacion: usuarioId,
        },
      });

      if (gastoFlete) {
        await tx.tbl_gastos.update({
          where: { id: gastoFlete.id },
          data: { id_compra_relacionada: compra.id, usuario_modificacion: usuarioId },
        });
      }

      // Guardar detalle (sin campo auxiliar _costoUnitarioSinIgvPen)
      await tx.tbl_detalle_compras.createMany({
        data: detalleCalculado.map(({ _costoUnitarioSinIgvPen: _, ...d }) => ({
          id_compra: compra.id,
          ...d,
        })),
      });

      // Actualizar orden de compra si aplica
      if (dto.id_orden_compra) {
        await tx.tbl_ordenes_compra.update({
          where: { id: dto.id_orden_compra },
          data: { estado: 'convertido', id_compra_generada: compra.id },
        });
      }

      // Ingresar stock + actualizar precios por producto
      for (const item of detalleCalculado) {
        const costoFinal = item._costoUnitarioSinIgvPen ?? item.costo_unitario_total;

        await this.inventarioRepo.registrarMovimientoEnTransaccion(
          {
            idProducto: item.id_producto,
            idAlmacen: dto.id_almacen,
            tipo: 'entrada',
            cantidad: item.cantidad,
            costoUnitario: costoFinal,
            motivo: `Compra ${numeroInterno} - ${proveedor.razon_social}`,
            idReferencia: compra.id,
            tipoReferencia: 'compra',
            idUsuario: usuarioId,
          },
          tx as unknown as Prisma.TransactionClient,
        );

        // Auto-calcular precios de venta según márgenes configurados
        // El margen se aplica sobre el costo sin IGV, y el IGV se suma aparte encima
        // (si no, el IGV se "come" parte del margen en vez de ser un cobro aparte para SUNAT).
        if (margenes.length > 0 && costoFinal > 0) {
          const factorIgv = item.afecta_igv ? 1 + tasaIgv : 1;
          const preciosData: Record<string, number> = {};
          for (const m of margenes) {
            const precio = redondear4(costoFinal * (1 + Number(m.margen) / 100) * factorIgv);
            preciosData[`precio_venta_${m.numero}`] = precio;
          }
          await tx.tbl_productos.update({
            where: { id: item.id_producto },
            data: {
              precio_compra_sin_igv: costoFinal,
              precio_compra_con_igv: redondear4(costoFinal * (1 + tasaIgv)),
              usuario_modificacion: usuarioId,
              ...preciosData,
            },
          });
        }
      }

      return tx.tbl_compras.findFirst({
        where: { id: compra.id },
        include: {
          proveedor: { select: { razon_social: true, ruc: true } },
          proveedor_flete: { select: { razon_social: true, ruc: true } },
          almacen: { select: { nombre: true } },
          detalle: { include: { producto: { select: { nombre: true, codigo: true } } } },
        },
      });
    }, {
      maxWait: 15000,
      timeout: 60000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }).then((compra) => {
      this.eventEmitter.emit('compra.registrada', compra);
      return compra;
    });
  }

  async findAll(pagination: PaginationDto & { fecha_desde?: string; fecha_hasta?: string; id_proveedor?: string; tipo_documento?: string; letras?: string }) {
    const where: any = { eliminado: false };
    // Facturas a crédito vigentes que todavía no se pasaron (o sí) a un paquete de letras.
    if (pagination.letras === 'sin_paquete' || pagination.letras === 'en_paquete') {
      Object.assign(where, { condicion_pago: 'credito', estado: 'registrada', tipo_documento: { not: 'nota_credito' } });
      where.documentos_letras = { [pagination.letras === 'sin_paquete' ? 'none' : 'some']: DOC_LETRAS_VIGENTE };
    }

    if (pagination.tipo_documento) where.tipo_documento = pagination.letras ? { equals: pagination.tipo_documento, not: 'nota_credito' } : pagination.tipo_documento;

    if (pagination.search) {
      where.OR = [
        { numero_interno: { contains: pagination.search } },
        { numero: { contains: pagination.search } },
        { proveedor: { razon_social: { contains: pagination.search, mode: 'insensitive' } } },
      ];
    }

    if (pagination.fecha_desde || pagination.fecha_hasta) {
      where.fecha_emision = {};
      if (pagination.fecha_desde) where.fecha_emision.gte = new Date(pagination.fecha_desde);
      if (pagination.fecha_hasta) where.fecha_emision.lte = finDeDia(pagination.fecha_hasta);
    }

    if (pagination.id_proveedor) where.id_proveedor = pagination.id_proveedor;

    const [data, total] = await Promise.all([
      this.prisma.tbl_compras.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        orderBy: { fecha_emision: 'desc' },
        include: {
          proveedor: { select: { razon_social: true, ruc: true, dias_credito: true, letras_pago_unico: true } },
          almacen: { select: { nombre: true } },
          usuario: { select: { nombre: true, apellido: true } },
          _count: { select: { detalle: true } },
        },
      }),
      this.prisma.tbl_compras.count({ where }),
    ]);

    const letras = await this.letrasDeCompras(data.map((c) => c.id));
    return { data: data.map((c) => ({ ...c, letras: letras.get(c.id) ?? null })), total, page: pagination.page, limit: pagination.limit };
  }

  /** Paquete de letras vigente de cada compra, con cuántas letras tiene y cuántas están pagadas. */
  private async letrasDeCompras(ids: string[]) {
    const docs = await this.prisma.tbl_letras_documentos.findMany({
      where: { id_compra: { in: ids }, ...DOC_LETRAS_VIGENTE },
      select: { id_compra: true, paquete: { select: { id: true, codigo: true, estado: true, moneda: true, monto_total: true } } },
    });
    const conteo = docs.length
      ? await this.prisma.tbl_letras.groupBy({
          by: ['id_paquete', 'estado'], _count: true,
          where: { id_paquete: { in: docs.map((d) => d.paquete.id) }, eliminado: false, estado: { not: 'cancelada' } },
        })
      : [];
    const contar = (idPaquete: string, estado?: string) =>
      conteo.filter((c) => c.id_paquete === idPaquete && (!estado || c.estado === estado)).reduce((s, c) => s + c._count, 0);
    return new Map(docs.map((d) => [d.id_compra!, {
      ...d.paquete, letras_total: contar(d.paquete.id), letras_pagadas: contar(d.paquete.id, 'pagada'),
    }]));
  }

  /** Detalle para pantalla: el documento + quién lo anuló/autorizó + historial de cambios. */
  async findOneConHistorial(id: string) {
    const compra = await this.findOne(id);
    const paquete = (await this.letrasDeCompras([id])).get(id);
    const letras = paquete
      ? serializarFechas(await this.prisma.tbl_letras.findMany({
          where: { id_paquete: paquete.id, eliminado: false }, orderBy: { numero_cuota: 'asc' },
          select: { id: true, numero_cuota: true, moneda: true, monto: true, fecha_pago: true, estado: true, fecha_pago_efectivo: true },
        }))
      : [];
    return { ...compra, letras: paquete ? { ...paquete, letras } : null, ...(await historialDocumento(this.prisma, 'compras', {
      ...compra, anulado: compra.estado === 'anulada', motivo: compra.observaciones,
    })) };
  }

  async findOne(id: string) {
    const compra = await this.prisma.tbl_compras.findFirst({
      where: { id, eliminado: false },
      include: {
        proveedor: true,
        proveedor_flete: { select: { id: true, razon_social: true, ruc: true } },
        almacen: { select: { id: true, nombre: true } },
        usuario: { select: { nombre: true, apellido: true } },
        detalle: { include: { producto: { select: { codigo: true, nombre: true, unidad_medida: { select: { simbolo: true } } } } } },
      },
    });
    if (!compra) throw new NotFoundException('Compra no encontrada');
    return compra;
  }

  async anular(id: string, dto: AnulacionAprobadaDto, usuarioId: string) {
    const { motivo } = dto;
    const compra = await this.findOne(id);
    if (compra.estado === 'anulada') throw new BadRequestException('La compra ya está anulada');

    const notaCreditoExistente = await this.prisma.tbl_compras.findFirst({
      where: { id_compra_original: id, eliminado: false, estado: { not: 'anulada' } },
    });
    if (notaCreditoExistente) {
      throw new BadRequestException(
        'Esta compra ya tiene una Nota de Crédito registrada. No se puede anular directamente (duplicaría la '
        + 'reversión de stock) — emita o complete la Nota de Crédito por el resto en su lugar.',
      );
    }
    await this.assertFueraDeLetras(id);

    return this.prisma.$transaction(async (tx) => {
      await this.aprobaciones.consumir(tx, 'compras', id, usuarioId, dto);
      await tx.tbl_compras.update({
        where: { id },
        data: { estado: 'anulada', observaciones: `ANULADA: ${motivo}`, usuario_modificacion: usuarioId },
      });

      for (const detalle of compra.detalle) {
        const productoCosteo = await tx.tbl_productos.findFirst({ where: { id: detalle.id_producto }, select: { costo_promedio: true } });
        await this.inventarioRepo.registrarMovimientoEnTransaccion(
          {
            idProducto: detalle.id_producto,
            idAlmacen: compra.id_almacen,
            tipo: 'salida',
            cantidad: Number(detalle.cantidad),
            costoUnitario: Number(productoCosteo?.costo_promedio || 0),
            motivo: `Anulación compra ${compra.numero_interno}: ${motivo}`,
            idReferencia: id,
            tipoReferencia: 'compra',
            idUsuario: usuarioId,
          },
          tx as unknown as Prisma.TransactionClient,
        );
      }

      return tx.tbl_compras.findFirst({ where: { id } });
    });
  }

  /** Una compra (o NC) dentro de un paquete de letras vigente no se anula: quedarían letras de un documento anulado. */
  private async assertFueraDeLetras(idCompra: string) {
    const doc = await this.prisma.tbl_letras_documentos.findFirst({
      where: { id_compra: idCompra, ...DOC_LETRAS_VIGENTE },
      select: { paquete: { select: { codigo: true, estado: true } } },
    });
    if (!doc) return;
    const { codigo, estado } = doc.paquete;
    const comoLiberarlo: Record<string, string> = {
      borrador: 'quítelo del paquete',
      pendiente_aprobacion: 'devuelva el paquete a borrador y quítelo',
      aprobado: 'reabra el paquete y quítelo, o cancele el paquete',
      en_proceso: 'cancele el paquete (sus letras pendientes quedarán canceladas)',
      completado: 'no es posible: sus letras ya están pagadas',
    };
    throw new BadRequestException(
      `Este documento está en el paquete de letras ${codigo}. Para anularlo, ${comoLiberarlo[estado] ?? 'cancele el paquete'} (Letras → Paquetes).`,
    );
  }

  async crearNotaCreditoCompra(idCompraOriginal: string, dto: CreateNotaCreditoCompraDto, usuarioId: string) {
    dto = aMayusculas(dto, ['serie', 'motivo']);
    return this.prisma.$transaction(async (tx) => {
      const original = await tx.tbl_compras.findFirst({
        where: { id: idCompraOriginal, eliminado: false },
        include: { detalle: true },
      });
      if (!original) throw new NotFoundException('Compra original no encontrada');

      if (original.tipo_documento === 'nota_credito') {
        throw new BadRequestException('No se puede emitir una Nota de Crédito sobre otra Nota de Crédito');
      }
      if (original.estado !== 'registrada') {
        throw new BadRequestException(`No se puede emitir una Nota de Crédito sobre una compra en estado "${original.estado}"`);
      }

      // tbl_detalle_compras no guarda un id_detalle_original (FK) hacia la línea que acredita,
      // así que para saber cuánto de cada línea ya fue acreditado por Notas de Crédito previas se
      // suma por (id_producto, precio_unitario_pen) entre todas las NC vigentes sobre esta compra.
      const notasCreditoPrevias = await tx.tbl_compras.findMany({
        where: { id_compra_original: original.id, eliminado: false, estado: { not: 'anulada' } },
        select: { id: true },
      });
      const detallesPrevios = notasCreditoPrevias.length
        ? await tx.tbl_detalle_compras.findMany({
            where: { id_compra: { in: notasCreditoPrevias.map((n) => n.id) } },
            select: { id_producto: true, precio_unitario_pen: true, cantidad: true },
          })
        : [];
      const claveLinea = (idProducto: string, precioUnitarioPen: number | Prisma.Decimal) =>
        `${idProducto}|${Number(precioUnitarioPen).toFixed(4)}`;
      const acreditadoPrevio = new Map<string, number>();
      for (const d of detallesPrevios) {
        const clave = claveLinea(d.id_producto, d.precio_unitario_pen);
        acreditadoPrevio.set(clave, (acreditadoPrevio.get(clave) || 0) + Number(d.cantidad));
      }

      // Construir el detalle a partir de las líneas ORIGINALES (para saber si cada
      // una afecta IGV) — el importe a acreditar por línea lo indica el proveedor
      // en su propio documento, no se recalcula desde precios actuales.
      const detalleCalculado = dto.detalle.map((item) => {
        const detOriginal = original.detalle.find((d) => d.id === item.id_detalle_original);
        if (!detOriginal) {
          throw new BadRequestException('Uno de los ítems indicados no pertenece a la compra original');
        }

        const yaAcreditado = acreditadoPrevio.get(claveLinea(detOriginal.id_producto, detOriginal.precio_unitario_pen)) || 0;
        const disponibleParaAcreditar = redondear4(Number(detOriginal.cantidad) - yaAcreditado);
        if (item.cantidad > disponibleParaAcreditar) {
          throw new BadRequestException(
            `La cantidad a acreditar de "${detOriginal.descripcion}" (${item.cantidad}) excede lo disponible para `
            + `acreditar (${disponibleParaAcreditar}). Ya se acreditaron ${yaAcreditado} de ${detOriginal.cantidad} `
            + 'en notas de crédito anteriores.',
          );
        }

        const tipoCambio = Number(original.tipo_cambio);
        const importeLineaPen = redondear4(item.importe_linea * tipoCambio);
        const afectaIgv = detOriginal.afecta_igv;
        // La NC del proveedor se emite con la misma tasa de IGV que la factura original.
        const subtotal = afectaIgv
          ? redondear2(importeLineaPen / (1 + Number(original.porcentaje_igv) / 100))
          : redondear2(importeLineaPen);
        const igvTotal = afectaIgv ? redondear2(importeLineaPen - subtotal) : 0;
        const precioUnitario = redondear4(item.importe_linea / item.cantidad);
        const precioUnitarioPen = redondear4(importeLineaPen / item.cantidad);

        return {
          id_producto: detOriginal.id_producto,
          descripcion: detOriginal.descripcion,
          cantidad: item.cantidad,
          importe_linea: item.importe_linea,
          precio_unitario: precioUnitario,
          precio_unitario_pen: precioUnitarioPen,
          costo_flete_prorrateado: 0,
          costo_unitario_total: redondear4(subtotal / item.cantidad),
          subtotal,
          igv: igvTotal,
          total: redondear2(subtotal + igvTotal),
          afecta_igv: afectaIgv,
        };
      });

      if (detalleCalculado.length === 0) {
        throw new BadRequestException('Debe incluir al menos un ítem a acreditar');
      }

      const subtotalNC = redondear2(detalleCalculado.reduce((s, d) => s + d.subtotal, 0));
      const igvNC = redondear2(detalleCalculado.reduce((s, d) => s + d.igv, 0));
      const totalNC = redondear2(subtotalNC + igvNC);

      if (dto.codigo_motivo === '01' && Math.abs(totalNC - Number(original.total)) > 0.05) {
        throw new BadRequestException(
          'Para anular la operación completa, la Nota de Crédito debe incluir todos los ítems por el total de la compra original',
        );
      }

      const totalCompras = await tx.tbl_compras.count();
      const numeroInterno = generarNumeroInterno('COM', totalCompras + 1);

      const nc = await tx.tbl_compras.create({
        data: {
          numero_interno: numeroInterno,
          tipo_documento: 'nota_credito',
          serie: dto.serie,
          numero: dto.numero,
          id_proveedor: original.id_proveedor,
          id_almacen: original.id_almacen,
          id_usuario: usuarioId,
          fecha_emision: new Date(dto.fecha_emision),
          condicion_pago: 'contado',
          moneda: original.moneda,
          tipo_cambio: original.tipo_cambio,
          subtotal: subtotalNC,
          igv: igvNC,
          porcentaje_igv: original.porcentaje_igv,
          total: totalNC,
          estado: 'registrada',
          observaciones: dto.motivo,
          id_compra_original: original.id,
          motivo_nota: dto.motivo,
          codigo_motivo_nota: dto.codigo_motivo,
          usuario_creacion: usuarioId,
        },
      });

      await tx.tbl_detalle_compras.createMany({
        data: detalleCalculado.map((d) => ({ id_compra: nc.id, ...d })),
      });

      // Si implica devolución física al proveedor, descontar stock
      if (dto.afecta_stock) {
        const numeroDocProveedor = dto.numero ? `${dto.serie ? dto.serie + '-' : ''}${dto.numero}` : numeroInterno;
        for (const item of detalleCalculado) {
          const productoCosteo = await tx.tbl_productos.findFirst({ where: { id: item.id_producto }, select: { costo_promedio: true } });
          await this.inventarioRepo.registrarMovimientoEnTransaccion(
            {
              idProducto: item.id_producto,
              idAlmacen: original.id_almacen,
              tipo: 'salida',
              cantidad: Number(item.cantidad),
              costoUnitario: Number(productoCosteo?.costo_promedio || 0),
              motivo: `Nota de Crédito ${numeroDocProveedor} sobre compra ${original.numero_interno}`,
              idReferencia: nc.id,
              tipoReferencia: 'compra',
              idUsuario: usuarioId,
            },
            tx as unknown as Prisma.TransactionClient,
          );
        }
      }

      // Si es anulación total de la operación, marcar la compra original como anulada
      if (dto.codigo_motivo === '01') {
        await tx.tbl_compras.update({
          where: { id: original.id },
          data: {
            estado: 'anulada',
            observaciones: `ANULADA por Nota de Crédito: ${dto.motivo}`,
            usuario_modificacion: usuarioId,
          },
        });
      }

      return tx.tbl_compras.findFirst({
        where: { id: nc.id },
        include: {
          proveedor: { select: { razon_social: true, ruc: true } },
          almacen: { select: { nombre: true } },
          detalle: { include: { producto: { select: { nombre: true, codigo: true } } } },
        },
      });
    }, {
      maxWait: 15000,
      timeout: 60000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }
}
