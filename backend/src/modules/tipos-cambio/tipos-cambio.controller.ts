import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TiposCambioService, CreateTipoCambioDto } from './tipos-cambio.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Tipos de Cambio')
@ApiBearerAuth()
@Controller('tipos-cambio')
export class TiposCambioController {
  constructor(private readonly service: TiposCambioService) {}

  @Get()
  @Permisos('configuracion:ver')
  @ApiOperation({ summary: 'Listar tipos de cambio recientes' })
  findAll(@Query('limit') limit?: string) {
    return this.service.findAll(limit ? parseInt(limit) : 60);
  }

  @Get('hoy')
  @Permisos('configuracion:ver')
  @ApiOperation({ summary: 'Obtener tipo de cambio de hoy' })
  findHoy() {
    return this.service.findHoy();
  }

  @Post()
  @Permisos('configuracion:crear')
  @ApiOperation({ summary: 'Registrar tipo de cambio' })
  create(@Body() dto: CreateTipoCambioDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Patch(':id')
  @Permisos('configuracion:editar')
  @ApiOperation({ summary: 'Actualizar tipo de cambio' })
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateTipoCambioDto>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @Permisos('configuracion:eliminar')
  @ApiOperation({ summary: 'Eliminar tipo de cambio' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.remove(id, userId);
  }
}
