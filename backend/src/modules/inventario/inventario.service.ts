import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { IsString, IsNotEmpty, IsEnum, IsNumber, Min, IsOptional } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { InventarioRepository } from './inventario.repository';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class AjusteInventarioDto {
  @IsString() @IsNotEmpty() id_producto: string;
  @IsString() @IsNotEmpty() id_almacen: string;
  @IsEnum(['ajuste_positivo', 'ajuste_negativo']) tipo: 'ajuste_positivo' | 'ajuste_negativo';
  @IsNumber() @Min(0.0001) cantidad: number;
  @IsString() @IsNotEmpty() motivo: string;
  @IsOptional() @IsNumber() @Min(0) costo_unitario?: number;
}

export class InicializarStockDto {
  @IsString() @IsNotEmpty() id_producto: string;
  @IsString() @IsNotEmpty() id_almacen: string;
  @IsNumber() @Min(0.0001) cantidad: number;
  @IsOptional() @IsNumber() @Min(0) costo_unitario?: number;
}

@Injectable()
export class InventarioService {
  constructor(
    private prisma: PrismaService,
    private inventarioRepo: InventarioRepository,
  ) {}

  async getStock(idProducto: string, idAlmacen?: string) {
    const where: any = { id_producto: idProducto, eliminado: false };
    if (idAlmacen) where.id_almacen = idAlmacen;

    return this.prisma.tbl_inventario.findMany({
      where,
      include: {
        almacen: { select: { id: true, nombre: true } },
        producto: {
          select: {
            id: true, nombre: true, codigo: true,
            stock_minimo: true, stock_maximo: true,
            unidad_medida: { select: { simbolo: true } },
          },
        },
      },
    });
  }

  async listarInventario(pagination: PaginationDto & { id_almacen?: string; bajo_minimo?: boolean }) {
    const where: any = { eliminado: false };
    if (pagination.id_almacen) where.id_almacen = pagination.id_almacen;

    if (pagination.search) {
      where.producto = {
        OR: [
          { nombre: { contains: pagination.search, mode: 'insensitive' } },
          { codigo: { contains: pagination.search, mode: 'insensitive' } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.tbl_inventario.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        include: {
          producto: {
            select: {
              id: true, codigo: true, nombre: true,
              stock_minimo: true, stock_maximo: true,
              precio_venta_1: true,
              unidad_medida: { select: { simbolo: true } },
            },
          },
          almacen: { select: { id: true, nombre: true } },
        },
        orderBy: { producto: { nombre: 'asc' } },
      }),
      this.prisma.tbl_inventario.count({ where }),
    ]);

    return { data, total, page: pagination.page, limit: pagination.limit };
  }

  async ajustar(dto: AjusteInventarioDto, usuarioId: string) {
    const producto = await this.prisma.tbl_productos.findFirst({
      where: { id: dto.id_producto, eliminado: false },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const almacen = await this.prisma.tbl_almacenes.findFirst({
      where: { id: dto.id_almacen, eliminado: false },
    });
    if (!almacen) throw new NotFoundException('Almacén no encontrado');

    if (dto.cantidad <= 0) throw new BadRequestException('La cantidad debe ser mayor a 0');

    return this.inventarioRepo.registrarMovimiento({
      idProducto: dto.id_producto,
      idAlmacen: dto.id_almacen,
      tipo: dto.tipo,
      cantidad: dto.cantidad,
      costoUnitario: dto.costo_unitario || Number(producto.costo_promedio),
      motivo: dto.motivo,
      idReferencia: undefined,
      tipoReferencia: 'ajuste',
      idUsuario: usuarioId,
    });
  }

  async inicializarStock(dto: InicializarStockDto, usuarioId: string) {
    const existente = await this.prisma.tbl_inventario.findFirst({
      where: {
        id_producto: dto.id_producto,
        id_almacen: dto.id_almacen,
        eliminado: false,
      },
    });

    if (existente && Number(existente.stock_actual) > 0) {
      throw new BadRequestException('El producto ya tiene stock. Use ajuste.');
    }

    return this.inventarioRepo.registrarMovimiento({
      idProducto: dto.id_producto,
      idAlmacen: dto.id_almacen,
      tipo: 'entrada',
      cantidad: dto.cantidad,
      costoUnitario: dto.costo_unitario || 0,
      motivo: 'Inventario inicial',
      tipoReferencia: 'inventario_inicial',
      idUsuario: usuarioId,
    });
  }

  async getMovimientos(
    idProducto: string,
    idAlmacen?: string,
    fechaDesde?: Date,
    fechaHasta?: Date,
  ) {
    const where: any = { id_producto: idProducto };
    if (idAlmacen) where.id_almacen = idAlmacen;
    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) where.fecha.gte = fechaDesde;
      if (fechaHasta) where.fecha.lte = fechaHasta;
    }

    return this.prisma.tbl_movimientos_inventario.findMany({
      where,
      orderBy: { fecha: 'desc' },
      take: 200,
    });
  }

  async getKardex(
    idProducto: string,
    idAlmacen?: string,
    fechaDesde?: string,
    fechaHasta?: string,
  ) {
    return this.inventarioRepo.obtenerKardex(
      idProducto,
      idAlmacen,
      fechaDesde ? new Date(fechaDesde) : undefined,
      fechaHasta ? new Date(fechaHasta) : undefined,
    );
  }
}
