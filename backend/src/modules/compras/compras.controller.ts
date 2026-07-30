import { Controller, Get, Post, Body, Param, Query, Patch } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ComprasService } from './compras.service';
import { CompraXmlService } from './compra-xml.service';
import { CreateCompraDto, PagarFleteDto } from './dto/create-compra.dto';
import { CreateNotaCreditoCompraDto } from './dto/create-nota-credito-compra.dto';
import { ImportarXmlCompraDto } from './dto/importar-xml.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Compras')
@ApiBearerAuth()
@Controller('compras')
export class ComprasController {
  constructor(
    private readonly service: ComprasService,
    private readonly xmlService: CompraXmlService,
  ) {}

  @Post('importar-xml')
  @Permisos('compras:crear')
  @ApiOperation({ summary: 'Leer un XML UBL de factura/boleta de un proveedor y proponer los datos para una compra' })
  importarXml(@Body() dto: ImportarXmlCompraDto) {
    return this.xmlService.parsear(dto.xml);
  }

  @Post()
  @Permisos('compras:crear')
  @ApiOperation({ summary: 'Registrar compra con prorrateo de flete e ingreso de stock' })
  create(@Body() dto: CreateCompraDto, @CurrentUser('sub') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @Permisos('compras:ver')
  @ApiQuery({ name: 'fecha_desde', required: false })
  @ApiQuery({ name: 'fecha_hasta', required: false })
  @ApiQuery({ name: 'id_proveedor', required: false })
  @ApiQuery({ name: 'tipo_documento', required: false })
  findAll(
    @Query() pagination: PaginationDto,
    @Query('fecha_desde') fecha_desde?: string,
    @Query('fecha_hasta') fecha_hasta?: string,
    @Query('id_proveedor') id_proveedor?: string,
    @Query('tipo_documento') tipo_documento?: string,
  ) {
    return this.service.findAll({ ...pagination, skip: Number(pagination.skip) || 0, fecha_desde, fecha_hasta, id_proveedor, tipo_documento } as any);
  }

  @Get(':id')
  @Permisos('compras:ver')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/anular')
  @Permisos('compras:anular')
  @ApiOperation({ summary: 'Anular compra y revertir stock' })
  anular(@Param('id') id: string, @Body() body: { motivo: string }, @CurrentUser('sub') userId: string) {
    return this.service.anular(id, body.motivo, userId);
  }

  @Patch(':id/flete/pagar')
  @Permisos('compras:editar')
  @ApiOperation({ summary: 'Registrar el pago del flete de una compra' })
  pagarFlete(@Param('id') id: string, @Body() dto: PagarFleteDto, @CurrentUser('sub') userId: string) {
    return this.service.pagarFlete(id, dto, userId);
  }

  @Post(':id/nota-credito')
  @Permisos('compras:anular')
  @ApiOperation({ summary: 'Registrar una Nota de Crédito que el proveedor emitió sobre una compra' })
  crearNotaCredito(
    @Param('id') id: string,
    @Body() dto: CreateNotaCreditoCompraDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.crearNotaCreditoCompra(id, dto, userId);
  }
}
