-- CreateEnum
CREATE TYPE "CondicionPago" AS ENUM ('contado', 'credito');

-- AlterTable
ALTER TABLE "tbl_compras" ADD COLUMN     "condicion_pago" "CondicionPago" NOT NULL DEFAULT 'contado';
