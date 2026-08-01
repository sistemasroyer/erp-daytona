import { api } from './client';
import type { MetodoPago } from '@/types/metodo-pago';

export const metodosPagoApi = {
  listar: () => api.get<MetodoPago[]>('/metodos-pago'),
};
