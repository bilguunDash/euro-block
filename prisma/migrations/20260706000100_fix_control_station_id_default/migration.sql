-- The live "control_stations" table predates the DEFAULT gen_random_uuid() clause in
-- 20260515000100_add_control_structure (that migration's CREATE TABLE IF NOT EXISTS was a
-- no-op against the already-existing table), so raw-SQL inserts that omit "id" fail with a
-- NOT NULL violation. Backfill the default directly.
ALTER TABLE "control_stations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
