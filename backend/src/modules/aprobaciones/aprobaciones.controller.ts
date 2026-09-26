import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AprobacionesService } from './aprobaciones.service';
import { ConfigurarPinDto, DesactivarPinDto, DocumentoAprobacionDto, SolicitarAprobacionDto } from './aprobaciones.dto';

@Controller('aprobaciones')
export class AprobacionesController {
  constructor(private readonly service: AprobacionesService) {}
  @Get('mi-pin')
  estado(@CurrentUser('sub') id: string) { return this.service.estadoPin(id); }
  @Patch('mi-pin')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  configurar(@CurrentUser('sub') id: string, @Body() dto: ConfigurarPinDto) { return this.service.configurarPin(id, dto); }
  @Post('mi-pin/desactivar')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  desactivar(@CurrentUser('sub') id: string, @Body() dto: DesactivarPinDto) { return this.service.desactivarPin(id, dto.password); }
  @Get('supervisores')
  supervisores(@CurrentUser('sub') id: string, @Query() dto: DocumentoAprobacionDto) { return this.service.supervisores(id, dto); }
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  aprobar(@CurrentUser('sub') id: string, @Body() dto: SolicitarAprobacionDto) { return this.service.aprobar(id, dto); }
  @Get('historial')
  historial(@CurrentUser('sub') id: string) { return this.service.historial(id); }
}
