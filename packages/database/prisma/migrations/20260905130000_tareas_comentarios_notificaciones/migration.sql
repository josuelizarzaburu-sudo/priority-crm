-- Comentarios en las tareas y avisos dentro del CRM.
--
-- Los comentarios siguen el mismo patron que NotaRequerimiento y NotaRenovacion:
-- quien escribio, que y cuando, sin poder editarse despues. Una conversacion de
-- trabajo no deberia poder reescribirse.
CREATE TABLE IF NOT EXISTS "tarea_comentarios" (
  "id"        TEXT NOT NULL,
  "tareaId"   TEXT NOT NULL,
  "autorId"   TEXT,
  "autorNombre" TEXT,
  "texto"     TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tarea_comentarios_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tarea_comentarios_tareaId_createdAt_idx"
  ON "tarea_comentarios"("tareaId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "tarea_comentarios" ADD CONSTRAINT "tarea_comentarios_tareaId_fkey"
    FOREIGN KEY ("tareaId") REFERENCES "tareas"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "tarea_comentarios" ADD CONSTRAINT "tarea_comentarios_autorId_fkey"
    FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Avisos dentro del CRM: la campanita.
--
-- Se guarda el enlace ya resuelto y no el id suelto, para que al pulsar el aviso
-- se pueda ir directo sin tener que reconstruir la ruta segun el tipo.
CREATE TABLE IF NOT EXISTS "notificaciones" (
  "id"        TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "tipo"      TEXT NOT NULL,
  "titulo"    TEXT NOT NULL,
  "detalle"   TEXT,
  "enlace"    TEXT,
  "leida"     BOOLEAN NOT NULL DEFAULT false,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- El indice cubre la consulta real: los avisos de una persona, primero los no
-- leidos, ordenados por fecha.
CREATE INDEX IF NOT EXISTS "notificaciones_usuarioId_leida_createdAt_idx"
  ON "notificaciones"("usuarioId", "leida", "createdAt" DESC);

DO $$ BEGIN
  ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
