import { Controller, Get, Post, Body, Param, Delete, Query, Patch, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { VentasService } from './ventas.service';
import { CreateVentaDto, AnularVentaDto, CanjearVentaDto } from './dto/create-venta.dto';
import { CreateNotaCreditoDto } from './dto/create-nota-credito.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Ventas')
@ApiBearerAuth()
@Controller('ventas')
export class VentasController {
  constructor(private readonly service: VentasService) {}

  @Post()
  @Permisos('ventas:crear')
  @ApiOperation({ summary: 'Crear venta (emite evento de descuento de stock y SUNAT)' })
  create(
    @Body() dto: CreateVentaDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('idPuntoVenta') idPuntoVenta: string,
  ) {
    return this.service.create(dto, userId, idPuntoVenta);
  }

  @Get()
  @Permisos('ventas:ver')
  @ApiQuery({ name: 'fecha_desde', required: false })
  @ApiQuery({ name: 'fecha_hasta', required: false })
  @ApiQuery({ name: 'estado_sunat', required: false })
  @ApiQuery({ name: 'tipo_documento', required: false })
  @ApiQuery({ name: 'id_usuario', required: false, description: 'Solo superadmin puede filtrar por otro vendedor' })
  findAll(
    @Query() pagination: PaginationDto,
    @Query('fecha_desde') fecha_desde: string,
    @Query('fecha_hasta') fecha_hasta: string,
    @Query('estado_sunat') estado_sunat: string,
    @Query('tipo_documento') tipo_documento: string,
    @Query('id_usuario') id_usuario: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('idPuntoVenta') idPuntoVenta: string,
    @CurrentUser('esSuperadmin') esSuperadmin: boolean,
  ) {
    return this.service.findAll({
      ...pagination,
      skip: Number(pagination.skip) || 0,
      fecha_desde,
      fecha_hasta,
      estado_sunat,
      tipo_documento,
      // Un vendedor/cajero solo ve sus propias ventas; el superadmin ve todas
      // o puede acotar a un vendedor puntual mediante ?id_usuario=.
      id_usuario: esSuperadmin ? (id_usuario || undefined) : userId,
      id_punto_venta: esSuperadmin ? undefined : idPuntoVenta,
    } as any);
  }

  @Get(':id')
  @Permisos('ventas:ver')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/anular')
  @Permisos('ventas:anular')
  @ApiOperation({ summary: 'Anular venta (solo admin/supervisor con permiso anular)' })
  anular(@Param('id') id: string, @Body() dto: AnularVentaDto, @CurrentUser('sub') userId: string) {
    return this.service.anular(id, dto, userId);
  }

  @Post(':id/nota-credito')
  @Permisos('ventas:anular')
  @ApiOperation({ summary: 'Emitir una Nota de Crédito sobre una Factura/Boleta (aceptada o no por SUNAT)' })
  crearNotaCredito(
    @Param('id') id: string,
    @Body() dto: CreateNotaCreditoDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.crearNotaCredito(id, dto, userId);
  }

  @Post(':id/reenviar-sunat')
  @Permisos('facturacion:crear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenviar venta a SUNAT manualmente' })
  reenviarSunat(@Param('id') id: string) {
    return this.service.reenviarSunat(id);
  }

  @Post(':id/canjear')
  @Permisos('ventas:crear')
  @ApiOperation({ summary: 'Canjear una Nota de Venta o Cotización a un documento oficial (Boleta/Factura)' })
  canjear(
    @Param('id') id: string,
    @Body() dto: CanjearVentaDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('idPuntoVenta') idPuntoVenta: string,
  ) {
    return this.service.canjear(id, dto, userId, idPuntoVenta);
  }
}
