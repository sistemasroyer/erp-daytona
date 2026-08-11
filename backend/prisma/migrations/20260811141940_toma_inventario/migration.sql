-- CreateEnum
CREATE TYPE "EstadoTomaInventario" AS ENUM ('en_proceso', 'finalizada', 'anulada');

-- AlterEnum
ALTER TYPE "TipoReferenciaMovimiento" ADD VALUE 'toma_inventario';

-- CreateTable
CREATE TABLE "tbl_tomas_inventario" (
    "id" TEXT NOT NULL,
    "numero_interno" VARCHAR(20) NOT NULL,
    "id_almacen" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_finalizacion" TIMESTAMP(3),
    "estado" "EstadoTomaInventario" NOT NULL DEFAULT 'en_proceso',
    "observaciones" VARCHAR(500),
    "estado_registro" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_tomas_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_detalle_tomas_inventario" (
    "id" TEXT NOT NULL,
    "id_toma" TEXT NOT NULL,
    "id_producto" TEXT NOT NULL,
    "stock_sistema" DECIMAL(12,4) NOT NULL,
    "cantidad_contada" DECIMAL(12,4) NOT NULL,
    "diferencia" DECIMAL(12,4) NOT NULL,
    "fecha_conteo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_detalle_tomas_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_tomas_inventario_numero_interno_key" ON "tbl_tomas_inventario"("numero_interno");

-- CreateIndex
CREATE INDEX "tbl_tomas_inventario_id_almacen_idx" ON "tbl_tomas_inventario"("id_almacen");

-- CreateIndex
CREATE INDEX "tbl_tomas_inventario_id_usuario_idx" ON "tbl_tomas_inventario"("id_usuario");

-- CreateIndex
CREATE INDEX "tbl_tomas_inventario_estado_idx" ON "tbl_tomas_inventario"("estado");

-- CreateIndex
CREATE INDEX "tbl_detalle_tomas_inventario_id_toma_idx" ON "tbl_detalle_tomas_inventario"("id_toma");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_detalle_tomas_inventario_id_toma_id_producto_key" ON "tbl_detalle_tomas_inventario"("id_toma", "id_producto");

-- AddForeignKey
ALTER TABLE "tbl_tomas_inventario" ADD CONSTRAINT "tbl_tomas_inventario_id_almacen_fkey" FOREIGN KEY ("id_almacen") REFERENCES "tbl_almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_tomas_inventario" ADD CONSTRAINT "tbl_tomas_inventario_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "tbl_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_detalle_tomas_inventario" ADD CONSTRAINT "tbl_detalle_tomas_inventario_id_toma_fkey" FOREIGN KEY ("id_toma") REFERENCES "tbl_tomas_inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_detalle_tomas_inventario" ADD CONSTRAINT "tbl_detalle_tomas_inventario_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "tbl_productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

