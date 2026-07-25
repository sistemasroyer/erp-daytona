import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { Permisos } from '../../common/decorators/permisos.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Facturación SUNAT')
@ApiBearerAuth()
@Controller('facturacion')
export class FacturacionController {
  constructor(private prisma: PrismaService) {}

  @Get('envios')
  @Permisos('facturacion:ver')
  @ApiOperation({ summary: 'Listar envíos a SUNAT' })
  async getEnvios(@Query() pagination: PaginationDto & { estado?: string }) {
    const where: any = {};
    if (pagination.estado) where.estado = pagination.estado;

    const [data, total] = await Promise.all([
      this.prisma.tbl_sunat_envios.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        orderBy: { fecha_creacion: 'desc' },
        include: {
          venta: { select: { numero_comprobante: true, total: true } },
          respuestas: { orderBy: { fecha_respuesta: 'desc' }, take: 1 },
        },
      }),
      this.prisma.tbl_sunat_envios.count({ where }),
    ]);

    return { data, total, page: pagination.page, limit: pagination.limit };
  }

  @Get('envios/:id')
  @Permisos('facturacion:ver')
  @ApiOperation({ summary: 'Detalle de un envío SUNAT' })
  async getEnvio(@Param('id') id: string) {
    return this.prisma.tbl_sunat_envios.findFirst({
      where: { id },
      include: {
        venta: {
          select: {
            numero_comprobante: true, fecha_emision: true,
            cliente: { select: { razon_social: true } },
            total: true,
          },
        },
        respuestas: { orderBy: { fecha_respuesta: 'desc' } },
      },
    });
  }

  @Get('resumen')
  @Permisos('facturacion:ver')
  @ApiOperation({ summary: 'Resumen de estados SUNAT' })
  async getResumen() {
    const estados = ['pendiente', 'enviado', 'aceptado', 'rechazado', 'error'];
    const resumen: Record<string, number> = {};

    for (const estado of estados) {
      resumen[estado] = await this.prisma.tbl_sunat_envios.count({ where: { estado: estado as any } });
    }

    return resumen;
  }
}
