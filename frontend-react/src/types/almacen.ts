export interface Almacen {
  id: string;
  nombre: string;
  descripcion: string | null;
  es_principal: boolean;
  estado: boolean;
  empresa: { id: string; razon_social: string };
}

export interface CreateAlmacenDto {
  id_empresa: string;
  nombre: string;
  descripcion?: string;
  es_principal?: boolean;
}
