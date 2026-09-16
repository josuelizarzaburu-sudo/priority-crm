-- Falta guardar a QUIEN se le envia cuando se programa.
--
-- Sin esto el envio programado fallaba siempre: enviarCorreo exige destinatario
-- y la tarea no tenia de donde sacarlo, asi que rechazaba con "el correo del
-- destinatario no es valido" y la renovacion se cancelaba sola.
ALTER TABLE "renovaciones"
  ADD COLUMN IF NOT EXISTS "destinatarioProgramado" TEXT;
