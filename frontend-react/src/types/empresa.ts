export interface Empresa {
  id: string;
  ruc: string;
  razon_social: string;
  nombre_comercial: string | null;
  direccion: string | null;
  ubigeo: string | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  telefono: string | null;
  email: string | null;
  web: string | null;
  logo_base64: string | null;
  regimen_tributario: string | null;
}

export interface UpdateEmpresaDto {
  razon_social?: string;
  nombre_comercial?: string;
  direccion?: string;
  ubigeo?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  telefono?: string;
  email?: string;
  web?: string;
  regimen_tributario?: string;
  logo_base64?: string;
}
