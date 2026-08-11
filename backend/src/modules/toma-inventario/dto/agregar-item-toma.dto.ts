import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class AgregarItemTomaDto {
  @IsString() @IsNotEmpty() id_producto: string;
  @IsNumber() @Min(0) cantidad_contada: number;
}
