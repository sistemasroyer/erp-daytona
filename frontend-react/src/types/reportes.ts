export interface FiltroReporte {
  fecha_desde?: string;
  fecha_hasta?: string;
  id_almacen?: string;
  tabla?: string;
}

export interface VentaReporte {
  id: string;
  numero_comprobante: string;
  serie: string;
  correlativo: number;
  fecha_emision: string;
  subtotal: string;
  igv: string;
  total: string;
  moneda: string;
  estado_sunat: string;
  cliente?: { razon_social: string; numero_documento: string };
}

export interface ReporteVentas {
  ventas: VentaReporte[];
  totales: { subtotal: number; igv: number; total: number; cantidad: number };
}

export interface CompraReporte {
  id: string;
  numero: string | null;
  serie: string | null;
  fecha_emision: string;
  subtotal: string;
  igv: string;
  total: string;
  moneda: string;
  proveedor?: { razon_social: string };
}

export interface ReporteCompras {
  compras: CompraReporte[];
  totales: { subtotal: number; igv: number; total: number; cantidad: number };
}

export interface ItemReporteInventario {
  id: string;
  stock_actual: string;
  producto: {
    codigo: string; nombre: string;
    costo_promedio: string;
    categoria: { nombre: string } | null;
  };
  almacen: { nombre: string };
}

export interface RegistroAuditoria {
  id: string;
  fecha: string;
  tabla: string;
  operacion: string;
  id_registro: string | null;
  usuario?: { nombre: string; apellido: string; email: string } | null;
}
