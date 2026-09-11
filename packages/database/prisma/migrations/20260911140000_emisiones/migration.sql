-- Emisiones de vehiculos.
--
-- Modulo aparte de Requerimientos a proposito: el mundo de autos es distinto.
-- Las emisiones de vehiculo las manda Gianella, no las ejecutivas de salud, y
-- mezclarlas en la misma bandeja llenaria la de cada una de trabajo que no le
-- toca.
CREATE TABLE IF NOT EXISTS "emisiones" (
  "id"                TEXT NOT NULL,
  "clienteId"         TEXT NOT NULL,
  "polizaId"          TEXT,
  -- PENDIENTE o ENVIADA. Dos estados bastan: se manda una vez y se acabo.
  "estado"            TEXT NOT NULL DEFAULT 'PENDIENTE',
  "enviadaEn"         TIMESTAMP(3),
  "enviadaPorId"      TEXT,
  -- Lo que se envio, tal cual: sirve de constancia de lo que se le dijo al
  -- cliente, que es justo lo que hace falta cuando despues pregunta.
  "correoTexto"       TEXT,
  "correoDestinatario" TEXT,
  "correoPlantilla"   TEXT,
  "organizationId"    TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "emisiones_pkey" PRIMARY KEY ("id")
);

-- Una emision por poliza: cada vehiculo asegurado lleva la suya.
CREATE UNIQUE INDEX IF NOT EXISTS "emisiones_polizaId_key" ON "emisiones"("polizaId");
CREATE INDEX IF NOT EXISTS "emisiones_organizationId_estado_idx"
  ON "emisiones"("organizationId", "estado");

DO $$ BEGIN
  ALTER TABLE "emisiones" ADD CONSTRAINT "emisiones_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "emisiones" ADD CONSTRAINT "emisiones_polizaId_fkey"
    FOREIGN KEY ("polizaId") REFERENCES "polizas"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "emisiones" ADD CONSTRAINT "emisiones_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
