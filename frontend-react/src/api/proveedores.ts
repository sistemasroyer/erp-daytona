import { api } from './client';
import type { Proveedor, CreateProveedorDto } from '@/types/proveedor';
import type { ConsultaDocumento } from '@/types/peru-api';

export interface ListarParams {
  page?: number;
  limit?: number;
  search?: string;
}

export const proveedoresApi = {
  listar: (params: ListarParams) => api.get<Proveedor[]>('/proveedores', params),
  obtener: (id: string) => api.get<Proveedor>(`/proveedores/${id}`),
  crear: (dto: CreateProveedorDto) => api.post<Proveedor>('/proveedores', dto),
  actualizar: (id: string, dto: Partial<CreateProveedorDto>) => api.patch<Proveedor>(`/proveedores/${id}`, dto),
  eliminar: (id: string) => api.delete<Proveedor>(`/proveedores/${id}`),
  consultarRuc: (ruc: string) => api.get<ConsultaDocumento>(`/proveedores/consultar/ruc/${ruc}`),
};
