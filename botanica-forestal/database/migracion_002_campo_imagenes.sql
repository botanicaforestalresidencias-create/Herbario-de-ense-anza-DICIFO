-- ============================================================
-- Migración incremental: agrega la columna "campo" a la tabla
-- imagenes, para poder ubicar cada foto bajo su característica
-- correspondiente (hojas, flor, fruto, cono, acículas, semilla...).
-- Ejecútalo SOLO si tu base de datos ya existía antes de este cambio.
-- ============================================================

USE botanica_forestal;

ALTER TABLE imagenes
  ADD COLUMN IF NOT EXISTS campo VARCHAR(50) AFTER ruta_archivo;

-- Las imágenes que ya tenías subidas quedan como "general" por defecto,
-- para que no desaparezcan de la ficha (se mostrarán en el bloque
-- de fotografía general en vez de bajo un campo específico).
UPDATE imagenes SET campo = 'general' WHERE campo IS NULL;
