export function generarNumeroInterno(prefijo: string, secuencial: number): string {
  return `${prefijo}-${String(secuencial).padStart(8, '0')}`;
}

export function generarNumeroComprobante(serie: string, correlativo: number): string {
  return `${serie}-${String(correlativo).padStart(8, '0')}`;
}

export function calcularIgv(valor: number, tasa = 0.18): number {
  return Math.round(valor * tasa * 100) / 100;
}

export function calcularValorSinIgv(total: number, tasa = 0.18): number {
  return Math.round((total / (1 + tasa)) * 100) / 100;
}

export function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function redondear4(valor: number): number {
  return Math.round(valor * 10000) / 10000;
}
