export interface Subcategoria {
  id: string;
  id_categoria: string;
  nombre: string;
  descripcion: string | null;
}

export interface Categoria {
  id: string;
  nombre: string;
  descripcion: string | null;
  subcategorias: Subcategoria[];
  _count?: { productos: number };
}

export interface CreateCategoriaDto {
  nombre: string;
  descripcion?: string;
}

export interface CreateSubcategoriaDto {
  id_categoria: string;
  nombre: string;
  descripcion?: string;
}
