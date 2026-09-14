-- Envio programado de renovaciones.
--
-- La renovacion se prepara cuando la ejecutiva tiene tiempo, pero el correo
-- conviene que salga en un momento concreto: ni de madrugada ni un domingo. Con
-- esto se deja listo y sale solo a la hora indicada.
ALTER TABLE "renovaciones" ADD COLUMN IF NOT EXISTS "programadoPara" TIMESTAMP(3);
ALTER TABLE "renovaciones" ADD COLUMN IF NOT EXISTS "textoProgramado" TEXT;
ALTER TABLE "renovaciones" ADD COLUMN IF NOT EXISTS "copiasProgramadas" TEXT;
ALTER TABLE "renovaciones" ADD COLUMN IF NOT EXISTS "programadoPorId" TEXT;

-- El indice cubre la consulta del proceso que envia: los pendientes cuya hora ya
-- paso. Sin el, habria que recorrer todas las renovaciones cada pocos minutos.
CREATE INDEX IF NOT EXISTS "renovaciones_programadoPara_idx"
  ON "renovaciones"("programadoPara") WHERE "programadoPara" IS NOT NULL;
