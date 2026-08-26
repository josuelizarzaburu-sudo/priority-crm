-- Cursos con modulos, preguntas y certificado.
--
-- Se construye SOBRE los videos de capacitacion que ya existian: aquellos son
-- una videoteca suelta, esto es un recorrido con evaluacion y constancia.
--
-- Los videos siguen en YouTube como no listados: es gratis, funciona con mala
-- conexion y en cualquier telefono. Alojarlos nosotros costaria dinero y se
-- veria peor.

CREATE TABLE IF NOT EXISTS "cursos" (
  "id"             TEXT NOT NULL,
  "titulo"         TEXT NOT NULL,
  "descripcion"    TEXT,
  -- Aseguradora o tema: BMI, Humana, CRM Priority...
  "aseguradora"    TEXT,
  "orden"          INTEGER NOT NULL DEFAULT 0,
  "publicado"      BOOLEAN NOT NULL DEFAULT false,
  -- Nota minima sobre 100. 80 por defecto: con menos, se puede aprobar
  -- respondiendo al azar sin haber visto el video.
  "notaMinima"     INTEGER NOT NULL DEFAULT 80,
  -- Meses que dura el certificado. 12 porque las condiciones de las
  -- aseguradoras cambian cada ano y hay que repasar.
  "vigenciaMeses"  INTEGER NOT NULL DEFAULT 12,
  "organizationId" TEXT NOT NULL,
  "createdById"    TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cursos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "curso_modulos" (
  "id"          TEXT NOT NULL,
  "cursoId"     TEXT NOT NULL,
  "titulo"      TEXT NOT NULL,
  "descripcion" TEXT,
  "youtubeUrl"  TEXT NOT NULL,
  "duracionMin" INTEGER,
  "orden"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "curso_modulos_pkey" PRIMARY KEY ("id")
);

-- Las opciones van como JSON y no en tabla aparte: son 2 a 4 por pregunta, se
-- editan siempre juntas y nunca se consultan por separado. Una tabla propia
-- complicaria el guardado sin aportar nada.
CREATE TABLE IF NOT EXISTS "curso_preguntas" (
  "id"        TEXT NOT NULL,
  "moduloId"  TEXT NOT NULL,
  "enunciado" TEXT NOT NULL,
  "opciones"  JSONB NOT NULL,
  -- Indice de la opcion correcta dentro de "opciones".
  "correcta"  INTEGER NOT NULL,
  -- Se muestra despues de responder: es donde de verdad se aprende.
  "explicacion" TEXT,
  "orden"     INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "curso_preguntas_pkey" PRIMARY KEY ("id")
);

-- Avance por modulo. Guarda el mejor intento, no el ultimo: si repasa y vuelve a
-- responder peor, no deberia perder lo que ya habia logrado.
CREATE TABLE IF NOT EXISTS "curso_avances" (
  "id"          TEXT NOT NULL,
  "moduloId"    TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "aciertos"    INTEGER NOT NULL DEFAULT 0,
  "total"       INTEGER NOT NULL DEFAULT 0,
  "aprobado"    BOOLEAN NOT NULL DEFAULT false,
  "intentos"    INTEGER NOT NULL DEFAULT 0,
  "completadoEn" TIMESTAMP(3),
  CONSTRAINT "curso_avances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "curso_certificados" (
  "id"        TEXT NOT NULL,
  "cursoId"   TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "nota"      INTEGER NOT NULL,
  "emitidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Fecha calculada al emitir y GUARDADA, no derivada al consultarla: si manana
  -- se cambia la vigencia del curso, los certificados ya entregados deben
  -- conservar la fecha con la que se emitieron.
  "venceEn"   TIMESTAMP(3) NOT NULL,
  -- Codigo corto para verificar el certificado si alguien lo presenta impreso.
  "codigo"    TEXT NOT NULL,
  CONSTRAINT "curso_certificados_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cursos_organizationId_orden_idx" ON "cursos"("organizationId", "orden");
CREATE INDEX IF NOT EXISTS "curso_modulos_cursoId_orden_idx" ON "curso_modulos"("cursoId", "orden");
CREATE INDEX IF NOT EXISTS "curso_preguntas_moduloId_orden_idx" ON "curso_preguntas"("moduloId", "orden");
CREATE UNIQUE INDEX IF NOT EXISTS "curso_avances_moduloId_userId_key" ON "curso_avances"("moduloId", "userId");
CREATE INDEX IF NOT EXISTS "curso_avances_userId_idx" ON "curso_avances"("userId");
-- Un solo certificado vigente por curso y persona: al renovar se reemplaza.
CREATE UNIQUE INDEX IF NOT EXISTS "curso_certificados_cursoId_userId_key" ON "curso_certificados"("cursoId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "curso_certificados_codigo_key" ON "curso_certificados"("codigo");

DO $$ BEGIN
  ALTER TABLE "cursos" ADD CONSTRAINT "cursos_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cursos" ADD CONSTRAINT "cursos_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "curso_modulos" ADD CONSTRAINT "curso_modulos_cursoId_fkey"
    FOREIGN KEY ("cursoId") REFERENCES "cursos"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "curso_preguntas" ADD CONSTRAINT "curso_preguntas_moduloId_fkey"
    FOREIGN KEY ("moduloId") REFERENCES "curso_modulos"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "curso_avances" ADD CONSTRAINT "curso_avances_moduloId_fkey"
    FOREIGN KEY ("moduloId") REFERENCES "curso_modulos"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "curso_avances" ADD CONSTRAINT "curso_avances_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "curso_certificados" ADD CONSTRAINT "curso_certificados_cursoId_fkey"
    FOREIGN KEY ("cursoId") REFERENCES "cursos"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "curso_certificados" ADD CONSTRAINT "curso_certificados_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
