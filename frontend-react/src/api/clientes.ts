import { api } from './client';
import type { Cliente, CreateClienteDto } from '@/types/cliente';
import type { ConsultaDocumento } from '@/types/peru-api';

export interface ListarParams {
  page?: number;
  limit?: number;
  search?: string;
}

export const clientesApi = {
  listar: (params: ListarParams) => api.get<Cliente[]>('/clientes', params),
  obtener: (id: string) => api.get<Cliente>(`/clientes/${id}`),
  crear: (dto: CreateClienteDto) => api.post<Cliente>('/clientes', dto),
  actualizar: (id: string, dto: Partial<CreateClienteDto>) => api.patch<Cliente>(`/clientes/${id}`, dto),
  eliminar: (id: string) => api.delete<Cliente>(`/clientes/${id}`),
  consultarDocumento: (tipo: 'dni' | 'ruc', numero: string) =>
    api.get<ConsultaDocumento>(`/clientes/consultar/${tipo}/${numero}`),
};
