export interface UsuarioRol {
  id: string;
  id_usuario: string;
  id_rol: string;
  rol: { id: string; nombre: string };
}

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  telefono: string | null;
  estado: boolean;
  ultimo_acceso: string | null;
  punto_venta: { id: string; nombre: string } | null;
  roles: UsuarioRol[];
}

export interface CreateUsuarioDto {
  email: string;
  password?: string;
  nombre: string;
  apellido: string;
  dni?: string;
  telefono?: string;
  id_punto_venta?: string | null;
  roles?: string[];
}
