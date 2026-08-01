export type TipoDocumentoCliente = 'DNI' | 'RUC' | 'CE' | 'PASAPORTE';

export interface Cliente {
  id: string;
  tipo_documento: TipoDocumentoCliente;
  numero_documento: string;
  razon_social: string;
  nombre_comercial: string | null;
  direccion: string | null;
  email: string | null;
  telefono: string | null;
  limite_credito: string; // Decimal de Prisma -> string en JSON
  dias_credito: number;
  estado: boolean;
}

export interface CreateClienteDto {
  tipo_documento: TipoDocumentoCliente;
  numero_documento: string;
  razon_social: string;
  nombre_comercial?: string;
  direccion?: string;
  email?: string;
  telefono?: string;
  limite_credito?: number;
  dias_credito?: number;
}
