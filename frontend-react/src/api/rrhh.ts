import { api } from './client';
import type { Personal, CreatePersonalDto } from '@/types/personal';

export interface ListarParams {
  page?: number;
  limit?: number;
  search?: string;
}

// El controller del backend vive en 'rrhh/personal', no 'rrhh' (la app vieja le
// apuntaba mal a '/rrhh' y todas sus llamadas fallaban con 404).
export const rrhhApi = {
  listar: (params: ListarParams) => api.get<Personal[]>('/rrhh/personal', params),
  obtener: (id: string) => api.get<Personal>(`/rrhh/personal/${id}`),
  crear: (dto: CreatePersonalDto) => api.post<Personal>('/rrhh/personal', dto),
  actualizar: (id: string, dto: Partial<CreatePersonalDto>) => api.patch<Personal>(`/rrhh/personal/${id}`, dto),
  cesar: (id: string, fechaCese: string) => api.patch<Personal>(`/rrhh/personal/${id}`, { fecha_cese: fechaCese }),
};
