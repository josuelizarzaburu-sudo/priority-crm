-- Tareas del equipo de operaciones.
--
-- Reemplaza la libreta de papel donde las ejecutivas anotan sus pendientes. Va
-- aparte del calendario de la empresa a proposito: mezclar tareas personales con
-- las reuniones haria inutiles a las dos.
--
-- La clave del diseno es que solicitanteId y asignadoId son DISTINTOS:
--   Roxana le pide algo a Yessenia -> Yessenia lo reasigna a Carolina
-- Al reasignar solo cambia asignadoId. Roxana sigue viendo su pedido y sabe
-- cuando se cumplio, aunque lo haya ejecutado otra persona. Si se guardara un
-- solo usuario, el pedido desapareceria del radar de quien lo hizo.
DO $$
BEGIN
  CREATE TYPE "PrioridadTarea" AS ENUM ('ALTA', 'MEDIA', 'BAJA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "tareas" (
  "id"             TEXT NOT NULL,
  "titulo"         TEXT NOT NULL,
  "detalle"        TEXT,
  "prioridad"      "PrioridadTarea" NOT NULL DEFAULT 'MEDIA',
  -- Dia en que hay que hacerla. Sin hora: es una tarea, no una cita.
  "fechaLimite"    DATE,
  -- Null = pendiente. Con fecha = hecha, y se sabe cuando.
  "completadaEn"   TIMESTAMP(3),
  "completadaPor"  TEXT,
  -- Quien la hace. Es el unico campo que cambia al reasignar.
  "asignadoId"     TEXT NOT NULL,
  -- Quien la pidio. NO cambia al reasignar: asi quien la pidio sigue viendola.
  "solicitanteId"  TEXT NOT NULL,
  -- Cliente relacionado, si aplica. Permite saltar a su ficha desde la lista.
  "clienteId"      TEXT,
  "organizationId" TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tareas_pkey" PRIMARY KEY ("id")
);

-- Indice pensado para la consulta mas frecuente: "mis tareas pendientes".
CREATE INDEX IF NOT EXISTS "tareas_asignadoId_completadaEn_idx"
  ON "tareas"("asignadoId", "completadaEn");
CREATE INDEX IF NOT EXISTS "tareas_organizationId_fechaLimite_idx"
  ON "tareas"("organizationId", "fechaLimite");
CREATE INDEX IF NOT EXISTS "tareas_solicitanteId_idx" ON "tareas"("solicitanteId");
CREATE INDEX IF NOT EXISTS "tareas_clienteId_idx" ON "tareas"("clienteId");

DO $$
BEGIN
  ALTER TABLE "tareas" ADD CONSTRAINT "tareas_asignadoId_fkey"
    FOREIGN KEY ("asignadoId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "tareas" ADD CONSTRAINT "tareas_solicitanteId_fkey"
    FOREIGN KEY ("solicitanteId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  -- SetNull: si se borra el cliente, la tarea no se borra; queda el historico.
  ALTER TABLE "tareas" ADD CONSTRAINT "tareas_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "tareas" ADD CONSTRAINT "tareas_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
