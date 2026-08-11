import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { generarNumeroInterno } from '../../common/utils/numero-documento.util';
import { AgregarItemTomaDto } from './dto/agregar-item-toma.dto';

const INCLUDE_CABECERA = {
  almacen: { select: { nombre: true } },
  usuario: { select: { nombre: true, apellido: true } },
} as const;

const INCLUDE_DETALLE_PRODUCTO = {
  producto: { select: { codigo: true, nombre: true, ubicacion: true, unidad_medida: { select: { simbolo: true } } } },
} as const;

@Injectable()
export class TomaInventarioService {
  constructor(private prisma: PrismaService) {}

  async crear(usuarioId: string) {
    const almacen = await this.prisma.tbl_almacenes.findFirst({ where: { es_principal: true, eliminado: false } });
    if (!almacen) throw new NotFoundException('No hay un almacén principal configurado');

    const total = await this.prisma.tbl_tomas_inventario.count();
    const numeroInterno = generarNumeroInterno('TI', total + 1);

    return this.prisma.tbl_tomas_inventario.create({
      data: {
        numero_interno: numeroInterno,
        id_almacen: almacen.id,
        id_usuario: usuarioId,
        usuario_creacion: usuarioId,
      },
      include: INCLUDE_CABECERA,
    });
  }

  async findAll(pagination: PaginationDto & { estado?: string }) {
    const where: any = { eliminado: false };
    if (pagination.estado) where.estado = pagination.estado;

    const [data, total] = await Promise.all([
      this.prisma.tbl_tomas_inventario.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        orderBy: { fecha_inicio: 'desc' },
        include: { ...INCLUDE_CABECERA, detalle: { select: { id: true } } },
      }),
      this.prisma.tbl_tomas_inventario.count({ where }),
    ]);

    return { data, total, page: pagination.page, limit: pagination.limit };
  }

  async findOne(id: string) {
    const toma = await this.prisma.tbl_tomas_inventario.findFirst({
      where: { id, eliminado: false },
      include: {
        ...INCLUDE_CABECERA,
        detalle: { include: INCLUDE_DETALLE_PRODUCTO, orderBy: { fecha_conteo: 'asc' } },
      },
    });
    if (!toma) throw new NotFoundException('Toma de inventario no encontrada');
    return toma;
  }

  private async getTomaEnProceso(id: string) {
    const toma = await this.prisma.tbl_tomas_inventario.findFirst({ where: { id, eliminado: false } });
    if (!toma) throw new NotFoundException('Toma de inventario no encontrada');
    if (toma.estado !== 'en_proceso') throw new BadRequestException('La toma de inventario ya no está en proceso');
    return toma;
  }

  async agregarItem(idToma: string, dto: AgregarItemTomaDto, usuarioId: string) {
    const toma = await this.getTomaEnProceso(idToma);

    const producto = await this.prisma.tbl_productos.findFirst({ where: { id: dto.id_producto, eliminado: false } });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const stockSistema = Number(producto.stock_actual);
    const diferencia = dto.cantidad_contada - stockSistema;

    await this.prisma.tbl_detalle_tomas_inventario.upsert({
      where: { id_toma_id_producto: { id_toma: toma.id, id_producto: dto.id_producto } },
      update: { cantidad_contada: dto.cantidad_contada, stock_sistema: stockSistema, diferencia, fecha_conteo: new Date() },
      create: {
        id_toma: toma.id,
        id_producto: dto.id_producto,
        stock_sistema: stockSistema,
        cantidad_contada: dto.cantidad_contada,
        diferencia,
      },
    });

    return this.findOne(idToma);
  }

  async quitarItem(idToma: string, idProducto: string) {
    await this.getTomaEnProceso(idToma);
    await this.prisma.tbl_detalle_tomas_inventario.deleteMany({ where: { id_toma: idToma, id_producto: idProducto } });
    return this.findOne(idToma);
  }

  /** Finaliza la sesión de conteo: congela el stock del sistema y la diferencia de cada línea
   * con su valor más reciente, y bloquea la toma para más ediciones. No modifica el stock real
   * — es solo un registro/reporte del conteo físico, la corrección (si se decide aplicar) se
   * hace aparte, a mano, vía Ajustes de Inventario. */
  async finalizar(idToma: string, usuarioId: string) {
    const toma = await this.prisma.tbl_tomas_inventario.findFirst({
      where: { id: idToma, eliminado: false },
      include: { detalle: true },
    });
    if (!toma) throw new NotFoundException('Toma de inventario no encontrada');
    if (toma.estado !== 'en_proceso') throw new BadRequestException('La toma de inventario ya no está en proceso');
    if (toma.detalle.length === 0) throw new BadRequestException('Agregue al menos un producto contado antes de finalizar');

    return this.prisma.$transaction(async (tx) => {
      for (const linea of toma.detalle) {
        const producto = await tx.tbl_productos.findFirst({ where: { id: linea.id_producto } });
        const stockActual = Number(producto?.stock_actual || 0);
        const diferenciaFinal = Number(linea.cantidad_contada) - stockActual;

        await tx.tbl_detalle_tomas_inventario.update({
          where: { id: linea.id },
          data: { stock_sistema: stockActual, diferencia: diferenciaFinal },
        });
      }

      await tx.tbl_tomas_inventario.update({
        where: { id: toma.id },
        data: { estado: 'finalizada', fecha_finalizacion: new Date(), usuario_modificacion: usuarioId },
      });

      return tx.tbl_tomas_inventario.findFirst({
        where: { id: toma.id },
        include: { ...INCLUDE_CABECERA, detalle: { include: INCLUDE_DETALLE_PRODUCTO } },
      });
    });
  }

  async anular(idToma: string, usuarioId: string) {
    const toma = await this.getTomaEnProceso(idToma);
    return this.prisma.tbl_tomas_inventario.update({
      where: { id: toma.id },
      data: { estado: 'anulada', usuario_modificacion: usuarioId },
      include: INCLUDE_CABECERA,
    });
  }
}
