export interface ConfigMargen {
  numero: number;
  nombre: string;
  margen: string; // Decimal de Prisma -> string en JSON
  descripcion: string | null;
  activo: boolean;
}

export interface UpdateMargenDto {
  nombre?: string;
  margen?: number;
  descripcion?: string;
  activo?: boolean;
}
