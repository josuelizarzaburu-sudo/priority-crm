-- Historial de consultas de Priority Help.
--
-- El objetivo no es auditar a nadie: es saber QUE preguntan los asesores.
-- Con eso se detecta donde falta material, que dudas se repiten y en que
-- casos el bot no supo responder. Sin este registro, ir llenando los huecos
-- del conocimiento depende de que alguien se acuerde de avisar.
--
-- Se escribe a mano e idempotente porque el sandbox no alcanza los
-- servidores de Prisma, igual que el resto de migraciones del proyecto.

CREATE TABLE IF NOT EXISTS "priority_help_consultas" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "pregunta"     TEXT NOT NULL,
  "respuesta"    TEXT NOT NULL,
  -- Archivos .md que se le pasaron al modelo en esa consulta.
  "fuentes"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- true si el bot admitio no tener el dato: marca un hueco del material.
  "sinRespuesta" BOOLEAN NOT NULL DEFAULT false,
  -- true si se activo el filtro de precios sobre la salida del modelo.
  "filtroPrecio" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "priority_help_consultas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "priority_help_consultas_userId_idx"
  ON "priority_help_consultas" ("userId");

CREATE INDEX IF NOT EXISTS "priority_help_consultas_createdAt_idx"
  ON "priority_help_consultas" ("createdAt");

-- Indice sobre sinRespuesta: la consulta mas util es justamente "que no
-- supo contestar el bot", que es la lista de trabajo para subir material.
CREATE INDEX IF NOT EXISTS "priority_help_consultas_sinRespuesta_idx"
  ON "priority_help_consultas" ("sinRespuesta");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'priority_help_consultas_userId_fkey'
  ) THEN
    ALTER TABLE "priority_help_consultas"
      ADD CONSTRAINT "priority_help_consultas_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
