import { Controller, Get, Query, Param, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportesService, FiltroReporte } from './reportes.service';
import { Permisos } from '../../common/decorators/permisos.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Reportes')
@ApiBearerAuth()
@Controller('reportes')
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  /** Los usuarios normales solo ven reportes de ventas de su propio punto de venta. */
  private filtrarPorPuntoVenta(filtros: FiltroReporte, idPuntoVenta?: string, esSuperadmin?: boolean): FiltroReporte {
    if (esSuperadmin) return filtros;
    return { ...filtros, id_punto_venta: idPuntoVenta };
  }

  @Get('ventas')
  @Permisos('reportes:ver')
  @ApiOperation({ summary: 'Reporte de ventas' })
  reporteVentas(
    @Query() filtros: FiltroReporte,
    @CurrentUser('idPuntoVenta') idPuntoVenta: string,
    @CurrentUser('esSuperadmin') esSuperadmin: boolean,
  ) {
    return this.service.reporteVentas(this.filtrarPorPuntoVenta(filtros, idPuntoVenta, esSuperadmin));
  }

  @Get('compras')
  @Permisos('reportes:ver')
  reporteCompras(@Query() filtros: FiltroReporte) {
    return this.service.reporteCompras(filtros);
  }

  @Get('inventario')
  @Permisos('reportes:ver')
  reporteInventario(@Query() filtros: FiltroReporte) {
    return this.service.reporteInventario(filtros);
  }

  @Get('kardex/:idProducto')
  @Permisos('reportes:ver')
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'skip', required: false })
  reporteKardex(
    @Param('idProducto') id: string,
    @Query() filtros: FiltroReporte & { limit?: number; skip?: number },
  ) {
    return this.service.reporteKardex(id, filtros);
  }

  @Get('auditoria')
  @Permisos('reportes:ver')
  reporteAuditoria(@Query() filtros: any) {
    return this.service.reporteAuditoria(filtros);
  }

  @Get('ventas/export/excel')
  @Permisos('reportes:ver')
  @ApiOperation({ summary: 'Exportar ventas a Excel' })
  async exportarVentasExcel(
    @Query() filtros: FiltroReporte,
    @Res() res: Response,
    @CurrentUser('idPuntoVenta') idPuntoVenta: string,
    @CurrentUser('esSuperadmin') esSuperadmin: boolean,
  ) {
    const buffer = await this.service.exportarVentasExcel(this.filtrarPorPuntoVenta(filtros, idPuntoVenta, esSuperadmin));
    const fecha = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=ventas_${fecha}.xlsx`);
    res.send(buffer);
  }

  @Get('inventario/export/excel')
  @Permisos('reportes:ver')
  @ApiOperation({ summary: 'Exportar inventario a Excel' })
  async exportarInventarioExcel(@Query() filtros: FiltroReporte, @Res() res: Response) {
    const buffer = await this.service.exportarInventarioExcel(filtros);
    const fecha = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=inventario_${fecha}.xlsx`);
    res.send(buffer);
  }
}
