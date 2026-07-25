import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateCategoriaDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsOptional() @IsString() descripcion?: string;
}

export class CreateSubcategoriaDto {
  @IsUUID() id_categoria: string;
  @IsString() @IsNotEmpty() nombre: string;
  @IsOptional() @IsString() descripcion?: string;
}

@Injectable()
export class CategoriasService {
  constructor(private prisma: PrismaService) {}

  async createCategoria(dto: CreateCategoriaDto, creadorId: string) {
    const existente = await this.prisma.tbl_categorias.findFirst({
      where: { nombre: dto.nombre, eliminado: false },
    });
    if (existente) throw new ConflictException('Ya existe una categoría con ese nombre');

    return this.prisma.tbl_categorias.create({
      data: { ...dto, usuario_creacion: creadorId },
    });
  }

  async findAllCategorias(pagination: PaginationDto) {
    const where: any = { eliminado: false };
    if (pagination.search) {
      where.nombre = { contains: pagination.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.tbl_categorias.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        orderBy: { nombre: 'asc' },
        include: {
          subcategorias: { where: { eliminado: false }, orderBy: { nombre: 'asc' } },
          _count: { select: { productos: true } },
        },
      }),
      this.prisma.tbl_categorias.count({ where }),
    ]);

    return { data, total, page: pagination.page, limit: pagination.limit };
  }

  async updateCategoria(id: string, dto: Partial<CreateCategoriaDto>, modificadorId: string) {
    const cat = await this.prisma.tbl_categorias.findFirst({ where: { id, eliminado: false } });
    if (!cat) throw new NotFoundException('Categoría no encontrada');

    return this.prisma.tbl_categorias.update({
      where: { id },
      data: { ...dto, usuario_modificacion: modificadorId },
    });
  }

  async removeCategoria(id: string, modificadorId: string) {
    const cat = await this.prisma.tbl_categorias.findFirst({ where: { id, eliminado: false } });
    if (!cat) throw new NotFoundException('Categoría no encontrada');

    return this.prisma.tbl_categorias.update({
      where: { id },
      data: { eliminado: true, estado: false, usuario_modificacion: modificadorId },
    });
  }

  async createSubcategoria(dto: CreateSubcategoriaDto, creadorId: string) {
    const categoria = await this.prisma.tbl_categorias.findFirst({
      where: { id: dto.id_categoria, eliminado: false },
    });
    if (!categoria) throw new NotFoundException('Categoría no encontrada');

    return this.prisma.tbl_subcategorias.create({
      data: { ...dto, usuario_creacion: creadorId },
    });
  }

  async findSubcategorias(idCategoria: string) {
    return this.prisma.tbl_subcategorias.findMany({
      where: { id_categoria: idCategoria, eliminado: false },
      orderBy: { nombre: 'asc' },
    });
  }

  async updateSubcategoria(id: string, dto: Partial<CreateSubcategoriaDto>, modificadorId: string) {
    const sub = await this.prisma.tbl_subcategorias.findFirst({ where: { id, eliminado: false } });
    if (!sub) throw new NotFoundException('Subcategoría no encontrada');

    return this.prisma.tbl_subcategorias.update({
      where: { id },
      data: { ...dto, usuario_modificacion: modificadorId },
    });
  }
}
