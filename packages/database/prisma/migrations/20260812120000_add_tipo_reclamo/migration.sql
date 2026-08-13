-- Distingue un reembolso de un credito hospitalario.
--
-- Son dos gestiones distintas: en el reembolso el cliente ya pago y se le
-- devuelve el dinero; en el credito hospitalario la aseguradora paga
-- directamente a la clinica. El flujo y los tiempos no son iguales, asi que hay
-- que poder filtrarlos y reportarlos por separado.
--
-- Los registros que ya existen quedan como REEMBOLSO, que es lo que se venia
-- gestionando hasta ahora.
DO $$
BEGIN
  CREATE TYPE "TipoReclamo" AS ENUM ('REEMBOLSO', 'CREDITO_HOSPITALARIO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "reclamos"
  ADD COLUMN IF NOT EXISTS "tipoReclamo" "TipoReclamo" NOT NULL DEFAULT 'REEMBOLSO';
