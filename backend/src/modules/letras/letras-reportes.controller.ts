import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Permisos } from '../../common/decorators/permisos.decorator';
import { LetrasReportesService } from './letras-reportes.service';
import { FiltroDeudaDto } from './dto/reportes.dto';
import { FiltroLetrasDto } from './dto/cuotas.dto';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('Letras — reportes')
@ApiBearerAuth()
@Controller('letras/reportes')
export class LetrasReportesController {
  constructor(private readonly service: LetrasReportesService) {}

  @Get('deuda') @Permisos('letras:ver')
  @ApiOperation({ summary: 'Deuda por proveedor y moneda: compras sin paquete, paquetes en trámite y letras por vencer / vencidas' })
  deuda(@Query() f: FiltroDeudaDto) { return this.service.deuda(f); }

  @Get('deuda/excel') @Permisos('letras:ver')
  async deudaExcel(@Query() f: FiltroDeudaDto, @Res() res: Response) {
    this.enviar(res, await this.service.deudaExcel(f), 'deuda_proveedores');
  }

  @Get('letras/excel') @Permisos('letras:ver')
  async letrasExcel(@Query() f: FiltroLetrasDto, @Res() res: Response) {
    this.enviar(res, await this.service.letrasExcel(f), 'letras');
  }

  @Get('estado-cuenta/:idProveedor') @Permisos('letras:ver')
  estadoCuenta(@Param('idProveedor') id: string) { return this.service.estadoCuenta(id); }

  private enviar(res: Response, buffer: Buffer, nombre: string) {
    res.setHeader('Content-Type', XLSX);
    res.setHeader('Content-Disposition', `attachment; filename=${nombre}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    res.send(buffer);
  }
}
