import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Convierte un choque de restricción única de Prisma (P2002) en un ConflictException limpio.
 * Estas restricciones (ruc, codigo, numero_documento, etc.) no consideran `eliminado`, así que
 * un P2002 acá casi siempre significa "ya existe un registro con soft-delete con ese mismo dato" —
 * sin este catch, el error crudo de Prisma/Postgres (con nombres de columna) llega al cliente.
 */
export function relanzarSiEsDuplicado(error: unknown, mensaje: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictException(mensaje);
  }
  throw error;
}
