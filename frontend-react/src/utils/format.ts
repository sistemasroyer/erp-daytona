export function formatMoneda(valor: number | string | null | undefined, moneda = 'PEN') {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: moneda }).format(Number(valor ?? 0));
}
