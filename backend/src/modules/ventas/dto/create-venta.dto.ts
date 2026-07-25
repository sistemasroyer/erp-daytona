import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsInt,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DetalleVentaDto {
  @ApiProperty()
  @IsUUID()
  id_producto: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.0001)
  cantidad: number;

  @ApiProperty({ description: 'Tipo de precio (1-5)', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  precio_tipo: number;

  @ApiPropertyOptional({ description: 'Descuento en monto (no porcentaje)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuento?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcion?: string;
}

export class PagoVentaDto {
  @ApiProperty()
  @IsUUID()
  id_metodo_pago: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  monto: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referencia?: string;
}

export class CreateVentaDto {
  @ApiProperty({
    enum: ['FACTURA', 'BOLETA', 'NOTA_VENTA', 'COTIZACION'],
    description: 'Documentos oficiales (FACTURA/BOLETA) afectan stock y se envían a SUNAT. NOTA_VENTA afecta stock pero no se envía a SUNAT. COTIZACION no afecta stock.',
  })
  @IsEnum(['FACTURA', 'BOLETA', 'NOTA_VENTA', 'COTIZACION'])
  tipo_documento: 'FACTURA' | 'BOLETA' | 'NOTA_VENTA' | 'COTIZACION';

  @ApiProperty({ description: 'ID de la serie de documento' })
  @IsUUID()
  id_serie_documento: string;

  @ApiProperty()
  @IsUUID()
  id_cliente: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id_caja_apertura?: string;

  @ApiPropertyOptional({ enum: ['PEN', 'USD'], default: 'PEN' })
  @IsOptional()
  @IsEnum(['PEN', 'USD'])
  moneda?: 'PEN' | 'USD';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  tipo_cambio?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({ type: [DetalleVentaDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetalleVentaDto)
  @ArrayMinSize(1)
  detalle: DetalleVentaDto[];

  @ApiPropertyOptional({
    type: [PagoVentaDto],
    description: 'Hasta 3 métodos de pago. Requerido (cubriendo el total) para FACTURA/BOLETA. Opcional para NOTA_VENTA/COTIZACION.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PagoVentaDto)
  @ArrayMaxSize(3)
  pagos?: PagoVentaDto[];
}

export class AnularVentaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  motivo: string;
}

export class CanjearVentaDto {
  @ApiProperty({ enum: ['FACTURA', 'BOLETA'], description: 'Documento oficial al que se canjea' })
  @IsEnum(['FACTURA', 'BOLETA'])
  tipo_documento: 'FACTURA' | 'BOLETA';

  @ApiProperty({ description: 'Serie del documento oficial destino' })
  @IsUUID()
  id_serie_documento: string;

  @ApiPropertyOptional({ type: [PagoVentaDto], description: 'Pagos del documento oficial. Si no se envía, se reutilizan los pagos del documento original.' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PagoVentaDto)
  @ArrayMaxSize(3)
  pagos?: PagoVentaDto[];
}

export class CreateNotaCreditoDto {
  @ApiProperty()
  @IsUUID()
  id_venta_original: string;

  @ApiProperty()
  @IsUUID()
  id_serie_documento: string;

  @ApiProperty({ example: '01', description: 'Código de motivo SUNAT' })
  @IsString()
  codigo_motivo: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  motivo: string;

  @ApiPropertyOptional({ description: 'Si no se envía, aplica a toda la venta' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetalleVentaDto)
  detalle?: DetalleVentaDto[];
}
