ALTER TABLE "control_stations"
  ADD COLUMN IF NOT EXISTS "isMasterStation" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "control_stations"
SET "isMasterStation" = TRUE,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" IN ('ҮЯ-099', 'ҮЯ-310', 'ҮЯ-410');
