import { api } from './client';
import type { Empresa, UpdateEmpresaDto } from '@/types/empresa';

export const empresaApi = {
  obtener: () => api.get<Empresa>('/empresa'),
  actualizar: (dto: UpdateEmpresaDto) => api.patch<Empresa>('/empresa', dto),
};
