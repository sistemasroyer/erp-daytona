import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AgregarCodigoProveedorDto {
  @ApiProperty()
  @IsString() @IsNotEmpty()
  id_proveedor: string;

  @ApiProperty({ description: 'Código que ese proveedor usa para referirse a este producto' })
  @IsString() @IsNotEmpty() @MaxLength(50)
  codigo_alterno: string;
}
