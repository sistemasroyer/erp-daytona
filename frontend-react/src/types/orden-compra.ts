export type EstadoOrdenCompra = 'borrador' | 'aprobado' | 'convertido' | 'anulado';

export interface DetalleOrdenCompra {
  id: string;
  id_producto: string;
  descripcion: string | null;
  cantidad: string;
  precio_referencial: string;
  producto?: { codigo: string; nombre: string; unidad_medida: { simbolo: string } };
}

export interface OrdenCompra {
  id: string;
  numero: string;
  id_proveedor: string;
  estado: EstadoOrdenCompra;
  moneda: 'PEN' | 'USD';
  fecha_solicitud: string;
  fecha_requerida: string | null;
  observaciones: string | null;
  total_estimado: string;
  proveedor?: { razon_social: string; ruc: string };
  solicitante?: { nombre: string; apellido: string; email?: string };
  aprobador?: { nombre: string; apellido: string } | null;
  detalle?: DetalleOrdenCompra[];
  _count?: { detalle: number };
}

export interface CreateOrdenCompraDto {
  id_proveedor: string;
  fecha_requerida?: string;
  moneda?: 'PEN' | 'USD';
  observaciones?: string;
  detalle: { id_producto: string; descripcion?: string; cantidad: number; precio_referencial?: number }[];
}
