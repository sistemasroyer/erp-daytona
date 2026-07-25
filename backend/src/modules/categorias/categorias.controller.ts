import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CategoriasService, CreateCategoriaDto, CreateSubcategoriaDto } from './categorias.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Categorías')
@ApiBearerAuth()
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly service: CategoriasService) {}

  @Post()
  @Permisos('productos:crear')
  create(@Body() dto: CreateCategoriaDto, @CurrentUser('sub') userId: string) {
    return this.service.createCategoria(dto, userId);
  }

  @Get()
  @Permisos('productos:ver')
  findAll(@Query() pagination: PaginationDto) {
    return this.service.findAllCategorias(pagination);
  }

  @Patch(':id')
  @Permisos('productos:editar')
  update(@Param('id') id: string, @Body() dto: Partial<CreateCategoriaDto>, @CurrentUser('sub') userId: string) {
    return this.service.updateCategoria(id, dto, userId);
  }

  @Delete(':id')
  @Permisos('productos:eliminar')
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.removeCategoria(id, userId);
  }

  @Post('subcategorias')
  @Permisos('productos:crear')
  createSubcategoria(@Body() dto: CreateSubcategoriaDto, @CurrentUser('sub') userId: string) {
    return this.service.createSubcategoria(dto, userId);
  }

  @Get(':id/subcategorias')
  @Permisos('productos:ver')
  findSubcategorias(@Param('id') id: string) {
    return this.service.findSubcategorias(id);
  }

  @Patch('subcategorias/:id')
  @Permisos('productos:editar')
  updateSubcategoria(@Param('id') id: string, @Body() dto: Partial<CreateSubcategoriaDto>, @CurrentUser('sub') userId: string) {
    return this.service.updateSubcategoria(id, dto, userId);
  }
}
