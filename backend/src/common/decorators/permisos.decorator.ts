import { SetMetadata } from '@nestjs/common';

export const PERMISOS_KEY = 'permisos';

export interface PermisoRequerido {
  modulo: string;
  accion: string;
}

export const Permisos = (...permisos: string[]) => {
  const lista: PermisoRequerido[] = permisos.map((p) => {
    const [modulo, accion] = p.split(':');
    return { modulo, accion };
  });
  return SetMetadata(PERMISOS_KEY, lista);
};
