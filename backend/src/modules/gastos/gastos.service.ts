import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { PagarGastoDto } from './dto/pagar-gasto.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { generarNumeroInterno, redondear2 } from '../../common/utils/numero-documento.util';
import { finDeDia } from '../../common/utils/fecha.util';

const INCLUDE_DETALLE = {
  proveedor: { select: { razon_social: true, ruc: true } },
  punto_venta: { select: { nombre: true } },
  usuario: { select: { nombre: true, apellido: true } },
  metodo_pago: { select: { nombre: true } },
} as const;

@Injectable()
export class GastosService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateGastoDto, usuarioId: string) {
    if (dto.id_proveedor) {
      const proveedor = await this.prisma.tbl_proveedores.findFirst({
        where: { id: dto.id_proveedor, eliminado: false },
      });
      if (!proveedor) throw new NotFoundException('Proveedor no encontrado');
    }

    const condicionPago = dto.condicion_pago || 'contado';
    if (condicionPago === 'credito' && !dto.fecha_vencimiento) {
      throw new BadRequestException('Debe indicar la fecha de vencimiento para gastos al crédito');
    }

    if (Math.abs(dto.total - (dto.subtotal + dto.igv)) > 0.05) {
      throw new BadRequestException('El total no coincide con subtotal + IGV');
    }

    const moneda = dto.moneda || 'PEN';
    const tipoCambio = moneda === 'USD' ? (dto.tipo_cambio || 1) : 1;
    const totalPen = redondear2(dto.total * tipoCambio);

    const totalGastos = await this.prisma.tbl_gastos.count();
    const numeroInterno = generarNumeroInterno('GAS', totalGastos + 1);

    const gasto = await this.prisma.tbl_gastos.create({
      data: {
        numero_interno: numeroInterno,
        categoria: dto.categoria,
        tipo_documento: dto.tipo_documento,
        serie: dto.serie,
        numero: dto.numero,
        ruc_emisor: dto.ruc_emisor,
        razon_social_emisor: dto.razon_social_emisor,
        id_proveedor: dto.id_proveedor || null,
        id_compra_relacionada: dto.id_compra_relacionada || null,
        id_punto_venta: dto.id_punto_venta || null,
        id_usuario: usuarioId,
        fecha_emision: new Date(dto.fecha_emision),
        condicion_pago: condicionPago as any,
        fecha_vencimiento: dto.fecha_vencimiento ? new Date(dto.fecha_vencimiento) : null,
        moneda: moneda as any,
        tipo_cambio: tipoCambio,
        afecta_igv: dto.afecta_igv !== false,
        subtotal: dto.subtotal,
        igv: dto.igv,
        total: dto.total,
        total_pen: totalPen,
        estado: 'registrado',
        observaciones: dto.observaciones,
        usuario_creacion: usuarioId,
      },
      include: INCLUDE_DETALLE,
    });

    return gasto;
  }

  async findAll(pagination: PaginationDto & {
    categoria?: string; estado?: string; pagado?: string;
    fecha_desde?: string; fecha_hasta?: string; id_proveedor?: string; sin_vincular?: string; id_compra_relacionada?: string;
  }) {
    const where: any = { eliminado: false };

    if (pagination.categoria) where.categoria = pagination.categoria;
    if (pagination.estado) where.estado = pagination.estado;
    if (pagination.pagado !== undefined && pagination.pagado !== '') where.pagado = pagination.pagado === 'true';
    if (pagination.id_proveedor) where.id_proveedor = pagination.id_proveedor;
    if (pagination.sin_vincular === 'true') where.id_compra_relacionada = null;
    if (pagination.id_compra_relacionada) where.id_compra_relacionada = pagination.id_compra_relacionada;

    if (pagination.search) {
      where.OR = [
        { numero_interno: { contains: pagination.search } },
        { numero: { contains: pagination.search } },
        { ruc_emisor: { contains: pagination.search } },
        { razon_social_emisor: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    if (pagination.fecha_desde || pagination.fecha_hasta) {
      where.fecha_emision = {};
      if (pagination.fecha_desde) where.fecha_emision.gte = new Date(pagination.fecha_desde);
      if (pagination.fecha_hasta) where.fecha_emision.lte = finDeDia(pagination.fecha_hasta);
    }

    const [data, total] = await Promise.all([
      this.prisma.tbl_gastos.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        orderBy: { fecha_emision: 'desc' },
        include: INCLUDE_DETALLE,
      }),
      this.prisma.tbl_gastos.count({ where }),
    ]);

    return { data, total, page: pagination.page, limit: pagination.limit };
  }

  async findOne(id: string) {
    const gasto = await this.prisma.tbl_gastos.findFirst({
      where: { id, eliminado: false },
      include: INCLUDE_DETALLE,
    });
    if (!gasto) throw new NotFoundException('Gasto no encontrado');
    return gasto;
  }

  async anular(id: string, motivo: string, usuarioId: string) {
    const gasto = await this.findOne(id);
    if (gasto.estado === 'anulado') throw new BadRequestException('El gasto ya está anulado');
    if (gasto.pagado) throw new BadRequestException('No se puede anular un gasto ya pagado');

    return this.prisma.tbl_gastos.update({
      where: { id },
      data: { estado: 'anulado', observaciones: `ANULADO: ${motivo}`, usuario_modificacion: usuarioId },
      include: INCLUDE_DETALLE,
    });
  }

  async pagar(id: string, dto: PagarGastoDto, usuarioId: string) {
    const gasto = await this.findOne(id);
    if (gasto.pagado) throw new BadRequestException('El gasto ya fue marcado como pagado');
    if (gasto.estado === 'anulado') throw new BadRequestException('No se puede pagar un gasto anulado');

    return this.prisma.$transaction(async (tx) => {
      await tx.tbl_gastos.update({
        where: { id },
        data: {
          pagado: true,
          fecha_pago: new Date(),
          id_metodo_pago: dto.id_metodo_pago,
          referencia_pago: dto.referencia,
          usuario_modificacion: usuarioId,
        },
      });

      if (dto.id_caja_apertura) {
        await tx.tbl_movimientos_caja.create({
          data: {
            id_caja_apertura: dto.id_caja_apertura,
            tipo: 'egreso',
            concepto: `Gasto ${gasto.numero_interno} - ${gasto.razon_social_emisor}`,
            monto: gasto.total_pen,
            id_referencia: id,
            tipo_referencia: 'gasto',
            id_usuario: usuarioId,
          },
        });
      }

      return tx.tbl_gastos.findFirst({ where: { id }, include: INCLUDE_DETALLE });
    });
  }
}
