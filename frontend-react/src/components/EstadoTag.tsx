import { Tag } from 'antd';

const COLORES_DEFAULT: Record<string, string> = {
  true: 'success', false: 'default',
  vigente: 'success', anulada: 'error', anulado: 'error', canjeada: 'blue',
  no_aplica: 'default', pendiente: 'warning', aceptado: 'success', rechazado: 'error',
  enviado: 'blue', borrador: 'default', aprobado: 'blue', convertido: 'success',
  abierta: 'success', cerrada: 'default', activo: 'success', inactivo: 'default', registrada: 'success', registrado: 'success',
  en_proceso: 'processing', finalizada: 'success',
};

/** Equivalente a badgeEstado() de components/tabla.js: un Tag coloreado según el valor
 * del estado, con colores por defecto razonables y la posibilidad de sobrescribir/agregar. */
export function EstadoTag({ estado, colores }: { estado: string | boolean; colores?: Record<string, string> }) {
  const mapa = { ...COLORES_DEFAULT, ...colores };
  const key = String(estado);
  const color = mapa[key] || 'default';
  const label = key === 'true' ? 'Activo' : key === 'false' ? 'Inactivo' : key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
  return <Tag color={color}>{label}</Tag>;
}
