-- Programa de referidos.
--
-- Personas externas —no son clientes ni empleados— que traen contactos y ganan
-- dinero y puntos cuando la venta se cierra.

CREATE TABLE IF NOT EXISTS "referidores" (
  "id"          TEXT NOT NULL,
  -- Su codigo, lo que comparte: "DANI-4417". Unico en toda la organizacion.
  "codigo"      TEXT NOT NULL,
  "nombres"     TEXT NOT NULL,
  "apellidos"   TEXT NOT NULL,
  "identificacion" TEXT,
  "email"       TEXT,
  "celular"     TEXT NOT NULL,
  -- ACTIVO o INACTIVO. No se borra: sus referidos y pagos siguen haciendo falta.
  "estado"      TEXT NOT NULL DEFAULT 'ACTIVO',
  -- Saldo actual de puntos. Se guarda calculado para no sumar el historial
  -- entero cada vez que abre la pantalla.
  "puntos"      INTEGER NOT NULL DEFAULT 0,
  -- Lo ganado y lo ya pagado, en dolares.
  "acumulado"   DECIMAL(10,2) NOT NULL DEFAULT 0,
  "pagado"      DECIMAL(10,2) NOT NULL DEFAULT 0,
  "notas"       TEXT,
  "organizationId" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "referidores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "referidores_codigo_key" ON "referidores"("codigo");
CREATE INDEX IF NOT EXISTS "referidores_organizationId_estado_idx"
  ON "referidores"("organizationId", "estado");

DO $$ BEGIN
  ALTER TABLE "referidores" ADD CONSTRAINT "referidores_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Cada contacto que manda un referidor.
CREATE TABLE IF NOT EXISTS "referidos" (
  "id"           TEXT NOT NULL,
  "referidorId"  TEXT NOT NULL,
  "nombres"      TEXT NOT NULL,
  "celular"      TEXT NOT NULL,
  "email"        TEXT,
  -- Que le interesa: SALUD, AUTO, VIDA, HOGAR.
  "interes"      TEXT,
  "nota"         TEXT,
  -- RECIBIDO, EN_GESTION, CERRADO, ACREDITADO, NO_PROSPERO
  "estado"       TEXT NOT NULL DEFAULT 'RECIBIDO',
  -- El lead que se creo a partir de este referido.
  "dealId"       TEXT,
  -- Lo que se le acredito, cuando se acredito.
  "puntos"       INTEGER,
  "monto"        DECIMAL(10,2),
  "acreditadoEn" TIMESTAMP(3),
  -- Por que no prospero, para que el referidor aprenda a referir mejor.
  "motivo"       TEXT,
  "organizationId" TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "referidos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "referidos_referidorId_estado_idx"
  ON "referidos"("referidorId", "estado");
CREATE INDEX IF NOT EXISTS "referidos_organizationId_estado_idx"
  ON "referidos"("organizationId", "estado");
CREATE UNIQUE INDEX IF NOT EXISTS "referidos_dealId_key" ON "referidos"("dealId");

DO $$ BEGIN
  ALTER TABLE "referidos" ADD CONSTRAINT "referidos_referidorId_fkey"
    FOREIGN KEY ("referidorId") REFERENCES "referidores"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "referidos" ADD CONSTRAINT "referidos_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "referidos" ADD CONSTRAINT "referidos_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Cada movimiento de puntos o dinero: por que subio o bajo el saldo.
--
-- Se guarda el historial y no solo el saldo porque cuando alguien reclame "me
-- faltan puntos" hay que poder decirle exactamente de donde salio cada uno.
CREATE TABLE IF NOT EXISTS "referido_movimientos" (
  "id"          TEXT NOT NULL,
  "referidorId" TEXT NOT NULL,
  "referidoId"  TEXT,
  -- ACREDITACION, CANJE, PAGO, AJUSTE
  "tipo"        TEXT NOT NULL,
  "puntos"      INTEGER NOT NULL DEFAULT 0,
  "monto"       DECIMAL(10,2) NOT NULL DEFAULT 0,
  "detalle"     TEXT NOT NULL,
  "autorId"     TEXT,
  "autorNombre" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "referido_movimientos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "referido_movimientos_referidorId_createdAt_idx"
  ON "referido_movimientos"("referidorId", "createdAt" DESC);

DO $$ BEGIN
  ALTER TABLE "referido_movimientos" ADD CONSTRAINT "referido_movimientos_referidorId_fkey"
    FOREIGN KEY ("referidorId") REFERENCES "referidores"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Reglas del programa: los numeros que Josue va a querer ajustar.
--
-- Van en la base y no en el codigo porque se ajustan con el tiempo: si los
-- premios se piden muy rapido se sube el costo, si nadie llega se baja. Con los
-- numeros fijos en el codigo cada ajuste seria un despliegue.
CREATE TABLE IF NOT EXISTS "referido_reglas" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "puntosPorReferido" INTEGER NOT NULL DEFAULT 10,
  -- Hasta este monto de prima anual se paga el monto bajo; sobre el, el alto.
  "cortePrima"    DECIMAL(10,2) NOT NULL DEFAULT 2000,
  "montoBajo"      DECIMAL(10,2) NOT NULL DEFAULT 20,
  "montoAlto"      DECIMAL(10,2) NOT NULL DEFAULT 30,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "referido_reglas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "referido_reglas_organizationId_key"
  ON "referido_reglas"("organizationId");

DO $$ BEGIN
  ALTER TABLE "referido_reglas" ADD CONSTRAINT "referido_reglas_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
