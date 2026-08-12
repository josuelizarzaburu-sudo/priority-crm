-- Registro de correos automaticos enviados a clientes.
--
-- La clave unica (clienteId, tipo, fecha) es el corazon de esta tabla: hace
-- IMPOSIBLE mandarle dos veces el mismo correo al mismo cliente el mismo dia,
-- aunque la tarea se ejecute repetida por un reinicio, un reintento de la cola o
-- dos instancias de la API corriendo a la vez.
--
-- Sin esto, un cliente podria recibir tres "feliz cumpleanos" el mismo dia.
--
-- Idempotente y escrita a mano, como el resto (el sandbox no alcanza a Prisma).
CREATE TABLE IF NOT EXISTS "correos_automaticos" (
  "id"             TEXT NOT NULL,
  "clienteId"      TEXT NOT NULL,
  "tipo"           TEXT NOT NULL,
  "fecha"          TEXT NOT NULL,
  "destinatario"   TEXT NOT NULL,
  "simulado"       BOOLEAN NOT NULL DEFAULT false,
  "error"          TEXT,
  "organizationId" TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "correos_automaticos_pkey" PRIMARY KEY ("id")
);

-- La restriccion que garantiza "una sola vez por cliente, tipo y dia".
CREATE UNIQUE INDEX IF NOT EXISTS "correos_automaticos_clienteId_tipo_fecha_key"
  ON "correos_automaticos"("clienteId", "tipo", "fecha");

CREATE INDEX IF NOT EXISTS "correos_automaticos_organizationId_tipo_fecha_idx"
  ON "correos_automaticos"("organizationId", "tipo", "fecha");

DO $$
BEGIN
  ALTER TABLE "correos_automaticos"
    ADD CONSTRAINT "correos_automaticos_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "correos_automaticos"
    ADD CONSTRAINT "correos_automaticos_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
