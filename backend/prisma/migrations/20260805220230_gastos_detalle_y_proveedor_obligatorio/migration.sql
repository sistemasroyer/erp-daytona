-- DropForeignKey
ALTER TABLE "tbl_gastos" DROP CONSTRAINT "tbl_gastos_id_proveedor_fkey";

-- AlterTable
ALTER TABLE "tbl_gastos" ALTER COLUMN "id_proveedor" SET NOT NULL;

-- CreateTable
CREATE TABLE "tbl_detalle_gastos" (
    "id" TEXT NOT NULL,
    "id_gasto" TEXT NOT NULL,
    "descripcion" VARCHAR(300) NOT NULL,
    "cantidad" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "precio_unitario" DECIMAL(12,4),
    "subtotal" DECIMAL(12,2) NOT NULL,
    "igv" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "afecta_igv" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tbl_detalle_gastos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tbl_detalle_gastos_id_gasto_idx" ON "tbl_detalle_gastos"("id_gasto");

-- AddForeignKey
ALTER TABLE "tbl_gastos" ADD CONSTRAINT "tbl_gastos_id_proveedor_fkey" FOREIGN KEY ("id_proveedor") REFERENCES "tbl_proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_detalle_gastos" ADD CONSTRAINT "tbl_detalle_gastos_id_gasto_fkey" FOREIGN KEY ("id_gasto") REFERENCES "tbl_gastos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

