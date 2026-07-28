-- Módulo de Operaciones — segunda entrega.
--
-- 1) Las pólizas ahora tienen TIPO (salud, auto, vida, hogar) y los campos
--    propios de cada ramo: un auto necesita placa/marca/modelo/año, un seguro
--    de vida necesita el tiempo de cobertura, etc.
-- 2) El cliente gana: nombre preferido, referido de, contacto sugerido, y una
--    marca para controlar que la ejecutiva solo corrija la cédula una vez.
--
-- Todas las columnas nuevas son opcionales o tienen valor por defecto, así que
-- los 10 clientes y 11 pólizas ya cargados no se ven afectados.

-- CreateEnum
CREATE TYPE "TipoPoliza" AS ENUM ('SALUD', 'AUTO', 'VIDA', 'HOGAR');

-- AlterTable: clientes
ALTER TABLE "clientes" ADD COLUMN     "nombrePreferido" TEXT,
                       ADD COLUMN     "referidoDe" TEXT,
                       ADD COLUMN     "contactoSugerido" TEXT,
                       ADD COLUMN     "cedulaEditada" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: polizas
-- Las pólizas que ya existen son todas de salud/gastos médicos, por eso el
-- default SALUD es correcto para ellas.
ALTER TABLE "polizas" ADD COLUMN     "tipo" "TipoPoliza" NOT NULL DEFAULT 'SALUD',
                      ADD COLUMN     "sumaAsegurada" DECIMAL(14,2),
                      ADD COLUMN     "marca" TEXT,
                      ADD COLUMN     "modelo" TEXT,
                      ADD COLUMN     "anio" INTEGER,
                      ADD COLUMN     "placa" TEXT,
                      ADD COLUMN     "tiempoCobertura" TEXT,
                      ADD COLUMN     "observacion" TEXT;

-- CreateIndex
CREATE INDEX "polizas_organizationId_tipo_idx" ON "polizas"("organizationId", "tipo");
