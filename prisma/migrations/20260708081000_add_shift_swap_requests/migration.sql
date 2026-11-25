-- CreateTable
CREATE TABLE "shift_swap_requests" (
    "id" UUID NOT NULL,
    "requesterScheduleId" TEXT NOT NULL,
    "requesterUid" TEXT NOT NULL,
    "requesterName" TEXT,
    "requesterShiftDate" TEXT NOT NULL,
    "requesterShiftType" TEXT NOT NULL,
    "requesterStationCode" TEXT NOT NULL,
    "targetScheduleId" TEXT NOT NULL,
    "targetUid" TEXT NOT NULL,
    "targetName" TEXT,
    "targetShiftDate" TEXT NOT NULL,
    "targetShiftType" TEXT NOT NULL,
    "targetStationCode" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decisionNote" TEXT,
    "decidedByUid" TEXT,
    "decidedByName" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_swap_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shift_swap_requests_requesterUid_status_idx" ON "shift_swap_requests"("requesterUid", "status");

-- CreateIndex
CREATE INDEX "shift_swap_requests_targetUid_status_idx" ON "shift_swap_requests"("targetUid", "status");

-- CreateIndex
CREATE INDEX "shift_swap_requests_requesterScheduleId_idx" ON "shift_swap_requests"("requesterScheduleId");

-- CreateIndex
CREATE INDEX "shift_swap_requests_targetScheduleId_idx" ON "shift_swap_requests"("targetScheduleId");
