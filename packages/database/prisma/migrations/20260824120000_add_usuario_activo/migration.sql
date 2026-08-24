-- Desactivar una cuenta sin borrarla.
--
-- Cuando alguien deja la empresa habia dos opciones, las dos malas:
--   - Borrar el usuario: se pierde su historial (quien asigno que, quien
--     escribio cada nota, sus ventas en el ranking).
--   - Cambiar la contrasena: NO cierra la sesion abierta. El token de acceso
--     dura 12 horas y el de renovacion 7 dias, asi que seguia entrando desde su
--     telefono una semana mas.
--
-- Con esto el corte es inmediato: cada peticion comprueba el estado del usuario
-- contra la base, asi que al apagar el interruptor queda fuera al instante.
--
-- Los usuarios existentes quedan activos, que es lo que son.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activo" BOOLEAN NOT NULL DEFAULT true;
-- Cuando y quien lo desactivo, para poder auditarlo despues.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "desactivadoEn" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "desactivadoPor" TEXT;
