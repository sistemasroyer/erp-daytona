import { useEffect, useRef, useState } from 'react';

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
  opciones: { vacio: (datos: T) => boolean; habilitado?: boolean; sesion?: unknown },
) {
  const { vacio, habilitado = true, sesion } = opciones;

  // `sesion` permite a un modal que no se desmonta entre aperturas (ej. pasar `open`)
  // empezar una clave nueva cada vez, para no pisar el borrador de la apertura anterior.
  const claveRef = useRef<string>('');
  const sesionRef = useRef<unknown>(sesion);
  const pendienteRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  if (!claveRef.current || sesionRef.current !== sesion) {
    sesionRef.current = sesion;
    claveRef.current = `${PREFIJO}:${nombre}:${generarId()}`;
  }

  useEffect(() => {
    // No escribe si está vacío, pero tampoco borra un borrador ya guardado: un reset
    // de estado en memoria (ej. al cancelar/cerrar un modal antes de desmontarse) no
    // debe hacer desaparecer un borrador real guardado momentos antes. Solo `limpiar()`
    // (llamado explícitamente tras guardar con éxito) borra la clave de esta sesión.
    if (!habilitado) return;
    if (vacio(datos)) { pendienteRef.current = null; return; }
    const clave = claveRef.current;
    const escribir = () => {
      pendienteRef.current = null;
      const guardado: BorradorGuardado<T> = { clave, fecha: Date.now(), datos };
      localStorage.setItem(clave, JSON.stringify(guardado));
    };
    pendienteRef.current = escribir;
    timerRef.current = setTimeout(escribir, 800);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habilitado, JSON.stringify(datos)]);

  // Si se cierra el modal o se sale de la pantalla antes de que venza el debounce,
  // escribe igual lo último tecleado en vez de perderlo.
  useEffect(() => {
    if (!habilitado) pendienteRef.current?.();
  }, [habilitado]);
  useEffect(() => () => pendienteRef.current?.(), []);

  const limpiar = () => {
    clearTimeout(timerRef.current);
    pendienteRef.current = null;
    localStorage.removeItem(claveRef.current);
  };

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

/** `useBorrador` + la lista de borradores pendientes para `BorradorBanner`, con
 * recuperar/descartar ya resueltos. `abierto` (para modales) vuelve a leer la lista
 * al abrir y empieza una clave nueva por apertura; `onRestaurar` vuelca los datos
 * del borrador elegido al estado del formulario. */
export function useBorradorConLista<T>(
  nombre: string,
  datos: T,
  opciones: {
    vacio: (datos: T) => boolean;
    onRestaurar: (datos: T) => void;
    habilitado?: boolean;
    abierto?: boolean;
  },
) {
  const { vacio, onRestaurar, habilitado = true, abierto = true } = opciones;
  const { limpiar } = useBorrador(nombre, datos, { vacio, habilitado: habilitado && abierto, sesion: abierto });
  const [borradores, setBorradores] = useState<BorradorGuardado<T>[]>([]);

  useEffect(() => {
    setBorradores(abierto && habilitado ? listarBorradores<T>(nombre) : []);
  }, [nombre, abierto, habilitado]);

  const restaurar = (b: BorradorGuardado<T>) => {
    onRestaurar(b.datos);
    descartarBorrador(b.clave);
    setBorradores((prev) => prev.filter((x) => x.clave !== b.clave));
  };

  const descartar = (clave: string) => {
    descartarBorrador(clave);
    setBorradores((prev) => prev.filter((x) => x.clave !== clave));
  };

  return { borradores, restaurar, descartar, limpiar };
}
