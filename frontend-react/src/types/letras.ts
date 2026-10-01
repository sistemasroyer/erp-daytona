import type { ConHistorial } from '@/types/historial';

export type MonedaLetras = 'PEN' | 'USD';
export type EstadoPaqueteLetras = 'borrador' | 'pendiente_aprobacion' | 'aprobado' | 'en_proceso' | 'completado' | 'cancelado';
/** "vencida" no viene del backend: es una letra pendiente cuya fecha de pago ya pasó. */
export type EstadoLetra = 'pendiente' | 'pagada' | 'cancelada';
export type TipoDocumentoLetra = 'factura' | 'nota_credito' | 'nota_debito' | 'otro';

export const ESTADO_PAQUETE_LABEL: Record<EstadoPaqueteLetras, string> = {
  borrador: 'Borrador', pendiente_aprobacion: 'Pendiente de aprobación', aprobado: 'Aprobado',
  en_proceso: 'En proceso', completado: 'Completado', cancelado: 'Cancelado',
};

export const TIPO_DOCUMENTO_LETRA_LABEL: Record<TipoDocumentoLetra, string> = {
  factura: 'Factura', nota_credito: 'Nota de crédito', nota_debito: 'Nota de débito', otro: 'Otro',
};

export const DIAS_SEMANA = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export interface Banco {
  id: string;
  nombre: string;
  siglas: string | null;
  descripcion: string | null;
  estado: boolean;
}

export interface DiaNoPago {
  id: string;
  /** 'YYYY-MM-DD' */
  fecha: string;
  descripcion: string;
  tipo: 'feriado' | 'especial';
  estado: boolean;
}

export interface LimitePagoDia {
  id: string;
  /** 1 = lunes ... 7 = domingo */
  dia_semana: number;
  moneda: MonedaLetras;
  monto_maximo: string;
  estado: boolean;
}

interface UsuarioResumen { nombre: string; apellido: string }

export interface PaqueteLetras extends ConHistorial {
  id: string;
  codigo: string;
  id_proveedor: string;
  id_banco: string | null;
  moneda: MonedaLetras;
  estado: EstadoPaqueteLetras;
  fecha_inicio_pago: string;
  fecha_fin_pago: string;
  dias_credito: number;
  monto_total: string;
  numero_cuotas: number;
  comentarios: string | null;
  fecha_aprobacion: string | null;
  fecha_creacion: string;
  proveedor: { id: string; ruc: string; razon_social: string; letras_pago_unico: boolean };
  banco: { id: string; nombre: string; siglas: string | null } | null;
  /** Solo en el listado. */
  letras_total?: number;
  letras_pagadas?: number;
  /** Solo en el detalle. */
  aprobador?: UsuarioResumen | null;
  usuario?: UsuarioResumen | null;
  documentos?: DocumentoLetra[];
  letras?: Letra[];
}

export interface DocumentoLetra {
  id: string;
  id_paquete: string;
  id_compra: string | null;
  tipo: TipoDocumentoLetra;
  serie: string;
  numero: string;
  moneda: MonedaLetras;
  /** Con signo: las notas de crédito vienen en negativo. */
  monto: string;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  dias_credito: number;
  compra?: { id: string; numero_interno: string } | null;
}

export interface Letra {
  id: string;
  id_paquete: string;
  numero_cuota: number;
  moneda: MonedaLetras;
  monto: string;
  fecha_banco: string;
  fecha_pago: string;
  estado: EstadoLetra;
  codigo_banco: string | null;
  fecha_pago_efectivo: string | null;
  metodo_pago: string | null;
  numero_operacion: string | null;
  monto_pagado: string | null;
  observaciones: string | null;
  usuario_pago?: UsuarioResumen | null;
}

/** Compra (factura a crédito o su NC) que se puede pasar a un paquete. `monto` ya es number, con signo. */
export interface CompraDisponible {
  id: string;
  numero_interno: string;
  tipo: TipoDocumentoLetra;
  serie: string;
  numero: string;
  monto: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  dias_credito: number;
}

