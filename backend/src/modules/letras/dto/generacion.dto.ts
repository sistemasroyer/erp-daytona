import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';

const aNumero = ({ value }: { value: unknown }) => (value === undefined || value === '' ? undefined : Number(value));

/** Parámetros del análisis (vienen por query string). Mismos defaults que letras-daytona. */
export class ConfigDistribucionDto {
  @IsOptional() @Transform(aNumero) @IsInt() @Min(0) @Max(50) tolerancia?: number;
  @IsOptional() @Transform(aNumero) @IsNumber() @Min(0) monto_minimo?: number;
  @IsOptional() @Transform(aNumero) @IsNumber() @Min(1) monto_maximo_preferido?: number;
  /** Solo en recalcular: cuotas elegidas a mano. */
  @IsOptional() @Transform(aNumero) @IsInt() @Min(1) @Max(36) numero_cuotas?: number;
}

export class LetraAGuardarDto {
  @IsDateString() fecha_pago: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) monto: number;
}

export class GuardarLetrasDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(36) @ValidateNested({ each: true }) @Type(() => LetraAGuardarDto)
  letras: LetraAGuardarDto[];
  @IsOptional() @IsBoolean() regenerar?: boolean;
}
