import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateUnidadMedidaDto {
  @IsString() @IsNotEmpty() codigo_sunat: string;
  @IsString() @IsNotEmpty() descripcion: string;
  @IsString() @IsNotEmpty() simbolo: string;
}

@Injectable()
export class UnidadesMedidaService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUnidadMedidaDto, creadorId: string) {
    const existente = await this.prisma.tbl_unidades_medida.findFirst({
      where: { codigo_sunat: dto.codigo_sunat, eliminado: false },
    });
    if (existente) throw new ConflictException('Ya existe una unidad con ese código SUNAT');

    return this.prisma.tbl_unidades_medida.create({
      data: { ...dto, usuario_creacion: creadorId },
    });
  }

  async findAll() {
    return this.prisma.tbl_unidades_medida.findMany({
      where: { eliminado: false, estado: true },
      orderBy: { descripcion: 'asc' },
    });
  }

  async update(id: string, dto: Partial<CreateUnidadMedidaDto>, modificadorId: string) {
    const um = await this.prisma.tbl_unidades_medida.findFirst({ where: { id, eliminado: false } });
    if (!um) throw new NotFoundException('Unidad de medida no encontrada');

    return this.prisma.tbl_unidades_medida.update({
      where: { id },
      data: { ...dto, usuario_modificacion: modificadorId },
    });
  }

  async remove(id: string, modificadorId: string) {
    const um = await this.prisma.tbl_unidades_medida.findFirst({ where: { id, eliminado: false } });
    if (!um) throw new NotFoundException('Unidad de medida no encontrada');

    return this.prisma.tbl_unidades_medida.update({
      where: { id },
      data: { eliminado: true, estado: false, usuario_modificacion: modificadorId },
    });
  }
}
