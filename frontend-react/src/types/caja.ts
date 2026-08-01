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

export interface ResumenCaja {
  apertura: CajaApertura;
  resumen: {
    monto_apertura: number;
    total_ingresos: number;
    total_egresos: number;
    saldo_actual: number;
    cantidad_ingresos: number;
    cantidad_egresos: number;
  };
  movimientos: MovimientoCaja[];
}

export interface AbrirCajaDto {
  id_caja: string;
  monto_apertura: number;
}

export interface CerrarCajaDto {
  monto_cierre: number;
}

export interface MovimientoCajaDto {
  tipo: 'ingreso' | 'egreso';
  concepto: string;
  monto: number;
}
