import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { IsString, IsNotEmpty, IsNumber, Min, IsOptional } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { InventarioRepository } from './inventario.repository';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { finDeDia } from '../../common/utils/fecha.util';
import { generarNumeroInterno } from '../../common/utils/numero-documento.util';
import { CreateAjusteInventarioDto, MOTIVO_AJUSTE_LABEL } from './dto/ajuste-inventario.dto';
import { Prisma } from '@prisma/client';

export class InicializarStockDto {
  @IsString() @IsNotEmpty() id_producto: string;
  @IsString() @IsNotEmpty() id_almacen: string;
  @IsNumber() @Min(0.0001) cantidad: number;
  @IsOptional() @IsNumber() @Min(0) costo_unitario?: number;
}

export class TransferenciaInventarioDto {
  @IsString() @IsNotEmpty() id_producto: string;
  @IsString() @IsNotEmpty() id_almacen_origen: string;
  @IsString() @IsNotEmpty() id_almacen_destino: string;
  @IsNumber() @Min(0.0001) cantidad: number;
  @IsOptional() @IsString() motivo?: string;
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
              precio_venta_1: true, costo_promedio: true,
              categoria: { select: { nombre: true } },
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

  async crearAjuste(dto: CreateAjusteInventarioDto, usuarioId: string) {
    const almacen = await this.prisma.tbl_almacenes.findFirst({
      where: { id: dto.id_almacen, eliminado: false },
    });
    if (!almacen) throw new NotFoundException('Almacén no encontrado');

    if (!dto.detalle || dto.detalle.length === 0) {
      throw new BadRequestException('Debe incluir al menos un producto en el ajuste');
    }

    const motivoLabel = MOTIVO_AJUSTE_LABEL[dto.motivo];

    return this.prisma.$transaction(async (tx) => {
      const total = await tx.tbl_ajustes_inventario.count();
      const numeroInterno = generarNumeroInterno('AJ', total + 1);

      const ajuste = await tx.tbl_ajustes_inventario.create({
        data: {
          numero_interno: numeroInterno,
          id_almacen: dto.id_almacen,
          motivo: dto.motivo as any,
          observaciones: dto.observaciones,
          usuario_creacion: usuarioId,
        },
      });

      for (const item of dto.detalle) {
        const producto = await tx.tbl_productos.findFirst({
          where: { id: item.id_producto, eliminado: false },
        });
        if (!producto) throw new NotFoundException(`Producto ${item.id_producto} no encontrado`);

        const costoUnitario = item.costo_unitario ?? Number(producto.costo_promedio) ?? 0;

        await tx.tbl_detalle_ajustes_inventario.create({
          data: {
            id_ajuste: ajuste.id,
            id_producto: item.id_producto,
            tipo: item.tipo as any,
            cantidad: item.cantidad,
            costo_unitario: costoUnitario,
          },
        });

        await this.inventarioRepo.registrarMovimientoEnTransaccion(
          {
            idProducto: item.id_producto,
            idAlmacen: dto.id_almacen,
            tipo: item.tipo,
            cantidad: item.cantidad,
            costoUnitario: costoUnitario > 0 ? costoUnitario : undefined,
            motivo: `${motivoLabel} — Ajuste ${numeroInterno}${dto.observaciones ? `: ${dto.observaciones}` : ''}`,
            idReferencia: ajuste.id,
            tipoReferencia: 'ajuste',
            idUsuario: usuarioId,
          },
          tx as unknown as Prisma.TransactionClient,
        );
      }

      return tx.tbl_ajustes_inventario.findFirst({
        where: { id: ajuste.id },
        include: {
          almacen: { select: { nombre: true } },
          detalle: { include: { producto: { select: { nombre: true, codigo: true } } } },
        },
      });
    }, {
      maxWait: 15000,
      timeout: 60000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  async findAllAjustes(pagination: PaginationDto & { id_almacen?: string; motivo?: string }) {
    const where: any = { eliminado: false };
    if (pagination.id_almacen) where.id_almacen = pagination.id_almacen;
    if (pagination.motivo) where.motivo = pagination.motivo;

    const [data, total] = await Promise.all([
      this.prisma.tbl_ajustes_inventario.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        include: {
          almacen: { select: { nombre: true } },
          detalle: { select: { id: true } },
        },
        orderBy: { fecha_ajuste: 'desc' },
      }),
      this.prisma.tbl_ajustes_inventario.count({ where }),
    ]);

    return { data, total, page: pagination.page, limit: pagination.limit };
  }

  async findOneAjuste(id: string) {
    const ajuste = await this.prisma.tbl_ajustes_inventario.findFirst({
      where: { id, eliminado: false },
      include: {
        almacen: { select: { nombre: true } },
        detalle: {
          include: {
            producto: { select: { nombre: true, codigo: true, unidad_medida: { select: { simbolo: true } } } },
          },
        },
      },
    });
    if (!ajuste) throw new NotFoundException('Ajuste no encontrado');
    return ajuste;
  }

  async transferir(dto: TransferenciaInventarioDto, usuarioId: string) {
    if (dto.id_almacen_origen === dto.id_almacen_destino) {
      throw new BadRequestException('El almacén de origen y destino no pueden ser el mismo');
    }

    const producto = await this.prisma.tbl_productos.findFirst({
      where: { id: dto.id_producto, eliminado: false },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const [origen, destino] = await Promise.all([
      this.prisma.tbl_almacenes.findFirst({ where: { id: dto.id_almacen_origen, eliminado: false } }),
      this.prisma.tbl_almacenes.findFirst({ where: { id: dto.id_almacen_destino, eliminado: false } }),
    ]);
    if (!origen) throw new NotFoundException('Almacén de origen no encontrado');
    if (!destino) throw new NotFoundException('Almacén de destino no encontrado');

    const motivo = dto.motivo || `Transferencia de ${origen.nombre} a ${destino.nombre}`;
    const costoUnitario = Number(producto.costo_promedio);

    return this.prisma.$transaction(async (tx) => {
      const salida = await this.inventarioRepo.registrarMovimientoEnTransaccion(
        {
          idProducto: dto.id_producto,
          idAlmacen: dto.id_almacen_origen,
          tipo: 'transferencia_salida',
          cantidad: dto.cantidad,
          costoUnitario,
          motivo,
          tipoReferencia: 'transferencia',
          idUsuario: usuarioId,
        },
        tx as unknown as Prisma.TransactionClient,
      );

      const entrada = await this.inventarioRepo.registrarMovimientoEnTransaccion(
        {
          idProducto: dto.id_producto,
          idAlmacen: dto.id_almacen_destino,
          tipo: 'transferencia_entrada',
          cantidad: dto.cantidad,
          costoUnitario,
          motivo,
          idReferencia: salida.movimiento.id,
          tipoReferencia: 'transferencia',
          idUsuario: usuarioId,
        },
        tx as unknown as Prisma.TransactionClient,
      );

      return { salida: salida.movimiento, entrada: entrada.movimiento };
    }, {
      maxWait: 10000,
      timeout: 30000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
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
      if (fechaHasta) where.fecha.lte = finDeDia(fechaHasta);
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
    limit?: number,
    skip?: number,
  ) {
    return this.inventarioRepo.obtenerKardex(
      idProducto,
      idAlmacen,
      fechaDesde ? new Date(fechaDesde) : undefined,
      fechaHasta ? new Date(fechaHasta) : undefined,
      undefined,
      limit,
      skip,
    );
  }
}
