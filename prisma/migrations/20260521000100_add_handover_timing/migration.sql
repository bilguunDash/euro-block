ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "handoverTimingStatus" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "handoverTimingReason" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "handoverTimingRecordedAt" TEXT;
