export type TipoContratoPersonal = 'indefinido' | 'plazo_fijo' | 'services' | 'practicas' | 'locacion_servicios';

export interface Personal {
  id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  cargo: string | null;
  area: string | null;
  fecha_ingreso: string;
  fecha_cese: string | null;
  sueldo: string; // Decimal de Prisma -> string en JSON
  cuenta_bancaria: string | null;
  banco: string | null;
  tipo_contrato: TipoContratoPersonal;
  email: string | null;
  telefono: string | null;
  estado: boolean;
}

export interface CreatePersonalDto {
  dni: string;
  nombres: string;
  apellidos: string;
  cargo?: string;
  area?: string;
  fecha_ingreso: string;
  fecha_cese?: string;
  sueldo: number;
  cuenta_bancaria?: string;
  banco?: string;
  tipo_contrato?: TipoContratoPersonal;
  email?: string;
  telefono?: string;
}

export const TIPOS_CONTRATO: { value: TipoContratoPersonal; label: string }[] = [
  { value: 'indefinido', label: 'Indefinido' },
  { value: 'plazo_fijo', label: 'Plazo fijo' },
  { value: 'services', label: 'Services' },
  { value: 'practicas', label: 'Prácticas' },
  { value: 'locacion_servicios', label: 'Locación de servicios' },
];
