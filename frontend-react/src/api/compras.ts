import { api } from './client';
import type { Compra, ListarComprasParams, CreateCompraDto, ImportarXmlCompraResult } from '@/types/compra';
import type { CreateNotaCreditoCompraDto } from '@/types/nota-credito';

export const comprasApi = {
  listar: (params: ListarComprasParams) => api.get<Compra[]>('/compras', params),
  obtener: (id: string) => api.get<Compra>(`/compras/${id}`),
  crear: (dto: CreateCompraDto) => api.post<Compra>('/compras', dto),
  anular: (id: string, motivo: string) => api.patch<Compra>(`/compras/${id}/anular`, { motivo }),
  importarXml: (xml: string) => api.post<ImportarXmlCompraResult>('/compras/importar-xml', { xml }),
  crearNotaCredito: (id: string, dto: CreateNotaCreditoCompraDto) => api.post<Compra>(`/compras/${id}/nota-credito`, dto),
};
