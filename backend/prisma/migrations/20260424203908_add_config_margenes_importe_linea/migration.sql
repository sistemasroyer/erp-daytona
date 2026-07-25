-- AlterTable
ALTER TABLE "tbl_detalle_compras" ADD COLUMN     "importe_linea" DECIMAL(12,4) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "tbl_config_margenes" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "margen" DECIMAL(8,4) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "descripcion" VARCHAR(200),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_config_margenes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_config_margenes_numero_key" ON "tbl_config_margenes"("numero");
