-- Permiso para emitir cotizaciones a nombre de otro asesor.
-- Se escribe a mano porque el sandbox no puede alcanzar Railway para correr
-- prisma migrate, igual que las migraciones del modulo de Operaciones.
-- Apagado por defecto: nadie gana el permiso solo por existir.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "puedeCotizarPorOtros" BOOLEAN NOT NULL DEFAULT false;
