import { api } from './client';
import type { Gasto, ListarGastosParams, CreateGastoDto, PagarGastoDto } from '@/types/gasto';

export const gastosApi = {
  listar: (params: ListarGastosParams) => api.get<Gasto[]>('/gastos', params),
  obtener: (id: string) => api.get<Gasto>(`/gastos/${id}`),
  crear: (dto: CreateGastoDto) => api.post<Gasto>('/gastos', dto),
  anular: (id: string, motivo: string) => api.patch<Gasto>(`/gastos/${id}/anular`, { motivo }),
  pagar: (id: string, dto: PagarGastoDto) => api.patch<Gasto>(`/gastos/${id}/pagar`, dto),
};
