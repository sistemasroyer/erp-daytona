import type { Usuario } from '@/types/auth';
import { ApiError, type ApiBody, type ApiResult } from './types';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

type RequestOptions = Omit<RequestInit, 'method' | 'body' | 'headers'>;

class ApiClient {
  private baseUrl = API_URL;
  private refreshPromise: Promise<boolean> | null = null;

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  setToken(token: string) {
    localStorage.setItem('access_token', token);
  }

  removeToken() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  }

  getUser(): Usuario | null {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as Usuario) : null;
  }

  setUser(user: Usuario) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<ApiResult<T>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const config: RequestInit = { method, headers, credentials: 'include', ...options };
    if (body !== undefined) config.body = JSON.stringify(body);

    let response = await fetch(`${this.baseUrl}${path}`, config);

    if (response.status === 401 && path !== '/auth/refresh' && path !== '/auth/login') {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.getToken()}`;
        response = await fetch(`${this.baseUrl}${path}`, { ...config, headers });
      } else {
        this.removeToken();
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        throw new ApiError({
          ok: false,
          statusCode: 401,
          message: 'Sesión expirada',
          errors: null,
          timestamp: new Date().toISOString(),
          path,
        });
      }
    }

    const json = (await response.json().catch(() => null)) as ApiBody<T> | null;

    if (!response.ok || !json || json.ok === false) {
      const errorBody = json && json.ok === false ? json : {
        ok: false as const,
        statusCode: response.status,
        message: 'Error en la solicitud',
        errors: null,
        timestamp: new Date().toISOString(),
        path,
      };
      throw new ApiError(errorBody);
    }

    return { data: json.data, meta: json.meta };
  }

  private async refreshToken(): Promise<boolean> {
    // Coalesce refresh calls concurrentes (varias requests en paralelo con 401 al mismo tiempo).
    if (!this.refreshPromise) {
      this.refreshPromise = this.doRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async doRefresh(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) return false;
      const json = (await response.json()) as ApiBody<{ accessToken: string }>;
      if (json.ok === false) return false;
      this.setToken(json.data.accessToken);
      return true;
    } catch {
      return false;
    }
  }

  get<T>(path: string, params: object = {}): Promise<ApiResult<T>> {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    const qs = new URLSearchParams(entries as [string, string][]).toString();
    return this.request<T>('GET', qs ? `${path}?${qs}` : path);
  }

  post<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return this.request<T>('POST', path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string): Promise<ApiResult<T>> {
    return this.request<T>('DELETE', path);
  }

  async getBlob(path: string, params: object = {}): Promise<Blob> {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    const qs = new URLSearchParams(entries as [string, string][]).toString();
    const token = this.getToken();
    const response = await fetch(`${this.baseUrl}${qs ? `${path}?${qs}` : path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Error al descargar archivo');
    return response.blob();
  }
}

export const api = new ApiClient();
