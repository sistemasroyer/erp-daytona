export interface ItemInventario {
  id: string;
  id_producto: string;
  id_almacen: string;
  stock_actual: string;
  producto: {
    id: string;
    codigo: string;
    nombre: string;
    stock_minimo: string;
    stock_maximo: string;
    precio_venta_1: string;
    costo_promedio: string;
    categoria: { nombre: string } | null;
    unidad_medida: { simbolo: string };
  };
  almacen: { id: string; nombre: string };
}

export interface TransferenciaInventarioDto {
  id_producto: string;
  id_almacen_origen: string;
  id_almacen_destino: string;
  cantidad: number;
  motivo?: string;
}
