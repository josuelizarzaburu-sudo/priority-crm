-- Migration: agregar los perfiles del módulo de Operaciones al enum UserRole.
--
-- Va en su propia migración a propósito: PostgreSQL no permite USAR un valor
-- de enum recién agregado dentro de la misma transacción que lo creó. Al
-- separarlo, la migración que crea las tablas (y cualquier seed posterior)
-- ya encuentra los valores confirmados.
--
-- Solo AGREGA valores: los cuatro roles existentes (SUPER_ADMIN, OWNER,
-- MANAGER, SALES_REP) quedan intactos y ningún usuario actual cambia.

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'OPERACIONES';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'JEFE_OPERACIONES';
