import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, Min, IsDateString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const CATEGORIAS = ['flete', 'alquiler', 'servicios', 'comida_viaticos', 'honorarios', 'utiles_oficina', 'mantenimiento', 'otros'] as const;

export class CreateGastoDto {
  @ApiProperty({ enum: CATEGORIAS })
  @IsEnum(CATEGORIAS)
  categoria: typeof CATEGORIAS[number];

  @ApiProperty({ description: 'Tipo: factura, boleta, recibo_honorarios, ticket, otros' })
  @IsString() @IsNotEmpty()
  tipo_documento: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  serie?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  numero?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @Length(11, 11)
  ruc_emisor?: string;

  @ApiProperty()
  @IsString() @IsNotEmpty()
  razon_social_emisor: string;

  @ApiPropertyOptional({ description: 'Proveedor ya registrado en el catálogo, si aplica' })
  @IsOptional() @IsString()
  id_proveedor?: string;

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

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  afecta_igv?: boolean;

  @ApiProperty()
  @IsNumber() @Min(0)
  subtotal: number;

  @ApiProperty()
  @IsNumber() @Min(0)
  igv: number;

  @ApiProperty()
  @IsNumber() @Min(0)
  total: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  observaciones?: string;
}
