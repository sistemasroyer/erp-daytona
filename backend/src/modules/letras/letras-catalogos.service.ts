import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { aMayusculas } from '../../common/utils/texto.util';
import { aFecha, serializarFechas } from './fechas';
import { BancoDto, DiaNoPagoDto, GuardarLimitesDto, UpdateBancoDto, UpdateDiaNoPagoDto } from './dto/catalogos.dto';

/** Catálogos propios de Letras: bancos, días de no pago y límites de pago por día de la semana. */
@Injectable()
export class LetrasCatalogosService {
  constructor(private prisma: PrismaService) {}

  // ─── Bancos ────────────────────────────────────────────────────────────────
  listarBancos() {
    return this.prisma.tbl_bancos.findMany({ where: { eliminado: false }, orderBy: { nombre: 'asc' } });
  }

  async crearBanco(dto: BancoDto, usuarioId: string) {
    dto = aMayusculas(dto, ['nombre', 'siglas', 'descripcion']);
    await this.assertBancoUnico(dto.nombre);
    return this.prisma.tbl_bancos.create({ data: { ...dto, usuario_creacion: usuarioId } });
  }

  async actualizarBanco(id: string, dto: UpdateBancoDto, usuarioId: string) {
    dto = aMayusculas(dto, ['nombre', 'siglas', 'descripcion']);
    await this.obtenerBanco(id);
    if (dto.nombre) await this.assertBancoUnico(dto.nombre, id);
    return this.prisma.tbl_bancos.update({ where: { id }, data: { ...dto, usuario_modificacion: usuarioId } });
  }

  async eliminarBanco(id: string, usuarioId: string) {
    await this.obtenerBanco(id);
    const enUso = await this.prisma.tbl_letras_paquetes.count({ where: { id_banco: id, eliminado: false } });
    if (enUso > 0) throw new BadRequestException(`El banco está asignado a ${enUso} paquete(s); desactívelo en vez de eliminarlo`);
    return this.prisma.tbl_bancos.update({ where: { id }, data: { eliminado: true, usuario_modificacion: usuarioId } });
  }

  private async obtenerBanco(id: string) {
    const banco = await this.prisma.tbl_bancos.findFirst({ where: { id, eliminado: false } });
    if (!banco) throw new NotFoundException('Banco no encontrado');
    return banco;
  }

  private async assertBancoUnico(nombre: string, excluirId?: string) {
    const existe = await this.prisma.tbl_bancos.findFirst({
      where: { nombre: { equals: nombre, mode: 'insensitive' }, eliminado: false, ...(excluirId ? { id: { not: excluirId } } : {}) },
    });
    if (existe) throw new ConflictException('Ya existe un banco con ese nombre');
  }

  // ─── Días de no pago ───────────────────────────────────────────────────────
  async listarDiasNoPago(anio?: number) {
    const where = anio
      ? { eliminado: false, fecha: { gte: aFecha(`${anio}-01-01`), lte: aFecha(`${anio}-12-31`) } }
      : { eliminado: false };
    return serializarFechas(await this.prisma.tbl_dias_no_pago.findMany({ where, orderBy: { fecha: 'asc' } }));
  }

  async crearDiaNoPago(dto: DiaNoPagoDto, usuarioId: string) {
    dto = aMayusculas(dto, ['descripcion']);
    await this.assertFechaUnica(dto.fecha);
    return serializarFechas(await this.prisma.tbl_dias_no_pago.create({
      data: { ...dto, fecha: aFecha(dto.fecha), usuario_creacion: usuarioId },
    }));
  }

  async actualizarDiaNoPago(id: string, dto: UpdateDiaNoPagoDto, usuarioId: string) {
    dto = aMayusculas(dto, ['descripcion']);
    const dia = await this.prisma.tbl_dias_no_pago.findFirst({ where: { id, eliminado: false } });
    if (!dia) throw new NotFoundException('Día no encontrado');
    if (dto.fecha) await this.assertFechaUnica(dto.fecha, id);
    return serializarFechas(await this.prisma.tbl_dias_no_pago.update({
      where: { id },
      data: { ...dto, ...(dto.fecha ? { fecha: aFecha(dto.fecha) } : {}), usuario_modificacion: usuarioId },
    }));
  }

  async eliminarDiaNoPago(id: string, usuarioId: string) {
    const dia = await this.prisma.tbl_dias_no_pago.findFirst({ where: { id, eliminado: false } });
    if (!dia) throw new NotFoundException('Día no encontrado');
    await this.prisma.tbl_dias_no_pago.update({ where: { id }, data: { eliminado: true, usuario_modificacion: usuarioId } });
    return { id };
  }

  private async assertFechaUnica(fecha: string, excluirId?: string) {
    const existe = await this.prisma.tbl_dias_no_pago.findFirst({
      where: { fecha: aFecha(fecha), eliminado: false, ...(excluirId ? { id: { not: excluirId } } : {}) },
    });
    if (existe) throw new ConflictException('Esa fecha ya está registrada como día de no pago');
  }

  // ─── Límites de pago por día de la semana ─────────────────────────────────
  listarLimites() {
    return this.prisma.tbl_limites_pago_dia.findMany({
      where: { eliminado: false }, orderBy: [{ moneda: 'asc' }, { dia_semana: 'asc' }],
    });
  }

  /** Reemplaza los límites de una moneda: un registro activo por día; vacío/0 = sin límite propio. */
  async guardarLimites(dto: GuardarLimitesDto, usuarioId: string) {
    const dias = new Set(dto.dias.map((d) => d.dia_semana));
    if (dias.size !== dto.dias.length) throw new BadRequestException('Hay días de la semana repetidos');
    return this.prisma.$transaction(async (tx) => {
      await tx.tbl_limites_pago_dia.updateMany({
        where: { moneda: dto.moneda, eliminado: false },
        data: { eliminado: true, usuario_modificacion: usuarioId },
      });
      const nuevos = dto.dias.filter((d) => d.monto_maximo && d.monto_maximo > 0);
      if (nuevos.length) {
        await tx.tbl_limites_pago_dia.createMany({
          data: nuevos.map((d) => ({ dia_semana: d.dia_semana, moneda: dto.moneda, monto_maximo: d.monto_maximo!, usuario_creacion: usuarioId })),
        });
      }
      return tx.tbl_limites_pago_dia.findMany({ where: { eliminado: false }, orderBy: [{ moneda: 'asc' }, { dia_semana: 'asc' }] });
    });
  }
}
