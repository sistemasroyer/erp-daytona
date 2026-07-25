import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateMarcaDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsOptional() @IsString() descripcion?: string;
}

@Injectable()
export class MarcasService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMarcaDto, creadorId: string) {
    const existente = await this.prisma.tbl_marcas.findFirst({
      where: { nombre: dto.nombre, eliminado: false },
    });
    if (existente) throw new ConflictException('Ya existe una marca con ese nombre');

    return this.prisma.tbl_marcas.create({ data: { ...dto, usuario_creacion: creadorId } });
  }

  async findAll(pagination: PaginationDto) {
    const where: any = { eliminado: false };
    if (pagination.search) {
      where.nombre = { contains: pagination.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.tbl_marcas.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        orderBy: { nombre: 'asc' },
        include: { _count: { select: { productos: true } } },
      }),
      this.prisma.tbl_marcas.count({ where }),
    ]);

    return { data, total, page: pagination.page, limit: pagination.limit };
  }

  async update(id: string, dto: Partial<CreateMarcaDto>, modificadorId: string) {
    const marca = await this.prisma.tbl_marcas.findFirst({ where: { id, eliminado: false } });
    if (!marca) throw new NotFoundException('Marca no encontrada');

    return this.prisma.tbl_marcas.update({
      where: { id },
      data: { ...dto, usuario_modificacion: modificadorId },
    });
  }

  async remove(id: string, modificadorId: string) {
    const marca = await this.prisma.tbl_marcas.findFirst({ where: { id, eliminado: false } });
    if (!marca) throw new NotFoundException('Marca no encontrada');

    return this.prisma.tbl_marcas.update({
      where: { id },
      data: { eliminado: true, estado: false, usuario_modificacion: modificadorId },
    });
  }
}
