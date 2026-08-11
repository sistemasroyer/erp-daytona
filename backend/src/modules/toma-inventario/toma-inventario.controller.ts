import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TomaInventarioService } from './toma-inventario.service';
import { AgregarItemTomaDto } from './dto/agregar-item-toma.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Toma de Inventario')
@ApiBearerAuth()
@Controller('toma-inventario')
export class TomaInventarioController {
  constructor(private readonly service: TomaInventarioService) {}

  @Post()
  @Permisos('inventario:crear')
  @ApiOperation({ summary: 'Iniciar una nueva sesión de toma de inventario' })
  crear(@CurrentUser('sub') userId: string) {
    return this.service.crear(userId);
  }

  @Get()
  @Permisos('inventario:ver')
  listar(@Query() pagination: PaginationDto, @Query('estado') estado?: string) {
    return this.service.findAll({ ...pagination, skip: Number(pagination.skip) || 0, estado } as any);
  }

  @Get(':id')
  @Permisos('inventario:ver')
  obtener(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/items')
  @Permisos('inventario:crear')
  @ApiOperation({ summary: 'Agregar o actualizar el conteo de un producto en la sesión' })
  agregarItem(@Param('id') id: string, @Body() dto: AgregarItemTomaDto, @CurrentUser('sub') userId: string) {
    return this.service.agregarItem(id, dto, userId);
  }

  @Delete(':id/items/:idProducto')
  @Permisos('inventario:editar')
  quitarItem(@Param('id') id: string, @Param('idProducto') idProducto: string) {
    return this.service.quitarItem(id, idProducto);
  }

  @Patch(':id/finalizar')
  @Permisos('inventario:editar')
  @ApiOperation({ summary: 'Finalizar la toma y aplicar las correcciones de stock' })
  finalizar(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.finalizar(id, userId);
  }

  @Patch(':id/anular')
  @Permisos('inventario:anular')
  anular(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.anular(id, userId);
  }
}
