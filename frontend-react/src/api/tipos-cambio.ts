import { api } from './client';
import type { TipoCambio, CreateTipoCambioDto } from '@/types/tipo-cambio';

export const tiposCambioApi = {
  listar: (limit = 60) => api.get<TipoCambio[]>('/tipos-cambio', { limit }),
  hoy: () => api.get<TipoCambio | null>('/tipos-cambio/hoy'),
  crear: (dto: CreateTipoCambioDto) => api.post<TipoCambio>('/tipos-cambio', dto),
  actualizar: (id: string, dto: Partial<CreateTipoCambioDto>) => api.patch<TipoCambio>(`/tipos-cambio/${id}`, dto),
  eliminar: (id: string) => api.delete<TipoCambio>(`/tipos-cambio/${id}`),
};
