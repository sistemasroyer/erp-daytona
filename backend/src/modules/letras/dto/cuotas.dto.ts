import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FiltroLetrasDto extends PaginationDto {
  /** pendiente | pagada | cancelada, o los derivados vencida / por_vencer (pendientes con fecha pasada / futura). */
  @IsOptional() @IsEnum(['pendiente', 'pagada', 'cancelada', 'vencida', 'por_vencer'])
  estado?: 'pendiente' | 'pagada' | 'cancelada' | 'vencida' | 'por_vencer';
  @IsOptional() @IsUUID() id_proveedor?: string;
  @IsOptional() @IsUUID() id_paquete?: string;
  @IsOptional() @IsEnum(['PEN', 'USD']) moneda?: 'PEN' | 'USD';
  @IsOptional() @IsDateString() fecha_desde?: string;
  @IsOptional() @IsDateString() fecha_hasta?: string;
}

export class PagarLetraDto {
  @IsDateString() fecha_pago_efectivo: string;
  @IsString() @IsNotEmpty() @MaxLength(50) metodo_pago: string;
  @IsOptional() @IsString() @MaxLength(50) numero_operacion?: string;
  /** En la moneda de la letra; puede diferir hasta 10% (comisiones, redondeos del banco). */
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) monto_pagado: number;
  @IsOptional() @IsString() @MaxLength(300) observaciones?: string;
}

export class CodigoBancoDto {
  @IsString() @MaxLength(50) codigo_banco: string;
}

export class CambiarMontoLetraDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) monto: number;
}

export class CambiarFechaLetraDto {
  @IsDateString() fecha_pago: string;
  /** Mover aunque el día pase el límite + 10%. */
  @IsOptional() @IsBoolean() forzar?: boolean;
}

export class EliminarLetraDto {
  /** auto: se reparte entre las demás pendientes; elegir: va a `id_destino`; ninguno: el monto se descuenta del plan. */
  @IsEnum(['auto', 'elegir', 'ninguno']) modo: 'auto' | 'elegir' | 'ninguno';
  @IsOptional() @IsUUID() id_destino?: string;
}

export class CalendarioDto {
  @IsDateString() desde: string;
  @IsDateString() hasta: string;
  @IsOptional() @IsEnum(['PEN', 'USD']) moneda?: 'PEN' | 'USD';
}
