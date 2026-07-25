import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UnidadesMedidaService, CreateUnidadMedidaDto } from './unidades-medida.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Unidades de Medida')
@ApiBearerAuth()
@Controller('unidades-medida')
export class UnidadesMedidaController {
  constructor(private readonly service: UnidadesMedidaService) {}

  @Post()
  @Permisos('productos:crear')
  create(@Body() dto: CreateUnidadMedidaDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permisos('productos:ver')
  findAll() {
    return this.service.findAll();
  }

  @Patch(':id')
  @Permisos('productos:editar')
  update(@Param('id') id: string, @Body() dto: Partial<CreateUnidadMedidaDto>, @CurrentUser('sub') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @Permisos('productos:eliminar')
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.remove(id, userId);
  }
}
