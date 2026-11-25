CREATE TABLE IF NOT EXISTS "control_stations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "isMasterStation" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "control_assignments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "stationCode" TEXT NOT NULL,
  "stationName" TEXT,
  "operatorUid" TEXT,
  "operatorName" TEXT,
  "masterUid" TEXT NOT NULL,
  "masterName" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "control_assignments_stationCode_operatorUid_masterUid_key"
  ON "control_assignments" ("stationCode", "operatorUid", "masterUid");

CREATE INDEX IF NOT EXISTS "control_assignments_masterUid_isActive_idx"
  ON "control_assignments" ("masterUid", "isActive");

CREATE INDEX IF NOT EXISTS "control_assignments_operatorUid_isActive_idx"
  ON "control_assignments" ("operatorUid", "isActive");

CREATE INDEX IF NOT EXISTS "control_assignments_stationCode_isActive_idx"
  ON "control_assignments" ("stationCode", "isActive");
