-- Agrega el parentesco CUÑADO (aparece en la base real de Priority).
--
-- Va en su propia migración porque PostgreSQL no permite usar un valor de enum
-- recién agregado dentro de la misma transacción que lo creó.
--
-- Solo AGREGA: los parentescos existentes quedan intactos.

-- AlterEnum
ALTER TYPE "Parentesco" ADD VALUE IF NOT EXISTS 'CUNADO';
