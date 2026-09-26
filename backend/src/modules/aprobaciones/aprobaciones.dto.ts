import { IsEnum, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export const RECURSOS = ['ventas', 'compras', 'gastos', 'ordenes_compra', 'toma_inventario'] as const;
export type RecursoAnulacion = typeof RECURSOS[number];

export class DocumentoAprobacionDto {
  @IsEnum(RECURSOS) recurso: RecursoAnulacion;
  @IsUUID() id_documento: string;
}
export class SolicitarAprobacionDto extends DocumentoAprobacionDto {
  @IsUUID() id_aprobador: string;
  @IsString() @Matches(/^\d{6,8}$/) pin: string;
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(3) @MaxLength(500) motivo: string;
}
export class ConfigurarPinDto {
  @IsString() @MinLength(1) @MaxLength(200) password: string;
  @IsString() @Matches(/^\d{6,8}$/) pin: string;
}
export class DesactivarPinDto {
  @IsString() @MinLength(1) @MaxLength(200) password: string;
}
export class AnulacionAprobadaDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) autorizacion: string;
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(3) @MaxLength(500) motivo: string;
}
