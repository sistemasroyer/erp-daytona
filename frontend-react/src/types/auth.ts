export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido?: string;
  roles: string[];
  permisos: string[];
  esSuperadmin: boolean;
  idPuntoVenta: string | null;
}

export interface LoginResponse {
  accessToken: string;
  usuario: Usuario;
}
