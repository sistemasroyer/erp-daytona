import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * Bloquea el acceso a una pantalla completa (no solo botones/menú) cuando el usuario
 * no tiene el permiso indicado — evita que alguien entre escribiendo la URL directamente
 * aunque el ítem del menú esté oculto. El endpoint que respalda la pantalla debe exigir
 * el mismo permiso en el backend cuando sea sensible (esto es solo la barrera de UI).
 */
export function RequirePermiso({ perm }: { perm: string }) {
  const { hasPermiso } = useAuth();

  if (!hasPermiso(perm)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
