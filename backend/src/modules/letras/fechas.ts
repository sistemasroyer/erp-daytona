/**
 * Fechas "solo día" del módulo Letras (fecha de pago, fecha banco, emisión...).
 * Se guardan como `@db.Date` (medianoche UTC) y se manejan como texto 'YYYY-MM-DD':
 * así ni el huso horario del servidor ni el de Lima corren el día.
 */
export function aFecha(texto: string): Date {
  return new Date(`${texto.slice(0, 10)}T00:00:00.000Z`);
}

export function aTexto(fecha: Date | string): string {
  return typeof fecha === 'string' ? fecha.slice(0, 10) : fecha.toISOString().slice(0, 10);
}

export function sumarDias(texto: string, dias: number): string {
  const d = aFecha(texto);
  d.setUTCDate(d.getUTCDate() + dias);
  return aTexto(d);
}

/** 1 = lunes ... 7 = domingo (ISO, igual que `date('N')` de PHP). */
export function diaSemanaIso(texto: string): number {
  const dia = aFecha(texto).getUTCDay();
  return dia === 0 ? 7 : dia;
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / 86_400_000);
}

/** Fecha de hoy en Perú, 'YYYY-MM-DD'. */
export function hoyLima(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
}

const CAMPOS_FECHA = new Set([
  'fecha', 'fecha_inicio_pago', 'fecha_fin_pago', 'fecha_emision', 'fecha_vencimiento',
  'fecha_banco', 'fecha_pago', 'fecha_pago_efectivo',
]);

/** Convierte (en profundidad) los campos de fecha-solo-día a 'YYYY-MM-DD' antes de responder. */
export function serializarFechas<T>(valor: T): T {
  if (Array.isArray(valor)) return valor.map((v) => serializarFechas(v)) as T;
  if (valor && typeof valor === 'object' && !(valor instanceof Date) && Object.getPrototypeOf(valor) === Object.prototype) {
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
      salida[clave] = CAMPOS_FECHA.has(clave) && v instanceof Date ? aTexto(v) : serializarFechas(v);
    }
    return salida as T;
  }
  return valor;
}
