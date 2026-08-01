export type TipoDocumentoCompra = 'factura' | 'boleta' | 'nota' | 'otros' | 'nota_credito';
export type EstadoCompra = 'borrador' | 'registrada' | 'anulada';
export type CondicionPago = 'contado' | 'credito';
export type TipoProrrateoFlete = 'precio' | 'cantidad';

export const TIPOS_DOC_COMPRA_LABEL: Record<TipoDocumentoCompra, string> = {
  factura: 'Factura', boleta: 'Boleta', nota: 'Nota', otros: 'Otros', nota_credito: 'N. Crédito',
};

export interface DetalleCompra {
  id: string;
  id_producto: string;
  descripcion: string | null;
  cantidad: string;
  importe_linea: string;
  precio_unitario: string;
  precio_unitario_pen: string;
  costo_flete_prorrateado: string;
  costo_unitario_total: string;
  subtotal: string;
  igv: string;
  total: string;
  afecta_igv: boolean;
  producto?: { codigo: string; nombre: string; unidad_medida?: { simbolo: string } };
}

export interface Compra {
  id: string;
  numero_interno: string;
  tipo_documento: TipoDocumentoCompra;
  serie: string | null;
  numero: string | null;
  id_proveedor: string;
  id_almacen: string;
  id_orden_compra: string | null;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  condicion_pago: CondicionPago;
  moneda: 'PEN' | 'USD';
  tipo_cambio: string;
  subtotal: string;
  igv: string;
  total: string;
  flete_monto: string;
  flete_moneda: 'PEN' | 'USD';
  flete_tipo_cambio: string;
  flete_monto_pen: string;
  flete_tipo_prorrateo: TipoProrrateoFlete;
  id_proveedor_flete: string | null;
  estado: EstadoCompra;
  observaciones: string | null;
  id_compra_original: string | null;
  motivo_nota: string | null;
  codigo_motivo_nota: string | null;
  proveedor?: { razon_social: string; ruc: string };
  proveedor_flete?: { id: string; razon_social: string; ruc: string };
  almacen?: { id: string; nombre: string };
  usuario?: { nombre: string; apellido: string };
  detalle?: DetalleCompra[];
  _count?: { detalle: number };
}

export interface ListarComprasParams {
  page?: number;
  limit?: number;
  search?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  id_proveedor?: string;
  tipo_documento?: string;
}

export interface DetalleCompraDto {
  id_producto: string;
  descripcion?: string;
  cantidad: number;
  importe_linea: number;
  precio_unitario?: number;
  afecta_igv?: boolean;
}

export interface CreateCompraDto {
  tipo_documento: string;
  serie?: string;
  numero?: string;
  id_proveedor: string;
  id_almacen: string;
  id_orden_compra?: string;
  fecha_emision: string;
  condicion_pago?: CondicionPago;
  fecha_vencimiento?: string;
  moneda?: 'PEN' | 'USD';
  tipo_cambio?: number;
  flete_monto?: number;
  flete_moneda?: 'PEN' | 'USD';
  flete_tipo_cambio?: number;
  flete_tipo_prorrateo?: TipoProrrateoFlete;
  id_proveedor_flete?: string;
  observaciones?: string;
  detalle: DetalleCompraDto[];
}

export interface DetalleImportadoXml {
  codigo_proveedor: string;
  descripcion: string;
  cantidad: number;
  unidad_codigo: string;
  valor_unitario: number;
  importe_linea: number;
  afecta_igv: boolean;
  producto: { id: string; codigo: string; nombre: string; afecta_igv: boolean; precio_compra_sin_igv: string; unidad_medida: { simbolo: string } | null } | null;
}

export interface ImportarXmlCompraResult {
  tipo_documento: 'factura' | 'boleta';
  serie: string;
  numero: string;
  fecha_emision: string;
  moneda: string;
  totales: { subtotal: number; igv: number; total: number };
  proveedor: { encontrado: true; id: string; ruc: string; razon_social: string } | { encontrado: false; ruc: string | null; razon_social: string | null };
  detalle: DetalleImportadoXml[];
}
