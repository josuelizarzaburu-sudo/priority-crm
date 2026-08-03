-- Requerimientos: gestiones administrativas del cliente. Hermano de Reclamo pero
-- sin liquidacion ni valor. Idempotente para poder re-ejecutarse sin fallar.

DO $$ BEGIN
  CREATE TYPE "TipoRequerimiento" AS ENUM (
    'DATOS_FACTURACION','CAMBIO_FORMA_PAGO','CAMBIO_DEDUCIBLE','ACTUALIZACION_DATOS',
    'INCLUSION_DEPENDIENTES','EXCLUSION_DEPENDIENTES','CANCELACION','COTIZACION',
    'PRE_NOTIFICACION','OTROS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EstadoRequerimiento" AS ENUM ('EN_TRAMITE','MAS_INFORMACION','SOLUCIONADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "requerimientos" (
  "id"                    TEXT NOT NULL,
  "organizationId"        TEXT NOT NULL,
  "clienteId"             TEXT,
  "clienteNombre"         TEXT NOT NULL,
  "pacienteNombre"        TEXT,
  "aseguradora"           TEXT,
  "contrato"              TEXT,
  "tipo"                  "TipoRequerimiento" NOT NULL DEFAULT 'OTROS',
  "tipoOtro"              TEXT,
  "requerimiento"         TEXT,
  "fechaRecepcion"        TIMESTAMP(3),
  "fechaEnvioAseguradora" TIMESTAMP(3),
  "fechaEnvioCliente"     TIMESTAMP(3),
  "estado"                "EstadoRequerimiento" NOT NULL DEFAULT 'EN_TRAMITE',
  "observaciones"         TEXT,
  "ejecutivoId"           TEXT,
  "ejecutivoNombre"       TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "requerimientos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "notas_requerimiento" (
  "id"              TEXT NOT NULL,
  "contenido"       TEXT NOT NULL,
  "requerimientoId" TEXT NOT NULL,
  "autorId"         TEXT,
  "autorNombre"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notas_requerimiento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "requerimientos_org_ejecutivo_idx" ON "requerimientos" ("organizationId","ejecutivoId");
CREATE INDEX IF NOT EXISTS "requerimientos_org_estado_idx" ON "requerimientos" ("organizationId","estado");
CREATE INDEX IF NOT EXISTS "requerimientos_cliente_idx" ON "requerimientos" ("clienteId");
CREATE INDEX IF NOT EXISTS "requerimientos_org_fecha_idx" ON "requerimientos" ("organizationId","fechaRecepcion");
CREATE INDEX IF NOT EXISTS "notas_requerimiento_req_created_idx" ON "notas_requerimiento" ("requerimientoId","createdAt");

DO $$ BEGIN
  ALTER TABLE "requerimientos" ADD CONSTRAINT "requerimientos_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "requerimientos" ADD CONSTRAINT "requerimientos_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "requerimientos" ADD CONSTRAINT "requerimientos_ejecutivoId_fkey"
    FOREIGN KEY ("ejecutivoId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "notas_requerimiento" ADD CONSTRAINT "notas_requerimiento_requerimientoId_fkey"
    FOREIGN KEY ("requerimientoId") REFERENCES "requerimientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "notas_requerimiento" ADD CONSTRAINT "notas_requerimiento_autorId_fkey"
    FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
