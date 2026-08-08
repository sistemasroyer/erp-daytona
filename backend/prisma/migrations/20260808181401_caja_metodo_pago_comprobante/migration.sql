-- AlterTable
ALTER TABLE "tbl_movimientos_caja" ADD COLUMN     "id_metodo_pago" TEXT,
ADD COLUMN     "numero_comprobante" VARCHAR(20);

-- AddForeignKey
ALTER TABLE "tbl_movimientos_caja" ADD CONSTRAINT "tbl_movimientos_caja_id_metodo_pago_fkey" FOREIGN KEY ("id_metodo_pago") REFERENCES "tbl_metodos_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

