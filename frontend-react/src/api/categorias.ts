import { api } from './client';
import type { Categoria, Subcategoria, CreateCategoriaDto, CreateSubcategoriaDto } from '@/types/categoria';

export const categoriasApi = {
  listar: () => api.get<Categoria[]>('/categorias', { limit: 100 }),
  crear: (dto: CreateCategoriaDto) => api.post<Categoria>('/categorias', dto),
  actualizar: (id: string, dto: Partial<CreateCategoriaDto>) => api.patch<Categoria>(`/categorias/${id}`, dto),
  eliminar: (id: string) => api.delete<Categoria>(`/categorias/${id}`),
};

export const subcategoriasApi = {
  crear: (dto: CreateSubcategoriaDto) => api.post<Subcategoria>('/categorias/subcategorias', dto),
  actualizar: (id: string, dto: Partial<CreateSubcategoriaDto>) => api.patch<Subcategoria>(`/categorias/subcategorias/${id}`, dto),
};
