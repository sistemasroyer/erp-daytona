export const CODIGOS_MOTIVO_NOTA_CREDITO = [
  { value: '01', label: '01 - Anulación de la operación' },
  { value: '02', label: '02 - Anulación por error en el RUC' },
  { value: '03', label: '03 - Corrección por error en la descripción' },
  { value: '04', label: '04 - Descuento global' },
  { value: '05', label: '05 - Descuento por ítem' },
  { value: '06', label: '06 - Devolución total' },
  { value: '07', label: '07 - Devolución por ítem' },
  { value: '08', label: '08 - Bonificación' },
  { value: '09', label: '09 - Disminución en el valor' },
  { value: '10', label: '10 - Otros' },
  { value: '11', label: '11 - Ajustes de operaciones IVAP' },
  { value: '12', label: '12 - Ajustes de exportación' },
  { value: '13', label: '13 - Ajustes montos/fechas de pago' },
];

export const MOTIVOS_NC: Record<string, string> = {
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

export interface DetalleNotaCreditoDto {
  id_detalle_original: string;
  cantidad: number;
}

export interface CreateNotaCreditoVentaDto {
  id_serie_documento: string;
  codigo_motivo: string;
  motivo: string;
  afecta_stock: boolean;
  detalle: DetalleNotaCreditoDto[];
}

export interface DetalleNotaCreditoCompraDto {
  id_detalle_original: string;
  cantidad: number;
  importe_linea: number;
}

export interface CreateNotaCreditoCompraDto {
  serie?: string;
  numero: string;
  fecha_emision: string;
  codigo_motivo: string;
  motivo: string;
  afecta_stock: boolean;
  detalle: DetalleNotaCreditoCompraDto[];
}
