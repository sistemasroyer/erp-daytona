export type TipoDocumentoEnum = 'FACTURA' | 'BOLETA' | 'NOTA_CREDITO' | 'NOTA_DEBITO' | 'NOTA_VENTA' | 'COTIZACION';
export type CodigoTipoDocumento = '01' | '03' | '07' | '08' | 'NV' | 'COT';

export interface SerieDocumento {
  id: string;
  id_punto_venta: string;
  tipo_documento: TipoDocumentoEnum;
  serie: string;
  correlativo_actual: number;
  activo: boolean;
  punto_venta?: { nombre: string };
}

export interface CreateSerieDto {
  id_punto_venta: string;
  tipo_documento: CodigoTipoDocumento;
  serie: string;
  activo?: boolean;
}

export const TIPOS_DOCUMENTO_LABEL: Record<TipoDocumentoEnum, string> = {
  FACTURA: 'Factura', BOLETA: 'Boleta', NOTA_CREDITO: 'Nota Crédito', NOTA_DEBITO: 'Nota Débito',
  NOTA_VENTA: 'Nota de Venta', COTIZACION: 'Cotización',
};

export const CODIGOS_TIPO_DOCUMENTO: { value: CodigoTipoDocumento; label: string }[] = [
  { value: '01', label: '01 — Factura' },
  { value: '03', label: '03 — Boleta de Venta' },
  { value: 'NV', label: 'NV — Nota de Venta' },
  { value: 'COT', label: 'COT — Cotización' },
  { value: '07', label: '07 — Nota de Crédito' },
  { value: '08', label: '08 — Nota de Débito' },
];
