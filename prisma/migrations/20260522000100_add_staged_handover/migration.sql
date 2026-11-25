ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "handoverStage" TEXT DEFAULT 'none';
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "currentMasterUid" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "currentMasterName" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "currentMasterApprovedByUid" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "currentMasterApprovedByName" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "currentMasterApprovedAt" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "currentMasterComment" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "nextMasterUid" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "nextMasterName" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "nextMasterApprovedByUid" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "nextMasterApprovedByName" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "nextMasterApprovedAt" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "nextMasterComment" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "nextOperatorUid" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "nextOperatorName" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "handoverFinalAcceptedAt" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "handoverReturnedByUid" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "handoverReturnedByName" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "handoverReturnedAt" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "handoverReturnReason" TEXT;

CREATE TABLE IF NOT EXISTS "shift_handover_approvals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "shiftId" UUID NOT NULL,
  "stage" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorUid" TEXT NOT NULL,
  "actorName" TEXT,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shift_handover_approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "shift_handover_approvals_shiftId_createdAt_idx"
ON "shift_handover_approvals"("shiftId", "createdAt");

CREATE INDEX IF NOT EXISTS "shift_handover_approvals_stage_action_idx"
ON "shift_handover_approvals"("stage", "action");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shift_handover_approvals_shiftId_fkey'
  ) THEN
    ALTER TABLE "shift_handover_approvals"
    ADD CONSTRAINT "shift_handover_approvals_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "shifts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
