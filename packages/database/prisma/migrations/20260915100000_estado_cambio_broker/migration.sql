-- Nuevo estado de poliza: CAMBIO_DE_BROKER.
--
-- Se AGREGA junto a CARTA_DE_NOMBRAMIENTO, no lo reemplaza: son cosas distintas.
-- La carta de nombramiento es el documento formal del tramite; el cambio de
-- broker es la situacion comercial. Una poliza puede estar en cambio de broker
-- sin que la carta este emitida todavia.
ALTER TYPE "EstadoPoliza" ADD VALUE IF NOT EXISTS 'CAMBIO_DE_BROKER';
