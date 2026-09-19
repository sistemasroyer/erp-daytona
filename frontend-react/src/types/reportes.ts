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

export type AgrupacionVentas = 'producto' | 'marca' | 'punto_venta';

export interface GrupoVentaAgrupada {
  clave: string;
  nombre: string;
  unidades: number;
  comprobantes: number;
  subtotal: number;
  igv: number;
  total: number;
}

export interface ReporteVentasAgrupado {
  data: GrupoVentaAgrupada[];
  totales: { unidades: number; comprobantes: number; subtotal: number; igv: number; total: number };
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

export interface ItemReporteTomaInventario {
  id: string;
  id_toma: string;
  id_producto: string;
  stock_sistema: string;
  cantidad_contada: string;
  diferencia: string;
  valor_diferencia: number;
  observaciones: string | null;
  fecha_conteo: string;
  producto: { codigo: string; nombre: string; ubicacion: string | null; costo_promedio: string; unidad_medida?: { simbolo: string } };
  toma: { numero_interno: string; estado: string; fecha_inicio: string; usuario?: { nombre: string; apellido: string } };
}

export interface GrupoProductoTomaInventario {
  clave: string;
  nombre: string;
  diferencia_unidades: number;
  valor_diferencia: number;
  veces_contado: number;
}

export interface ReporteTomasInventario {
  detalle: ItemReporteTomaInventario[];
  totales: { cantidad: number; sobran: number; faltan: number; ok: number; valor_sobrante: number; valor_faltante: number; valor_neto: number };
  porProducto: GrupoProductoTomaInventario[];
}

export interface RegistroAuditoria {
  id: string;
  fecha: string;
  tabla: string;
  operacion: string;
  id_registro: string | null;
  usuario?: { nombre: string; apellido: string; email: string } | null;
}
