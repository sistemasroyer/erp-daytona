import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  IsString, IsUUID, IsOptional, IsArray, ValidateNested,
  IsNumber, Min, IsEnum, IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { generarNumeroInterno } from '../../common/utils/numero-documento.util';

export class DetalleOrdenDto {
  @ApiProperty() @IsUUID() id_producto: string;
  @ApiPropertyOptional() @IsOptional() @IsString() descripcion?: string;
  @ApiProperty() @IsNumber() @Min(0.001) cantidad: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) precio_referencial?: number;
}

export class CreateOrdenCompraDto {
  @ApiProperty() @IsUUID() id_proveedor: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() fecha_requerida?: string;
  @ApiPropertyOptional({ enum: ['PEN', 'USD'] }) @IsOptional() @IsEnum(['PEN', 'USD']) moneda?: 'PEN' | 'USD';
  @ApiPropertyOptional() @IsOptional() @IsString() observaciones?: string;
  @ApiProperty({ type: [DetalleOrdenDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => DetalleOrdenDto)
  detalle: DetalleOrdenDto[];
}

@Injectable()
export class OrdenesCompraService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateOrdenCompraDto, usuarioId: string) {
    const proveedor = await this.prisma.tbl_proveedores.findFirst({
      where: { id: dto.id_proveedor, eliminado: false },
    });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');

    const totalOrdenes = await this.prisma.tbl_ordenes_compra.count();
    const numero = generarNumeroInterno('OC', totalOrdenes + 1);

    const totalEstimado = dto.detalle.reduce(
      (s, d) => s + d.cantidad * (d.precio_referencial || 0), 0,
    );

    const orden = await this.prisma.tbl_ordenes_compra.create({
      data: {
        numero,
        id_proveedor: dto.id_proveedor,
        id_usuario_solicitante: usuarioId,
        fecha_solicitud: new Date(),
        fecha_requerida: dto.fecha_requerida ? new Date(dto.fecha_requerida) : null,
        moneda: (dto.moneda as any) || 'PEN',
        total_estimado: totalEstimado,
        estado: 'borrador',
        observaciones: dto.observaciones,
        usuario_creacion: usuarioId,
      },
    });

    await this.prisma.tbl_detalle_ordenes_compra.createMany({
      data: dto.detalle.map((d) => ({
        id_orden: orden.id,
        id_producto: d.id_producto,
        descripcion: d.descripcion,
        cantidad: d.cantidad,
        precio_referencial: d.precio_referencial || 0,
        subtotal_estimado: d.cantidad * (d.precio_referencial || 0),
      })),
    });

    return this.findOne(orden.id);
  }

  async findAll(pagination: PaginationDto & { estado?: string }) {
    const where: any = { eliminado: false };
    if (pagination.estado) where.estado = pagination.estado;
    if (pagination.search) {
      where.OR = [
        { numero: { contains: pagination.search } },
        { proveedor: { razon_social: { contains: pagination.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.tbl_ordenes_compra.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        orderBy: { fecha_creacion: 'desc' },
        include: {
          proveedor: { select: { razon_social: true, ruc: true } },
          solicitante: { select: { nombre: true, apellido: true } },
          _count: { select: { detalle: true } },
        },
      }),
      this.prisma.tbl_ordenes_compra.count({ where }),
    ]);

    return { data, total, page: pagination.page, limit: pagination.limit };
  }

  async findOne(id: string) {
    const orden = await this.prisma.tbl_ordenes_compra.findFirst({
      where: { id, eliminado: false },
      include: {
        proveedor: true,
        solicitante: { select: { nombre: true, apellido: true, email: true } },
        aprobador: { select: { nombre: true, apellido: true } },
        detalle: {
          include: { producto: { select: { codigo: true, nombre: true, unidad_medida: { select: { simbolo: true } } } } },
        },
      },
    });
    if (!orden) throw new NotFoundException('Orden de compra no encontrada');
    return orden;
  }

  async aprobar(id: string, aprobadorId: string) {
    const orden = await this.findOne(id);
    if (orden.estado !== 'borrador') {
      throw new BadRequestException(`No se puede aprobar una orden en estado "${orden.estado}"`);
    }
    if (orden.id_usuario_solicitante === aprobadorId) {
      throw new ForbiddenException('No puede aprobar su propia orden de compra');
    }

    return this.prisma.tbl_ordenes_compra.update({
      where: { id },
      data: {
        estado: 'aprobado',
        id_usuario_aprobador: aprobadorId,
        fecha_aprobacion: new Date(),
        usuario_modificacion: aprobadorId,
      },
    });
  }

  async anular(id: string, usuarioId: string) {
    const orden = await this.findOne(id);
    if (orden.estado === 'convertido') {
      throw new BadRequestException('No se puede anular una orden ya convertida en compra');
    }

    return this.prisma.tbl_ordenes_compra.update({
      where: { id },
      data: { estado: 'anulado', usuario_modificacion: usuarioId },
    });
  }

  async update(id: string, dto: Partial<CreateOrdenCompraDto>, usuarioId: string) {
    const orden = await this.findOne(id);
    if (orden.estado !== 'borrador') {
      throw new BadRequestException('Solo se puede editar una orden en estado borrador');
    }

    const data: any = { usuario_modificacion: usuarioId };
    if (dto.observaciones !== undefined) data.observaciones = dto.observaciones;
    if (dto.fecha_requerida) data.fecha_requerida = new Date(dto.fecha_requerida);
    if (dto.moneda) data.moneda = dto.moneda;

    await this.prisma.tbl_ordenes_compra.update({ where: { id }, data });

    if (dto.detalle) {
      await this.prisma.tbl_detalle_ordenes_compra.deleteMany({ where: { id_orden: id } });
      await this.prisma.tbl_detalle_ordenes_compra.createMany({
        data: dto.detalle.map((d) => ({
          id_orden: id,
          id_producto: d.id_producto,
          descripcion: d.descripcion,
          cantidad: d.cantidad,
          precio_referencial: d.precio_referencial || 0,
          subtotal_estimado: d.cantidad * (d.precio_referencial || 0),
        })),
      });
    }

    return this.findOne(id);
  }
}
