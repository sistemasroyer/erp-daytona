import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProductosService } from './productos.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Productos')
@ApiBearerAuth()
@Controller('productos')
export class ProductosController {
  constructor(private readonly service: ProductosService) {}

  @Post()
  @Permisos('productos:crear')
  create(@Body() dto: CreateProductoDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permisos('productos:ver')
  @ApiQuery({ name: 'id_categoria', required: false })
  @ApiQuery({ name: 'con_stock', required: false, type: Boolean })
  findAll(@Query() pagination: PaginationDto, @Query('id_categoria') id_categoria?: string, @Query('con_stock') con_stock?: string) {
    return this.service.findAll({ ...pagination, skip: Number(pagination.skip) || 0, id_categoria, con_stock: con_stock === 'true' } as any);
  }

  @Get('alertas/stock')
  @Permisos('productos:ver')
  @ApiOperation({ summary: 'Productos con stock bajo el mínimo' })
  getStockAlerta() {
    return this.service.getStockAlerta();
  }

  @Get('barras/:codigo')
  @Permisos('productos:ver')
  @ApiOperation({ summary: 'Buscar producto por código de barras' })
  findByCodigoBarras(@Param('codigo') codigo: string) {
    return this.service.findByCodigoBarras(codigo);
  }

  @Get(':id')
  @Permisos('productos:ver')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/precio/:tipo')
  @Permisos('productos:ver')
  @ApiOperation({ summary: 'Obtener precio por tipo (1-5)' })
  getPrecio(@Param('id') id: string, @Param('tipo') tipo: string) {
    return this.service.getPreciosByTipo(id, parseInt(tipo));
  }

  @Patch(':id')
  @Permisos('productos:editar')
  update(@Param('id') id: string, @Body() dto: Partial<CreateProductoDto>, @CurrentUser('sub') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @Permisos('productos:eliminar')
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.remove(id, userId);
  }
}
