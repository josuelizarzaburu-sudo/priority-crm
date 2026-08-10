-- Equipos comerciales: un jefe y sus vendedores.
--
-- Antes los leads se repartian por Excel y mensajes sueltos. Con esto cada jefe
-- reparte y supervisa UNICAMENTE los leads de su gente.
--
-- Se escribe a mano e idempotente porque el sandbox no alcanza los servidores de
-- Prisma, igual que el resto de migraciones del proyecto.

-- El rol JEFE_EQUIPO se agrega en la migracion anterior
-- (20260807135000_add_rol_jefe_equipo), porque un valor nuevo de enum no se
-- puede usar en la misma transaccion en que se crea.

-- 1. Tabla de equipos.
CREATE TABLE IF NOT EXISTS "equipos" (
  "id"             TEXT NOT NULL,
  "nombre"         TEXT NOT NULL,
  "jefeId"         TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "activo"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "equipos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "equipos_organizationId_idx" ON "equipos"("organizationId");
CREATE INDEX IF NOT EXISTS "equipos_jefeId_idx" ON "equipos"("jefeId");

-- 2. Pertenencia del usuario a un equipo. Opcional: quien no esta en ninguno
--    (super admin, gerencia, operaciones) sigue funcionando igual que antes.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "equipoId" TEXT;
CREATE INDEX IF NOT EXISTS "users_equipoId_idx" ON "users"("equipoId");

-- 3. Llaves foraneas. Se envuelven en DO/EXCEPTION porque ADD CONSTRAINT no
--    admite IF NOT EXISTS en PostgreSQL.
DO $$
BEGIN
  -- Restrict: no se puede borrar al usuario que es jefe sin antes reasignar el
  -- equipo. Evita dejar un equipo huerfano con leads dentro.
  ALTER TABLE "equipos"
    ADD CONSTRAINT "equipos_jefeId_fkey"
    FOREIGN KEY ("jefeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "equipos"
    ADD CONSTRAINT "equipos_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  -- SetNull: si se borra el equipo, la persona queda sin equipo. No se borra al
  -- usuario ni se pierden sus negocios.
  ALTER TABLE "users"
    ADD CONSTRAINT "users_equipoId_fkey"
    FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
