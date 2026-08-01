import { api } from './client';
import type { Permiso } from '@/types/permiso';

export const permisosApi = {
  listar: () => api.get<Permiso[]>('/permisos/flat'),
};
