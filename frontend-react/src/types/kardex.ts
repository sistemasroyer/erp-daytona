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
  cantidad_entrada: string;
  cantidad_salida: string;
  costo_unitario: string;
  costo_total: string;
  stock_resultante: string;
}

export interface FiltrosKardex {
  id_almacen?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  limit?: number;
  skip?: number;
}
