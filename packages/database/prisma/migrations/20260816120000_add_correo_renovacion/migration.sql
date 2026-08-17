-- Borrador del correo de renovacion.
--
-- El sistema arma el texto con los datos de la poliza, y la ejecutiva lo revisa
-- y corrige en pantalla antes de enviar. Ese texto corregido se guarda aqui: si
-- no, cada vez que abriera la renovacion perderia sus ajustes y tendria que
-- rehacerlos.
ALTER TABLE "renovaciones" ADD COLUMN IF NOT EXISTS "correoTexto" TEXT;
-- Plantilla elegida. Se detecta por aseguradora y plan, pero queda editable
-- porque hay casos que no cuadran solos.
ALTER TABLE "renovaciones" ADD COLUMN IF NOT EXISTS "correoPlantilla" TEXT;
-- Correo del destinatario. Se precarga del cliente y se puede corregir: a veces
-- el cliente pide que le escriban a otra direccion.
ALTER TABLE "renovaciones" ADD COLUMN IF NOT EXISTS "correoDestinatario" TEXT;
