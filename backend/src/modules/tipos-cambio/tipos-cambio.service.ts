import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { IsDateString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';

export class CreateTipoCambioDto {
  @IsDateString() fecha: string;
  @IsNumber() @Min(0.0001) compra: number;
  @IsNumber() @Min(0.0001) venta: number;
  @IsOptional() @IsEnum(['manual', 'sunat']) fuente?: 'manual' | 'sunat';
}

@Injectable()
export class TiposCambioService {
  constructor(private prisma: PrismaService) {}

  async findAll(limit = 60) {
    return this.prisma.tbl_tipos_cambio.findMany({
      where: { eliminado: false },
      orderBy: { fecha: 'desc' },
      take: limit,
    });
  }

  async findHoy() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return this.prisma.tbl_tipos_cambio.findFirst({
      where: { eliminado: false, fecha: { gte: hoy } },
      orderBy: { fecha: 'desc' },
    });
  }

  async create(dto: CreateTipoCambioDto, usuarioId: string) {
    // No usar `new Date(dto.fecha)`: para un string "YYYY-MM-DD" el motor de JS lo
    // interpreta como medianoche UTC, y luego setHours(0,0,0,0) lo reinterpreta en la
    // zona horaria local del servidor, pudiendo correr la fecha guardada un día hacia atrás.
    const [anio, mes, dia] = dto.fecha.split('-').map(Number);
    const fecha = new Date(anio, mes - 1, dia);

    const existente = await this.prisma.tbl_tipos_cambio.findFirst({
      where: { fecha, eliminado: false },
    });
    if (existente) throw new ConflictException('Ya existe un tipo de cambio para esa fecha');

    return this.prisma.tbl_tipos_cambio.create({
      data: {
        fecha,
        compra: dto.compra,
        venta: dto.venta,
        fuente: (dto.fuente || 'manual') as any,
        usuario_creacion: usuarioId,
      },
    });
  }

  async update(id: string, dto: Partial<CreateTipoCambioDto>, usuarioId: string) {
    const tc = await this.prisma.tbl_tipos_cambio.findFirst({ where: { id, eliminado: false } });
    if (!tc) throw new NotFoundException('Tipo de cambio no encontrado');

    const data: any = { usuario_modificacion: usuarioId };
    if (dto.compra !== undefined) data.compra = dto.compra;
    if (dto.venta !== undefined) data.venta = dto.venta;
    if (dto.fuente) data.fuente = dto.fuente;

    return this.prisma.tbl_tipos_cambio.update({ where: { id }, data });
  }

  async remove(id: string, usuarioId: string) {
    const tc = await this.prisma.tbl_tipos_cambio.findFirst({ where: { id, eliminado: false } });
    if (!tc) throw new NotFoundException('Tipo de cambio no encontrado');
    return this.prisma.tbl_tipos_cambio.update({
      where: { id },
      data: { eliminado: true, estado: false, usuario_modificacion: usuarioId },
    });
  }
}
