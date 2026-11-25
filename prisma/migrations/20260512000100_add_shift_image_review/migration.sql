ALTER TABLE "shift_images"
ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'pending_review',
ADD COLUMN "reviewComment" TEXT,
ADD COLUMN "reviewedByUid" TEXT,
ADD COLUMN "reviewedByName" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3);

CREATE INDEX "shift_images_shiftId_reviewStatus_idx" ON "shift_images"("shiftId", "reviewStatus");
