import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InventarioService, AjusteInventarioDto, InicializarStockDto } from './inventario.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Inventario')
@ApiBearerAuth()
@Controller('inventario')
export class InventarioController {
  constructor(private readonly service: InventarioService) {}

  @Get()
  @Permisos('inventario:ver')
  @ApiQuery({ name: 'id_almacen', required: false })
  listar(@Query() pagination: PaginationDto, @Query('id_almacen') id_almacen?: string) {
    return this.service.listarInventario({ ...pagination, skip: Number(pagination.skip) || 0, id_almacen } as any);
  }

  @Get('producto/:idProducto')
  @Permisos('inventario:ver')
  @ApiOperation({ summary: 'Stock de un producto por almacén' })
  getStock(@Param('idProducto') id: string, @Query('id_almacen') idAlmacen?: string) {
    return this.service.getStock(id, idAlmacen);
  }

  @Get('producto/:idProducto/movimientos')
  @Permisos('inventario:ver')
  @ApiQuery({ name: 'id_almacen', required: false })
  @ApiQuery({ name: 'fecha_desde', required: false })
  @ApiQuery({ name: 'fecha_hasta', required: false })
  getMovimientos(
    @Param('idProducto') id: string,
    @Query('id_almacen') idAlmacen?: string,
    @Query('fecha_desde') fechaDesde?: string,
    @Query('fecha_hasta') fechaHasta?: string,
  ) {
    return this.service.getMovimientos(
      id,
      idAlmacen,
      fechaDesde ? new Date(fechaDesde) : undefined,
      fechaHasta ? new Date(fechaHasta) : undefined,
    );
  }

  @Get('kardex/:idProducto')
  @Permisos('inventario:ver')
  @ApiOperation({ summary: 'Kardex de un producto (inmutable)' })
  getKardex(
    @Param('idProducto') id: string,
    @Query('id_almacen') idAlmacen?: string,
    @Query('fecha_desde') fechaDesde?: string,
    @Query('fecha_hasta') fechaHasta?: string,
  ) {
    return this.service.getKardex(id, idAlmacen, fechaDesde, fechaHasta);
  }

  @Post('inicializar')
  @Permisos('inventario:crear')
  @ApiOperation({ summary: 'Inicializar stock de un producto' })
  inicializar(@Body() dto: InicializarStockDto, @CurrentUser('sub') userId: string) {
    return this.service.inicializarStock(dto, userId);
  }

  @Post('ajuste')
  @Permisos('inventario:editar')
  @ApiOperation({ summary: 'Registrar ajuste de inventario (+/-)' })
  ajustar(@Body() dto: AjusteInventarioDto, @CurrentUser('sub') userId: string) {
    return this.service.ajustar(dto, userId);
  }
}
