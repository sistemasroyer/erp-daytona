import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImportarProductosDto {
  @ApiProperty({ description: 'Archivo .xlsx de la plantilla de importación, codificado en base64' })
  @IsString()
  @IsNotEmpty()
  file_base64: string;
}
