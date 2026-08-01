export interface CodigoProveedor {
  id?: string;
  id_proveedor: string;
  codigo_alterno: string;
  proveedor?: { id: string; razon_social: string };
}

export interface Producto {
  id: string;
  codigo: string;
  codigo_barras: string | null;
  codigo_sunat: string | null;
  nombre: string;
  descripcion: string | null;
  id_categoria: string | null;
  id_subcategoria: string | null;
  id_marca: string | null;
  id_unidad_medida: string;
  ubicacion: string | null;
  tipo_existencia: string;
  afecta_igv: boolean;
  estado: boolean;
  stock_minimo: string;
  stock_maximo: string;
  stock_actual: string;
  costo_promedio: string;
  precio_compra_sin_igv: string;
  precio_compra_con_igv: string;
  precio_venta_1: string;
  precio_venta_2: string;
  precio_venta_3: string;
  precio_venta_4: string;
  precio_venta_5: string;
  categoria: { id: string; nombre: string } | null;
  subcategoria: { id: string; nombre: string } | null;
  marca: { id: string; nombre: string } | null;
  unidad_medida: { id: string; descripcion: string; simbolo: string };
  codigos_proveedor: CodigoProveedor[];
}

export interface CreateProductoDto {
  codigo: string;
  codigos_proveedor?: { id_proveedor: string; codigo_alterno: string }[];
  codigo_barras?: string;
  codigo_sunat?: string;
  nombre: string;
  descripcion?: string;
  id_categoria?: string;
  id_subcategoria?: string;
  id_marca?: string;
  id_unidad_medida: string;
  ubicacion?: string;
  tipo_existencia?: string;
  afecta_igv?: boolean;
  estado?: boolean;
  stock_minimo?: number;
  stock_maximo?: number;
  precio_venta_1?: number;
  precio_venta_2?: number;
  precio_venta_3?: number;
  precio_venta_4?: number;
  precio_venta_5?: number;
}

export const TIPOS_EXISTENCIA = [
  { value: '01', label: '01 – Mercadería' },
  { value: '02', label: '02 – Productos terminados' },
  { value: '03', label: '03 – Materias primas' },
  { value: '05', label: '05 – Suministros diversos' },
  { value: '99', label: '99 – Otros' },
];
