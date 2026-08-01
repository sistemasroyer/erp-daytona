-- CreateEnum
CREATE TYPE "CategoriaGasto" AS ENUM ('flete', 'alquiler', 'servicios', 'comida_viaticos', 'honorarios', 'utiles_oficina', 'mantenimiento', 'otros');

-- CreateEnum
CREATE TYPE "EstadoGasto" AS ENUM ('registrado', 'anulado');

-- DropForeignKey
ALTER TABLE "tbl_compras" DROP CONSTRAINT "tbl_compras_flete_id_metodo_pago_fkey";

-- AlterTable
ALTER TABLE "tbl_compras" DROP COLUMN "flete_fecha_pago",
DROP COLUMN "flete_id_metodo_pago",
DROP COLUMN "flete_pagado",
DROP COLUMN "flete_referencia_pago";

-- CreateTable
CREATE TABLE "tbl_gastos" (
    "id" TEXT NOT NULL,
    "numero_interno" VARCHAR(20) NOT NULL,
    "categoria" "CategoriaGasto" NOT NULL,
    "tipo_documento" VARCHAR(30) NOT NULL,
    "serie" VARCHAR(4),
    "numero" VARCHAR(10),
    "ruc_emisor" VARCHAR(11),
    "razon_social_emisor" VARCHAR(200) NOT NULL,
    "id_proveedor" TEXT,
    "id_compra_relacionada" VARCHAR(36),
    "id_punto_venta" TEXT,
    "id_usuario" TEXT NOT NULL,
    "fecha_emision" TIMESTAMP(3) NOT NULL,
    "condicion_pago" "CondicionPago" NOT NULL DEFAULT 'contado',
    "fecha_vencimiento" TIMESTAMP(3),
    "moneda" "Moneda" NOT NULL DEFAULT 'PEN',
    "tipo_cambio" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "afecta_igv" BOOLEAN NOT NULL DEFAULT true,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "igv" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "total_pen" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_pago" TIMESTAMP(3),
    "id_metodo_pago" TEXT,
    "referencia_pago" VARCHAR(100),
    "estado" "EstadoGasto" NOT NULL DEFAULT 'registrado',
    "observaciones" VARCHAR(500),
    "estado_registro" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),

    CONSTRAINT "tbl_gastos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_gastos_numero_interno_key" ON "tbl_gastos"("numero_interno");

-- CreateIndex
CREATE INDEX "tbl_gastos_id_proveedor_idx" ON "tbl_gastos"("id_proveedor");

-- CreateIndex
CREATE INDEX "tbl_gastos_id_punto_venta_idx" ON "tbl_gastos"("id_punto_venta");

-- CreateIndex
CREATE INDEX "tbl_gastos_fecha_emision_idx" ON "tbl_gastos"("fecha_emision");

-- CreateIndex
CREATE INDEX "tbl_gastos_categoria_idx" ON "tbl_gastos"("categoria");

-- CreateIndex
CREATE INDEX "tbl_gastos_estado_idx" ON "tbl_gastos"("estado");

-- AddForeignKey
ALTER TABLE "tbl_gastos" ADD CONSTRAINT "tbl_gastos_id_proveedor_fkey" FOREIGN KEY ("id_proveedor") REFERENCES "tbl_proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_gastos" ADD CONSTRAINT "tbl_gastos_id_punto_venta_fkey" FOREIGN KEY ("id_punto_venta") REFERENCES "tbl_puntos_venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_gastos" ADD CONSTRAINT "tbl_gastos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "tbl_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_gastos" ADD CONSTRAINT "tbl_gastos_id_metodo_pago_fkey" FOREIGN KEY ("id_metodo_pago") REFERENCES "tbl_metodos_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

