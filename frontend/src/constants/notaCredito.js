/**
 * Catálogo SUNAT 09 — Tipo de Nota de Crédito.
 * Es un catálogo nacional único: aplica igual si el documento lo emitimos
 * nosotros (Nota de Crédito de venta) o lo recibimos de un proveedor
 * (Nota de Crédito de compra) — por eso vive en un solo lugar compartido.
 */
export const MOTIVOS_NC = {
  '01': 'Anulación de la operación',
  '02': 'Anulación por error en el RUC',
  '03': 'Corrección por error en la descripción',
  '04': 'Descuento global',
  '05': 'Descuento por ítem',
  '06': 'Devolución total',
  '07': 'Devolución por ítem',
  '08': 'Bonificación',
  '09': 'Disminución en el valor',
  '10': 'Otros conceptos',
  '11': 'Ajustes afectos al IVAP',
  '12': 'Ajustes de operaciones de exportación',
  '13': 'Ajustes - montos y/o fechas de pago',
};

// Motivos que normalmente implican devolución física de mercadería
export const MOTIVOS_NC_SUGIERE_STOCK = ['01', '06', '07'];
