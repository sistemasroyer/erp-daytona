import { api } from './client';
import type { MovimientoKardex, FiltrosKardex } from '@/types/kardex';
import type { FiltroReporte, ReporteVentas, ReporteCompras, ItemReporteInventario, RegistroAuditoria } from '@/types/reportes';
import { descargarBlob, hoy } from '@/utils/download';

export const reportesApi = {
  kardex: (idProducto: string, filtros: FiltrosKardex) => api.get<MovimientoKardex[]>(`/reportes/kardex/${idProducto}`, filtros),
  ventas: (filtros: FiltroReporte) => api.get<ReporteVentas>('/reportes/ventas', filtros),
  compras: (filtros: FiltroReporte) => api.get<ReporteCompras>('/reportes/compras', filtros),
  inventario: (filtros: FiltroReporte) => api.get<ItemReporteInventario[]>('/reportes/inventario', filtros),
  auditoria: (filtros: FiltroReporte) => api.get<RegistroAuditoria[]>('/reportes/auditoria', filtros),
  exportarVentasExcel: async (filtros: FiltroReporte) => {
    const blob = await api.getBlob('/reportes/ventas/export/excel', filtros);
    descargarBlob(blob, `ventas_${hoy()}.xlsx`);
  },
  exportarInventarioExcel: async (filtros: FiltroReporte) => {
    const blob = await api.getBlob('/reportes/inventario/export/excel', filtros);
    descargarBlob(blob, `inventario_${hoy()}.xlsx`);
  },
};
