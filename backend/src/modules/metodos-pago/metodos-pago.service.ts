import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MetodosPagoService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tbl_metodos_pago.findMany({
      where: { eliminado: false, activo: true },
      orderBy: { nombre: 'asc' },
    });
  }
}
