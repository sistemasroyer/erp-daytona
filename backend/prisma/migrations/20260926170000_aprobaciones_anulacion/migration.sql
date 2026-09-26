CREATE TABLE "tbl_credenciales_aprobacion" (
  "id_usuario" TEXT PRIMARY KEY REFERENCES "tbl_usuarios"("id"),
  "pin_hash" VARCHAR(200) NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
  "bloqueado_hasta" TIMESTAMP(3),
  "fecha_modificacion" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "tbl_autorizaciones" (
  "id" TEXT PRIMARY KEY,
  "token_hash" VARCHAR(64) NOT NULL UNIQUE,
  "recurso" VARCHAR(40) NOT NULL,
  "id_documento" TEXT NOT NULL,
  "accion" VARCHAR(30) NOT NULL DEFAULT 'anular',
  "id_solicitante" TEXT NOT NULL REFERENCES "tbl_usuarios"("id"),
  "id_aprobador" TEXT NOT NULL REFERENCES "tbl_usuarios"("id"),
  "motivo" VARCHAR(500) NOT NULL,
  "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "vence_en" TIMESTAMP(3) NOT NULL,
  "usada_en" TIMESTAMP(3)
);
CREATE INDEX "tbl_autorizaciones_recurso_id_documento_idx" ON "tbl_autorizaciones"("recurso", "id_documento");
CREATE INDEX "tbl_autorizaciones_id_solicitante_fecha_creacion_idx" ON "tbl_autorizaciones"("id_solicitante", "fecha_creacion");
