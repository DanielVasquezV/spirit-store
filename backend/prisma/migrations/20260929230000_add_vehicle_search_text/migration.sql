-- Columna de busqueda para el catalogo de vehiculos.
--
-- Guarda marca + modelo ya normalizados (minusculas y sin diacriticos) para que
-- el filtro de texto del catalogo no dependa de como este configurada la base.
--
-- El motivo concreto: la extension `unaccent` no esta disponible, asi que con
-- `ILIKE` un "skoda" no encuentra "Skoda" y un "sedan" no encuentra "Sedan".
-- Normalizando en la app se resuelve sin tocar la instalacion de Postgres y
-- sin una consulta por vehicle.
--
-- `COLLATE "C"` deja la comparacion byte a byte: el resultado no cambia segun
-- la colacion que tenga configurada cada instalacion (dev, CI, produccion).
--
-- El backfill solo puede pasar por `lower()`, que es lo unico disponible sin
-- `unaccent`. Las filas con acentos se corrigen solas en su proxima
-- actualizacion, porque el service recalcula searchText en cada escritura.
ALTER TABLE "vehicles" ADD COLUMN "searchText" TEXT COLLATE "C" NOT NULL DEFAULT '';

UPDATE "vehicles"
SET "searchText" = lower("brand") || ' ' || lower("model");
