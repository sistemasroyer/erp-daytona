-- Módulo Letras (migrado de letras-daytona): bancos, días de no pago, límites de pago por día,
-- paquetes, documentos y letras. Aditiva: no modifica datos existentes.

-- CreateEnum
CREATE TYPE "EstadoPaqueteLetras" AS ENUM ('borrador', 'pendiente_aprobacion', 'aprobado', 'en_proceso', 'completado', 'cancelado');

-- CreateEnum
CREATE TYPE "EstadoLetra" AS ENUM ('pendiente', 'pagada', 'cancelada');

-- CreateEnum
CREATE TYPE "TipoDocumentoLetra" AS ENUM ('factura', 'nota_credito', 'nota_debito', 'otro');

-- CreateEnum
CREATE TYPE "TipoDiaNoPago" AS ENUM ('feriado', 'especial');

-- AlterTable
ALTER TABLE "tbl_proveedores" ADD COLUMN     "letras_pago_unico" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "tbl_bancos" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "siglas" VARCHAR(20),
    "descripcion" VARCHAR(300),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),
    "id_legacy" INTEGER,

    CONSTRAINT "tbl_bancos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_dias_no_pago" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "descripcion" VARCHAR(200) NOT NULL,
    "tipo" "TipoDiaNoPago" NOT NULL DEFAULT 'feriado',
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),
    "id_legacy" INTEGER,

    CONSTRAINT "tbl_dias_no_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_limites_pago_dia" (
    "id" TEXT NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'PEN',
    "monto_maximo" DECIMAL(12,2) NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),
    "id_legacy" INTEGER,

    CONSTRAINT "tbl_limites_pago_dia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_letras_paquetes" (
    "id" TEXT NOT NULL,
    "codigo" VARCHAR(30) NOT NULL,
    "id_proveedor" TEXT NOT NULL,
    "id_banco" TEXT,
    "moneda" "Moneda" NOT NULL DEFAULT 'PEN',
    "estado" "EstadoPaqueteLetras" NOT NULL DEFAULT 'borrador',
    "fecha_inicio_pago" DATE NOT NULL,
    "fecha_fin_pago" DATE NOT NULL,
    "dias_credito" INTEGER NOT NULL DEFAULT 0,
    "monto_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "numero_cuotas" INTEGER NOT NULL DEFAULT 1,
    "comentarios" VARCHAR(500),
    "id_usuario_aprobador" TEXT,
    "fecha_aprobacion" TIMESTAMP(3),
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),
    "id_legacy" INTEGER,

    CONSTRAINT "tbl_letras_paquetes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_letras_documentos" (
    "id" TEXT NOT NULL,
    "id_paquete" TEXT NOT NULL,
    "id_compra" TEXT,
    "tipo" "TipoDocumentoLetra" NOT NULL DEFAULT 'factura',
    "serie" VARCHAR(10) NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'PEN',
    "monto" DECIMAL(12,2) NOT NULL,
    "fecha_emision" DATE NOT NULL,
    "fecha_vencimiento" DATE,
    "dias_credito" INTEGER NOT NULL DEFAULT 0,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),
    "id_legacy" INTEGER,

    CONSTRAINT "tbl_letras_documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tbl_letras" (
    "id" TEXT NOT NULL,
    "id_paquete" TEXT NOT NULL,
    "numero_cuota" INTEGER NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'PEN',
    "monto" DECIMAL(12,2) NOT NULL,
    "fecha_banco" DATE NOT NULL,
    "fecha_pago" DATE NOT NULL,
    "estado" "EstadoLetra" NOT NULL DEFAULT 'pendiente',
    "codigo_banco" VARCHAR(50),
    "fecha_pago_efectivo" DATE,
    "metodo_pago" VARCHAR(50),
    "numero_operacion" VARCHAR(50),
    "monto_pagado" DECIMAL(12,2),
    "id_usuario_pago" TEXT,
    "observaciones" TEXT,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificacion" TIMESTAMP(3) NOT NULL,
    "usuario_creacion" VARCHAR(36),
    "usuario_modificacion" VARCHAR(36),
    "id_legacy" INTEGER,

    CONSTRAINT "tbl_letras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbl_bancos_id_legacy_key" ON "tbl_bancos"("id_legacy");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_dias_no_pago_id_legacy_key" ON "tbl_dias_no_pago"("id_legacy");

-- CreateIndex
CREATE INDEX "tbl_dias_no_pago_fecha_idx" ON "tbl_dias_no_pago"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_limites_pago_dia_id_legacy_key" ON "tbl_limites_pago_dia"("id_legacy");

-- CreateIndex
CREATE INDEX "tbl_limites_pago_dia_dia_semana_idx" ON "tbl_limites_pago_dia"("dia_semana");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_letras_paquetes_codigo_key" ON "tbl_letras_paquetes"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_letras_paquetes_id_legacy_key" ON "tbl_letras_paquetes"("id_legacy");

-- CreateIndex
CREATE INDEX "tbl_letras_paquetes_id_proveedor_idx" ON "tbl_letras_paquetes"("id_proveedor");

-- CreateIndex
CREATE INDEX "tbl_letras_paquetes_estado_idx" ON "tbl_letras_paquetes"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_letras_documentos_id_legacy_key" ON "tbl_letras_documentos"("id_legacy");

-- CreateIndex
CREATE INDEX "tbl_letras_documentos_id_paquete_idx" ON "tbl_letras_documentos"("id_paquete");

-- CreateIndex
CREATE INDEX "tbl_letras_documentos_id_compra_idx" ON "tbl_letras_documentos"("id_compra");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_letras_id_legacy_key" ON "tbl_letras"("id_legacy");

-- CreateIndex
CREATE INDEX "tbl_letras_id_paquete_idx" ON "tbl_letras"("id_paquete");

-- CreateIndex
CREATE INDEX "tbl_letras_fecha_pago_idx" ON "tbl_letras"("fecha_pago");

-- CreateIndex
CREATE INDEX "tbl_letras_estado_idx" ON "tbl_letras"("estado");

-- AddForeignKey
ALTER TABLE "tbl_letras_paquetes" ADD CONSTRAINT "tbl_letras_paquetes_id_proveedor_fkey" FOREIGN KEY ("id_proveedor") REFERENCES "tbl_proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_letras_paquetes" ADD CONSTRAINT "tbl_letras_paquetes_id_banco_fkey" FOREIGN KEY ("id_banco") REFERENCES "tbl_bancos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_letras_paquetes" ADD CONSTRAINT "tbl_letras_paquetes_id_usuario_aprobador_fkey" FOREIGN KEY ("id_usuario_aprobador") REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_letras_documentos" ADD CONSTRAINT "tbl_letras_documentos_id_paquete_fkey" FOREIGN KEY ("id_paquete") REFERENCES "tbl_letras_paquetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_letras_documentos" ADD CONSTRAINT "tbl_letras_documentos_id_compra_fkey" FOREIGN KEY ("id_compra") REFERENCES "tbl_compras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_letras" ADD CONSTRAINT "tbl_letras_id_paquete_fkey" FOREIGN KEY ("id_paquete") REFERENCES "tbl_letras_paquetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_letras" ADD CONSTRAINT "tbl_letras_id_usuario_pago_fkey" FOREIGN KEY ("id_usuario_pago") REFERENCES "tbl_usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

