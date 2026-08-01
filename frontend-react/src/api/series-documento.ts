import { api } from './client';
import type { PuntoVenta } from '@/types/punto-venta';
import type { SerieDocumento, CreateSerieDto } from '@/types/serie-documento';

export const seriesDocumentoApi = {
  puntosVenta: () => api.get<PuntoVenta[]>('/series-documento/puntos-venta'),
  listar: (idPuntoVenta?: string) => api.get<SerieDocumento[]>('/series-documento', { id_punto_venta: idPuntoVenta }),
  crear: (dto: CreateSerieDto) => api.post<SerieDocumento>('/series-documento', dto),
  actualizar: (id: string, dto: { activo: boolean }) => api.patch<SerieDocumento>(`/series-documento/${id}`, dto),
  resetCorrelativo: (id: string, correlativo: number) => api.patch<SerieDocumento>(`/series-documento/${id}/reset-correlativo`, { correlativo }),
  eliminar: (id: string) => api.delete<SerieDocumento>(`/series-documento/${id}`),
};
