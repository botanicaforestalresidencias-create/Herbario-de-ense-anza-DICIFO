-- ============================================================
-- Migración incremental: agrega los campos "sexualidad" y
-- "ubicacion_herbario" a angiospermas_detalle.
-- Ejecútalo SOLO si ya habías importado database/schema.sql antes
-- de esta actualización (si vas a importar desde cero, ya no hace
-- falta: schema.sql ya incluye estos campos).
-- ============================================================

USE botanica_forestal;

ALTER TABLE angiospermas_detalle
  ADD COLUMN IF NOT EXISTS sexualidad VARCHAR(50) AFTER filotaxia,
  ADD COLUMN IF NOT EXISTS ubicacion_herbario VARCHAR(100) AFTER fruto;
