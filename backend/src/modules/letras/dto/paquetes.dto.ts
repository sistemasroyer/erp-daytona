import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { PartialType, PickType } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreatePaqueteDto {
  @IsUUID() id_proveedor: string;
  @IsEnum(['PEN', 'USD']) moneda: 'PEN' | 'USD';
  @IsOptional() @IsUUID() id_banco?: string;
  @IsDateString() fecha_inicio_pago: string;
  @IsInt() @Min(0) @Max(365) dias_credito: number;
  @IsInt() @Min(1) @Max(36) numero_cuotas: number;
  @IsOptional() @IsString() @MaxLength(500) comentarios?: string;
  /** Compras (facturas a crédito / NC) con las que nace el paquete, cuando se crea desde Compras. */
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) ids_compras?: string[];
}

/** Proveedor y moneda no se cambian una vez creado (los documentos dependen de ellos). */
export class UpdatePaqueteDto extends PartialType(PickType(CreatePaqueteDto, ['id_banco', 'fecha_inicio_pago', 'dias_credito', 'numero_cuotas', 'comentarios'] as const)) {}

export class FiltroPaquetesDto extends PaginationDto {
  @IsOptional() @IsString() estado?: string;
  @IsOptional() @IsUUID() id_proveedor?: string;
  @IsOptional() @IsEnum(['PEN', 'USD']) moneda?: 'PEN' | 'USD';
}

export class DocumentoLetraDto {
  @IsEnum(['factura', 'nota_credito', 'nota_debito', 'otro']) tipo: 'factura' | 'nota_credito' | 'nota_debito' | 'otro';
  @IsString() @IsNotEmpty() @MaxLength(10) serie: string;
  @IsString() @IsNotEmpty() @MaxLength(20) numero: string;
  /** Siempre positivo: las notas de crédito se guardan en negativo automáticamente. */
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) monto: number;
  @IsDateString() fecha_emision: string;
  @IsOptional() @IsDateString() fecha_vencimiento?: string;
}
export class UpdateDocumentoLetraDto extends PartialType(DocumentoLetraDto) {}

export class ImportarComprasDto {
  @IsArray() @ArrayNotEmpty() @IsUUID('all', { each: true }) ids: string[];
}

export class MotivoDto {
  @IsString() @IsNotEmpty() @MaxLength(300) motivo: string;
}
