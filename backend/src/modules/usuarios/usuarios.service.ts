import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class UsuariosService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async create(dto: CreateUsuarioDto, creadorId: string) {
    const existente = await this.prisma.tbl_usuarios.findFirst({
      where: { email: dto.email, eliminado: false },
    });
    if (existente) throw new ConflictException('El email ya está registrado');

    const rounds = this.configService.get<number>('security.bcryptRounds') || 12;
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const usuario = await this.prisma.tbl_usuarios.create({
      data: {
        email: dto.email,
        password_hash: passwordHash,
        nombre: dto.nombre,
        apellido: dto.apellido,
        dni: dto.dni,
        telefono: dto.telefono,
        id_punto_venta: dto.id_punto_venta,
        usuario_creacion: creadorId,
      },
    });

    if (dto.roles && dto.roles.length > 0) {
      await this.prisma.tbl_usuarios_roles.createMany({
        data: dto.roles.map((rolId) => ({
          id_usuario: usuario.id,
          id_rol: rolId,
          usuario_creacion: creadorId,
        })),
        skipDuplicates: true,
      });
    }

    return this.findOne(usuario.id);
  }

  async findAll(pagination: PaginationDto) {
    const where: any = { eliminado: false };
    if (pagination.search) {
      where.OR = [
        { nombre: { contains: pagination.search, mode: 'insensitive' } },
        { apellido: { contains: pagination.search, mode: 'insensitive' } },
        { email: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.tbl_usuarios.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        orderBy: { fecha_creacion: 'desc' },
        select: {
          id: true,
          email: true,
          nombre: true,
          apellido: true,
          dni: true,
          telefono: true,
          estado: true,
          ultimo_acceso: true,
          fecha_creacion: true,
          punto_venta: { select: { id: true, nombre: true } },
          roles: {
            where: { eliminado: false },
            include: { rol: { select: { id: true, nombre: true } } },
          },
        },
      }),
      this.prisma.tbl_usuarios.count({ where }),
    ]);

    return { data, total, page: pagination.page, limit: pagination.limit };
  }

  async findOne(id: string) {
    const usuario = await this.prisma.tbl_usuarios.findFirst({
      where: { id, eliminado: false },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        dni: true,
        telefono: true,
        estado: true,
        ultimo_acceso: true,
        fecha_creacion: true,
        fecha_modificacion: true,
        punto_venta: { select: { id: true, nombre: true } },
        roles: {
          where: { eliminado: false },
          include: {
            rol: {
              include: {
                permisos: {
                  where: { eliminado: false },
                  include: { permiso: true },
                },
              },
            },
          },
        },
      },
    });

    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    return usuario;
  }

  async update(id: string, dto: Partial<CreateUsuarioDto>, modificadorId: string) {
    await this.findOne(id);

    const data: any = {
      usuario_modificacion: modificadorId,
    };

    if (dto.nombre) data.nombre = dto.nombre;
    if (dto.apellido) data.apellido = dto.apellido;
    if (dto.dni !== undefined) data.dni = dto.dni;
    if (dto.telefono !== undefined) data.telefono = dto.telefono;
    if (dto.id_punto_venta !== undefined) data.id_punto_venta = dto.id_punto_venta;

    if (dto.password) {
      const rounds = this.configService.get<number>('security.bcryptRounds') || 12;
      data.password_hash = await bcrypt.hash(dto.password, rounds);
    }

    await this.prisma.tbl_usuarios.update({ where: { id }, data });

    if (dto.roles !== undefined) {
      const deseados = new Set(dto.roles);

      // Desactivar los roles que ya no corresponden
      await this.prisma.tbl_usuarios_roles.updateMany({
        where: { id_usuario: id, id_rol: { notIn: dto.roles } },
        data: { eliminado: true },
      });

      // Activar (o crear) cada rol deseado. Usar upsert en vez de createMany+skipDuplicates:
      // si el rol ya existía soft-eliminado, skipDuplicates lo dejaría eliminado para siempre.
      for (const rolId of deseados) {
        await this.prisma.tbl_usuarios_roles.upsert({
          where: { id_usuario_id_rol: { id_usuario: id, id_rol: rolId } },
          update: { eliminado: false },
          create: { id_usuario: id, id_rol: rolId, usuario_creacion: modificadorId },
        });
      }
    }

    return this.findOne(id);
  }

  async toggleEstado(id: string, modificadorId: string) {
    const usuario = await this.findOne(id);
    return this.prisma.tbl_usuarios.update({
      where: { id },
      data: { estado: !usuario.estado, usuario_modificacion: modificadorId },
    });
  }

  async remove(id: string, modificadorId: string) {
    await this.findOne(id);
    return this.prisma.tbl_usuarios.update({
      where: { id },
      data: { eliminado: true, estado: false, usuario_modificacion: modificadorId },
    });
  }
}
