/**
 * Convierte una fecha (o string 'YYYY-MM-DD', que Date interpreta como medianoche UTC)
 * al final de ese mismo día en UTC. Usar siempre en filtros `fecha_hasta`/`lte` para no
 * excluir los registros creados ese mismo día.
 */
export function finDeDia(fecha: string | Date): Date {
  const d = new Date(fecha);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}
