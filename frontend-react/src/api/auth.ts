import { api } from './client';
import type { LoginResponse, Usuario } from '@/types/auth';

export interface LoginDto {
  email: string;
  password: string;
}

export const authApi = {
  login: (dto: LoginDto) => api.post<LoginResponse>('/auth/login', dto),
  logout: () => api.post<{ message: string }>('/auth/logout'),
  perfil: () => api.get<Usuario>('/auth/perfil'),
};
