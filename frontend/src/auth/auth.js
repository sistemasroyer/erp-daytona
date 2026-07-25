import { api } from '../api/client.js';
import { authApi } from '../api/modules.js';

export function requireAuth() {
  if (!api.getToken()) {
    window.location.href = '/src/pages/login.html';
    return false;
  }
  return true;
}

export function requireGuest() {
  if (api.getToken()) {
    window.location.href = '/src/pages/dashboard.html';
    return false;
  }
  return true;
}

export function getUser() {
  return api.getUser();
}

export function hasPermiso(permiso) {
  const user = getUser();
  if (!user) return false;
  if (user.esSuperadmin) return true;
  return user.permisos?.includes(permiso) ?? false;
}

export async function logout() {
  try {
    await authApi.logout();
  } catch (_) {
    // ignore
  } finally {
    api.removeToken();
    window.location.href = '/src/pages/login.html';
  }
}

export function renderNavUser() {
  const user = getUser();
  if (!user) return;
  const el = document.getElementById('nav-user-name');
  if (el) el.textContent = user.nombre || 'Usuario';
  const role = document.getElementById('nav-user-role');
  const rol = user.roles?.[0];
  if (role) role.textContent = (typeof rol === 'string' ? rol : rol?.nombre) || 'Usuario';
}
