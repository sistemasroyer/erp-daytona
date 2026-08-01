import type { Permiso } from './permiso';

export interface RolPermiso {
  id: string;
  id_rol: string;
  id_permiso: string;
  permiso: Permiso;
}

export interface Rol {
  id: string;
  nombre: string;
  descripcion: string | null;
  es_superadmin: boolean;
  permisos: RolPermiso[];
  _count?: { usuarios: number };
}

export interface CreateRolDto {
  nombre: string;
  descripcion?: string;
  permisos?: string[];
}
