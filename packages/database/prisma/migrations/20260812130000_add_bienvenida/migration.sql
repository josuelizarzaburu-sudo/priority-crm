-- Requerimiento de bienvenida y marca de correo enviado.
--
-- Cuando Yessenia le asigna una ejecutiva a un cliente nuevo, se abre solo un
-- requerimiento de BIENVENIDA para que alguien verifique los datos y le mande el
-- correo de bienvenida. Antes ese paso dependia de que alguien se acordara.
--
-- El valor del enum va en su PROPIA migracion porque en PostgreSQL un valor
-- nuevo de enum no se puede usar en la misma transaccion en que se crea.
ALTER TYPE "TipoRequerimiento" ADD VALUE IF NOT EXISTS 'BIENVENIDA';
