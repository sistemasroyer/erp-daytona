import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InventarioService, InicializarStockDto, TransferenciaInventarioDto } from './inventario.service';
import { CreateAjusteInventarioDto } from './dto/ajuste-inventario.dto';
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
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'skip', required: false })
  getKardex(
    @Param('idProducto') id: string,
    @Query('id_almacen') idAlmacen?: string,
    @Query('fecha_desde') fechaDesde?: string,
    @Query('fecha_hasta') fechaHasta?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.service.getKardex(id, idAlmacen, fechaDesde, fechaHasta, Number(limit) || undefined, Number(skip) || undefined);
  }

  @Post('inicializar')
  @Permisos('inventario:crear')
  @ApiOperation({ summary: 'Inicializar stock de un producto' })
  inicializar(@Body() dto: InicializarStockDto, @CurrentUser('sub') userId: string) {
    return this.service.inicializarStock(dto, userId);
  }

  @Post('ajustes')
  @Permisos('inventario:editar')
  @ApiOperation({ summary: 'Registrar un documento de ajuste de inventario (uno o varios productos)' })
  crearAjuste(@Body() dto: CreateAjusteInventarioDto, @CurrentUser('sub') userId: string) {
    return this.service.crearAjuste(dto, userId);
  }

  @Get('ajustes')
  @Permisos('inventario:ver')
  @ApiOperation({ summary: 'Listar documentos de ajuste de inventario' })
  @ApiQuery({ name: 'id_almacen', required: false })
  @ApiQuery({ name: 'motivo', required: false })
  listarAjustes(
    @Query() pagination: PaginationDto,
    @Query('id_almacen') id_almacen?: string,
    @Query('motivo') motivo?: string,
  ) {
    return this.service.findAllAjustes({ ...pagination, skip: Number(pagination.skip) || 0, id_almacen, motivo } as any);
  }

  @Get('ajustes/:id')
  @Permisos('inventario:ver')
  @ApiOperation({ summary: 'Detalle de un documento de ajuste de inventario' })
  obtenerAjuste(@Param('id') id: string) {
    return this.service.findOneAjuste(id);
  }

  @Post('transferencia')
  @Permisos('inventario:editar')
  @ApiOperation({ summary: 'Transferir stock de un producto entre almacenes' })
  transferir(@Body() dto: TransferenciaInventarioDto, @CurrentUser('sub') userId: string) {
    return this.service.transferir(dto, userId);
  }
}
