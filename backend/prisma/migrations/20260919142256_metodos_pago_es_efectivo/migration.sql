-- AlterTable
ALTER TABLE "tbl_metodos_pago" ADD COLUMN     "es_efectivo" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: el método sembrado "EFECTIVO" (codigo 'EFE') es el único que pone dinero físico
-- en la caja. El resto (tarjetas, Yape, Plin, transferencia, cheque, crédito) queda en false.
UPDATE "tbl_metodos_pago" SET "es_efectivo" = true WHERE "codigo" = 'EFE' OR "nombre" = 'EFECTIVO';
