import { api } from './client';
import type { UnidadMedida, CreateUnidadMedidaDto } from '@/types/unidad-medida';

export const unidadesMedidaApi = {
  listar: () => api.get<UnidadMedida[]>('/unidades-medida'),
  crear: (dto: CreateUnidadMedidaDto) => api.post<UnidadMedida>('/unidades-medida', dto),
  actualizar: (id: string, dto: Partial<CreateUnidadMedidaDto>) => api.patch<UnidadMedida>(`/unidades-medida/${id}`, dto),
};
