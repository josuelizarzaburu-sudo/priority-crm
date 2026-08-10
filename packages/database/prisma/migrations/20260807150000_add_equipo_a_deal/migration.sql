-- Equipo dueño de cada lead, independiente de a qué vendedor está asignado.
--
-- Son dos cosas distintas:
--   equipoId     -> de qué jefe es el lead (su lote)
--   assignedToId -> qué vendedor lo trabaja
--
-- Asi un lead puede estar sin asignar pero ya pertenecer al equipo de un jefe, y
-- cada jefe ve su propio lote en la bandeja en vez de una bolsa comun.
--
-- Los leads que ya existen quedan con equipoId NULL a proposito: no se reparten
-- solos. Siguen en la bolsa comun, visibles unicamente para gerencia, que los
-- puede mover a un equipo desde la bandeja. Repartir historico automaticamente
-- habria movido leads que quiza ya se estaban trabajando.
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "equipoId" TEXT;
CREATE INDEX IF NOT EXISTS "deals_equipoId_idx" ON "deals"("equipoId");

DO $$
BEGIN
  -- SetNull: si se borra un equipo, el lead NO se borra: vuelve a la bolsa comun.
  ALTER TABLE "deals"
    ADD CONSTRAINT "deals_equipoId_fkey"
    FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
