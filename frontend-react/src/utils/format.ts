export function formatMoneda(valor: number | string | null | undefined, moneda = 'PEN') {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: moneda }).format(Number(valor ?? 0));
}

/**
 * Compras siempre guarda subtotal/igv/total en soles (PEN), sin importar la moneda de la factura.
 * Esta función revierte esa conversión para mostrar el valor en la moneda original de la factura.
 */
export function penAMonedaOriginal(valorPen: number | string | null | undefined, moneda: string, tipoCambio: number | string) {
  const tc = moneda === 'USD' ? Number(tipoCambio) : 1;
  return Number(valorPen ?? 0) / tc;
}
