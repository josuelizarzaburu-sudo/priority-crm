-- Limites de reintento, para que el quiz no se pueda pasar a fuerza de probar.
--
-- El problema: al reintentar de inmediato y con las preguntas en el mismo orden,
-- se puede aprobar sin ver el video —basta ir cambiando de opcion hasta acertar.
--
-- ultimoIntentoEn permite exigir una espera; intentosHoy y diaDeIntentos, un tope
-- diario. Se guarda el DIA en texto (YYYY-MM-DD, hora de Ecuador) en vez de
-- comparar marcas de tiempo: asi el corte del dia es el del calendario local y no
-- el de UTC, que en Ecuador caeria a las 19:00.
ALTER TABLE "curso_avances" ADD COLUMN IF NOT EXISTS "ultimoIntentoEn" TIMESTAMP(3);
ALTER TABLE "curso_avances" ADD COLUMN IF NOT EXISTS "intentosHoy" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "curso_avances" ADD COLUMN IF NOT EXISTS "diaDeIntentos" TEXT;

-- Configurable por curso: un curso corto puede querer mas margen que uno largo.
ALTER TABLE "cursos" ADD COLUMN IF NOT EXISTS "esperaMinutos" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "cursos" ADD COLUMN IF NOT EXISTS "intentosPorDia" INTEGER NOT NULL DEFAULT 3;
