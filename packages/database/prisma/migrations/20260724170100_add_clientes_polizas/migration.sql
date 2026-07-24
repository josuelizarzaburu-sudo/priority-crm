-- Migration: módulo de Operaciones — base de clientes.
--
-- Crea 4 tablas nuevas. NO modifica ninguna tabla existente, así que el área
-- comercial (contactos, deals, pipeline) sigue funcionando igual.
--
-- Modelo:
--   clientes            una persona, única por (organización, identificación)
--   polizas             N por cliente (salud, gastos mayores, vehículo...)
--   dependientes        N por cliente — cuelgan de la PERSONA, no de la póliza,
--                       para que un mismo cónyuge no se duplique
--   poliza_dependientes qué dependiente está cubierto bajo qué póliza

-- CreateEnum
CREATE TYPE "Genero" AS ENUM ('MASCULINO', 'FEMENINO', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoPoliza" AS ENUM ('NUEVO', 'RENOVADO', 'CARTA_DE_NOMBRAMIENTO', 'CANCELADA');

-- CreateEnum
CREATE TYPE "FormaPago" AS ENUM ('CONTADO', 'MENSUAL', 'DIFERIDO', 'DIFERIDO_ESPECIAL');

-- CreateEnum
CREATE TYPE "Parentesco" AS ENUM ('CONYUGE', 'HIJO', 'HIJA', 'PADRE', 'MADRE', 'HERMANO', 'HERMANA', 'OTRO');

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "identificacion" TEXT NOT NULL,
    "genero" "Genero",
    "fechaNacimiento" TIMESTAMP(3),
    "email" TEXT,
    "telefono" TEXT,
    "celular" TEXT,
    "ciudad" TEXT,
    "direccion" TEXT,
    "notas" TEXT,
    "revisar" BOOLEAN NOT NULL DEFAULT false,
    "revisarMotivo" TEXT,
    "organizationId" TEXT NOT NULL,
    "ejecutivoId" TEXT,
    "ejecutivoNombre" TEXT,
    "contactId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polizas" (
    "id" TEXT NOT NULL,
    "numeroContrato" TEXT,
    "estado" "EstadoPoliza",
    "aseguradora" TEXT,
    "plan" TEXT,
    "deducible" TEXT,
    "formaPago" "FormaPago",
    "fechaEmision" TIMESTAMP(3),
    "fechaRenovacion" TIMESTAMP(3),
    "primaNeta" DECIMAL(12,2),
    "revisar" BOOLEAN NOT NULL DEFAULT false,
    "revisarMotivo" TEXT,
    "clienteId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agenteId" TEXT,
    "agenteNombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "polizas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dependientes" (
    "id" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT,
    "identificacion" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "parentesco" "Parentesco" NOT NULL DEFAULT 'OTRO',
    "clienteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dependientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poliza_dependientes" (
    "polizaId" TEXT NOT NULL,
    "dependienteId" TEXT NOT NULL,

    CONSTRAINT "poliza_dependientes_pkey" PRIMARY KEY ("polizaId","dependienteId")
);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_contactId_key" ON "clientes"("contactId");

-- CreateIndex
CREATE INDEX "clientes_organizationId_ejecutivoId_idx" ON "clientes"("organizationId", "ejecutivoId");

-- CreateIndex
CREATE INDEX "clientes_organizationId_apellidos_idx" ON "clientes"("organizationId", "apellidos");

-- CreateIndex
CREATE INDEX "clientes_identificacion_idx" ON "clientes"("identificacion");

-- CreateIndex
-- Esta es la que impide técnicamente que un mismo cliente se cargue dos veces.
CREATE UNIQUE INDEX "clientes_organizationId_identificacion_key" ON "clientes"("organizationId", "identificacion");

-- CreateIndex
CREATE INDEX "polizas_clienteId_idx" ON "polizas"("clienteId");

-- CreateIndex
CREATE INDEX "polizas_organizationId_aseguradora_idx" ON "polizas"("organizationId", "aseguradora");

-- CreateIndex
CREATE INDEX "polizas_organizationId_fechaRenovacion_idx" ON "polizas"("organizationId", "fechaRenovacion");

-- CreateIndex
CREATE INDEX "dependientes_clienteId_idx" ON "dependientes"("clienteId");

-- CreateIndex
CREATE INDEX "poliza_dependientes_dependienteId_idx" ON "poliza_dependientes"("dependienteId");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_ejecutivoId_fkey" FOREIGN KEY ("ejecutivoId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polizas" ADD CONSTRAINT "polizas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polizas" ADD CONSTRAINT "polizas_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polizas" ADD CONSTRAINT "polizas_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependientes" ADD CONSTRAINT "dependientes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poliza_dependientes" ADD CONSTRAINT "poliza_dependientes_polizaId_fkey" FOREIGN KEY ("polizaId") REFERENCES "polizas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poliza_dependientes" ADD CONSTRAINT "poliza_dependientes_dependienteId_fkey" FOREIGN KEY ("dependienteId") REFERENCES "dependientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
