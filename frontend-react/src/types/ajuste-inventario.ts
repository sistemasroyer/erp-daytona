export type MotivoAjusteInventario = 'mermas_mal_estado' | 'entrega_trabajadores' | 'sobrante_faltante' | 'otros';

export const MOTIVO_AJUSTE_LABEL: Record<MotivoAjusteInventario, string> = {
  mermas_mal_estado: 'Mermas / Mal estado',
  entrega_trabajadores: 'Entrega a trabajadores',
  sobrante_faltante: 'Sobrante / Faltante',
  otros: 'Otros',
};

export interface DetalleAjusteInventario {
  id: string;
  id_producto: string;
  tipo: 'ajuste_positivo' | 'ajuste_negativo';
  cantidad: string;
  costo_unitario: string;
  producto?: { nombre: string; codigo: string };
}

export interface AjusteInventario {
  id: string;
  numero_interno: string;
  fecha_ajuste: string;
  id_almacen: string;
  motivo: MotivoAjusteInventario;
  observaciones: string | null;
  almacen?: { nombre: string };
  detalle: DetalleAjusteInventario[];
}

export interface CreateAjusteInventarioDto {
  id_almacen: string;
  motivo: MotivoAjusteInventario;
  observaciones?: string;
  detalle: {
    id_producto: string;
    tipo: 'ajuste_positivo' | 'ajuste_negativo';
    cantidad: number;
    costo_unitario?: number;
  }[];
}