export interface CreatePaqueteDto {
  id_proveedor: string;
  moneda: MonedaLetras;
  id_banco?: string;
  fecha_inicio_pago: string;
  dias_credito: number;
  numero_cuotas: number;
  comentarios?: string;
}

export interface DocumentoLetraDto {
  tipo: TipoDocumentoLetra;
  serie: string;
  numero: string;
  /** Positivo siempre; el backend aplica el signo de las NC. */
  monto: number;
  fecha_emision: string;
  fecha_vencimiento?: string;
}

export interface ListarPaquetesParams {
  page?: number;
  limit?: number;
  search?: string;
  estado?: EstadoPaqueteLetras;
  id_proveedor?: string;
  moneda?: MonedaLetras;
}

// ─── Generación de letras ───
export interface CapacidadDia {
  fecha: string;
  num_dia_semana: number;
  es_habil: boolean;
  monto_programado: number;
  limite_maximo: number;
  capacidad_disponible: number;
  estado: 'no_habil' | 'sin_capacidad' | 'limitado' | 'disponible';
  tiene_letra_proveedor: boolean;
}

export interface LetraPropuesta {
  numero_cuota: number;
  monto: number;
  fecha_banco: string;
  fecha_pago: string;
  monto_existente: number;
  monto_total_dia: number;
  limite_dia: number;
  estado: 'valida' | 'advertencia' | 'invalida';
  observaciones: string;
}

export interface AnalisisDistribucion {
  capacidad_dias: CapacidadDia[];
  analisis_cuotas?: {
    numero_cuotas_optimo: number;
    cuotas_referencial: number;
    dias_disponibles: number;
    capacidad_total_disponible: number;
    capacidad_promedio: number;
    monto_cuota_promedio: number;
    limites: { minimo_cuotas: number; maximo_cuotas: number };
    explicacion: string;
  };
  letras: LetraPropuesta[];
  tolerancia_utilizada: number;
  mensaje_tolerancia: string;
  tipo_cambio: number;
  dias_banco: number;
  monto_total: number;
  moneda: MonedaLetras;
}

export interface ConfigDistribucion {
  tolerancia?: number;
  monto_minimo?: number;
  monto_maximo_preferido?: number;
  numero_cuotas?: number;
}

// ─── Letras (cuotas) ya generadas ───
/** Letra con su paquete y proveedor (listado general y calendario). */
export interface LetraConPaquete extends Letra {
  paquete: {
    id: string;
    codigo: string;
    estado: EstadoPaqueteLetras;
    moneda: MonedaLetras;
    proveedor: { id: string; ruc: string; razon_social: string };
    banco: { id: string; nombre: string; siglas: string | null } | null;
  };
}

/** "vencida" y "por_vencer" no se guardan: son pendientes con fecha de pago pasada / futura. */
export type FiltroEstadoLetra = EstadoLetra | 'vencida' | 'por_vencer';

export interface ListarLetrasParams {
  page?: number;
  limit?: number;
  search?: string;
  estado?: FiltroEstadoLetra;
  id_proveedor?: string;
  id_paquete?: string;
  moneda?: MonedaLetras;
  fecha_desde?: string;
  fecha_hasta?: string;
}

export type ResumenLetras = Record<MonedaLetras, Partial<Record<EstadoLetra | 'vencida', { cantidad: number; monto: number }>>>;

export interface PagarLetraDto {
  fecha_pago_efectivo: string;
  metodo_pago: string;
  numero_operacion?: string;
  monto_pagado: number;
  observaciones?: string;
}

export type ModoEliminarLetra = 'auto' | 'elegir' | 'ninguno';

export interface DiaCalendarioLetras {
  fecha: string;
  /** Suma del día convertida a la moneda de la vista. */
  total: number;
  limite: number;
  no_pago: string | null;
  domingo: boolean;
  letras: (LetraConPaquete & { monto_vista: number; vencida: boolean })[];
}

export interface CalendarioLetras {
  moneda: MonedaLetras;
  tipo_cambio: number;
  dias: DiaCalendarioLetras[];
}

export const METODOS_PAGO_LETRA = ['TRANSFERENCIA', 'DEPÓSITO', 'CARGO EN CUENTA', 'CHEQUE', 'EFECTIVO'];
