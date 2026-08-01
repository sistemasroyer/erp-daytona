import { Controller, Get, Post, Body, Param, Query, Patch } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { GastosService } from './gastos.service';
import { CreateGastoDto } from './dto/create-gasto.dto';
import { PagarGastoDto } from './dto/pagar-gasto.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Gastos')
@ApiBearerAuth()
@Controller('gastos')
export class GastosController {
  constructor(private readonly service: GastosService) {}

  @Post()
  @Permisos('gastos:crear')
  @ApiOperation({ summary: 'Registrar una factura de gasto (flete, alquiler, servicios, comida, honorarios, etc.)' })
  create(@Body() dto: CreateGastoDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permisos('gastos:ver')
  @ApiQuery({ name: 'categoria', required: false })
  @ApiQuery({ name: 'estado', required: false })
  @ApiQuery({ name: 'pagado', required: false })
  @ApiQuery({ name: 'fecha_desde', required: false })
  @ApiQuery({ name: 'fecha_hasta', required: false })
  @ApiQuery({ name: 'id_proveedor', required: false })
  @ApiQuery({ name: 'sin_vincular', required: false, description: 'true = solo gastos sin compra vinculada (id_compra_relacionada IS NULL)' })
  @ApiQuery({ name: 'id_compra_relacionada', required: false })
  findAll(
    @Query() pagination: PaginationDto,
    @Query('categoria') categoria?: string,
    @Query('estado') estado?: string,
    @Query('pagado') pagado?: string,
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
    @Query('id_proveedor') id_proveedor?: string,
    @Query('sin_vincular') sin_vincular?: string,
    @Query('id_compra_relacionada') id_compra_relacionada?: string,
  ) {
    return this.service.findAll({
      ...pagination, skip: Number(pagination.skip) || 0,
      categoria, estado, pagado, fecha_desde, fecha_hasta, id_proveedor, sin_vincular, id_compra_relacionada,
    } as any);
  }

  @Get(':id')
  @Permisos('gastos:ver')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/anular')
  @Permisos('gastos:anular')
  @ApiOperation({ summary: 'Anular un gasto (no pagado)' })
  anular(@Param('id') id: string, @Body() body: { motivo: string }, @CurrentUser('sub') userId: string) {
    return this.service.anular(id, body.motivo, userId);
  }

  @Patch(':id/pagar')
  @Permisos('gastos:editar')
  @ApiOperation({ summary: 'Registrar el pago de un gasto' })
  pagar(@Param('id') id: string, @Body() dto: PagarGastoDto, @CurrentUser('sub') userId: string) {
    return this.service.pagar(id, dto, userId);
  }
}
