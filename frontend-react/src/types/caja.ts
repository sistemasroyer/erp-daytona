export interface Caja {
  id: string;
  nombre: string;
  id_punto_venta: string;
  activo: boolean;
  punto_venta?: { nombre: string };
}

export interface MovimientoCaja {
  id: string;
  fecha: string;
  tipo: 'ingreso' | 'egreso';
  concepto: string;
  monto: string;
  id_metodo_pago: string | null;
  numero_comprobante: string | null;
  id_referencia: string | null;
  tipo_referencia: string | null;
  metodo_pago?: { nombre: string };
}

export interface CajaApertura {
  id: string;
  id_caja: string;
  monto_apertura: string;
  estado: 'abierta' | 'cerrada';
  fecha_apertura: string;
  fecha_cierre: string | null;
  monto_cierre: string | null;
  diferencia: string | null;
  caja?: { nombre: string };
  usuario?: { nombre: string; apellido: string };
  movimientos?: MovimientoCaja[];
}

export interface ListarAperturasParams {
  page?: number;
  limit?: number;
  id_caja?: string;
  estado?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}

export interface ResumenPorMetodoPago {
  id_metodo_pago: string;
  nombre: string;
  ingresos: number;
  egresos: number;
}

export interface ResumenCaja {
  apertura: CajaApertura;
  resumen: {
    monto_apertura: number;
    total_ingresos: number;
    total_egresos: number;
    saldo_actual: number;
    cantidad_ingresos: number;
    cantidad_egresos: number;
    por_metodo_pago: ResumenPorMetodoPago[];
  };
  movimientos: MovimientoCaja[];
}

export interface AbrirCajaDto {
  id_caja: string;
  monto_apertura: number;
}

export type CerrarCajaDto = ArqueoCajaDto;

export interface MovimientoCajaDto {
  tipo: 'ingreso' | 'egreso';
  concepto: string;
  monto: number;
  id_metodo_pago?: string;
}

export type TipoDenominacion = 'moneda' | 'billete';

export interface DetalleDenominacion {
  denominacion: number;
  tipo: TipoDenominacion;
  cantidad: number;
  subtotal: number;
}

export interface ArqueoCaja {
  id: string;
  id_caja_apertura: string;
  monto_sistema: string;
  monto_contado: string;
  diferencia: string;
  detalle_denominaciones: DetalleDenominacion[];
  observaciones: string | null;
  fecha_arqueo: string;
  usuario?: { nombre: string; apellido: string };
}

export interface ArqueoCajaDto {
  detalle: { denominacion: number; tipo: TipoDenominacion; cantidad: number }[];
  observaciones?: string;
}

export const DENOMINACIONES: { denominacion: number; tipo: TipoDenominacion }[] = [
  { denominacion: 0.1, tipo: 'moneda' },
  { denominacion: 0.2, tipo: 'moneda' },
  { denominacion: 0.5, tipo: 'moneda' },
  { denominacion: 1, tipo: 'moneda' },
  { denominacion: 2, tipo: 'moneda' },
  { denominacion: 5, tipo: 'moneda' },
  { denominacion: 10, tipo: 'billete' },
  { denominacion: 20, tipo: 'billete' },
  { denominacion: 50, tipo: 'billete' },
  { denominacion: 100, tipo: 'billete' },
  { denominacion: 200, tipo: 'billete' },
];
