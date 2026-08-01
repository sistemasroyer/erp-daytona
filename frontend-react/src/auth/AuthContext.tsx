import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/api/client';
import { authApi, type LoginDto } from '@/api/auth';
import type { Usuario } from '@/types/auth';

interface AuthContextValue {
  user: Usuario | null;
  login: (dto: LoginDto) => Promise<void>;
  logout: () => Promise<void>;
  hasPermiso: (permiso: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(() => api.getUser());

  const login = async (dto: LoginDto) => {
    const { data } = await authApi.login(dto);
    api.setToken(data.accessToken);
    api.setUser(data.usuario);
    setUser(data.usuario);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort: aunque falle en el servidor, igual cerramos sesión localmente.
    } finally {
      api.removeToken();
      setUser(null);
    }
  };

  const hasPermiso = (permiso: string) => {
    if (!user) return false;
    if (user.esSuperadmin) return true;
    return user.permisos.includes('*') || user.permisos.includes(permiso);
  };

  const value = useMemo(() => ({ user, login, logout, hasPermiso }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
