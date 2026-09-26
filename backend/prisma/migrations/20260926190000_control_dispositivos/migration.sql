ALTER TABLE "tbl_dispositivos"
ADD COLUMN "ultima_ip" VARCHAR(45),
ADD COLUMN "aprobado_en" TIMESTAMP(3),
ADD COLUMN "datos" JSONB;
