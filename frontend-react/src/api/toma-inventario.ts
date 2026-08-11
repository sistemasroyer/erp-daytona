import { api } from './client';
import type { TomaInventario, AgregarItemTomaDto, ListarTomasInventarioParams } from '@/types/toma-inventario';

export const tomaInventarioApi = {
  listar: (params: ListarTomasInventarioParams) => api.get<TomaInventario[]>('/toma-inventario', params),
  obtener: (id: string) => api.get<TomaInventario>(`/toma-inventario/${id}`),
  crear: () => api.post<TomaInventario>('/toma-inventario', {}),
  agregarItem: (id: string, dto: AgregarItemTomaDto) => api.post<TomaInventario>(`/toma-inventario/${id}/items`, dto),
  quitarItem: (id: string, idProducto: string) => api.delete<TomaInventario>(`/toma-inventario/${id}/items/${idProducto}`),
  finalizar: (id: string) => api.patch<TomaInventario>(`/toma-inventario/${id}/finalizar`),
  anular: (id: string) => api.patch<TomaInventario>(`/toma-inventario/${id}/anular`),
};
