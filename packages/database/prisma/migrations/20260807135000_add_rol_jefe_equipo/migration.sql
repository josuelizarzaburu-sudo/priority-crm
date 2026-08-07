-- Rol de jefe de equipo comercial.
--
-- Va en su PROPIA migracion a proposito: en PostgreSQL, un valor nuevo de enum
-- no se puede usar dentro de la misma transaccion en que se crea. Separandolo,
-- la migracion siguiente (que crea la tabla de equipos) ya lo encuentra
-- disponible.
--
-- Idempotente: si el valor ya existe, no hace nada.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'JEFE_EQUIPO';
