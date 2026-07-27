-- AlterTable
ALTER TABLE "tbl_compras" ADD COLUMN     "flete_fecha_pago" TIMESTAMP(3),
ADD COLUMN     "flete_id_metodo_pago" TEXT,
ADD COLUMN     "flete_pagado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "flete_referencia_pago" VARCHAR(100),
ADD COLUMN     "id_proveedor_flete" TEXT;

-- CreateIndex
CREATE INDEX "tbl_compras_id_proveedor_flete_idx" ON "tbl_compras"("id_proveedor_flete");

-- AddForeignKey
ALTER TABLE "tbl_compras" ADD CONSTRAINT "tbl_compras_id_proveedor_flete_fkey" FOREIGN KEY ("id_proveedor_flete") REFERENCES "tbl_proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_compras" ADD CONSTRAINT "tbl_compras_flete_id_metodo_pago_fkey" FOREIGN KEY ("flete_id_metodo_pago") REFERENCES "tbl_metodos_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;
