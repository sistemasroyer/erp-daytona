/*
  Warnings:

  - You are about to drop the column `logo_path` on the `tbl_empresas` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "tbl_empresas" DROP COLUMN "logo_path",
ADD COLUMN     "logo_base64" TEXT;
