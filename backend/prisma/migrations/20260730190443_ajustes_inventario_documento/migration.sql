-- CreateEnum
CREATE TYPE "MotivoAjusteInventario" AS ENUM ('mermas_mal_estado', 'entrega_trabajadores', 'sobrante_faltante', 'otros');

-- CreateTable
CREATE TABLE "tbl_ajustes_inventario" (
    "id" TEXT NOT NULL,
    "numero_interno" VARCHAR(20) NOT NULL,
    "id_almacen" TEXT NOT NULL,
    "motivo" "MotivoAjusteInventario" NOT NULL,
    "observaciones" VARCHAR(500),
    "fecha_ajuste" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_ajustes_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_detalle_ajustes_inventario" (
    "id" TEXT NOT NULL,
    "id_ajuste" TEXT NOT NULL,
    "id_producto" TEXT NOT NULL,
    "tipo" "TipoMovimientoInventario" NOT NULL,
    "cantidad" DECIMAL(12,4) NOT NULL,
    "costo_unitario" DECIMAL(12,4) NOT NULL DEFAULT 0,

    CONSTRAINT "tbl_detalle_ajustes_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_ajustes_inventario_numero_interno_key" ON "tbl_ajustes_inventario"("numero_interno");

-- CreateIndex
CREATE INDEX "tbl_ajustes_inventario_id_almacen_idx" ON "tbl_ajustes_inventario"("id_almacen");

-- CreateIndex
CREATE INDEX "tbl_ajustes_inventario_fecha_ajuste_idx" ON "tbl_ajustes_inventario"("fecha_ajuste");

-- CreateIndex
CREATE INDEX "tbl_detalle_ajustes_inventario_id_ajuste_idx" ON "tbl_detalle_ajustes_inventario"("id_ajuste");

-- CreateIndex
CREATE INDEX "tbl_detalle_ajustes_inventario_id_producto_idx" ON "tbl_detalle_ajustes_inventario"("id_producto");

-- AddForeignKey
ALTER TABLE "tbl_ajustes_inventario" ADD CONSTRAINT "tbl_ajustes_inventario_id_almacen_fkey" FOREIGN KEY ("id_almacen") REFERENCES "tbl_almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_detalle_ajustes_inventario" ADD CONSTRAINT "tbl_detalle_ajustes_inventario_id_ajuste_fkey" FOREIGN KEY ("id_ajuste") REFERENCES "tbl_ajustes_inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_detalle_ajustes_inventario" ADD CONSTRAINT "tbl_detalle_ajustes_inventario_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "tbl_productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
