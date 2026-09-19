import { Controller, Get, Query, Param, Res, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportesService, FiltroReporte, AgrupacionVentas } from './reportes.service';
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

  private validarAgrupacion(valor: string): AgrupacionVentas {
    if (!['producto', 'marca', 'punto_venta'].includes(valor)) {
      throw new BadRequestException('agrupar_por debe ser "producto", "marca" o "punto_venta"');
    }
    return valor as AgrupacionVentas;
  }

  @Get('ventas-agrupado')
  @Permisos('reportes:ver')
  @ApiOperation({ summary: 'Ventas agrupadas por producto, marca o punto de venta (unidades y soles)' })
  @ApiQuery({ name: 'agrupar_por', enum: ['producto', 'marca', 'punto_venta'] })
  reporteVentasAgrupado(
    @Query() filtros: FiltroReporte & { agrupar_por: string },
    @CurrentUser('idPuntoVenta') idPuntoVenta: string,
    @CurrentUser('esSuperadmin') esSuperadmin: boolean,
  ) {
    const agrupar_por = this.validarAgrupacion(filtros.agrupar_por);
    return this.service.reporteVentasAgrupado({ ...this.filtrarPorPuntoVenta(filtros, idPuntoVenta, esSuperadmin), agrupar_por });
  }

  @Get('ventas-agrupado/export/excel')
  @Permisos('reportes:ver')
  @ApiOperation({ summary: 'Exportar ventas agrupadas a Excel' })
  @ApiQuery({ name: 'agrupar_por', enum: ['producto', 'marca', 'punto_venta'] })
  async exportarVentasAgrupadoExcel(
    @Query() filtros: FiltroReporte & { agrupar_por: string },
    @Res() res: Response,
    @CurrentUser('idPuntoVenta') idPuntoVenta: string,
    @CurrentUser('esSuperadmin') esSuperadmin: boolean,
  ) {
    const agrupar_por = this.validarAgrupacion(filtros.agrupar_por);
    const buffer = await this.service.exportarVentasAgrupadoExcel({ ...this.filtrarPorPuntoVenta(filtros, idPuntoVenta, esSuperadmin), agrupar_por });
    const fecha = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=ventas_por_${agrupar_por}_${fecha}.xlsx`);
    res.send(buffer);
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

  @Get('tomas-inventario')
  @Permisos('reportes:ver')
  @ApiOperation({ summary: 'Reporte de diferencias de tomas de inventario (sobrantes/faltantes)' })
  reporteTomasInventario(@Query() filtros: FiltroReporte & { search?: string; tipo_diferencia?: 'sobra' | 'falta' | 'ok'; estado_toma?: string }) {
    return this.service.reporteTomasInventario(filtros);
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
  @ApiOperation({ summary: 'Reporte de auditoría (solo administradores)' })
  reporteAuditoria(@Query() filtros: any, @CurrentUser('esSuperadmin') esSuperadmin: boolean) {
    if (!esSuperadmin) {
      throw new ForbiddenException('Solo un administrador puede ver el reporte de auditoría');
    }
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

  @Get('tomas-inventario/export/excel')
  @Permisos('reportes:ver')
  @ApiOperation({ summary: 'Exportar diferencias de tomas de inventario a Excel' })
  async exportarTomasInventarioExcel(
    @Query() filtros: FiltroReporte & { search?: string; tipo_diferencia?: 'sobra' | 'falta' | 'ok'; estado_toma?: string },
    @Res() res: Response,
  ) {
    const buffer = await this.service.exportarTomasInventarioExcel(filtros);
    const fecha = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=tomas_inventario_${fecha}.xlsx`);
    res.send(buffer);
  }
}
