/**
 * Catálogo SUNAT 09 — Tipo de Nota de Crédito.
 * Es un catálogo nacional único: aplica igual si el documento lo emitimos
 * nosotros (Nota de Crédito de venta) o lo recibimos de un proveedor
 * (Nota de Crédito de compra) — por eso vive en un solo lugar compartido.
 */
export const CODIGOS_MOTIVO_NOTA_CREDITO = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13',
] as const;

export const DESCRIPCION_MOTIVOS_NOTA_CREDITO =
  '01=Anulación operación, 02=Error RUC, 03=Error descripción, 04=Descuento global, '
  + '05=Descuento por ítem, 06=Devolución total, 07=Devolución por ítem, 08=Bonificación, '
  + '09=Disminución en el valor, 10=Otros, 11=Ajustes IVAP, 12=Ajustes exportación, 13=Ajustes montos/fechas';
