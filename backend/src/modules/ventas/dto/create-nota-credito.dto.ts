import {
  IsString, IsNotEmpty, IsBoolean, IsArray, ValidateNested, IsNumber, Min, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/** Catálogo SUNAT 09 — Tipo de Nota de Crédito */
export const CODIGOS_MOTIVO_NOTA_CREDITO = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13',
] as const;

export class DetalleNotaCreditoDto {
  @ApiProperty({ description: 'id de tbl_detalle_ventas de la línea original que se está acreditando' })
  @IsString() @IsNotEmpty()
  id_detalle_original: string;

  @ApiProperty({ description: 'Cantidad a acreditar (puede ser menor o igual a la cantidad original)' })
  @IsNumber()
  @Min(0.0001)
  cantidad: number;
}

export class CreateNotaCreditoDto {
  @ApiProperty()
  @IsString() @IsNotEmpty()
  id_serie_documento: string;

  @ApiProperty({
    enum: CODIGOS_MOTIVO_NOTA_CREDITO,
    description: '01=Anulación operación, 02=Error RUC, 03=Error descripción, 04=Descuento global, '
      + '05=Descuento por ítem, 06=Devolución total, 07=Devolución por ítem, 08=Bonificación, '
      + '09=Disminución en el valor, 10=Otros, 11=Ajustes IVAP, 12=Ajustes exportación, 13=Ajustes montos/fechas',
  })
  @IsIn(CODIGOS_MOTIVO_NOTA_CREDITO)
  codigo_motivo: string;

  @ApiProperty()
  @IsString() @IsNotEmpty()
  motivo: string;

  @ApiProperty({ description: 'true si implica devolución física de mercadería (repone stock)' })
  @IsBoolean()
  afecta_stock: boolean;

  @ApiProperty({ type: [DetalleNotaCreditoDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetalleNotaCreditoDto)
  detalle: DetalleNotaCreditoDto[];
}
