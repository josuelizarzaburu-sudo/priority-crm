-- Inspeccion de vehiculos.
--
-- En autos el proceso es distinto al de salud: antes de poder cerrar la venta,
-- el vehiculo tiene que pasar una inspeccion. No es trabajo posterior como la
-- bienvenida, es un REQUISITO del cierre.
CREATE TABLE IF NOT EXISTS "inspecciones" (
  "id"             TEXT NOT NULL,
  "dealId"         TEXT NOT NULL,
  "estado"         TEXT NOT NULL DEFAULT 'DE_INSPECCION',
  "aseguradora"    TEXT,
  -- Datos del vehiculo, que se envian a la aseguradora.
  "marca"          TEXT,
  "modelo"         TEXT,
  "anio"           INTEGER,
  "placa"          TEXT,
  -- Cuando se envio a Gianella y quien lo mando.
  "enviadaEn"      TIMESTAMP(3),
  "enviadaPorId"   TEXT,
  -- Resultado: cuando se resolvio y por que.
  "resueltaEn"     TIMESTAMP(3),
  "observacion"    TEXT,
  -- Cuantas veces se ha reinspeccionado. Un vehiculo puede volver a inspeccion
  -- si el rechazo fue con observacion: "si repara el parabrisas, pasa".
  "intentos"       INTEGER NOT NULL DEFAULT 1,
  "organizationId" TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inspecciones_pkey" PRIMARY KEY ("id")
);

-- Una inspeccion por deal: el ciclo de reinspeccion se cuenta en "intentos", no
-- creando filas nuevas, para que el historial quede en un solo sitio.
CREATE UNIQUE INDEX IF NOT EXISTS "inspecciones_dealId_key" ON "inspecciones"("dealId");
CREATE INDEX IF NOT EXISTS "inspecciones_organizationId_estado_idx"
  ON "inspecciones"("organizationId", "estado");

DO $$ BEGIN
  ALTER TABLE "inspecciones" ADD CONSTRAINT "inspecciones_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inspecciones" ADD CONSTRAINT "inspecciones_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Bitacora de la inspeccion: cada envio y cada respuesta.
CREATE TABLE IF NOT EXISTS "inspeccion_notas" (
  "id"           TEXT NOT NULL,
  "inspeccionId" TEXT NOT NULL,
  "texto"        TEXT NOT NULL,
  "autorId"      TEXT,
  "autorNombre"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inspeccion_notas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inspeccion_notas_inspeccionId_createdAt_idx"
  ON "inspeccion_notas"("inspeccionId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "inspeccion_notas" ADD CONSTRAINT "inspeccion_notas_inspeccionId_fkey"
    FOREIGN KEY ("inspeccionId") REFERENCES "inspecciones"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
