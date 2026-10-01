import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class FiltroDeudaDto {
  @IsOptional() @IsUUID() id_proveedor?: string;
  @IsOptional() @IsEnum(['PEN', 'USD']) moneda?: 'PEN' | 'USD';
  @IsOptional() @IsString() search?: string;
}
