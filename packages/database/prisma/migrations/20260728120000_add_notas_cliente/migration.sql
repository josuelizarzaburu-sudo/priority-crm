-- Bitácora del cliente: notas que las ejecutivas van dejando y que NO se pueden
-- editar ni borrar. Es un historial, por eso no lleva columna updatedAt.
--
-- Se guarda el nombre del autor además de su id, para que la nota siga siendo
-- legible aunque esa persona salga de la empresa y su usuario se elimine.

-- CreateTable
CREATE TABLE "notas_cliente" (
    "id" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "autorId" TEXT,
    "autorNombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notas_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notas_cliente_clienteId_createdAt_idx" ON "notas_cliente"("clienteId", "createdAt");

-- AddForeignKey
ALTER TABLE "notas_cliente" ADD CONSTRAINT "notas_cliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_cliente" ADD CONSTRAINT "notas_cliente_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
