import {
  IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, ValidateNested, IsNumber, Min, IsIn, IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CODIGOS_MOTIVO_NOTA_CREDITO,
  DESCRIPCION_MOTIVOS_NOTA_CREDITO,
} from '../../../common/constants/motivos-nota-credito.constant';

export class DetalleNotaCreditoCompraDto {
  @ApiProperty({ description: 'id de tbl_detalle_compras de la línea original que se está acreditando' })
  @IsString() @IsNotEmpty()
  id_detalle_original: string;

  @ApiProperty({ description: 'Cantidad acreditada por el proveedor (puede ser menor o igual a la cantidad original)' })
  @IsNumber()
  @Min(0.0001)
  cantidad: number;

  @ApiProperty({ description: 'Importe total de la línea acreditada, tal como lo indica el documento del proveedor (incluye IGV si aplica)' })
  @IsNumber()
  @Min(0)
  importe_linea: number;
}

export class CreateNotaCreditoCompraDto {
  @ApiPropertyOptional({ description: 'Serie del documento tal como la emitió el proveedor' })
  @IsOptional()
  @IsString()
  serie?: string;

  @ApiPropertyOptional({ description: 'Número del documento tal como lo emitió el proveedor' })
  @IsOptional()
  @IsString()
  numero?: string;

  @ApiProperty({ example: '2026-01-15', description: 'Fecha de emisión del documento del proveedor' })
  @IsDateString()
  fecha_emision: string;

  @ApiProperty({
    enum: CODIGOS_MOTIVO_NOTA_CREDITO,
    description: DESCRIPCION_MOTIVOS_NOTA_CREDITO,
  })
  @IsIn(CODIGOS_MOTIVO_NOTA_CREDITO)
  codigo_motivo: string;

  @ApiProperty()
  @IsString() @IsNotEmpty()
  motivo: string;

  @ApiProperty({ description: 'true si implica devolución física de mercadería al proveedor (descuenta stock)' })
  @IsBoolean()
  afecta_stock: boolean;

  @ApiProperty({ type: [DetalleNotaCreditoCompraDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetalleNotaCreditoCompraDto)
  detalle: DetalleNotaCreditoCompraDto[];
}
