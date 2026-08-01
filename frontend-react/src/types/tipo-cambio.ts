export interface TipoCambio {
  id: string;
  fecha: string;
  compra: string; // Decimal de Prisma -> string en JSON
  venta: string;
  fuente: 'manual' | 'sunat';
}

export interface CreateTipoCambioDto {
  fecha: string;
  compra: number;
  venta: number;
  fuente?: 'manual' | 'sunat';
}
