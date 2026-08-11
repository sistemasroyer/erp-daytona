import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, MaxLength } from 'class-validator';

export class AgregarItemTomaDto {
  @IsString() @IsNotEmpty() id_producto: string;
  @IsNumber() @Min(0) cantidad_contada: number;
  @IsOptional() @IsString() @MaxLength(500) observaciones?: string;
}
