-- Datos que viajan del CRM comercial al operativo cuando se gana un deal.
--
-- origenLead: de donde vino el cliente (PRIORITY_HEALTH = web y campanas,
-- PRIORITY = carga por Excel del jefe de equipo, PROPIO = lo consiguio el asesor
-- por su cuenta). Operaciones lo necesita para saber el contexto de la venta y
-- para reportes; hasta ahora ese dato se perdia al crear la ficha.
--
-- vieneDeOtroSeguro: si el cliente traia un seguro anterior. Es dato de gestion:
-- cambia el trato inicial y ayuda a entender la cartera. Es texto y no booleano
-- para poder guardar tambien de que aseguradora venia.
--
-- Los clientes que ya existen quedan con ambos en null, que es correcto: de
-- ellos no tenemos esa informacion.
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "origenLead" TEXT;
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "vieneDeOtroSeguro" TEXT;
