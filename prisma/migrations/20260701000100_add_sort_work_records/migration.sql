-- CreateTable
CREATE TABLE "sort_work_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shiftNo" TEXT NOT NULL DEFAULT '',
    "headerCNumber" TEXT NOT NULL DEFAULT '',
    "headerPoured" TEXT NOT NULL DEFAULT '',
    "headerCut" TEXT NOT NULL DEFAULT '',
    "autoclaveNo" TEXT NOT NULL DEFAULT '',
    "sort1FrameNo" TEXT NOT NULL DEFAULT '',
    "sort1SizeMm" TEXT NOT NULL DEFAULT '',
    "sort1Desc" TEXT NOT NULL DEFAULT '',
    "specialDualMode" BOOLEAN NOT NULL DEFAULT false,
    "sort1CutMm" TEXT NOT NULL DEFAULT '',
    "sort1Qty" INTEGER NOT NULL DEFAULT 0,
    "sort1M3" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sort1Qty200" INTEGER NOT NULL DEFAULT 0,
    "sort1M3200" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sort1Qty100" INTEGER NOT NULL DEFAULT 0,
    "sort1M3100" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sort2Code" TEXT NOT NULL DEFAULT '',
    "sort2CutMm" TEXT NOT NULL DEFAULT '',
    "sort2Qty" INTEGER NOT NULL DEFAULT 0,
    "sort2M3" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sort2Desc" TEXT NOT NULL DEFAULT '',
    "sort2Qty200" INTEGER NOT NULL DEFAULT 0,
    "sort2M3200" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sort2Qty100" INTEGER NOT NULL DEFAULT 0,
    "sort2M3100" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sort3Code" TEXT NOT NULL DEFAULT '',
    "sort3CutMm" TEXT NOT NULL DEFAULT '',
    "sort3Qty" INTEGER NOT NULL DEFAULT 0,
    "sort3M3" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sort3Desc" TEXT NOT NULL DEFAULT '',
    "sort3Qty200" INTEGER NOT NULL DEFAULT 0,
    "sort3M3200" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sort3Qty100" INTEGER NOT NULL DEFAULT 0,
    "sort3M3100" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deficitCutMm" TEXT NOT NULL DEFAULT '',
    "deficitQty" INTEGER NOT NULL DEFAULT 0,
    "deficitM3" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deficitDesc" TEXT NOT NULL DEFAULT '',
    "deficitQty200" INTEGER NOT NULL DEFAULT 0,
    "deficitM3200" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deficitQty100" INTEGER NOT NULL DEFAULT 0,
    "deficitM3100" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdByUid" TEXT NOT NULL,
    "createdByName" TEXT,
    "sortedByUid" TEXT,
    "sortedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "sort_work_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sort_work_records_headerCNumber_idx" ON "sort_work_records"("headerCNumber");

-- CreateIndex
CREATE INDEX "sort_work_records_shiftNo_idx" ON "sort_work_records"("shiftNo");

-- CreateIndex
CREATE INDEX "sort_work_records_status_createdAt_idx" ON "sort_work_records"("status", "createdAt");

-- CreateIndex
CREATE INDEX "sort_work_records_createdByUid_idx" ON "sort_work_records"("createdByUid");
