export type TipoDocumentoVenta = 'FACTURA' | 'BOLETA' | 'NOTA_VENTA' | 'COTIZACION' | 'NOTA_CREDITO' | 'NOTA_DEBITO';
export type EstadoVenta = 'vigente' | 'anulada' | 'canjeada';
export type EstadoSunat = 'pendiente' | 'enviado' | 'aceptado' | 'rechazado' | 'no_aplica';

export const TIPOS_DOC_LABEL: Record<TipoDocumentoVenta, string> = {
  FACTURA: 'Factura', BOLETA: 'Boleta', NOTA_VENTA: 'Nota Venta', COTIZACION: 'Cotización',
  NOTA_CREDITO: 'N. Crédito', NOTA_DEBITO: 'N. Débito',
};

export interface DetalleVenta {
  id: string;
  id_producto: string;
  descripcion: string;
  cantidad: string;
  precio_unitario: string;
  descuento: string;
  subtotal: string;
  igv: string;
  total: string;
  producto?: { codigo: string; nombre: string; unidad_medida?: { simbolo: string } };
}

export interface PagoVenta {
  id: string;
  id_metodo_pago: string;
  monto: string;
  referencia: string | null;
  metodo_pago?: { nombre: string };
}

export interface SunatEnvio {
  id: string;
  estado: string;
  error_mensaje: string | null;
  enlace_pdf: string | null;
  enlace_xml: string | null;
  enlace_cdr: string | null;
  codigo_hash: string | null;
  enlace: string | null;
}

export interface Venta {
  id: string;
  numero_interno: string;
  numero_comprobante: string | null;
  tipo_documento: TipoDocumentoVenta;
  serie: string;
  correlativo: number;
  fecha_emision: string;
  moneda: 'PEN' | 'USD';
  subtotal: string;
  igv: string;
  total: string;
  estado_sunat: EstadoSunat;
  estado_venta: EstadoVenta;
  observaciones: string | null;
  id_venta_origen: string | null;
  cliente?: { razon_social: string; numero_documento: string; tipo_documento?: string };
  vendedor?: { nombre: string; apellido: string; email?: string };
  detalle?: DetalleVenta[];
  pagos?: PagoVenta[];
  sunat_envios?: SunatEnvio[];
}

export interface ListarVentasParams {
  page?: number;
  limit?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  estado_sunat?: string;
  tipo_documento?: string;
  id_usuario?: string;
  search?: string;
}

export interface DetalleVentaDto {
  id_producto: string;
  cantidad: number;
  precio_tipo: number;
  descuento?: number;
  descripcion?: string;
}

export interface PagoVentaDto {
  id_metodo_pago: string;
  monto: number;
  referencia?: string;
}

export interface CreateVentaDto {
  tipo_documento: 'FACTURA' | 'BOLETA' | 'NOTA_VENTA' | 'COTIZACION';
  id_serie_documento: string;
  id_cliente: string;
  id_caja_apertura?: string;
  moneda?: 'PEN' | 'USD';
  tipo_cambio?: number;
  observaciones?: string;
  detalle: DetalleVentaDto[];
  pagos?: PagoVentaDto[];
}

export interface CanjearVentaDto {
  tipo_documento: 'FACTURA' | 'BOLETA';
  id_serie_documento: string;
  pagos?: PagoVentaDto[];
}
