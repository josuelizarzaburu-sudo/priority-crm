-- Valor que la aseguradora termino liquidando, distinto del presentado.
ALTER TABLE "reclamos" ADD COLUMN IF NOT EXISTS "valorLiquidado" DECIMAL(12,2);
