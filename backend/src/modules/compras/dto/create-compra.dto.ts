import {
  IsString, IsNotEmpty, IsUUID, IsEnum, IsOptional,
  IsArray, ValidateNested, IsNumber, Min, IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DetalleCompraDto {
  @ApiProperty()
  @IsString() @IsNotEmpty()
  id_producto: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.0001)
  cantidad: number;

  @ApiProperty({ description: 'Importe total de la línea en la factura (incluye IGV si aplica). Fuente principal para el cálculo del costo.' })
  @IsNumber()
  @Min(0)
  importe_linea: number;

  @ApiPropertyOptional({ description: 'Precio unitario de referencia (se recalcula desde importe_linea si no se provee)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precio_unitario?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  afecta_igv?: boolean;
}

export class CreateCompraDto {
  @ApiProperty({ description: 'Tipo: factura, boleta, nota, otros' })
  @IsString()
  @IsNotEmpty()
  tipo_documento: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serie?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  numero?: string;

  @ApiProperty()
  @IsString() @IsNotEmpty()
  id_proveedor: string;

  @ApiProperty()
  @IsString() @IsNotEmpty()
  id_almacen: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id_orden_compra?: string;

  @ApiProperty({ example: '2025-01-15' })
  @IsDateString()
  fecha_emision: string;

  @ApiPropertyOptional({ enum: ['contado', 'credito'], default: 'contado' })
  @IsOptional()
  @IsEnum(['contado', 'credito'])
  condicion_pago?: 'contado' | 'credito';

  @ApiPropertyOptional({ description: 'Requerido si condicion_pago es credito' })
  @IsOptional()
  @IsDateString()
  fecha_vencimiento?: string;

  @ApiPropertyOptional({ enum: ['PEN', 'USD'], default: 'PEN' })
  @IsOptional()
  @IsEnum(['PEN', 'USD'])
  moneda?: 'PEN' | 'USD';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tipo_cambio?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  flete_monto?: number;

  @ApiPropertyOptional({ enum: ['PEN', 'USD'], default: 'PEN' })
  @IsOptional()
  @IsEnum(['PEN', 'USD'])
  flete_moneda?: 'PEN' | 'USD';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  flete_tipo_cambio?: number;

  @ApiPropertyOptional({ enum: ['precio', 'cantidad'], default: 'precio' })
  @IsOptional()
  @IsEnum(['precio', 'cantidad'])
  flete_tipo_prorrateo?: 'precio' | 'cantidad';

  @ApiPropertyOptional({ description: 'Proveedor/transportista a quien se le debe el flete (gasto aparte de la mercadería)' })
  @IsOptional()
  @IsString()
  id_proveedor_flete?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({ type: [DetalleCompraDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetalleCompraDto)
  detalle: DetalleCompraDto[];
}
