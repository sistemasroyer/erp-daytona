export type AccionPermiso = 'ver' | 'crear' | 'editar' | 'eliminar' | 'aprobar' | 'anular';

export interface Permiso {
  id: string;
  modulo: string;
  submodulo: string | null;
  accion: AccionPermiso;
  descripcion: string | null;
}

export const ACCIONES: AccionPermiso[] = ['ver', 'crear', 'editar', 'eliminar', 'aprobar', 'anular'];
