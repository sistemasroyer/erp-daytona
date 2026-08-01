import { api } from './client';
import type { Marca, CreateMarcaDto } from '@/types/marca';

export const marcasApi = {
  listar: () => api.get<Marca[]>('/marcas', { limit: 100 }),
  crear: (dto: CreateMarcaDto) => api.post<Marca>('/marcas', dto),
  actualizar: (id: string, dto: Partial<CreateMarcaDto>) => api.patch<Marca>(`/marcas/${id}`, dto),
};
