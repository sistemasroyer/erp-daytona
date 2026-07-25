import { Controller, Get, Post, Body, Param, Query, Patch } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CajaService, AbrirCajaDto, CerrarCajaDto, MovimientoCajaDto } from './caja.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Caja')
@ApiBearerAuth()
@Controller('caja')
export class CajaController {
  constructor(private readonly service: CajaService) {}

  @Get('cajas')
  @Permisos('caja:ver')
  findCajas(
    @Query() pagination: PaginationDto,
    @CurrentUser('idPuntoVenta') idPuntoVenta: string,
    @CurrentUser('esSuperadmin') esSuperadmin: boolean,
  ) {
    return this.service.findCajas(pagination, idPuntoVenta, esSuperadmin);
  }

  @Post('cajas')
  @Permisos('caja:crear')
  createCaja(
    @Body() dto: any,
    @CurrentUser('sub') userId: string,
    @CurrentUser('idPuntoVenta') idPuntoVenta: string,
    @CurrentUser('esSuperadmin') esSuperadmin: boolean,
  ) {
    return this.service.createCaja(dto, userId, idPuntoVenta, esSuperadmin);
  }

  @Get('cajas/:idCaja/apertura-activa')
  @Permisos('caja:ver')
  getCajaActiva(
    @Param('idCaja') id: string,
    @CurrentUser('idPuntoVenta') idPuntoVenta: string,
    @CurrentUser('esSuperadmin') esSuperadmin: boolean,
  ) {
    return this.service.getCajaActiva(id, idPuntoVenta, esSuperadmin);
  }

  @Get('cajas/:idCaja/aperturas')
  @Permisos('caja:ver')
  getAperturas(
    @Param('idCaja') id: string,
    @Query() pagination: PaginationDto,
    @CurrentUser('idPuntoVenta') idPuntoVenta: string,
    @CurrentUser('esSuperadmin') esSuperadmin: boolean,
  ) {
    return this.service.getAperturas(id, pagination, idPuntoVenta, esSuperadmin);
  }

  @Post('abrir')
  @Permisos('caja:crear')
  @ApiOperation({ summary: 'Abrir caja (apertura)' })
  abrir(
    @Body() dto: AbrirCajaDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('idPuntoVenta') idPuntoVenta: string,
    @CurrentUser('esSuperadmin') esSuperadmin: boolean,
  ) {
    return this.service.abrirCaja(dto, userId, idPuntoVenta, esSuperadmin);
  }

  @Patch('aperturas/:id/cerrar')
  @Permisos('caja:editar')
  @ApiOperation({ summary: 'Cerrar caja con cuadre y diferencia' })
  cerrar(
    @Param('id') id: string,
    @Body() dto: CerrarCajaDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('idPuntoVenta') idPuntoVenta: string,
    @CurrentUser('esSuperadmin') esSuperadmin: boolean,
  ) {
    return this.service.cerrarCaja(id, dto, userId, idPuntoVenta, esSuperadmin);
  }

  @Get('aperturas/:id/resumen')
  @Permisos('caja:ver')
  @ApiOperation({ summary: 'Resumen y movimientos de una apertura' })
  resumen(
    @Param('id') id: string,
    @CurrentUser('idPuntoVenta') idPuntoVenta: string,
    @CurrentUser('esSuperadmin') esSuperadmin: boolean,
  ) {
    return this.service.getResumenCaja(id, idPuntoVenta, esSuperadmin);
  }

  @Post('aperturas/:id/movimientos')
  @Permisos('caja:crear')
  @ApiOperation({ summary: 'Registrar ingreso o egreso manual en caja' })
  movimiento(
    @Param('id') id: string,
    @Body() dto: MovimientoCajaDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser('idPuntoVenta') idPuntoVenta: string,
    @CurrentUser('esSuperadmin') esSuperadmin: boolean,
  ) {
    return this.service.registrarMovimiento(id, dto, userId, idPuntoVenta, esSuperadmin);
  }
}
