export interface MetodoPago {
  id: string;
  nombre: string;
  codigo: string | null;
  requiere_referencia: boolean;
  activo: boolean;
}
