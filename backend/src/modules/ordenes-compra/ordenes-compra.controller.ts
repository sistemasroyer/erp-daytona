import { Controller, Get, Post, Body, Param, Query, Patch } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { OrdenesCompraService, CreateOrdenCompraDto } from './ordenes-compra.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Órdenes de Compra')
@ApiBearerAuth()
@Controller('ordenes-compra')
export class OrdenesCompraController {
  constructor(private readonly service: OrdenesCompraService) {}

  @Post()
  @Permisos('ordenes_compra:crear')
  @ApiOperation({ summary: 'Crear orden de compra (estado: borrador)' })
  create(@Body() dto: CreateOrdenCompraDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permisos('ordenes_compra:ver')
  @ApiQuery({ name: 'estado', required: false, enum: ['borrador', 'aprobado', 'convertido', 'anulado'] })
  findAll(@Query() pagination: PaginationDto, @Query('estado') estado?: string) {
    return this.service.findAll({ ...pagination, skip: Number(pagination.skip) || 0, estado } as any);
  }

  @Get(':id')
  @Permisos('ordenes_compra:ver')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permisos('ordenes_compra:editar')
  @ApiOperation({ summary: 'Editar orden (solo en estado borrador)' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateOrdenCompraDto>, @CurrentUser('sub') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Patch(':id/aprobar')
  @Permisos('ordenes_compra:aprobar')
  @ApiOperation({ summary: 'Aprobar orden de compra (flujo: borrador → aprobado)' })
  aprobar(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.aprobar(id, userId);
  }

  @Patch(':id/anular')
  @Permisos('ordenes_compra:anular')
  @ApiOperation({ summary: 'Anular orden de compra' })
  anular(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.anular(id, userId);
  }
}
