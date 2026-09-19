-- Consentimiento de tratamiento de datos (LOPDP Ecuador).
--
-- La ley exige responsabilidad proactiva y DEMOSTRADA: no basta con decir que el
-- cliente autorizo, hay que poder mostrar cuando, desde donde y QUE TEXTO leyo.
-- Por eso se guarda la version del documento y no solo un "si".

CREATE TABLE IF NOT EXISTS "consentimientos" (
  "id"             TEXT NOT NULL,
  "clienteId"      TEXT NOT NULL,
  -- El token del enlace que se le manda. Unico y largo: es lo que prueba que
  -- quien acepto tenia el correo del cliente.
  "token"          TEXT NOT NULL,
  -- OTORGADO, REVOCADO o PENDIENTE mientras no responde.
  "estado"         TEXT NOT NULL DEFAULT 'PENDIENTE',

  -- La evidencia. Nada de esto se edita despues.
  "otorgadoEn"     TIMESTAMP(3),
  "revocadoEn"     TIMESTAMP(3),
  -- A que correo se le mando y desde que IP acepto.
  "correoEnviado"  TEXT NOT NULL,
  "ipAceptacion"   TEXT,
  "navegador"      TEXT,
  -- La version del texto que leyo. Sin esto, cambiar la politica el año que
  -- viene haria que la autorizacion vieja "dijera" algo que el cliente nunca
  -- acepto.
  "versionTexto"   TEXT NOT NULL,
  -- Huella del texto exacto, para probar que no se altero despues.
  "hashTexto"      TEXT NOT NULL,

  -- Cuando se le envio y cuantas veces: sirve para la campaña de seguimiento.
  "enviadoEn"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "vecesEnviado"   INTEGER NOT NULL DEFAULT 1,
  "ultimoEnvio"    TIMESTAMP(3),

  "organizationId" TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consentimientos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "consentimientos_token_key" ON "consentimientos"("token");
-- Un cliente tiene UN consentimiento vigente. Si revoca y vuelve a aceptar, se
-- crea otro y el anterior queda como historia.
CREATE INDEX IF NOT EXISTS "consentimientos_clienteId_estado_idx"
  ON "consentimientos"("clienteId", "estado");
CREATE INDEX IF NOT EXISTS "consentimientos_organizationId_estado_idx"
  ON "consentimientos"("organizationId", "estado");

DO $$ BEGIN
  ALTER TABLE "consentimientos" ADD CONSTRAINT "consentimientos_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "consentimientos" ADD CONSTRAINT "consentimientos_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Impide EDITAR o BORRAR un consentimiento ya otorgado.
--
-- Va en la base de datos y no en el codigo a proposito: una regla que vive en la
-- aplicacion se salta con un UPDATE directo, y entonces la evidencia no prueba
-- nada. Asi ni el administrador puede cambiarla.
CREATE OR REPLACE FUNCTION consentimiento_inmutable() RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'Un consentimiento no se borra: es la evidencia ante la autoridad';
  END IF;
  IF (OLD."estado" = 'OTORGADO') THEN
    -- Revocar SI se permite: es un derecho del titular. Lo demas no.
    IF (NEW."estado" <> 'REVOCADO'
        OR NEW."otorgadoEn" IS DISTINCT FROM OLD."otorgadoEn"
        OR NEW."ipAceptacion" IS DISTINCT FROM OLD."ipAceptacion"
        OR NEW."hashTexto" IS DISTINCT FROM OLD."hashTexto"
        OR NEW."versionTexto" IS DISTINCT FROM OLD."versionTexto") THEN
      RAISE EXCEPTION 'La evidencia de un consentimiento otorgado no se modifica';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS consentimiento_inmutable_trg ON "consentimientos";
CREATE TRIGGER consentimiento_inmutable_trg
  BEFORE UPDATE OR DELETE ON "consentimientos"
  FOR EACH ROW EXECUTE FUNCTION consentimiento_inmutable();
