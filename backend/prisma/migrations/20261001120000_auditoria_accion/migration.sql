-- Acción concreta registrada en la auditoría (anular, canjear, pagar, ...), para el
-- historial de cambios de cada documento. Aditiva y nullable: los registros viejos quedan igual.

-- AlterTable
ALTER TABLE "tbl_auditoria" ADD COLUMN     "accion" VARCHAR(60);
