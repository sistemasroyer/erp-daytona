import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ConfigMargenesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tbl_config_margenes.findMany({
      orderBy: { numero: 'asc' },
    });
  }

  async findActivos() {
    return this.prisma.tbl_config_margenes.findMany({
      where: { activo: true },
      orderBy: { numero: 'asc' },
    });
  }

  async update(numero: number, dto: { nombre?: string; margen?: number; activo?: boolean; descripcion?: string }) {
    const existente = await this.prisma.tbl_config_margenes.findUnique({
      where: { numero },
    });
    if (!existente) throw new NotFoundException(`Configuración de precio ${numero} no encontrada`);

    return this.prisma.tbl_config_margenes.update({
      where: { numero },
      data: {
        nombre: dto.nombre,
        margen: dto.margen !== undefined ? dto.margen : undefined,
        activo: dto.activo !== undefined ? dto.activo : undefined,
        descripcion: dto.descripcion,
      },
    });
  }
}
