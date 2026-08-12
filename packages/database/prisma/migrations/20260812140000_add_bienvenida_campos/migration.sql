-- Marca de que ya se envio el correo de bienvenida.
--
-- Es una fecha y no un booleano para saber CUANDO se mando, y sirve ademas como
-- proteccion: si ya tiene fecha, el boton no vuelve a enviar y el cliente no
-- recibe el correo dos veces.
ALTER TABLE "requerimientos"
  ADD COLUMN IF NOT EXISTS "correoBienvenidaEnviado" TIMESTAMP(3);
