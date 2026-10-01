import { api } from './client';
import type {
  Banco, CompraDisponible, CreatePaqueteDto, DiaNoPago, DocumentoLetra, DocumentoLetraDto, EstadoPaqueteLetras,
  LimitePagoDia, ListarPaquetesParams, MonedaLetras, PaqueteLetras,
} from '@/types/letras';

export const letrasCatalogosApi = {
  listarBancos: () => api.get<Banco[]>('/letras/bancos'),
  crearBanco: (dto: Partial<Banco>) => api.post<Banco>('/letras/bancos', dto),
  actualizarBanco: (id: string, dto: Partial<Banco>) => api.patch<Banco>(`/letras/bancos/${id}`, dto),
  eliminarBanco: (id: string) => api.delete<Banco>(`/letras/bancos/${id}`),

  listarDiasNoPago: (anio?: number) => api.get<DiaNoPago[]>('/letras/dias-no-pago', anio ? { anio } : {}),
  crearDiaNoPago: (dto: Omit<DiaNoPago, 'id' | 'estado'> & { estado?: boolean }) => api.post<DiaNoPago>('/letras/dias-no-pago', dto),
  actualizarDiaNoPago: (id: string, dto: Partial<DiaNoPago>) => api.patch<DiaNoPago>(`/letras/dias-no-pago/${id}`, dto),
  eliminarDiaNoPago: (id: string) => api.delete<{ id: string }>(`/letras/dias-no-pago/${id}`),

  listarLimites: () => api.get<LimitePagoDia[]>('/letras/limites'),
  guardarLimites: (moneda: MonedaLetras, dias: { dia_semana: number; monto_maximo: number | null }[]) =>
    api.put<LimitePagoDia[]>('/letras/limites', { moneda, dias }),
};

export const letrasPaquetesApi = {
  listar: (params: ListarPaquetesParams) => api.get<PaqueteLetras[]>('/letras/paquetes', params),
  resumen: () => api.get<Record<EstadoPaqueteLetras, number>>('/letras/paquetes/resumen'),
  obtener: (id: string) => api.get<PaqueteLetras>(`/letras/paquetes/${id}`),
  crear: (dto: CreatePaqueteDto) => api.post<PaqueteLetras>('/letras/paquetes', dto),
  actualizar: (id: string, dto: Partial<Omit<CreatePaqueteDto, 'id_proveedor' | 'moneda'>>) => api.patch<PaqueteLetras>(`/letras/paquetes/${id}`, dto),
  eliminar: (id: string) => api.delete<{ id: string }>(`/letras/paquetes/${id}`),

  enviar: (id: string) => api.patch<PaqueteLetras>(`/letras/paquetes/${id}/enviar`),
  devolver: (id: string) => api.patch<PaqueteLetras>(`/letras/paquetes/${id}/devolver`),
  aprobar: (id: string) => api.patch<PaqueteLetras>(`/letras/paquetes/${id}/aprobar`),
  reabrir: (id: string) => api.patch<PaqueteLetras>(`/letras/paquetes/${id}/reabrir`),
  cancelar: (id: string, motivo: string) => api.patch<{ id: string }>(`/letras/paquetes/${id}/cancelar`, { motivo }),

  comprasDisponibles: (id: string) => api.get<CompraDisponible[]>(`/letras/paquetes/${id}/compras-disponibles`),
  importarCompras: (id: string, ids: string[]) => api.post<{ importados: number }>(`/letras/paquetes/${id}/importar-compras`, { ids }),
  agregarDocumento: (id: string, dto: DocumentoLetraDto) => api.post<DocumentoLetra>(`/letras/paquetes/${id}/documentos`, dto),
  actualizarDocumento: (id: string, idDoc: string, dto: Partial<DocumentoLetraDto>) => api.patch<DocumentoLetra>(`/letras/paquetes/${id}/documentos/${idDoc}`, dto),
  eliminarDocumento: (id: string, idDoc: string) => api.delete<{ id: string }>(`/letras/paquetes/${id}/documentos/${idDoc}`),
};
