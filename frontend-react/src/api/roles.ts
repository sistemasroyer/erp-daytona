import { api } from './client';
import type { Rol, CreateRolDto } from '@/types/rol';

export const rolesApi = {
  listar: (params: { page?: number; limit?: number; search?: string } = {}) => api.get<Rol[]>('/roles', params),
  obtener: (id: string) => api.get<Rol>(`/roles/${id}`),
  crear: (dto: CreateRolDto) => api.post<Rol>('/roles', dto),
  actualizar: (id: string, dto: Partial<CreateRolDto>) => api.patch<Rol>(`/roles/${id}`, dto),
  asignarPermisos: (id: string, permisos: string[]) => api.patch<Rol>(`/roles/${id}`, { permisos }),
};
