import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDeviceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token_dispositivo: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  navegador?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sistema_operativo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  user_agent?: string;
}
