import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/** Bloquea el acceso a toda su subárbol de rutas si no hay sesión iniciada. */
export function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}
