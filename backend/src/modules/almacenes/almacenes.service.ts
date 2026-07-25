import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUUID } from 'class-validator';

export class CreateAlmacenDto {
  @IsUUID() id_empresa: string;
  @IsString() @IsNotEmpty() nombre: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsBoolean() es_principal?: boolean;
}

@Injectable()
export class AlmacenesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAlmacenDto, creadorId: string) {
    if (dto.es_principal) {
      await this.prisma.tbl_almacenes.updateMany({
        where: { id_empresa: dto.id_empresa, es_principal: true },
        data: { es_principal: false },
      });
    }

    return this.prisma.tbl_almacenes.create({
      data: { ...dto, usuario_creacion: creadorId },
    });
  }

  async findAll(pagination: PaginationDto) {
    const where: any = { eliminado: false };
    if (pagination.search) {
      where.nombre = { contains: pagination.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.tbl_almacenes.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        orderBy: [{ es_principal: 'desc' }, { nombre: 'asc' }],
        include: { empresa: { select: { id: true, razon_social: true } } },
      }),
      this.prisma.tbl_almacenes.count({ where }),
    ]);

    return { data, total, page: pagination.page, limit: pagination.limit };
  }

  async findOne(id: string) {
    const almacen = await this.prisma.tbl_almacenes.findFirst({
      where: { id, eliminado: false },
      include: { empresa: { select: { id: true, razon_social: true } } },
    });
    if (!almacen) throw new NotFoundException('Almacén no encontrado');
    return almacen;
  }

  async update(id: string, dto: Partial<CreateAlmacenDto>, modificadorId: string) {
    const almacen = await this.findOne(id);

    if (dto.es_principal) {
      await this.prisma.tbl_almacenes.updateMany({
        where: { id_empresa: almacen.id_empresa, es_principal: true, id: { not: id } },
        data: { es_principal: false },
      });
    }

    return this.prisma.tbl_almacenes.update({
      where: { id },
      data: { ...dto, usuario_modificacion: modificadorId },
    });
  }

  async remove(id: string, modificadorId: string) {
    await this.findOne(id);
    return this.prisma.tbl_almacenes.update({
      where: { id },
      data: { eliminado: true, estado: false, usuario_modificacion: modificadorId },
    });
  }
}
