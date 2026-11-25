ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "tabletAccessAllowed" BOOLEAN NOT NULL DEFAULT true;

UPDATE "users"
SET "tabletAccessAllowed" = true
WHERE "tabletAccessAllowed" IS NULL;
