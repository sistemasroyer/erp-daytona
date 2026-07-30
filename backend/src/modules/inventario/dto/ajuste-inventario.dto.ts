import {
  IsString, IsNotEmpty, IsEnum, IsNumber, Min, IsOptional, IsArray, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const MOTIVOS_AJUSTE_INVENTARIO = [
  'mermas_mal_estado', 'entrega_trabajadores', 'sobrante_faltante', 'otros',
] as const;

export type MotivoAjusteInventario = (typeof MOTIVOS_AJUSTE_INVENTARIO)[number];

export const MOTIVO_AJUSTE_LABEL: Record<MotivoAjusteInventario, string> = {
  mermas_mal_estado: 'Mermas / Mal estado',
  entrega_trabajadores: 'Entrega a trabajadores',
  sobrante_faltante: 'Sobrante / Faltante de inventario',
  otros: 'Otros',
};

export class DetalleAjusteInventarioDto {
  @ApiProperty()
  @IsString() @IsNotEmpty()
  id_producto: string;

  @ApiProperty({ enum: ['ajuste_positivo', 'ajuste_negativo'] })
  @IsEnum(['ajuste_positivo', 'ajuste_negativo'])
  tipo: 'ajuste_positivo' | 'ajuste_negativo';

  @ApiProperty()
  @IsNumber()
  @Min(0.0001)
  cantidad: number;

  @ApiPropertyOptional({ description: 'Si no se indica, se usa el costo promedio actual del producto' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costo_unitario?: number;
}

export class CreateAjusteInventarioDto {
  @ApiProperty()
  @IsString() @IsNotEmpty()
  id_almacen: string;

  @ApiProperty({ enum: MOTIVOS_AJUSTE_INVENTARIO })
  @IsEnum(MOTIVOS_AJUSTE_INVENTARIO)
  motivo: MotivoAjusteInventario;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({ type: [DetalleAjusteInventarioDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetalleAjusteInventarioDto)
  detalle: DetalleAjusteInventarioDto[];
}
