import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { InventarioRepository } from '../inventario/inventario.repository';
import { CreateVentaDto, AnularVentaDto, CanjearVentaDto } from './dto/create-venta.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  generarNumeroInterno,
  generarNumeroComprobante,
  redondear2,
  redondear4,
} from '../../common/utils/numero-documento.util';
import { Prisma } from '@prisma/client';

const TASA_IGV = 0.18;

@Injectable()
export class VentasService {
  private readonly logger = new Logger(VentasService.name);

  constructor(
    private prisma: PrismaService,
    private inventarioRepo: InventarioRepository,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateVentaDto, usuarioId: string, idPuntoVenta?: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Validar y obtener serie → bloquear para correlativo único
      const series = await tx.$queryRaw<any[]>`
        SELECT id, serie, correlativo_actual, tipo_documento, id_punto_venta
        FROM tbl_series_documento
        WHERE id::text = ${dto.id_serie_documento} AND activo = true
        FOR UPDATE
      `;

      const serieDoc = series[0];
      if (!serieDoc) throw new BadRequestException('Serie de documento no válida o inactiva');

      if (serieDoc.tipo_documento !== dto.tipo_documento) {
        throw new BadRequestException('La serie seleccionada no corresponde al tipo de documento indicado');
      }

      if (idPuntoVenta && serieDoc.id_punto_venta !== idPuntoVenta) {
        throw new ForbiddenException('No puede usar series de otro punto de venta');
      }

      // 2. Incrementar correlativo
      const nuevoCorrelativo = serieDoc.correlativo_actual + 1;
      await tx.$executeRaw`
        UPDATE tbl_series_documento
        SET correlativo_actual = ${nuevoCorrelativo}
        WHERE id::text = ${dto.id_serie_documento}
      `;

      const numeroComprobante = generarNumeroComprobante(serieDoc.serie, nuevoCorrelativo);

      // 3. Obtener cliente
      const cliente = await tx.tbl_clientes.findFirst({
        where: { id: dto.id_cliente, eliminado: false, estado: true },
      });
      if (!cliente) throw new NotFoundException('Cliente no encontrado');

      // 4. Obtener almacén principal (para descontar stock)
      const almacen = await tx.tbl_almacenes.findFirst({
        where: {
          eliminado: false,
          estado: true,
          es_principal: true,
        },
      });
      if (!almacen) throw new BadRequestException('No hay almacén principal configurado');

      // 5. Calcular totales del detalle
      const detalleCalculado = await Promise.all(
        dto.detalle.map(async (item) => {
          const producto = await tx.tbl_productos.findFirst({
            where: { id: item.id_producto, eliminado: false, estado: true },
            select: {
              id: true, nombre: true, afecta_igv: true,
              precio_venta_1: true, precio_venta_2: true, precio_venta_3: true,
              precio_venta_4: true, precio_venta_5: true,
            },
          });

          if (!producto) throw new NotFoundException(`Producto ${item.id_producto} no encontrado`);

          const precios: Record<number, any> = {
            1: producto.precio_venta_1, 2: producto.precio_venta_2,
            3: producto.precio_venta_3, 4: producto.precio_venta_4,
            5: producto.precio_venta_5,
          };

          const precioUnitario = Number(precios[item.precio_tipo] || producto.precio_venta_1);
          const descuento = item.descuento || 0;
          const cantidad = item.cantidad;

          let valorUnitario: number;
          let igvUnitario: number;

          if (producto.afecta_igv) {
            valorUnitario = redondear4(precioUnitario / (1 + TASA_IGV));
            igvUnitario = redondear4(precioUnitario - valorUnitario);
          } else {
            valorUnitario = precioUnitario;
            igvUnitario = 0;
          }

          const subtotal = redondear2(valorUnitario * cantidad - descuento);
          const igvTotal = redondear2(igvUnitario * cantidad);
          const total = redondear2(subtotal + igvTotal);

          return {
            id_producto: item.id_producto,
            descripcion: item.descripcion || producto.nombre,
            cantidad,
            precio_tipo: item.precio_tipo,
            precio_unitario: precioUnitario,
            descuento,
            descuento_pct: 0,
            valor_unitario: valorUnitario,
            subtotal,
            igv: igvTotal,
            total,
            afecta_igv: producto.afecta_igv,
          };
        }),
      );

      const subtotalVenta = redondear2(detalleCalculado.reduce((s, d) => s + d.subtotal, 0));
      const igvVenta = redondear2(detalleCalculado.reduce((s, d) => s + d.igv, 0));
      const totalVenta = redondear2(subtotalVenta + igvVenta);

      // 6. Validar pagos (obligatorio y debe cubrir el total solo para documentos oficiales)
      const esOficial = dto.tipo_documento === 'FACTURA' || dto.tipo_documento === 'BOLETA';
      const afectaStock = dto.tipo_documento !== 'COTIZACION';
      const pagos = dto.pagos || [];
      const totalPagos = redondear2(pagos.reduce((s, p) => s + p.monto, 0));

      if (esOficial && totalPagos < totalVenta) {
        throw new BadRequestException(
          `El total de pagos (${totalPagos}) es menor al total de la venta (${totalVenta})`,
        );
      }

      // 7. Obtener número interno secuencial
      const totalVentas = await tx.tbl_ventas.count();
      const numeroInterno = generarNumeroInterno('VTA', totalVentas + 1);

      // 8. Crear la venta
      const venta = await tx.tbl_ventas.create({
        data: {
          numero_interno: numeroInterno,
          id_serie_documento: dto.id_serie_documento,
          tipo_documento: dto.tipo_documento as any,
          serie: serieDoc.serie,
          correlativo: nuevoCorrelativo,
          numero_comprobante: numeroComprobante,
          id_cliente: dto.id_cliente,
          id_punto_venta: idPuntoVenta,
          id_usuario_vendedor: usuarioId,
          id_caja_apertura: dto.id_caja_apertura,
          fecha_emision: new Date(),
          moneda: (dto.moneda as any) || 'PEN',
          tipo_cambio: dto.tipo_cambio || 1,
          subtotal: subtotalVenta,
          igv: igvVenta,
          total: totalVenta,
          observaciones: dto.observaciones,
          estado_sunat: esOficial ? 'pendiente' : 'no_aplica',
          estado_venta: 'vigente',
          afecto_stock: afectaStock,
          usuario_creacion: usuarioId,
        },
      });

      // 9. Crear detalle
      await tx.tbl_detalle_ventas.createMany({
        data: detalleCalculado.map((d) => ({
          id_venta: venta.id,
          ...d,
        })),
      });

      // 10. Crear pagos
      if (pagos.length > 0) {
        await tx.tbl_pagos.createMany({
          data: pagos.map((p) => ({
            id_venta: venta.id,
            id_metodo_pago: p.id_metodo_pago,
            monto: p.monto,
            referencia: p.referencia,
            fecha: new Date(),
          })),
        });
      }

      // 11. Registrar movimiento caja si aplica
      if (dto.id_caja_apertura && totalPagos > 0) {
        await tx.tbl_movimientos_caja.create({
          data: {
            id_caja_apertura: dto.id_caja_apertura,
            tipo: 'ingreso',
            concepto: `Venta ${numeroComprobante}`,
            monto: totalPagos,
            id_referencia: venta.id,
            tipo_referencia: 'venta',
            id_usuario: usuarioId,
          },
        });
      }

      // 12. Descontar stock por cada ítem (dentro de la transacción). Las cotizaciones no afectan stock.
      if (afectaStock) {
        for (const item of dto.detalle) {
          await this.inventarioRepo.registrarMovimientoEnTransaccion(
            {
              idProducto: item.id_producto,
              idAlmacen: almacen.id,
              tipo: 'salida',
              cantidad: item.cantidad,
              motivo: `Venta ${numeroComprobante}`,
              idReferencia: venta.id,
              tipoReferencia: 'venta',
              idUsuario: usuarioId,
            },
            tx as unknown as Prisma.TransactionClient,
          );
        }
      }

      // 13. Commit → emit evento (fuera de transacción ya que es async)
      const ventaCompleta = await tx.tbl_ventas.findFirst({
        where: { id: venta.id },
        include: {
          cliente: { select: { razon_social: true, numero_documento: true } },
          detalle: { include: { producto: { select: { nombre: true, codigo: true } } } },
          pagos: { include: { metodo_pago: true } },
        },
      });

      return ventaCompleta;
    }, {
      maxWait: 15000,
      timeout: 60000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }).then((venta) => {
      // Emitir evento DESPUÉS del commit
      this.eventEmitter.emit('venta.creada', venta);
      return venta;
    });
  }

  async findAll(pagination: PaginationDto & {
    fecha_desde?: string;
    fecha_hasta?: string;
    estado_sunat?: string;
    id_usuario?: string;
    id_punto_venta?: string;
  }) {
    const where: any = { eliminado: false };
    if (pagination.id_punto_venta) where.id_punto_venta = pagination.id_punto_venta;

    if (pagination.search) {
      where.OR = [
        { numero_comprobante: { contains: pagination.search } },
        { numero_interno: { contains: pagination.search } },
        { cliente: { razon_social: { contains: pagination.search, mode: 'insensitive' } } },
      ];
    }

    if (pagination.fecha_desde || pagination.fecha_hasta) {
      where.fecha_emision = {};
      if (pagination.fecha_desde) where.fecha_emision.gte = new Date(pagination.fecha_desde);
      if (pagination.fecha_hasta) where.fecha_emision.lte = new Date(pagination.fecha_hasta);
    }

    if (pagination.estado_sunat) where.estado_sunat = pagination.estado_sunat;
    if (pagination.id_usuario) where.id_usuario_vendedor = pagination.id_usuario;

    const [data, total] = await Promise.all([
      this.prisma.tbl_ventas.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        orderBy: { fecha_emision: 'desc' },
        include: {
          cliente: { select: { razon_social: true, numero_documento: true } },
          vendedor: { select: { nombre: true, apellido: true } },
          _count: { select: { detalle: true } },
        },
      }),
      this.prisma.tbl_ventas.count({ where }),
    ]);

    return { data, total, page: pagination.page, limit: pagination.limit };
  }

  async findOne(id: string) {
    const venta = await this.prisma.tbl_ventas.findFirst({
      where: { id, eliminado: false },
      include: {
        cliente: true,
        vendedor: { select: { nombre: true, apellido: true, email: true } },
        serie_documento: { select: { serie: true, tipo_documento: true } },
        detalle: {
          include: {
            producto: {
              select: {
                codigo: true, nombre: true,
                unidad_medida: { select: { simbolo: true } },
              },
            },
          },
        },
        pagos: { include: { metodo_pago: { select: { nombre: true } } } },
        sunat_envios: {
          orderBy: { fecha_creacion: 'desc' },
          take: 1,
        },
      },
    });

    if (!venta) throw new NotFoundException('Venta no encontrada');
    return venta;
  }

  async anular(id: string, dto: AnularVentaDto, usuarioId: string) {
    const venta = await this.findOne(id);

    if (venta.estado_venta === 'anulada') {
      throw new BadRequestException('La venta ya está anulada');
    }

    if (venta.estado_venta === 'canjeada') {
      throw new BadRequestException(
        'Este documento ya fue canjeado a un comprobante oficial. Anule el documento oficial resultante en su lugar.',
      );
    }

    if (venta.estado_sunat === 'aceptado') {
      throw new BadRequestException(
        'No se puede anular una venta aceptada por SUNAT. Debe emitir una Nota de Crédito.',
      );
    }

    const esOficial = venta.tipo_documento === 'FACTURA' || venta.tipo_documento === 'BOLETA';
    // No derivar de tipo_documento: un documento canjeado desde Nota de Venta no afectó
    // stock por sí mismo (ya lo hizo el original), así que se usa el flag guardado en creación.
    const afectoStock = venta.afecto_stock;

    return this.prisma.$transaction(async (tx) => {
      await tx.tbl_ventas.update({
        where: { id },
        data: {
          estado_venta: 'anulada',
          motivo_anulacion: dto.motivo,
          estado_sunat: esOficial ? 'pendiente' : venta.estado_sunat,
          usuario_modificacion: usuarioId,
        },
      });

      // Revertir stock (solo si el documento original lo afectó; las cotizaciones no)
      const almacen = afectoStock
        ? await tx.tbl_almacenes.findFirst({ where: { eliminado: false, es_principal: true } })
        : null;

      if (almacen) {
        const detalles = await tx.tbl_detalle_ventas.findMany({ where: { id_venta: id } });

        for (const detalle of detalles) {
          await this.inventarioRepo.registrarMovimientoEnTransaccion(
            {
              idProducto: detalle.id_producto,
              idAlmacen: almacen.id,
              tipo: 'entrada',
              cantidad: Number(detalle.cantidad),
              motivo: `Anulación venta ${venta.numero_comprobante}: ${dto.motivo}`,
              idReferencia: id,
              tipoReferencia: 'ajuste',
              idUsuario: usuarioId,
            },
            tx as unknown as Prisma.TransactionClient,
          );
        }
      }

      return tx.tbl_ventas.findFirst({ where: { id } });
    });
  }

  async reenviarSunat(id: string) {
    const venta = await this.findOne(id);

    if (venta.estado_venta === 'anulada') {
      throw new BadRequestException('No se puede reenviar una venta anulada');
    }

    this.eventEmitter.emit('venta.reenviar_sunat', venta);
    return { message: 'Reenvío a SUNAT encolado correctamente' };
  }

  async canjear(id: string, dto: CanjearVentaDto, usuarioId: string, idPuntoVenta?: string) {
    const origen = await this.findOne(id);

    if (origen.tipo_documento !== 'NOTA_VENTA' && origen.tipo_documento !== 'COTIZACION') {
      throw new BadRequestException('Solo se puede canjear una Nota de Venta o una Cotización');
    }
    if (origen.estado_venta !== 'vigente') {
      throw new BadRequestException(`No se puede canjear un documento en estado "${origen.estado_venta}"`);
    }

    // La Nota de Venta ya descontó stock al crearse; la Cotización no, por lo que el canje debe descontarlo ahora.
    const debeAfectarStock = origen.tipo_documento === 'COTIZACION';

    return this.prisma.$transaction(async (tx) => {
      const series = await tx.$queryRaw<any[]>`
        SELECT id, serie, correlativo_actual, tipo_documento, id_punto_venta
        FROM tbl_series_documento
        WHERE id::text = ${dto.id_serie_documento} AND activo = true
        FOR UPDATE
      `;
      const serieDoc = series[0];
      if (!serieDoc) throw new BadRequestException('Serie de documento no válida o inactiva');
      if (serieDoc.tipo_documento !== dto.tipo_documento) {
        throw new BadRequestException('La serie seleccionada no corresponde al tipo de documento indicado');
      }
      if (idPuntoVenta && serieDoc.id_punto_venta !== idPuntoVenta) {
        throw new ForbiddenException('No puede usar series de otro punto de venta');
      }

      const nuevoCorrelativo = serieDoc.correlativo_actual + 1;
      await tx.$executeRaw`
        UPDATE tbl_series_documento
        SET correlativo_actual = ${nuevoCorrelativo}
        WHERE id::text = ${dto.id_serie_documento}
      `;
      const numeroComprobante = generarNumeroComprobante(serieDoc.serie, nuevoCorrelativo);

      const pagos = dto.pagos?.length
        ? dto.pagos
        : origen.pagos.map((p) => ({
            id_metodo_pago: p.id_metodo_pago,
            monto: Number(p.monto),
            referencia: p.referencia ?? undefined,
          }));

      const totalPagos = redondear2(pagos.reduce((s, p) => s + p.monto, 0));
      if (totalPagos < Number(origen.total)) {
        throw new BadRequestException(
          `El total de pagos (${totalPagos}) es menor al total del documento (${origen.total})`,
        );
      }

      const totalVentas = await tx.tbl_ventas.count();
      const numeroInterno = generarNumeroInterno('VTA', totalVentas + 1);

      const nueva = await tx.tbl_ventas.create({
        data: {
          numero_interno: numeroInterno,
          id_serie_documento: dto.id_serie_documento,
          tipo_documento: dto.tipo_documento as any,
          serie: serieDoc.serie,
          correlativo: nuevoCorrelativo,
          numero_comprobante: numeroComprobante,
          id_cliente: origen.id_cliente,
          id_punto_venta: idPuntoVenta,
          id_usuario_vendedor: usuarioId,
          id_caja_apertura: origen.id_caja_apertura,
          fecha_emision: new Date(),
          moneda: origen.moneda,
          tipo_cambio: origen.tipo_cambio,
          subtotal: origen.subtotal,
          igv: origen.igv,
          total: origen.total,
          observaciones: origen.observaciones,
          estado_sunat: 'pendiente',
          estado_venta: 'vigente',
          id_venta_origen: origen.id,
          afecto_stock: debeAfectarStock,
          usuario_creacion: usuarioId,
        },
      });

      await tx.tbl_detalle_ventas.createMany({
        data: origen.detalle.map((d) => ({
          id_venta: nueva.id,
          id_producto: d.id_producto,
          descripcion: d.descripcion,
          cantidad: d.cantidad,
          precio_tipo: d.precio_tipo,
          precio_unitario: d.precio_unitario,
          descuento: d.descuento,
          descuento_pct: d.descuento_pct,
          valor_unitario: d.valor_unitario,
          subtotal: d.subtotal,
          igv: d.igv,
          total: d.total,
          afecta_igv: d.afecta_igv,
        })),
      });

      if (pagos.length > 0) {
        await tx.tbl_pagos.createMany({
          data: pagos.map((p) => ({
            id_venta: nueva.id,
            id_metodo_pago: p.id_metodo_pago,
            monto: p.monto,
            referencia: p.referencia,
            fecha: new Date(),
          })),
        });
      }

      if (origen.id_caja_apertura && totalPagos > 0) {
        await tx.tbl_movimientos_caja.create({
          data: {
            id_caja_apertura: origen.id_caja_apertura,
            tipo: 'ingreso',
            concepto: `Canje ${origen.numero_comprobante} → ${numeroComprobante}`,
            monto: totalPagos,
            id_referencia: nueva.id,
            tipo_referencia: 'venta',
            id_usuario: usuarioId,
          },
        });
      }

      if (debeAfectarStock) {
        const almacen = await tx.tbl_almacenes.findFirst({
          where: { eliminado: false, estado: true, es_principal: true },
        });
        if (!almacen) throw new BadRequestException('No hay almacén principal configurado');

        for (const item of origen.detalle) {
          await this.inventarioRepo.registrarMovimientoEnTransaccion(
            {
              idProducto: item.id_producto,
              idAlmacen: almacen.id,
              tipo: 'salida',
              cantidad: Number(item.cantidad),
              motivo: `Canje ${origen.numero_comprobante} → ${numeroComprobante}`,
              idReferencia: nueva.id,
              tipoReferencia: 'venta',
              idUsuario: usuarioId,
            },
            tx as unknown as Prisma.TransactionClient,
          );
        }
      }

      await tx.tbl_ventas.update({
        where: { id: origen.id },
        data: { estado_venta: 'canjeada', usuario_modificacion: usuarioId },
      });

      return tx.tbl_ventas.findFirst({
        where: { id: nueva.id },
        include: {
          cliente: { select: { razon_social: true, numero_documento: true } },
          detalle: { include: { producto: { select: { nombre: true, codigo: true } } } },
          pagos: { include: { metodo_pago: true } },
        },
      });
    }, {
      maxWait: 15000,
      timeout: 60000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }).then((venta) => {
      this.eventEmitter.emit('venta.creada', venta);
      return venta;
    });
  }
}
