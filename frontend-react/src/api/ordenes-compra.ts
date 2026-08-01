import { api } from './client';
import type { OrdenCompra, CreateOrdenCompraDto } from '@/types/orden-compra';

export interface ListarOrdenesParams {
  page?: number;
  limit?: number;
  estado?: string;
}

export const ordenesCompraApi = {
  listar: (params: ListarOrdenesParams) => api.get<OrdenCompra[]>('/ordenes-compra', params),
  obtener: (id: string) => api.get<OrdenCompra>(`/ordenes-compra/${id}`),
  crear: (dto: CreateOrdenCompraDto) => api.post<OrdenCompra>('/ordenes-compra', dto),
  aprobar: (id: string) => api.patch<OrdenCompra>(`/ordenes-compra/${id}/aprobar`),
  anular: (id: string) => api.patch<OrdenCompra>(`/ordenes-compra/${id}/anular`),
};
