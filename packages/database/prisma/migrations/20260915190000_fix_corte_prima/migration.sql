-- Corrige el nombre de la columna: se creo como "corteePrima", con una e de mas.
--
-- Prisma busca "cortePrima", asi que cualquier lectura o escritura de las reglas
-- fallaba con error 500 —incluida la pantalla del referidor, que las consulta
-- para saber cuantos puntos da cada referido.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'referido_reglas' AND column_name = 'corteePrima'
  ) THEN
    ALTER TABLE "referido_reglas" RENAME COLUMN "corteePrima" TO "cortePrima";
  END IF;
END $$;

-- Por si la tabla se creo en un entorno donde el nombre ya era el correcto pero
-- la columna no existe: se agrega con el valor acordado.
ALTER TABLE "referido_reglas"
  ADD COLUMN IF NOT EXISTS "cortePrima" DECIMAL(10,2) NOT NULL DEFAULT 2000;
