ALTER TABLE "control_assignments"
  ADD COLUMN IF NOT EXISTS "masterStationCode" TEXT,
  ADD COLUMN IF NOT EXISTS "masterStationName" TEXT;
