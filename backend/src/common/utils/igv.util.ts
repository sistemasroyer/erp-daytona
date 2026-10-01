import { Prisma } from '@prisma/client';

/** Tasa de IGV de Perú, usada solo si la empresa todavía no tiene una configurada. */
export const PORCENTAJE_IGV_DEFAULT = 18;

type ClienteConEmpresa = Pick<Prisma.TransactionClient, 'tbl_empresas'>;

/** Porcentaje de IGV vigente configurado en la empresa (ej. 18). Acepta el
 * PrismaService o el cliente de una transacción, para leerlo dentro de ella. */
export async function obtenerPorcentajeIgv(db: ClienteConEmpresa): Promise<number> {
  const empresa = await db.tbl_empresas.findFirst({
    where: { eliminado: false },
    select: { porcentaje_igv: true },
  });
  return empresa ? Number(empresa.porcentaje_igv) : PORCENTAJE_IGV_DEFAULT;
}

/** Igual que `obtenerPorcentajeIgv` pero como tasa decimal (ej. 0.18). */
export async function obtenerTasaIgv(db: ClienteConEmpresa): Promise<number> {
  return (await obtenerPorcentajeIgv(db)) / 100;
}
