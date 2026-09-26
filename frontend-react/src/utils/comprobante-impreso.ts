import type { Venta } from '@/types/venta';

const CODIGOS_DOCUMENTO: Record<string, string> = {
  FACTURA: '01', BOLETA: '03', NOTA_CREDITO: '07', NOTA_DEBITO: '08',
};
const CODIGOS_CLIENTE: Record<string, string> = { DNI: '1', RUC: '6', CE: '4', PASAPORTE: '7' };

export function fechaComprobante(fecha: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(fecha));
}

/** SUNAT, anexo técnico: campos separados por |, conservando los campos vacíos. */
export function contenidoQrComprobante(venta: Venta, ruc: string, hash?: string | null): string {
  const tipo = CODIGOS_DOCUMENTO[venta.tipo_documento];
  if (!tipo || !ruc) return '';
  return [
    ruc, tipo, venta.serie, String(venta.correlativo),
    Number(venta.igv).toFixed(2), Number(venta.total).toFixed(2), fechaComprobante(venta.fecha_emision),
    CODIGOS_CLIENTE[venta.cliente?.tipo_documento ?? ''] ?? '',
    venta.cliente?.numero_documento ?? '', hash ?? '',
  ].join('|');
}
