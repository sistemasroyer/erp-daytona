/** Resumen de usuario tal como lo devuelve el backend en historiales. */
export interface UsuarioResumen {
  nombre: string;
  apellido: string;
}

/** Quién anuló un documento y quién lo autorizó (backend: `historialDocumento()`). */
export interface AnulacionDocumento {
  fecha: string;
  motivo: string | null;
  anulado_por: UsuarioResumen | null;
  /** Supervisor que autorizó con PIN; null en anulaciones anteriores a las aprobaciones. */
  autorizado_por: UsuarioResumen | null;
}

export interface EventoHistorial {
  fecha: string;
  usuario: UsuarioResumen | null;
  operacion: 'INSERT' | 'UPDATE' | 'DELETE';
  /** Acción de la ruta (ej. "anular", "canjear"); null = alta o edición simple. */
  accion: string | null;
}

/** Campos que agrega el detalle (GET /<modulo>/:id) de ventas, compras, gastos, órdenes y tomas. */
export interface ConHistorial {
  anulacion?: AnulacionDocumento | null;
  historial?: EventoHistorial[];
}
