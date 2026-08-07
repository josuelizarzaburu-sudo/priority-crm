-- Permiso para gestionar negocios propios en "Mi Pipeline" sin ser vendedor de
-- planta. Pensado para los perfiles de Operaciones, que venden ocasionalmente.
--
-- Se escribe a mano e idempotente porque el sandbox no alcanza los servidores de
-- Prisma, igual que el resto de migraciones del modulo de Operaciones.
--
-- Apagado por defecto: nadie gana el permiso solo por existir. Se activa usuario
-- por usuario desde la pantalla de Usuarios.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "puedeVender" BOOLEAN NOT NULL DEFAULT false;
