import { api } from './client';
import type { Usuario, CreateUsuarioDto } from '@/types/usuario';

export interface ListarParams {
  page?: number;
  limit?: number;
  search?: string;
}

export const usuariosApi = {
  listar: (params: ListarParams) => api.get<Usuario[]>('/usuarios', params),
  obtener: (id: string) => api.get<Usuario>(`/usuarios/${id}`),
  crear: (dto: CreateUsuarioDto) => api.post<Usuario>('/usuarios', dto),
  actualizar: (id: string, dto: Partial<CreateUsuarioDto>) => api.patch<Usuario>(`/usuarios/${id}`, dto),
  // El backend reemplaza roles/password como parte del PATCH general (no hay rutas dedicadas).
  cambiarPassword: (id: string, password: string) => api.patch<Usuario>(`/usuarios/${id}`, { password }),
  actualizarRoles: (id: string, roles: string[]) => api.patch<Usuario>(`/usuarios/${id}`, { roles }),
};
