import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';
import { LetrasCuotasService } from './letras-cuotas.service';
import {
  CalendarioDto, CambiarFechaLetraDto, CambiarMontoLetraDto, CodigoBancoDto, EliminarLetraDto, FiltroLetrasDto, PagarLetraDto,
} from './dto/cuotas.dto';

@ApiTags('Letras — cuotas')
@ApiBearerAuth()
@Controller('letras')
export class LetrasCuotasController {
  constructor(private readonly service: LetrasCuotasService) {}

  @Get('cuotas') @Permisos('letras:ver')
  listar(@Query() filtros: FiltroLetrasDto) { return this.service.listar(filtros); }

  @Get('cuotas/resumen') @Permisos('letras:ver')
  @ApiOperation({ summary: 'Totales por moneda y estado (con los mismos filtros del listado)' })
  resumen(@Query() filtros: FiltroLetrasDto) { return this.service.resumen(filtros); }

  @Get('calendario') @Permisos('letras:ver')
  calendario(@Query() dto: CalendarioDto) { return this.service.calendario(dto); }

  @Patch('cuotas/:id/pagar') @Permisos('letras:editar')
  pagar(@Param('id') id: string, @Body() dto: PagarLetraDto, @CurrentUser('sub') u: string) { return this.service.pagar(id, dto, u); }

  @Patch('cuotas/:id/codigo-banco') @Permisos('letras:editar')
  codigoBanco(@Param('id') id: string, @Body() dto: CodigoBancoDto, @CurrentUser('sub') u: string) { return this.service.codigoBanco(id, dto, u); }

  @Patch('cuotas/:id/monto') @Permisos('letras:editar')
  monto(@Param('id') id: string, @Body() dto: CambiarMontoLetraDto, @CurrentUser('sub') u: string) { return this.service.cambiarMonto(id, dto, u); }

  @Patch('cuotas/:id/fecha') @Permisos('letras:editar')
  fecha(@Param('id') id: string, @Body() dto: CambiarFechaLetraDto, @CurrentUser('sub') u: string) { return this.service.cambiarFecha(id, dto, u); }

  @Patch('cuotas/:id/eliminar') @Permisos('letras:eliminar')
  eliminar(@Param('id') id: string, @Body() dto: EliminarLetraDto, @CurrentUser('sub') u: string) { return this.service.eliminar(id, dto, u); }
}
