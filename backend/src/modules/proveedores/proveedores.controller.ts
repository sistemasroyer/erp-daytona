import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProveedoresService, CreateProveedorDto } from './proveedores.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Proveedores')
@ApiBearerAuth()
@Controller('proveedores')
export class ProveedoresController {
  constructor(private readonly service: ProveedoresService) {}

  @Post()
  @Permisos('proveedores:crear')
  create(@Body() dto: CreateProveedorDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permisos('proveedores:ver')
  findAll(@Query() pagination: PaginationDto) {
    return this.service.findAll(pagination);
  }

  @Get('consultar/ruc/:ruc')
  @Permisos('proveedores:ver')
  @ApiOperation({ summary: 'Consultar RUC proveedor en SUNAT' })
  consultarRuc(@Param('ruc') ruc: string) {
    return this.service.consultarRuc(ruc);
  }

  @Get(':id')
  @Permisos('proveedores:ver')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permisos('proveedores:editar')
  update(@Param('id') id: string, @Body() dto: Partial<CreateProveedorDto>, @CurrentUser('sub') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @Permisos('proveedores:eliminar')
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.remove(id, userId);
  }
}
