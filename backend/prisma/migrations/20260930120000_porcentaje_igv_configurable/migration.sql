-- Tasa de IGV configurable (antes fija en 18% en el código).
-- Default 18: los registros existentes quedan con la tasa con la que se emitieron.

-- AlterTable
ALTER TABLE "tbl_empresas" ADD COLUMN     "porcentaje_igv" DECIMAL(5,2) NOT NULL DEFAULT 18;

-- AlterTable
ALTER TABLE "tbl_ventas" ADD COLUMN     "porcentaje_igv" DECIMAL(5,2) NOT NULL DEFAULT 18;

-- AlterTable
ALTER TABLE "tbl_compras" ADD COLUMN     "porcentaje_igv" DECIMAL(5,2) NOT NULL DEFAULT 18;
