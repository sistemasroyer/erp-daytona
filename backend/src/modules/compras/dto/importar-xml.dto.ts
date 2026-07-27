import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImportarXmlCompraDto {
  @ApiProperty({ description: 'Contenido del XML UBL 2.1 (Factura/Boleta) que envió el proveedor' })
  @IsString()
  @IsNotEmpty()
  xml: string;
}
