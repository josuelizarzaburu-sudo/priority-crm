-- Adjuntos del envio programado.
--
-- Al programar solo se guardaba el texto, asi que el correo salia sin los
-- archivos que la ejecutiva habia adjuntado. En renovaciones eso importa: el
-- adjunto suele ser el cuadro de beneficios del plan nuevo.
--
-- Se guardan como JSON con el contenido en base64, igual que viajan en la
-- peticion. Es lo unico que permite reconstruir el correo mas tarde sin montar
-- almacenamiento de archivos para algo que se usa una vez y se borra.
ALTER TABLE "renovaciones"
  ADD COLUMN IF NOT EXISTS "adjuntosProgramados" JSONB;
