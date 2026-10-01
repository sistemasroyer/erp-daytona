import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';
import { LetrasCatalogosService } from './letras-catalogos.service';
import { BancoDto, DiaNoPagoDto, GuardarLimitesDto, UpdateBancoDto, UpdateDiaNoPagoDto } from './dto/catalogos.dto';

@ApiTags('Letras — configuración')
@ApiBearerAuth()
@Controller('letras')
export class LetrasCatalogosController {
  constructor(private readonly service: LetrasCatalogosService) {}

  @Get('bancos') @Permisos('letras:ver')
  listarBancos() { return this.service.listarBancos(); }

  @Post('bancos') @Permisos('letras:editar')
  crearBanco(@Body() dto: BancoDto, @CurrentUser('sub') u: string) { return this.service.crearBanco(dto, u); }

  @Patch('bancos/:id') @Permisos('letras:editar')
  actualizarBanco(@Param('id') id: string, @Body() dto: UpdateBancoDto, @CurrentUser('sub') u: string) { return this.service.actualizarBanco(id, dto, u); }

  @Delete('bancos/:id') @Permisos('letras:editar')
  eliminarBanco(@Param('id') id: string, @CurrentUser('sub') u: string) { return this.service.eliminarBanco(id, u); }

  @Get('dias-no-pago') @Permisos('letras:ver')
  @ApiOperation({ summary: 'Feriados y días especiales en que no se programan letras' })
  listarDiasNoPago(@Query('anio') anio?: string) { return this.service.listarDiasNoPago(anio ? Number(anio) : undefined); }

  @Post('dias-no-pago') @Permisos('letras:editar')
  crearDiaNoPago(@Body() dto: DiaNoPagoDto, @CurrentUser('sub') u: string) { return this.service.crearDiaNoPago(dto, u); }

  @Patch('dias-no-pago/:id') @Permisos('letras:editar')
  actualizarDiaNoPago(@Param('id') id: string, @Body() dto: UpdateDiaNoPagoDto, @CurrentUser('sub') u: string) { return this.service.actualizarDiaNoPago(id, dto, u); }

  @Delete('dias-no-pago/:id') @Permisos('letras:editar')
  eliminarDiaNoPago(@Param('id') id: string, @CurrentUser('sub') u: string) { return this.service.eliminarDiaNoPago(id, u); }

  @Get('limites') @Permisos('letras:ver')
  @ApiOperation({ summary: 'Monto máximo de letras a pagar por día de la semana' })
  listarLimites() { return this.service.listarLimites(); }

  @Put('limites') @Permisos('letras:editar')
  guardarLimites(@Body() dto: GuardarLimitesDto, @CurrentUser('sub') u: string) { return this.service.guardarLimites(dto, u); }
}
