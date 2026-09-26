import { api } from './client';
import type { ConfigMargen, UpdateMargenDto } from '@/types/config-margen';

export const configMargenesApi = {
  preciosVenta: () => api.get<Pick<ConfigMargen, 'numero' | 'nombre'>[]>('/config/margenes/precios-venta'),
  listar: () => api.get<ConfigMargen[]>('/config/margenes'),
  actualizar: (numero: number, dto: UpdateMargenDto) => api.patch<ConfigMargen>(`/config/margenes/${numero}`, dto),
};
