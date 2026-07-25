import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SeriesDocumentoService, CreateSerieDto, UpdateSerieDto } from './series-documento.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Series de Documento')
@ApiBearerAuth()
@Controller('series-documento')
export class SeriesDocumentoController {
  constructor(private readonly service: SeriesDocumentoService) {}

  // Lectura: sin restricción de permiso — la necesita cualquier usuario autenticado
  // al emitir una venta (para elegir su serie) o al gestionar usuarios (puntos de venta).
  @Get()
  @ApiOperation({ summary: 'Listar series de documento' })
  findAll(@Query('id_punto_venta') idPuntoVenta?: string) {
    return this.service.findAll(idPuntoVenta);
  }

  @Get('puntos-venta')
  @ApiOperation({ summary: 'Listar puntos de venta disponibles' })
  findPuntosVenta() {
    return this.service.findPuntosVenta();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener serie por ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Permisos('configuracion:crear')
  @ApiOperation({ summary: 'Crear nueva serie de documento' })
  create(@Body() dto: CreateSerieDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Patch(':id')
  @Permisos('configuracion:editar')
  @ApiOperation({ summary: 'Activar/desactivar serie' })
  update(@Param('id') id: string, @Body() dto: UpdateSerieDto, @CurrentUser('sub') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Patch(':id/reset-correlativo')
  @Permisos('configuracion:editar')
  @ApiOperation({ summary: 'Ajustar correlativo actual' })
  resetCorrelativo(
    @Param('id') id: string,
    @Body('correlativo', ParseIntPipe) correlativo: number,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.resetCorrelativo(id, correlativo, userId);
  }

  @Delete(':id')
  @Permisos('configuracion:eliminar')
  @ApiOperation({ summary: 'Eliminar serie (solo si no tiene documentos emitidos)' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.remove(id, userId);
  }
}
