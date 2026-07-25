/*
  Warnings:

  - You are about to drop the column `codigo_alterno` on the `tbl_productos` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "tbl_productos" DROP COLUMN "codigo_alterno";

-- CreateTable
CREATE TABLE "tbl_producto_codigos_proveedor" (
    "id" TEXT NOT NULL,
    "id_producto" TEXT NOT NULL,
    "id_proveedor" TEXT NOT NULL,
    "codigo_alterno" VARCHAR(50) NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tbl_producto_codigos_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tbl_producto_codigos_proveedor_codigo_alterno_idx" ON "tbl_producto_codigos_proveedor"("codigo_alterno");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_producto_codigos_proveedor_id_producto_id_proveedor_key" ON "tbl_producto_codigos_proveedor"("id_producto", "id_proveedor");

-- AddForeignKey
ALTER TABLE "tbl_producto_codigos_proveedor" ADD CONSTRAINT "tbl_producto_codigos_proveedor_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "tbl_productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_producto_codigos_proveedor" ADD CONSTRAINT "tbl_producto_codigos_proveedor_id_proveedor_fkey" FOREIGN KEY ("id_proveedor") REFERENCES "tbl_proveedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
