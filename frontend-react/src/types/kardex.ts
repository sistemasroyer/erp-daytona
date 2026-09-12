export type TipoMovimientoKardex = 'entrada' | 'salida' | 'ajuste_positivo' | 'ajuste_negativo' | 'transferencia_entrada' | 'transferencia_salida';
export type TipoReferenciaKardex = 'venta' | 'compra' | 'ajuste' | 'transferencia' | 'inventario_inicial';

export const TIPO_MOVIMIENTO_LABEL: Record<string, string> = {
  entrada: 'Entrada', salida: 'Salida',
  ajuste_positivo: 'Ajuste (+)', ajuste_negativo: 'Ajuste (-)',
  transferencia_entrada: 'Transf. entrada', transferencia_salida: 'Transf. salida',
};

export const TIPO_REFERENCIA_LABEL: Record<string, string> = {
  venta: 'Venta', compra: 'Compra', ajuste: 'Ajuste',
  transferencia: 'Transferencia', inventario_inicial: 'Inventario inicial',
};

export interface MovimientoKardex {
  id: string;
  fecha: string;
  tipo_movimiento: TipoMovimientoKardex;
  tipo_referencia: TipoReferenciaKardex | null;
  id_referencia: string | null;
  descripcion: string | null;
  numero_documento: string | null;
  tipo_documento_origen: string | null;
  cantidad_entrada: string;
  cantidad_salida: string;
  costo_unitario: string;
  costo_total: string;
  stock_resultante: string;
}

/** Distingue Nota de Crédito de una Venta/Compra normal (ambas comparten tipo_referencia). */
export function etiquetaReferencia(k: Pick<MovimientoKardex, 'tipo_referencia' | 'tipo_documento_origen'>): string {
  if (k.tipo_referencia === 'venta') {
    return k.tipo_documento_origen === 'NOTA_CREDITO' ? 'Nota de Crédito (Venta)' : 'Venta';
  }
  if (k.tipo_referencia === 'compra') {
    return k.tipo_documento_origen === 'nota_credito' ? 'Nota de Crédito (Compra)' : 'Compra';
  }
  return k.tipo_referencia ? (TIPO_REFERENCIA_LABEL[k.tipo_referencia] || k.tipo_referencia) : '-';
}

export interface FiltrosKardex {
  id_almacen?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  limit?: number;
  skip?: number;
}
