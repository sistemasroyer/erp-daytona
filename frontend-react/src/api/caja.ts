import { api } from './client';
import type { Caja, CajaApertura, ResumenCaja, AbrirCajaDto, CerrarCajaDto, MovimientoCajaDto, ListarAperturasParams } from '@/types/caja';

export const cajaApi = {
  cajas: () => api.get<Caja[]>('/caja/cajas', { limit: 100 }),
  aperturas: (params: ListarAperturasParams) => api.get<CajaApertura[]>('/caja/aperturas', params),
  aperturaActiva: (idCaja: string) => api.get<CajaApertura | null>(`/caja/cajas/${idCaja}/apertura-activa`),
  abrir: (dto: AbrirCajaDto) => api.post<CajaApertura>('/caja/abrir', dto),
  cerrar: (idApertura: string, dto: CerrarCajaDto) => api.patch<CajaApertura>(`/caja/aperturas/${idApertura}/cerrar`, dto),
  resumen: (idApertura: string) => api.get<ResumenCaja>(`/caja/aperturas/${idApertura}/resumen`),
  movimiento: (idApertura: string, dto: MovimientoCajaDto) => api.post(`/caja/aperturas/${idApertura}/movimientos`, dto),
  // No existe un endpoint único "mi sesión activa": se listan las cajas visibles para el
  // usuario (ya filtradas por punto de venta en el backend) y se busca cuál tiene apertura abierta.
  async miAperturaActiva(): Promise<CajaApertura | null> {
    const { data: cajas } = await this.cajas();
    for (const c of cajas) {
      try {
        const { data } = await this.aperturaActiva(c.id);
        if (data) return data;
      } catch {
        // sin acceso o sin apertura para esta caja
      }
    }
    return null;
  },
};
