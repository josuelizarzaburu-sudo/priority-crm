-- Estado del cliente.
--
-- Un cliente que cancela deja de ser cliente activo, pero NO se borra: su
-- historial —polizas, renovaciones, reclamos— sigue haciendo falta, y ademas
-- puede volver. Borrarlo perderia años de relacion.
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "estado" TEXT NOT NULL DEFAULT 'ACTIVO';
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "canceladoEn" TIMESTAMP(3);
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "motivoCancelacion" TEXT;

-- El indice cubre la consulta de siempre: los clientes activos de la
-- organizacion, que es lo que se lista por defecto.
CREATE INDEX IF NOT EXISTS "clientes_organizationId_estado_idx"
  ON "clientes"("organizationId", "estado");
