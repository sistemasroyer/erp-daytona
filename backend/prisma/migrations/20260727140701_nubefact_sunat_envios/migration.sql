/*
  Warnings:

  - You are about to drop the column `hash_xml` on the `tbl_sunat_envios` table. All the data in the column will be lost.
  - You are about to drop the column `nombre_xml` on the `tbl_sunat_envios` table. All the data in the column will be lost.
  - You are about to drop the column `xml_firmado` on the `tbl_sunat_envios` table. All the data in the column will be lost.
  - You are about to drop the column `xml_sin_firma` on the `tbl_sunat_envios` table. All the data in the column will be lost.
  - You are about to drop the column `zip_base64` on the `tbl_sunat_envios` table. All the data in the column will be lost.
  - You are about to drop the column `cdr_base64` on the `tbl_sunat_respuestas` table. All the data in the column will be lost.
  - You are about to drop the column `cdr_xml` on the `tbl_sunat_respuestas` table. All the data in the column will be lost.
  - Added the required column `identificador` to the `tbl_sunat_envios` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "tbl_sunat_envios" DROP COLUMN "hash_xml",
DROP COLUMN "nombre_xml",
DROP COLUMN "xml_firmado",
DROP COLUMN "xml_sin_firma",
DROP COLUMN "zip_base64",
ADD COLUMN     "codigo_hash" VARCHAR(200),
ADD COLUMN     "enlace" VARCHAR(500),
ADD COLUMN     "enlace_cdr" VARCHAR(500),
ADD COLUMN     "enlace_pdf" VARCHAR(500),
ADD COLUMN     "enlace_xml" VARCHAR(500),
ADD COLUMN     "identificador" VARCHAR(100) NOT NULL;

-- AlterTable
ALTER TABLE "tbl_sunat_respuestas" DROP COLUMN "cdr_base64",
DROP COLUMN "cdr_xml",
ADD COLUMN     "observaciones" VARCHAR(500),
ADD COLUMN     "respuesta_raw" JSONB;
