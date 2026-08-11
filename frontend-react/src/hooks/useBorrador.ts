import { useEffect, useRef } from 'react';

const PREFIJO = 'borrador';
const MAX_ANTIGUEDAD_MS = 3 * 24 * 60 * 60 * 1000;

export interface BorradorGuardado<T> {
  clave: string;
  fecha: number;
  datos: T;
}

function generarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** Autoguarda `datos` en localStorage bajo una clave única por montaje, para
 * recuperar el progreso de un formulario largo si se corta la luz/internet o
 * se cierra la pestaña por accidente. No usa crypto.randomUUID() porque ese
 * método exige contexto seguro (https/localhost) y el sistema puede servirse
 * por IP LAN en http dentro de la tienda. */
export function useBorrador<T>(
  nombre: string,
  datos: T,
  opciones: { vacio: (datos: T) => boolean; habilitado?: boolean },
) {
  const claveRef = useRef<string>('');
  if (!claveRef.current) claveRef.current = `${PREFIJO}:${nombre}:${generarId()}`;

  const { vacio, habilitado = true } = opciones;

  useEffect(() => {
    // No escribe si está vacío, pero tampoco borra un borrador ya guardado: un reset
    // de estado en memoria (ej. al cancelar/cerrar un modal antes de desmontarse) no
    // debe hacer desaparecer un borrador real guardado momentos antes. Solo `limpiar()`
    // (llamado explícitamente tras guardar con éxito) borra la clave de esta sesión.
    if (!habilitado || vacio(datos)) return;
    const t = setTimeout(() => {
      const guardado: BorradorGuardado<T> = { clave: claveRef.current, fecha: Date.now(), datos };
      localStorage.setItem(claveRef.current, JSON.stringify(guardado));
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habilitado, JSON.stringify(datos)]);

  const limpiar = () => localStorage.removeItem(claveRef.current);

  return { limpiar };
}

export function listarBorradores<T>(nombre: string): BorradorGuardado<T>[] {
  const prefijo = `${PREFIJO}:${nombre}:`;
  const resultado: BorradorGuardado<T>[] = [];
  const ahora = Date.now();

  for (const clave of Object.keys(localStorage)) {
    if (!clave.startsWith(prefijo)) continue;
    try {
      const guardado = JSON.parse(localStorage.getItem(clave) || '') as BorradorGuardado<T>;
      if (ahora - guardado.fecha > MAX_ANTIGUEDAD_MS) {
        localStorage.removeItem(clave);
        continue;
      }
      resultado.push(guardado);
    } catch {
      localStorage.removeItem(clave);
    }
  }

  return resultado.sort((a, b) => b.fecha - a.fecha);
}

export function descartarBorrador(clave: string) {
  localStorage.removeItem(clave);
}
