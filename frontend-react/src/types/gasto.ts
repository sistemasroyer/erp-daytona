export type CategoriaGasto = 'flete' | 'alquiler' | 'servicios' | 'comida_viaticos' | 'honorarios' | 'utiles_oficina' | 'mantenimiento' | 'otros';
export type EstadoGasto = 'registrado' | 'anulado';

export const CATEGORIAS_GASTO_LABEL: Record<CategoriaGasto, string> = {
  flete: 'Flete',
  alquiler: 'Alquiler',
  servicios: 'Servicios',
  comida_viaticos: 'Comida / Viáticos',
  honorarios: 'Honorarios',
  utiles_oficina: 'Útiles de oficina',
  mantenimiento: 'Mantenimiento',
  otros: 'Otros',
};

export interface DetalleGasto {
  id: string;
  id_gasto: string;
  descripcion: string;
  cantidad: string;
  precio_unitario: string | null;
  subtotal: string;
  igv: string;
  total: string;
  afecta_igv: boolean;
}

export interface Gasto {
  id: string;
  numero_interno: string;
  categoria: CategoriaGasto;
  tipo_documento: string;
  serie: string | null;
  numero: string | null;
  ruc_emisor: string | null;
  razon_social_emisor: string;
  id_proveedor: string;
  id_compra_relacionada: string | null;
  id_punto_venta: string | null;
  fecha_emision: string;
  condicion_pago: 'contado' | 'credito';
  fecha_vencimiento: string | null;
  moneda: 'PEN' | 'USD';
  tipo_cambio: string;
  subtotal: string;
  igv: string;
  total: string;
  total_pen: string;
  pagado: boolean;
  fecha_pago: string | null;
  id_metodo_pago: string | null;
  referencia_pago: string | null;
  estado: EstadoGasto;
  observaciones: string | null;
  proveedor?: { razon_social: string; ruc: string };
  punto_venta?: { nombre: string };
  usuario?: { nombre: string; apellido: string };
  metodo_pago?: { nombre: string };
  detalle?: DetalleGasto[];
}

export interface ListarGastosParams {
  page?: number;
  limit?: number;
  search?: string;
  categoria?: string;
  estado?: string;
  pagado?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  id_proveedor?: string;
  sin_vincular?: string;
  id_compra_relacionada?: string;
}

export interface DetalleGastoDto {
  descripcion: string;
  cantidad?: number;
  importe_linea: number;
  afecta_igv?: boolean;
}

export interface CreateGastoDto {
  categoria: CategoriaGasto;
  tipo_documento: string;
  serie?: string;
  numero?: string;
  id_proveedor: string;
  id_compra_relacionada?: string;
  id_punto_venta?: string;
  fecha_emision: string;
  condicion_pago?: 'contado' | 'credito';
  fecha_vencimiento?: string;
  moneda?: 'PEN' | 'USD';
  tipo_cambio?: number;
  observaciones?: string;
  detalle: DetalleGastoDto[];
}

export interface PagarGastoDto {
  id_metodo_pago: string;
  referencia?: string;
  id_caja_apertura?: string;
}

export interface DetalleImportadoXmlGasto {
  codigo_proveedor: string;
  descripcion: string;
  cantidad: number;
  unidad_codigo: string;
  valor_unitario: number;
  importe_linea: number;
  afecta_igv: boolean;
}

export interface ImportarXmlGastoResult {
  tipo_documento: 'factura' | 'boleta';
  serie: string;
  numero: string;
  fecha_emision: string;
  moneda: string;
  totales: { subtotal: number; igv: number; total: number };
  proveedor: { encontrado: true; id: string; ruc: string; razon_social: string } | { encontrado: false; ruc: string | null; razon_social: string | null };
  detalle: DetalleImportadoXmlGasto[];
}
