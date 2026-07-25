import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  IsUUID,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CodigoProveedorDto {
  @ApiProperty()
  @IsUUID()
  id_proveedor: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  codigo_alterno: string;
}

export class CreateProductoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @ApiPropertyOptional({ type: [CodigoProveedorDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CodigoProveedorDto)
  codigos_proveedor?: CodigoProveedorDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  codigo_barras?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  codigo_sunat?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id_categoria?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id_subcategoria?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id_marca?: string;

  @ApiProperty()
  @IsUUID()
  id_unidad_medida: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ubicacion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tipo_existencia?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  afecta_igv?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  estado?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock_minimo?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock_maximo?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precio_compra_sin_igv?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precio_compra_con_igv?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precio_venta_1?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precio_venta_2?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precio_venta_3?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precio_venta_4?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precio_venta_5?: number;
}
