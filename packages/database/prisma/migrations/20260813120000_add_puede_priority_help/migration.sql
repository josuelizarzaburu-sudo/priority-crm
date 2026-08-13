-- Acceso a Priority Help, activable usuario por usuario.
--
-- Cada consulta al bot tiene costo, asi que el acceso no se da por rol sino
-- por persona: se activa a los asesores que convenga desde la pantalla de
-- Usuarios. Apagado por defecto, igual que puedeVender y
-- puedeCotizarPorOtros: nadie lo gana solo por existir.
--
-- Se escribe a mano e idempotente porque el sandbox no alcanza los
-- servidores de Prisma, igual que el resto de migraciones del proyecto.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "puedePriorityHelp" BOOLEAN NOT NULL DEFAULT false;
