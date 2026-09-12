-- CreateTable
CREATE TABLE "tbl_cajas_arqueos" (
    "id" TEXT NOT NULL,
    "id_caja_apertura" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "monto_sistema" DECIMAL(12,2) NOT NULL,
    "monto_contado" DECIMAL(12,2) NOT NULL,
    "diferencia" DECIMAL(12,2) NOT NULL,
    "detalle_denominaciones" JSONB NOT NULL,
    "observaciones" VARCHAR(500),
    "fecha_arqueo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_cajas_arqueos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tbl_cajas_arqueos_id_caja_apertura_idx" ON "tbl_cajas_arqueos"("id_caja_apertura");

-- AddForeignKey
ALTER TABLE "tbl_cajas_arqueos" ADD CONSTRAINT "tbl_cajas_arqueos_id_caja_apertura_fkey" FOREIGN KEY ("id_caja_apertura") REFERENCES "tbl_cajas_aperturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tbl_cajas_arqueos" ADD CONSTRAINT "tbl_cajas_arqueos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "tbl_usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
