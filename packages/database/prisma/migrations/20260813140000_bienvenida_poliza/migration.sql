-- El requerimiento de bienvenida se liga a una POLIZA, no solo al cliente.
--
-- Un cliente que ya existe y contrata un plan nuevo tambien recibe bienvenida:
-- es un plan distinto y hay que presentarselo. Si la deduplicacion fuera por
-- cliente, ese segundo plan nunca generaria su carta.
--
-- Con polizaId, cada poliza tiene a lo sumo una bienvenida y no se duplica.
ALTER TABLE "requerimientos" ADD COLUMN IF NOT EXISTS "polizaId" TEXT;
CREATE INDEX IF NOT EXISTS "requerimientos_polizaId_idx" ON "requerimientos"("polizaId");

-- Diagnosticos preexistentes que van en la carta de bienvenida. Se escriben a
-- mano porque salen de la poliza emitida por la aseguradora, no de un dato que
-- el CRM tenga.
ALTER TABLE "requerimientos" ADD COLUMN IF NOT EXISTS "preexistencias" TEXT;

DO $$
BEGIN
  -- SetNull: si se borra la poliza, el requerimiento no se borra; queda como
  -- historico de que la bienvenida se envio.
  ALTER TABLE "requerimientos"
    ADD CONSTRAINT "requerimientos_polizaId_fkey"
    FOREIGN KEY ("polizaId") REFERENCES "polizas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
