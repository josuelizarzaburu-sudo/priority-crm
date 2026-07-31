-- Registro de acceso a datos sensibles (quien vio o exporto que).
-- Escrita a mano porque el sandbox no alcanza Railway para correr prisma migrate.
CREATE TABLE IF NOT EXISTS "registros_acceso" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "usuarioId"      TEXT,
  "usuarioNombre"  TEXT,
  "usuarioRol"     TEXT,
  "accion"         TEXT NOT NULL,
  "objetoTipo"     TEXT,
  "objetoId"       TEXT,
  "detalle"        TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "registros_acceso_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "registros_acceso_org_created_idx"
  ON "registros_acceso" ("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "registros_acceso_org_user_created_idx"
  ON "registros_acceso" ("organizationId", "usuarioId", "createdAt");

-- FKs con los mismos comportamientos del schema: la org en cascada, el usuario a null.
-- Envueltas para que re-ejecutar la migracion no falle si la FK ya existe.
DO $$ BEGIN
  ALTER TABLE "registros_acceso"
    ADD CONSTRAINT "registros_acceso_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "registros_acceso"
    ADD CONSTRAINT "registros_acceso_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
