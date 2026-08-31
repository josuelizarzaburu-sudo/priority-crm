-- Subpuntos dentro de una tarea, y aviso al asignarla.
--
-- Una tarea como "preparar la renovacion de X" son varios pasos. Sin poder
-- marcarlos, la tarea se ve igual al 20% que al 80%: solo hecha o no hecha, y no
-- hay forma de saber si alguien avanzo.
CREATE TABLE IF NOT EXISTS "tarea_subpuntos" (
  "id"        TEXT NOT NULL,
  "tareaId"   TEXT NOT NULL,
  "texto"     TEXT NOT NULL,
  "hecho"     BOOLEAN NOT NULL DEFAULT false,
  "orden"     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tarea_subpuntos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tarea_subpuntos_tareaId_orden_idx"
  ON "tarea_subpuntos"("tareaId", "orden");

DO $$ BEGIN
  ALTER TABLE "tarea_subpuntos" ADD CONSTRAINT "tarea_subpuntos_tareaId_fkey"
    FOREIGN KEY ("tareaId") REFERENCES "tareas"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
