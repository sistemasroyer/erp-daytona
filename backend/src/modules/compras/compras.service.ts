import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { InventarioRepository } from '../inventario/inventario.repository';
import { ConfigMargenesService } from '../config-margenes/config-margenes.service';
import { CreateCompraDto } from './dto/create-compra.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { generarNumeroInterno, redondear2, redondear4 } from '../../common/utils/numero-documento.util';
import { Prisma } from '@prisma/client';

const TASA_IGV = 0.18;

@Injectable()
export class ComprasService {
  constructor(
    private prisma: PrismaService,
    private inventarioRepo: InventarioRepository,
    private eventEmitter: EventEmitter2,
    private configMargenes: ConfigMargenesService,
  ) {}

  async create(dto: CreateCompraDto, usuarioId: string) {
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

    const margenes = await this.configMargenes.findActivos();

    return this.prisma.$transaction(async (tx) => {
      const moneda = dto.moneda || 'PEN';
      const tipoCambio = moneda === 'USD' ? (dto.tipo_cambio || 1) : 1;
      const fleteMonto = dto.flete_monto || 0;
      const fleteMoneda = dto.flete_moneda || 'PEN';
      const fleteTipoCambio = dto.flete_tipo_cambio || 1;
      const fleteMontoPen = redondear2(fleteMonto * (fleteMoneda === 'USD' ? fleteTipoCambio : 1));

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
            ? redondear2(importeLineaPen / (1 + TASA_IGV))
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
          total: totalCompra,
          flete_monto: fleteMonto,
          flete_moneda: fleteMoneda as any,
          flete_tipo_cambio: fleteTipoCambio,
          flete_monto_pen: fleteMontoPen,
          flete_tipo_prorrateo: (dto.flete_tipo_prorrateo || 'precio') as any,
          estado: 'registrada',
          observaciones: dto.observaciones,
          usuario_creacion: usuarioId,
        },
      });

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
        if (margenes.length > 0 && costoFinal > 0) {
          const preciosData: Record<string, number> = {};
          for (const m of margenes) {
            const precio = redondear4(costoFinal * (1 + Number(m.margen) / 100));
            preciosData[`precio_venta_${m.numero}`] = precio;
          }
          await tx.tbl_productos.update({
            where: { id: item.id_producto },
            data: {
              precio_compra_sin_igv: costoFinal,
              precio_compra_con_igv: redondear4(costoFinal * (1 + TASA_IGV)),
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

  async findAll(pagination: PaginationDto & { fecha_desde?: string; fecha_hasta?: string; id_proveedor?: string }) {
    const where: any = { eliminado: false };

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
      if (pagination.fecha_hasta) where.fecha_emision.lte = new Date(pagination.fecha_hasta);
    }

    if (pagination.id_proveedor) where.id_proveedor = pagination.id_proveedor;

    const [data, total] = await Promise.all([
      this.prisma.tbl_compras.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        orderBy: { fecha_emision: 'desc' },
        include: {
          proveedor: { select: { razon_social: true, ruc: true } },
          almacen: { select: { nombre: true } },
          _count: { select: { detalle: true } },
        },
      }),
      this.prisma.tbl_compras.count({ where }),
    ]);

    return { data, total, page: pagination.page, limit: pagination.limit };
  }

  async findOne(id: string) {
    const compra = await this.prisma.tbl_compras.findFirst({
      where: { id, eliminado: false },
      include: {
        proveedor: true,
        almacen: { select: { id: true, nombre: true } },
        usuario: { select: { nombre: true, apellido: true } },
        detalle: { include: { producto: { select: { codigo: true, nombre: true, unidad_medida: { select: { simbolo: true } } } } } },
      },
    });
    if (!compra) throw new NotFoundException('Compra no encontrada');
    return compra;
  }

  async anular(id: string, motivo: string, usuarioId: string) {
    const compra = await this.findOne(id);
    if (compra.estado === 'anulada') throw new BadRequestException('La compra ya está anulada');

    return this.prisma.$transaction(async (tx) => {
      await tx.tbl_compras.update({
        where: { id },
        data: { estado: 'anulada', observaciones: `ANULADA: ${motivo}`, usuario_modificacion: usuarioId },
      });

      for (const detalle of compra.detalle) {
        await this.inventarioRepo.registrarMovimientoEnTransaccion(
          {
            idProducto: detalle.id_producto,
            idAlmacen: compra.id_almacen,
            tipo: 'salida',
            cantidad: Number(detalle.cantidad),
            motivo: `Anulación compra ${compra.numero_interno}: ${motivo}`,
            idReferencia: id,
            tipoReferencia: 'ajuste',
            idUsuario: usuarioId,
          },
          tx as unknown as Prisma.TransactionClient,
        );
      }

      return tx.tbl_compras.findFirst({ where: { id } });
    });
  }
}
