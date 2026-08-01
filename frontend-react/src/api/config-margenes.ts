import { api } from './client';
import type { ConfigMargen, UpdateMargenDto } from '@/types/config-margen';

export const configMargenesApi = {
  listar: () => api.get<ConfigMargen[]>('/config/margenes'),
  actualizar: (numero: number, dto: UpdateMargenDto) => api.patch<ConfigMargen>(`/config/margenes/${numero}`, dto),
};
