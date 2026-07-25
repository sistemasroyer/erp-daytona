import { Controller, Get, Patch, Body, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigMargenesService } from './config-margenes.service';
import { Permisos } from '../../common/decorators/permisos.decorator';
import { IsNumber, Min, Max, IsString, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateMargenDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  margen?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsString()
  descripcion?: string;
}

@ApiTags('Configuración')
@ApiBearerAuth()
@Controller('config/margenes')
export class ConfigMargenesController {
  constructor(private readonly service: ConfigMargenesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar márgenes de precios configurados' })
  findAll() {
    return this.service.findAll();
  }

  @Patch(':numero')
  @Permisos('configuracion:editar')
  @ApiOperation({ summary: 'Actualizar margen de precio (1-5)' })
  update(@Param('numero', ParseIntPipe) numero: number, @Body() dto: UpdateMargenDto) {
    return this.service.update(numero, dto);
  }
}
