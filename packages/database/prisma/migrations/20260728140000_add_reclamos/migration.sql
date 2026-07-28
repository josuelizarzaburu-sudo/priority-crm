-- Reclamos / reembolsos médicos.
--
-- El vínculo con el cliente (clienteId) es opcional a propósito: los reclamos
-- históricos vienen del Excel sin cédula, así que se cargan con el nombre en
-- texto y se enganchan después, cuando esté cargada la base completa de clientes.
--
-- Los "días de liquidación" y "días de envío al cliente" NO se guardan: se
-- calculan al mostrarlos. Así se evita el problema del Excel, donde 373 filas
-- mostraban -32651 porque la fórmula restaba contra una fecha vacía.

-- CreateEnum
CREATE TYPE "EstadoReclamo" AS ENUM ('EN_TRAMITE', 'LIQUIDADO', 'NEGADO', 'DEVUELTO');

-- CreateTable
CREATE TABLE "reclamos" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clienteId" TEXT,
    "clienteNombre" TEXT NOT NULL,
    "pacienteNombre" TEXT,
    "aseguradora" TEXT,
    "contrato" TEXT,
    "diagnostico" TEXT,
    "fechaRecepcion" TIMESTAMP(3),
    "fechaEnvioAseguradora" TIMESTAMP(3),
    "liquidacion" TEXT,
    "fechaLiquidacion" TIMESTAMP(3),
    "fechaEnvioCliente" TIMESTAMP(3),
    "valor" DECIMAL(12,2),
    "estado" "EstadoReclamo" NOT NULL DEFAULT 'EN_TRAMITE',
    "medioComunicacion" TEXT,
    "observaciones" TEXT,
    "detalle" TEXT,
    "ejecutivoId" TEXT,
    "ejecutivoNombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reclamos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reclamos_organizationId_ejecutivoId_idx" ON "reclamos"("organizationId", "ejecutivoId");

-- CreateIndex
CREATE INDEX "reclamos_organizationId_estado_idx" ON "reclamos"("organizationId", "estado");

-- CreateIndex
CREATE INDEX "reclamos_clienteId_idx" ON "reclamos"("clienteId");

-- CreateIndex
CREATE INDEX "reclamos_organizationId_fechaEnvioAseguradora_idx" ON "reclamos"("organizationId", "fechaEnvioAseguradora");

-- AddForeignKey
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_ejecutivoId_fkey" FOREIGN KEY ("ejecutivoId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
