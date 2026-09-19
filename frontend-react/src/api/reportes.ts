import { api } from './client';
import type { MovimientoKardex, FiltrosKardex } from '@/types/kardex';
import type { FiltroReporte, ReporteVentas, ReporteVentasAgrupado, AgrupacionVentas, ReporteCompras, ItemReporteInventario, ReporteTomasInventario, RegistroAuditoria } from '@/types/reportes';
import { descargarBlob, hoy } from '@/utils/download';

export const reportesApi = {
  kardex: (idProducto: string, filtros: FiltrosKardex) => api.get<MovimientoKardex[]>(`/reportes/kardex/${idProducto}`, filtros),
  ventas: (filtros: FiltroReporte) => api.get<ReporteVentas>('/reportes/ventas', filtros),
  ventasAgrupado: (agrupar_por: AgrupacionVentas, filtros: FiltroReporte & { id_punto_venta?: string }) =>
    api.get<ReporteVentasAgrupado>('/reportes/ventas-agrupado', { ...filtros, agrupar_por }),
  compras: (filtros: FiltroReporte) => api.get<ReporteCompras>('/reportes/compras', filtros),
  inventario: (filtros: FiltroReporte) => api.get<ItemReporteInventario[]>('/reportes/inventario', filtros),
  tomasInventario: (filtros: FiltroReporte & { search?: string; tipo_diferencia?: string; estado_toma?: string }) =>
    api.get<ReporteTomasInventario>('/reportes/tomas-inventario', filtros),
  auditoria: (filtros: FiltroReporte) => api.get<RegistroAuditoria[]>('/reportes/auditoria', filtros),
  exportarVentasExcel: async (filtros: FiltroReporte) => {
    const blob = await api.getBlob('/reportes/ventas/export/excel', filtros);
    descargarBlob(blob, `ventas_${hoy()}.xlsx`);
  },
  exportarVentasAgrupadoExcel: async (agrupar_por: AgrupacionVentas, filtros: FiltroReporte & { id_punto_venta?: string }) => {
    const blob = await api.getBlob('/reportes/ventas-agrupado/export/excel', { ...filtros, agrupar_por });
    descargarBlob(blob, `ventas_por_${agrupar_por}_${hoy()}.xlsx`);
  },
  exportarInventarioExcel: async (filtros: FiltroReporte) => {
    const blob = await api.getBlob('/reportes/inventario/export/excel', filtros);
    descargarBlob(blob, `inventario_${hoy()}.xlsx`);
  },
  exportarTomasInventarioExcel: async (filtros: FiltroReporte & { search?: string; tipo_diferencia?: string; estado_toma?: string }) => {
    const blob = await api.getBlob('/reportes/tomas-inventario/export/excel', filtros);
    descargarBlob(blob, `tomas_inventario_${hoy()}.xlsx`);
  },
};
