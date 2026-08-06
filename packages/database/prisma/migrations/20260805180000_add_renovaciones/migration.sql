-- Renovaciones: una por poliza (no por cliente). Idempotente.

DO $$ BEGIN
  CREATE TYPE "EstadoRenovacion" AS ENUM (
    'POR_RENOVAR','ENVIAR','ENVIADO','EN_PROCESO','RENOVADO_PAGO_PENDIENTE','RENOVADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EstadoEnvio" AS ENUM ('NO_ENVIADO','PRIMER_ENVIO','SEGUNDO_ENVIO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "renovaciones" (
  "id"               TEXT NOT NULL,
  "organizationId"   TEXT NOT NULL,
  "polizaId"         TEXT NOT NULL,
  "fechaRenovacion"  TIMESTAMP(3) NOT NULL,
  "valorActual"      DECIMAL(12,2),
  "valorRenovacion"  DECIMAL(12,2),
  "diferidoEspecial" DECIMAL(12,2),
  "estado"           "EstadoRenovacion" NOT NULL DEFAULT 'POR_RENOVAR',
  "envio"            "EstadoEnvio" NOT NULL DEFAULT 'NO_ENVIADO',
  "fechaPrimerEnvio" TIMESTAMP(3),
  "comentarios"      TEXT,
  "ejecutivoId"      TEXT,
  "ejecutivoNombre"  TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "renovaciones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "notas_renovacion" (
  "id"           TEXT NOT NULL,
  "contenido"    TEXT NOT NULL,
  "renovacionId" TEXT NOT NULL,
  "autorId"      TEXT,
  "autorNombre"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notas_renovacion_pkey" PRIMARY KEY ("id")
);

-- Una sola renovacion por poliza y fecha: evita duplicados al regenerar.
CREATE UNIQUE INDEX IF NOT EXISTS "renovaciones_poliza_fecha_key"
  ON "renovaciones" ("polizaId", "fechaRenovacion");
CREATE INDEX IF NOT EXISTS "renovaciones_org_fecha_idx"
  ON "renovaciones" ("organizationId", "fechaRenovacion");
CREATE INDEX IF NOT EXISTS "renovaciones_org_estado_idx"
  ON "renovaciones" ("organizationId", "estado");
CREATE INDEX IF NOT EXISTS "notas_renovacion_ren_created_idx"
  ON "notas_renovacion" ("renovacionId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "renovaciones" ADD CONSTRAINT "renovaciones_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "renovaciones" ADD CONSTRAINT "renovaciones_polizaId_fkey"
    FOREIGN KEY ("polizaId") REFERENCES "polizas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "renovaciones" ADD CONSTRAINT "renovaciones_ejecutivoId_fkey"
    FOREIGN KEY ("ejecutivoId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "notas_renovacion" ADD CONSTRAINT "notas_renovacion_renovacionId_fkey"
    FOREIGN KEY ("renovacionId") REFERENCES "renovaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "notas_renovacion" ADD CONSTRAINT "notas_renovacion_autorId_fkey"
    FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
