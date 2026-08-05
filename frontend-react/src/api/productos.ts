import { api } from './client';
import type { Producto, CreateProductoDto, CodigoProveedor } from '@/types/producto';

export interface ListarProductosParams {
  page?: number;
  limit?: number;
  search?: string;
  id_categoria?: string;
}

export const productosApi = {
  listar: (params: ListarProductosParams) => api.get<Producto[]>('/productos', params),
  obtener: (id: string) => api.get<Producto>(`/productos/${id}`),
  crear: (dto: CreateProductoDto) => api.post<Producto>('/productos', dto),
  actualizar: (id: string, dto: Partial<CreateProductoDto>) => api.patch<Producto>(`/productos/${id}`, dto),
  eliminar: (id: string) => api.delete<Producto>(`/productos/${id}`),
  agregarCodigoProveedor: (id: string, dto: { id_proveedor: string; codigo_alterno: string }) =>
    api.post<CodigoProveedor>(`/productos/${id}/codigos-proveedor`, dto),
};
