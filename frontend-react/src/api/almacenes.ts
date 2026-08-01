import { api } from './client';
import type { Almacen, CreateAlmacenDto } from '@/types/almacen';

export const almacenesApi = {
  listar: () => api.get<Almacen[]>('/almacenes', { limit: 100 }),
  crear: (dto: CreateAlmacenDto) => api.post<Almacen>('/almacenes', dto),
  actualizar: (id: string, dto: Partial<CreateAlmacenDto>) => api.patch<Almacen>(`/almacenes/${id}`, dto),
};
