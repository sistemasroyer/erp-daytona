import { api } from './client';
import type { AjusteInventario, CreateAjusteInventarioDto } from '@/types/ajuste-inventario';
import type { ItemInventario, TransferenciaInventarioDto } from '@/types/inventario';

export interface ListarAjustesParams {
  page?: number;
  limit?: number;
  id_almacen?: string;
  motivo?: string;
}

export interface ListarInventarioParams {
  page?: number;
  limit?: number;
  search?: string;
  id_almacen?: string;
}

export const inventarioApi = {
  listar: (params: ListarInventarioParams) => api.get<ItemInventario[]>('/inventario', params),
  transferir: (dto: TransferenciaInventarioDto) => api.post<ItemInventario>('/inventario/transferencia', dto),
  listarAjustes: (params: ListarAjustesParams) => api.get<AjusteInventario[]>('/inventario/ajustes', params),
  obtenerAjuste: (id: string) => api.get<AjusteInventario>(`/inventario/ajustes/${id}`),
  crearAjuste: (dto: CreateAjusteInventarioDto) => api.post<AjusteInventario>('/inventario/ajustes', dto),
};
