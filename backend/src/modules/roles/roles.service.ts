import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class CreateRolDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsBoolean() es_superadmin?: boolean;
  @IsOptional() @IsArray() permisos?: string[];
}

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRolDto, creadorId: string) {
    const existente = await this.prisma.tbl_roles.findFirst({
      where: { nombre: dto.nombre, eliminado: false },
    });
    if (existente) throw new ConflictException('Ya existe un rol con ese nombre');

    const rol = await this.prisma.tbl_roles.create({
      data: {
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        es_superadmin: dto.es_superadmin || false,
        usuario_creacion: creadorId,
      },
    });

    if (dto.permisos && dto.permisos.length > 0) {
      await this.prisma.tbl_roles_permisos.createMany({
        data: dto.permisos.map((permisoId) => ({
          id_rol: rol.id,
          id_permiso: permisoId,
          usuario_creacion: creadorId,
        })),
        skipDuplicates: true,
      });
    }

    return this.findOne(rol.id);
  }

  async findAll(pagination: PaginationDto) {
    const where: any = { eliminado: false };
    if (pagination.search) {
      where.nombre = { contains: pagination.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.tbl_roles.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        orderBy: { nombre: 'asc' },
        include: {
          permisos: {
            where: { eliminado: false },
            include: { permiso: true },
          },
          _count: { select: { usuarios: true } },
        },
      }),
      this.prisma.tbl_roles.count({ where }),
    ]);

    return { data, total, page: pagination.page, limit: pagination.limit };
  }

  async findOne(id: string) {
    const rol = await this.prisma.tbl_roles.findFirst({
      where: { id, eliminado: false },
      include: {
        permisos: {
          where: { eliminado: false },
          include: { permiso: true },
        },
      },
    });
    if (!rol) throw new NotFoundException('Rol no encontrado');
    return rol;
  }

  async update(id: string, dto: Partial<CreateRolDto>, modificadorId: string) {
    await this.findOne(id);

    const data: any = { usuario_modificacion: modificadorId };
    if (dto.nombre) data.nombre = dto.nombre;
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion;
    if (dto.es_superadmin !== undefined) data.es_superadmin = dto.es_superadmin;

    await this.prisma.tbl_roles.update({ where: { id }, data });

    if (dto.permisos !== undefined) {
      const deseados = new Set(dto.permisos);

      // Desactivar los permisos que ya no corresponden
      await this.prisma.tbl_roles_permisos.updateMany({
        where: { id_rol: id, id_permiso: { notIn: dto.permisos } },
        data: { eliminado: true },
      });

      // Activar (o crear) cada permiso deseado. Usar upsert en vez de createMany+skipDuplicates:
      // si el permiso ya existía soft-eliminado, skipDuplicates lo dejaría eliminado para siempre.
      for (const permisoId of deseados) {
        await this.prisma.tbl_roles_permisos.upsert({
          where: { id_rol_id_permiso: { id_rol: id, id_permiso: permisoId } },
          update: { eliminado: false },
          create: { id_rol: id, id_permiso: permisoId, usuario_creacion: modificadorId },
        });
      }
    }

    return this.findOne(id);
  }

  async remove(id: string, modificadorId: string) {
    await this.findOne(id);
    return this.prisma.tbl_roles.update({
      where: { id },
      data: { eliminado: true, estado: false, usuario_modificacion: modificadorId },
    });
  }
}
