export interface Proveedor {
  id: string;
  ruc: string;
  razon_social: string;
  nombre_comercial: string | null;
  direccion: string | null;
  email: string | null;
  telefono: string | null;
  contacto: string | null;
  cuenta_detraccion: string | null;
  dias_credito: number;
  estado: boolean;
}

export interface CreateProveedorDto {
  ruc: string;
  razon_social: string;
  nombre_comercial?: string;
  direccion?: string;
  email?: string;
  telefono?: string;
  contacto?: string;
  cuenta_detraccion?: string;
  dias_credito?: number;
}
