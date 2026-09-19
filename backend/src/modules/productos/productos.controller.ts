import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ProductosService } from './productos.service';
import { ProductoImportacionService } from './producto-importacion.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { AgregarCodigoProveedorDto } from './dto/agregar-codigo-proveedor.dto';
import { ImportarProductosDto } from './dto/importar-productos.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Productos')
@ApiBearerAuth()
@Controller('productos')
export class ProductosController {
  constructor(
    private readonly service: ProductosService,
    private readonly importacionService: ProductoImportacionService,
  ) {}

  @Post()
  @Permisos('productos:crear')
  create(@Body() dto: CreateProductoDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get('importar/plantilla')
  @Permisos('productos:crear')
  @ApiOperation({ summary: 'Descargar la plantilla Excel para importar el catálogo de productos' })
  async descargarPlantillaImportacion(@Res() res: Response) {
    const buffer = await this.importacionService.generarPlantilla();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=plantilla_importacion_productos.xlsx');
    res.send(buffer);
  }

  @Post('importar')
  @Permisos('productos:crear')
  @ApiOperation({ summary: 'Importar productos en lote desde la plantilla Excel' })
  importar(@Body() dto: ImportarProductosDto, @CurrentUser('sub') userId: string) {
    return this.importacionService.importar(dto.file_base64, userId);
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

  @Post(':id/codigos-proveedor')
  @Permisos('productos:editar')
  @ApiOperation({ summary: 'Agregar o actualizar el código que un proveedor usa para este producto' })
  agregarCodigoProveedor(@Param('id') id: string, @Body() dto: AgregarCodigoProveedorDto) {
    return this.service.agregarCodigoProveedor(id, dto);
  }

  @Delete(':id')
  @Permisos('productos:eliminar')
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.service.remove(id, userId);
  }
}
