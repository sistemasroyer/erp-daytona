import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PagarGastoDto {
  @ApiProperty()
  @IsString() @IsNotEmpty()
  id_metodo_pago: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  referencia?: string;

  @ApiPropertyOptional({ description: 'Si se envía, registra el egreso en esa apertura de caja' })
  @IsOptional() @IsString()
  id_caja_apertura?: string;
}
