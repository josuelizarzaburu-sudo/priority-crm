-- Campos que trae la base historica y el CRM no tenia.
--
-- empresa: para los clientes corporativos. Va en el CLIENTE y no en la poliza
-- porque se busca por ahi —"que clientes tengo de tal empresa"—, no plan por
-- plan.
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "empresa" TEXT;
-- INDIVIDUAL o CORPORATIVO.
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "tipoCliente" TEXT;

-- Quien vendio la poliza.
--
-- Va como TEXTO y no como relacion a User a proposito: parte de las ventas
-- historicas las hicieron vendedores que ya no estan en la empresa y que nunca
-- tuvieron usuario en el CRM. Si fuera una relacion, esas ventas se quedarian
-- sin agente y se perderia quien las trajo.
--
-- agenteId se llena solo cuando el nombre coincide con un usuario activo, para
-- poder filtrar por el en los reportes.
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "agenteNombre" TEXT;
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "agenteId" TEXT;

-- Numero de contrato de la aseguradora: es la llave con la que operaciones
-- identifica la poliza al hablar con la compania.
ALTER TABLE "polizas" ADD COLUMN IF NOT EXISTS "numeroContrato" TEXT;
ALTER TABLE "polizas" ADD COLUMN IF NOT EXISTS "frecuenciaPago" TEXT;

CREATE INDEX IF NOT EXISTS "clientes_organizationId_empresa_idx"
  ON "clientes"("organizationId", "empresa");
CREATE INDEX IF NOT EXISTS "clientes_agenteId_idx" ON "clientes"("agenteId");
CREATE INDEX IF NOT EXISTS "polizas_numeroContrato_idx" ON "polizas"("numeroContrato");

DO $$ BEGIN
  ALTER TABLE "clientes" ADD CONSTRAINT "clientes_agenteId_fkey"
    FOREIGN KEY ("agenteId") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
