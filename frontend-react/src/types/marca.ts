export interface Marca {
  id: string;
  nombre: string;
  descripcion: string | null;
  _count?: { productos: number };
}

export interface CreateMarcaDto {
  nombre: string;
  descripcion?: string;
}
