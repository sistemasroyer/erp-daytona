import {
  IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, Min, IsDateString, MaxLength,
  IsArray, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const CATEGORIAS = ['flete', 'alquiler', 'servicios', 'comida_viaticos', 'honorarios', 'utiles_oficina', 'mantenimiento', 'otros'] as const;

export class DetalleGastoDto {
  @ApiProperty()
  @IsString() @IsNotEmpty() @MaxLength(300)
  descripcion: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @IsNumber() @Min(0.0001)
  cantidad?: number;

  @ApiProperty({ description: 'Importe total de la línea (incluye IGV si aplica)' })
  @IsNumber() @Min(0)
  importe_linea: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  afecta_igv?: boolean;
}

export class CreateGastoDto {
  @ApiProperty({ enum: CATEGORIAS })
  @IsEnum(CATEGORIAS)
  categoria: typeof CATEGORIAS[number];

  @ApiProperty({ description: 'Tipo: factura, boleta, recibo_honorarios, ticket, otros' })
  @IsString() @IsNotEmpty() @MaxLength(30)
  tipo_documento: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(4)
  serie?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(10)
  numero?: string;

  @ApiProperty({ description: 'Proveedor emisor del comprobante, buscado en el catálogo de Proveedores' })
  @IsString() @IsNotEmpty()
  id_proveedor: string;

  @ApiPropertyOptional({ description: 'Compra a la que está vinculado este gasto (ej. la factura real del flete de esa compra)' })
  @IsOptional() @IsString()
  id_compra_relacionada?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  id_punto_venta?: string;

  @ApiProperty({ example: '2025-01-15' })
  @IsDateString()
  fecha_emision: string;

  @ApiPropertyOptional({ enum: ['contado', 'credito'], default: 'contado' })
  @IsOptional() @IsEnum(['contado', 'credito'])
  condicion_pago?: 'contado' | 'credito';

  @ApiPropertyOptional({ description: 'Requerido si condicion_pago es credito' })
  @IsOptional() @IsDateString()
  fecha_vencimiento?: string;

  @ApiPropertyOptional({ enum: ['PEN', 'USD'], default: 'PEN' })
  @IsOptional() @IsEnum(['PEN', 'USD'])
  moneda?: 'PEN' | 'USD';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @IsNumber() @Min(0)
  tipo_cambio?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(500)
  observaciones?: string;

  @ApiProperty({ type: [DetalleGastoDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetalleGastoDto)
  detalle: DetalleGastoDto[];
}
