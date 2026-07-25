import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MarcasService, CreateMarcaDto } from './marcas.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Marcas')
@ApiBearerAuth()
@Controller('marcas')
export class MarcasController {
  constructor(private readonly service: MarcasService) {}

  @Post()
  @Permisos('productos:crear')
  create(@Body() dto: CreateMarcaDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permisos('productos:ver')
  findAll(@Query() pagination: PaginationDto) {
    return this.service.findAll(pagination);
  }

  @Patch(':id')
  @Permisos('productos:editar')
  update(@Param('id') id: string, @Body() dto: Partial<CreateMarcaDto>, @CurrentUser('sub') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @Permisos('productos:eliminar')
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.remove(id, userId);
  }
}
