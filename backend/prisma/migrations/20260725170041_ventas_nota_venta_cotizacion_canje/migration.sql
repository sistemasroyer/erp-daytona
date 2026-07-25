-- AlterEnum
ALTER TYPE "EstadoSunat" ADD VALUE 'no_aplica';

-- AlterEnum
ALTER TYPE "EstadoVenta" ADD VALUE 'canjeada';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoDocumentoSunat" ADD VALUE 'NOTA_VENTA';
ALTER TYPE "TipoDocumentoSunat" ADD VALUE 'COTIZACION';

-- AlterTable
ALTER TABLE "tbl_ventas" ADD COLUMN     "id_venta_origen" TEXT;

-- AddForeignKey
ALTER TABLE "tbl_ventas" ADD CONSTRAINT "tbl_ventas_id_venta_origen_fkey" FOREIGN KEY ("id_venta_origen") REFERENCES "tbl_ventas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
