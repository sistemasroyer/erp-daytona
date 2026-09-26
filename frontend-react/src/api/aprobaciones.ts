import { api } from './client';

export type RecursoAnulacion = 'ventas' | 'compras' | 'gastos' | 'ordenes_compra' | 'toma_inventario';
export interface AnulacionAprobada { motivo: string; autorizacion: string }
export interface AutorizacionRegistro {
  id: string; recurso: RecursoAnulacion; id_documento: string; numero_documento: string; motivo: string;
  fecha_creacion: string; vence_en: string; usada_en: string | null;
  solicitante: { nombre: string; apellido: string }; aprobador: { nombre: string; apellido: string };
}
export const aprobacionesApi = {
  estadoPin: () => api.get<{ configurado: boolean; activo: boolean; bloqueado_hasta: string | null }>('/aprobaciones/mi-pin'),
  configurarPin: (dto: { password: string; pin: string }) => api.patch('/aprobaciones/mi-pin', dto),
  desactivarPin: (password: string) => api.post('/aprobaciones/mi-pin/desactivar', { password }),
  supervisores: (recurso: RecursoAnulacion, id_documento: string) => api.get<{ id: string; nombre: string }[]>('/aprobaciones/supervisores', { recurso, id_documento }),
  aprobar: (dto: { recurso: RecursoAnulacion; id_documento: string; id_aprobador: string; pin: string; motivo: string }) => api.post<{ autorizacion: string }>('/aprobaciones', dto),
  historial: () => api.get<AutorizacionRegistro[]>('/aprobaciones/historial'),
};
