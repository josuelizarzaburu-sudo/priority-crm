-- PIN de 6 digitos para entrar desde el movil.
--
-- El caso que resuelve: telefono robado con la contrasena guardada en el
-- navegador. Sin PIN, quien lo tenga abre el CRM y ve datos de clientes —cedulas,
-- diagnosticos, primas—. Con PIN, la contrasena guardada no le sirve porque no
-- es lo que se le pide.
--
-- El PIN se guarda CIFRADO igual que una contrasena y NUNCA en el telefono: se
-- verifica contra el servidor, asi que ni extrayendo la memoria del dispositivo
-- se puede leer.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pinHash" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pinCreadoEn" TIMESTAMP(3);
-- Intentos fallidos seguidos. A los 5 se cierra la sesion: es lo que evita que
-- alguien pruebe combinaciones con el telefono en la mano.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pinIntentos" INTEGER NOT NULL DEFAULT 0;
