import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PermisosService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const permisos = await this.prisma.tbl_permisos.findMany({
      where: { eliminado: false },
      orderBy: [{ modulo: 'asc' }, { accion: 'asc' }],
    });

    const agrupados = permisos.reduce((acc: any, permiso) => {
      if (!acc[permiso.modulo]) acc[permiso.modulo] = [];
      acc[permiso.modulo].push(permiso);
      return acc;
    }, {});

    return agrupados;
  }

  async findAllFlat() {
    return this.prisma.tbl_permisos.findMany({
      where: { eliminado: false },
      orderBy: [{ modulo: 'asc' }, { accion: 'asc' }],
    });
  }

  async findOne(id: string) {
    const permiso = await this.prisma.tbl_permisos.findFirst({
      where: { id, eliminado: false },
    });
    if (!permiso) throw new NotFoundException('Permiso no encontrado');
    return permiso;
  }
}
