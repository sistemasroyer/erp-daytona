export interface UnidadMedida {
  id: string;
  codigo_sunat: string;
  descripcion: string;
  simbolo: string;
}

export interface CreateUnidadMedidaDto {
  codigo_sunat: string;
  descripcion: string;
  simbolo: string;
}
