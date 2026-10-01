import { IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

export class BancoDto {
  @IsString() @IsNotEmpty() @MaxLength(150) nombre: string;
  @IsOptional() @IsString() @MaxLength(20) siglas?: string;
  @IsOptional() @IsString() @MaxLength(300) descripcion?: string;
  @IsOptional() @IsBoolean() estado?: boolean;
}
export class UpdateBancoDto extends PartialType(BancoDto) {}

export class DiaNoPagoDto {
  @IsDateString() fecha: string;
  @IsString() @IsNotEmpty() @MaxLength(200) descripcion: string;
  @IsEnum(['feriado', 'especial']) tipo: 'feriado' | 'especial';
  @IsOptional() @IsBoolean() estado?: boolean;
}
export class UpdateDiaNoPagoDto extends PartialType(DiaNoPagoDto) {}

export class LimitePagoDiaDto {
  @IsInt() @Min(1) @Max(7) dia_semana: number;
  @IsEnum(['PEN', 'USD']) moneda: 'PEN' | 'USD';
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) monto_maximo: number;
  @IsOptional() @IsBoolean() estado?: boolean;
}

/** Reemplaza de una vez los límites de una moneda para toda la semana (pantalla de configuración). */
export class GuardarLimitesDto {
  @IsEnum(['PEN', 'USD']) moneda: 'PEN' | 'USD';
  @IsArray() @ValidateNested({ each: true }) @Type(() => LimiteDiaItemDto) dias: LimiteDiaItemDto[];
}
export class LimiteDiaItemDto {
  @IsInt() @Min(1) @Max(7) dia_semana: number;
  /** null/0 = sin límite propio para ese día (se usa el de la otra moneda o el valor por defecto). */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) monto_maximo?: number | null;
}
