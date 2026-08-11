export type EstadoTomaInventario = 'en_proceso' | 'finalizada' | 'anulada';

export interface DetalleTomaInventario {
  id: string;
  id_toma: string;
  id_producto: string;
  stock_sistema: string;
  cantidad_contada: string;
  diferencia: string;
  observaciones: string | null;
  fecha_conteo: string;
  producto?: { codigo: string; nombre: string; ubicacion: string | null; unidad_medida?: { simbolo: string } };
}

export interface TomaInventario {
  id: string;
  numero_interno: string;
  id_almacen: string;
  fecha_inicio: string;
  fecha_finalizacion: string | null;
  estado: EstadoTomaInventario;
  observaciones: string | null;
  almacen?: { nombre: string };
  usuario?: { nombre: string; apellido: string };
  detalle?: DetalleTomaInventario[];
}

export interface AgregarItemTomaDto {
  id_producto: string;
  cantidad_contada: number;
  observaciones?: string;
}

export interface ListarTomasInventarioParams {
  page?: number;
  limit?: number;
  estado?: string;
}
