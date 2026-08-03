-- Bitacora del reclamo: notas que no se editan ni se borran, solo se agregan.
-- Idempotente para que re-ejecutar la migracion no falle.
CREATE TABLE IF NOT EXISTS "notas_reclamo" (
  "id"          TEXT NOT NULL,
  "contenido"   TEXT NOT NULL,
  "reclamoId"   TEXT NOT NULL,
  "autorId"     TEXT,
  "autorNombre" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notas_reclamo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notas_reclamo_reclamo_created_idx"
  ON "notas_reclamo" ("reclamoId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "notas_reclamo"
    ADD CONSTRAINT "notas_reclamo_reclamoId_fkey"
    FOREIGN KEY ("reclamoId") REFERENCES "reclamos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "notas_reclamo"
    ADD CONSTRAINT "notas_reclamo_autorId_fkey"
    FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Las observaciones que ya existian se pasan a la bitacora como primera nota,
-- para no perderlas al quitar el campo de edicion libre.
INSERT INTO "notas_reclamo" ("id", "contenido", "reclamoId", "autorNombre", "createdAt")
SELECT
  'mig-' || "id",
  "observaciones",
  "id",
  COALESCE("ejecutivoNombre", 'Registro anterior'),
  COALESCE("createdAt", CURRENT_TIMESTAMP)
FROM "reclamos"
WHERE "observaciones" IS NOT NULL
  AND btrim("observaciones") <> ''
  AND NOT EXISTS (SELECT 1 FROM "notas_reclamo" n WHERE n."id" = 'mig-' || "reclamos"."id");

-- 'detalle' se deja de usar. No se borra la columna a proposito: si algun reclamo
-- historico tenia algo ahi, se conserva por si hace falta consultarlo.
