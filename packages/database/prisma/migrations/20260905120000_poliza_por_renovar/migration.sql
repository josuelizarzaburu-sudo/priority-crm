-- Estado POR_RENOVAR en la poliza.
--
-- Cuando llega el mes de renovacion, la poliza del cliente pasa a POR_RENOVAR, y
-- cuando la renovacion se cierra vuelve a RENOVADO. Asi, al abrir la ficha se ve
-- en que situacion esta cada poliza sin tener que ir al modulo de renovaciones.
ALTER TYPE "EstadoPoliza" ADD VALUE IF NOT EXISTS 'POR_RENOVAR';
