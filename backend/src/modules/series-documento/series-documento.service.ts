import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsBoolean, Length } from 'class-validator';

export class CreateSerieDto {
  @IsString() @IsNotEmpty() id_punto_venta: string;
  @IsEnum(['01', '03', '07', '08', 'NV', 'COT']) tipo_documento: '01' | '03' | '07' | '08' | 'NV' | 'COT';
  @IsString() @IsNotEmpty() @Length(1, 4) serie: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class UpdateSerieDto {
  @IsOptional() @IsBoolean() activo?: boolean;
}

@Injectable()
export class SeriesDocumentoService {
  constructor(private prisma: PrismaService) {}

  private readonly TIPOS: Record<string, string> = {
    '01': 'Factura',
    '03': 'Boleta',
    '07': 'Nota de Crédito',
    '08': 'Nota de Débito',
    'NV': 'Nota de Venta',
    'COT': 'Cotización',
  };

  private readonly CODIGO_A_ENUM: Record<string, string> = {
    '01': 'FACTURA',
    '03': 'BOLETA',
    '07': 'NOTA_CREDITO',
    '08': 'NOTA_DEBITO',
    'NV': 'NOTA_VENTA',
    'COT': 'COTIZACION',
  };

  async findAll(idPuntoVenta?: string) {
    const where: any = { eliminado: false };
    if (idPuntoVenta) where.id_punto_venta = idPuntoVenta;

    return this.prisma.tbl_series_documento.findMany({
      where,
      include: { punto_venta: { select: { nombre: true } } },
      orderBy: [{ tipo_documento: 'asc' }, { serie: 'asc' }],
    });
  }

  async findOne(id: string) {
    const serie = await this.prisma.tbl_series_documento.findFirst({
      where: { id, eliminado: false },
      include: { punto_venta: { select: { nombre: true } } },
    });
    if (!serie) throw new NotFoundException('Serie no encontrada');
    return serie;
  }

  async create(dto: CreateSerieDto, usuarioId: string) {
    const pv = await this.prisma.tbl_puntos_venta.findFirst({
      where: { id: dto.id_punto_venta, eliminado: false },
    });
    if (!pv) throw new NotFoundException('Punto de venta no encontrado');

    const tipoDocumento = this.CODIGO_A_ENUM[dto.tipo_documento];

    const existente = await this.prisma.tbl_series_documento.findFirst({
      where: {
        id_punto_venta: dto.id_punto_venta,
        tipo_documento: tipoDocumento as any,
        serie: dto.serie.toUpperCase(),
        eliminado: false,
      },
    });
    if (existente) throw new ConflictException('Ya existe esa serie para ese punto de venta y tipo de documento');

    return this.prisma.tbl_series_documento.create({
      data: {
        id_punto_venta: dto.id_punto_venta,
        tipo_documento: tipoDocumento as any,
        serie: dto.serie.toUpperCase(),
        correlativo_actual: 0,
        activo: dto.activo ?? true,
        usuario_creacion: usuarioId,
      },
      include: { punto_venta: { select: { nombre: true } } },
    });
  }

  async update(id: string, dto: UpdateSerieDto, usuarioId: string) {
    const serie = await this.prisma.tbl_series_documento.findFirst({ where: { id, eliminado: false } });
    if (!serie) throw new NotFoundException('Serie no encontrada');

    return this.prisma.tbl_series_documento.update({
      where: { id },
      data: { activo: dto.activo, usuario_modificacion: usuarioId },
      include: { punto_venta: { select: { nombre: true } } },
    });
  }

  async resetCorrelativo(id: string, nuevoValor: number, usuarioId: string) {
    const serie = await this.prisma.tbl_series_documento.findFirst({ where: { id, eliminado: false } });
    if (!serie) throw new NotFoundException('Serie no encontrada');
    if (nuevoValor < serie.correlativo_actual)
      throw new BadRequestException('El nuevo correlativo no puede ser menor al actual');

    return this.prisma.tbl_series_documento.update({
      where: { id },
      data: { correlativo_actual: nuevoValor, usuario_modificacion: usuarioId },
    });
  }

  async remove(id: string, usuarioId: string) {
    const serie = await this.prisma.tbl_series_documento.findFirst({ where: { id, eliminado: false } });
    if (!serie) throw new NotFoundException('Serie no encontrada');
    if (serie.correlativo_actual > 0)
      throw new BadRequestException('No se puede eliminar una serie que ya tiene documentos emitidos');

    return this.prisma.tbl_series_documento.update({
      where: { id },
      data: { eliminado: true, estado: false, usuario_modificacion: usuarioId },
    });
  }

  async findPuntosVenta() {
    return this.prisma.tbl_puntos_venta.findMany({
      where: { eliminado: false },
      select: { id: true, nombre: true, direccion: true, activo: true },
      orderBy: { nombre: 'asc' },
    });
  }
}
