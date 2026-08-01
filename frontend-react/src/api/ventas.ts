import { api } from './client';
import type { Venta, ListarVentasParams, CreateVentaDto, CanjearVentaDto } from '@/types/venta';
import type { CreateNotaCreditoVentaDto } from '@/types/nota-credito';

export const ventasApi = {
  listar: (params: ListarVentasParams) => api.get<Venta[]>('/ventas', params),
  obtener: (id: string) => api.get<Venta>(`/ventas/${id}`),
  crear: (dto: CreateVentaDto) => api.post<Venta>('/ventas', dto),
  anular: (id: string, motivo: string) => api.patch<Venta>(`/ventas/${id}/anular`, { motivo }),
  canjear: (id: string, dto: CanjearVentaDto) => api.post<Venta>(`/ventas/${id}/canjear`, dto),
  reenviarSunat: (id: string) => api.post<Venta>(`/ventas/${id}/reenviar-sunat`),
  crearNotaCredito: (id: string, dto: CreateNotaCreditoVentaDto) => api.post<Venta>(`/ventas/${id}/nota-credito`, dto),
};
