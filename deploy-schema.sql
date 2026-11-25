-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "operatorUid" TEXT NOT NULL,
    "operatorName" TEXT NOT NULL,
    "stationCode" TEXT NOT NULL,
    "stationName" TEXT,
    "shiftType" TEXT NOT NULL,
    "shiftDate" TEXT NOT NULL,
    "checkIn" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Хадгалсан',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shiftNumber" TEXT,
    "formVersion" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TEXT,
    "handoverAwaitingAcceptance" BOOLEAN NOT NULL DEFAULT false,
    "handoverRequestedAt" TEXT,
    "handoverAcceptedByUid" TEXT,
    "handoverAcceptedByName" TEXT,
    "handoverAcceptedAt" TEXT,
    "handoverToOperatorUid" TEXT,
    "handoverToOperatorName" TEXT,
    "handoverTimingStatus" TEXT,
    "handoverTimingReason" TEXT,
    "handoverTimingRecordedAt" TEXT,
    "handoverStage" TEXT DEFAULT 'none',
    "currentMasterUid" TEXT,
    "currentMasterName" TEXT,
    "currentMasterApprovedByUid" TEXT,
    "currentMasterApprovedByName" TEXT,
    "currentMasterApprovedAt" TEXT,
    "currentMasterComment" TEXT,
    "nextMasterUid" TEXT,
    "nextMasterName" TEXT,
    "nextMasterApprovedByUid" TEXT,
    "nextMasterApprovedByName" TEXT,
    "nextMasterApprovedAt" TEXT,
    "nextMasterComment" TEXT,
    "nextOperatorUid" TEXT,
    "nextOperatorName" TEXT,
    "handoverFinalAcceptedAt" TEXT,
    "handoverReturnedByUid" TEXT,
    "handoverReturnedByName" TEXT,
    "handoverReturnedAt" TEXT,
    "handoverReturnReason" TEXT,
    "checkOut" TEXT,
    "operatorShiftCompleted" BOOLEAN NOT NULL DEFAULT false,
    "masterApproved" BOOLEAN NOT NULL DEFAULT false,
    "masterApprovedBy" TEXT,
    "masterApprovedDate" TEXT,
    "shiftMasterUid" TEXT,
    "adminApproved" BOOLEAN NOT NULL DEFAULT false,
    "adminApprovedBy" TEXT,
    "adminApprovedDate" TEXT,
    "notes" TEXT,
    "hseInfo" TEXT,
    "hseComment" TEXT,
    "equipmentInfo" TEXT,
    "equipmentComment" TEXT,
    "explanation" TEXT,
    "totalNote" TEXT,
    "report" TEXT,
    "ingredientChangeNote" TEXT,
    "platformMaintenanceNote" TEXT,
    "moldMaintenanceNote" TEXT,
    "attentionNotes" TEXT,
    "workPerformed" TEXT,
    "sigHandingOver" TEXT,
    "sigReceiving" TEXT,
    "sigShiftMaster" TEXT,
    "sigEngineer" TEXT,
    "sigMaster" TEXT,
    "sigOperator" TEXT,
    "sigTechnologistEngineer" TEXT,
    "sigChiefTechnologist" TEXT,
    "sigQualitySpecialist" TEXT,
    "pipelineStatus" TEXT,
    "pipelineComment" TEXT,
    "airPressureStatus" TEXT,
    "airPressureComment" TEXT,
    "lubricationStatus" TEXT,
    "lubricationComment" TEXT,
    "rawCementUnloadTons" TEXT,
    "rawWagonCleaningCount" TEXT,
    "workplaceStatus" TEXT,
    "workplaceComment" TEXT,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_handover_approvals" (
    "id" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "stage" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUid" TEXT NOT NULL,
    "actorName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_handover_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_inspections" (
    "id" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "tableType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "itemKey" TEXT,
    "itemLabel" TEXT,
    "status" TEXT,
    "comment" TEXT,
    "statusOk" TEXT,
    "cleaned" TEXT,
    "emergencyEquipment" TEXT,
    "labelEn" TEXT,
    "labelMn" TEXT,
    "equipmentNotes" TEXT,
    "nextShiftWork" TEXT,
    "weeklyInspection" TEXT,
    "requirement" TEXT,
    "percent" TEXT,
    "unit" TEXT,
    "total" TEXT,

    CONSTRAINT "equipment_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement_rows" (
    "id" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "timeValue" TEXT,
    "scheduledDay" TEXT,
    "scheduledNight" TEXT,
    "measuredTime" TEXT,
    "lineVoltage" TEXT,
    "transformerTempA" TEXT,
    "transformerTempB" TEXT,
    "transformerTempC" TEXT,
    "transformerCurrentInput1" TEXT,
    "transformerCurrentInput2" TEXT,
    "dieselMotorHours" TEXT,
    "dieselOilTemp" TEXT,
    "fuel" TEXT,
    "mebu1Voltage" TEXT,
    "mebu1Current" TEXT,
    "mebu1SectionSwitch" TEXT,
    "mebu2Voltage" TEXT,
    "mebu2Current" TEXT,
    "mebu2SectionSwitch" TEXT,
    "measuredTime35" TEXT,
    "lineVoltage35" TEXT,
    "transHighCurrentT1" TEXT,
    "transHighCurrentT2" TEXT,
    "transHighCurrentWindoor" TEXT,
    "transLowCurrentInput1" TEXT,
    "transLowCurrentInput2" TEXT,
    "furnacePressure" TEXT,
    "steamLinePressure" TEXT,
    "totalProductOut" TEXT,
    "totalProductIn" TEXT,
    "kilnPowerTransmissionPct" TEXT,
    "kilnPressureBar" TEXT,
    "kilnLevelPct" TEXT,
    "boosterAmountPct" TEXT,
    "screenTempMaxC" TEXT,
    "grateCastIronTempMaxC" TEXT,
    "condensateTank3LevelPct" TEXT,
    "condensateTank3TempC" TEXT,
    "feedWaterToTankTempC" TEXT,
    "ashDischargeHours" TEXT,
    "feedWaterBankPressurePct" TEXT,
    "feedWaterBankLevelPct" TEXT,
    "feedWaterBankTempPct" TEXT,
    "stateMeterReadingCondensateM3" TEXT,
    "kilnWaterReadingM3" TEXT,
    "kilnFiringPct" TEXT,
    "airSupplyPct" TEXT,
    "airSuctionPct" TEXT,
    "y210Status" TEXT,
    "saltConsumptionKg" TEXT,
    "kilnOperatingHours" TEXT,
    "coalBuckets" TEXT,

    CONSTRAINT "measurement_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autoclave_entries" (
    "id" UUID NOT NULL,
    "measurementRowId" UUID NOT NULL,
    "autoclaveNumber" INTEGER NOT NULL,
    "startTime" TEXT,
    "startRoller" TEXT,
    "stopTime" TEXT,
    "stopRoller" TEXT,
    "outTrack1" TEXT,
    "outTrack2" TEXT,
    "inTrack3" TEXT,
    "inTrack4" TEXT,

    CONSTRAINT "autoclave_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_logs" (
    "id" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "logType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_entries" (
    "id" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "entryType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "itemKey" TEXT,
    "labelEn" TEXT,
    "labelMn" TEXT,
    "section" TEXT,
    "unplannedTime" TEXT,
    "plannedTime" TEXT,
    "comment" TEXT,
    "additionalWork" TEXT,
    "enteredRepairDate" TEXT,
    "leftRepairDate" TEXT,
    "shift_value" TEXT,
    "repairStartTime" TEXT,
    "repairEndTime" TEXT,
    "toolReceivedTime" TEXT,
    "partsReceivedTime" TEXT,
    "affectedProduction" TEXT,
    "shiftNumber" TEXT,
    "repairType" TEXT,
    "damageCondition" TEXT,
    "damageCause" TEXT,
    "repairWorkDone" TEXT,
    "performerName" TEXT,
    "performerPosition" TEXT,
    "performerManHours" TEXT,
    "receiverName" TEXT,
    "receiverPosition" TEXT,
    "totalDuration" TEXT,
    "workerCount" TEXT,

    CONSTRAINT "repair_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_records" (
    "id" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "itemKey" TEXT,
    "label" TEXT,
    "originalValue" TEXT,
    "changedValue" TEXT,

    CONSTRAINT "ingredient_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_metrics_totals" (
    "id" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "workingStarted" TEXT,
    "workingStopped" TEXT,
    "sampleTime" TEXT,
    "currentA" TEXT,
    "electricityKwh" TEXT,
    "waterM3h" TEXT,
    "sandTh" TEXT,
    "millDensityKgM3" TEXT,
    "electricityKwhPerT" TEXT,

    CONSTRAINT "flow_metrics_totals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_images" (
    "id" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "section" TEXT NOT NULL DEFAULT 'inspection',
    "rowKey" TEXT,
    "rowLabel" TEXT,
    "caption" TEXT,
    "storagePath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedByUid" TEXT NOT NULL,
    "uploadedByName" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending_review',
    "reviewComment" TEXT,
    "reviewedByUid" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_schedules" (
    "id" UUID NOT NULL,
    "shiftDate" TEXT NOT NULL,
    "shiftType" TEXT NOT NULL,
    "stationCode" TEXT NOT NULL,
    "masterUid" TEXT NOT NULL,
    "masterName" TEXT,
    "operatorUid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_schedules" (
    "id" UUID NOT NULL,
    "shiftDate" TEXT NOT NULL,
    "shiftType" TEXT NOT NULL,
    "stationCode" TEXT NOT NULL,
    "operatorUid" TEXT NOT NULL,
    "operatorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operator_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "authorUid" TEXT NOT NULL,
    "authorName" TEXT,
    "authorRole" TEXT,
    "targetRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetStations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_reads" (
    "id" UUID NOT NULL,
    "announcementId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hse_documents" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL DEFAULT 'other',
    "visibility" TEXT NOT NULL DEFAULT 'all',
    "uploadedByUid" TEXT,
    "uploadedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hse_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruction_documents" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "stationCode" TEXT,
    "roleTarget" TEXT NOT NULL DEFAULT 'operator',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedByUid" TEXT NOT NULL,
    "uploadedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instruction_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruction_acknowledgements" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "operatorUid" TEXT NOT NULL,
    "operatorName" TEXT,
    "stationCode" TEXT,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instruction_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_requests" (
    "id" UUID NOT NULL,
    "stationCode" TEXT NOT NULL,
    "equipmentName" TEXT,
    "reportedByUid" TEXT NOT NULL,
    "reportedByName" TEXT,
    "description" TEXT NOT NULL,
    "priority" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "assignedToUid" TEXT,
    "assignedToName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hse_logs" (
    "id" UUID NOT NULL,
    "shiftId" UUID,
    "stationCode" TEXT NOT NULL,
    "operatorUid" TEXT NOT NULL,
    "operatorName" TEXT,
    "incidents" TEXT NOT NULL,
    "generalComment" TEXT,
    "hseEngineerNote" TEXT,
    "hseEngineerApproved" BOOLEAN NOT NULL DEFAULT false,
    "hseApprovedByUid" TEXT,
    "hseApprovedByName" TEXT,
    "hseApprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hse_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorUid" TEXT NOT NULL,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'operator',
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "stationCode" TEXT,
    "passwordHash" TEXT,
    "mobileAccessAllowed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL DEFAULT 'unknown',
    "userAgent" TEXT,
    "platform" TEXT,
    "ipAddress" TEXT,
    "allowed" BOOLEAN NOT NULL DEFAULT false,
    "blockedReason" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_stations" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isMasterStation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "control_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_assignments" (
    "id" UUID NOT NULL,
    "stationCode" TEXT NOT NULL,
    "stationName" TEXT,
    "operatorUid" TEXT,
    "operatorName" TEXT,
    "masterUid" TEXT NOT NULL,
    "masterName" TEXT,
    "masterStationCode" TEXT,
    "masterStationName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "control_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE INDEX "shifts_operatorUid_shiftDate_idx" ON "shifts"("operatorUid", "shiftDate");

-- CreateIndex
CREATE INDEX "shifts_stationCode_shiftDate_idx" ON "shifts"("stationCode", "shiftDate");

-- CreateIndex
CREATE INDEX "shift_handover_approvals_shiftId_createdAt_idx" ON "shift_handover_approvals"("shiftId", "createdAt");

-- CreateIndex
CREATE INDEX "shift_handover_approvals_stage_action_idx" ON "shift_handover_approvals"("stage", "action");

-- CreateIndex
CREATE INDEX "equipment_inspections_shiftId_idx" ON "equipment_inspections"("shiftId");

-- CreateIndex
CREATE INDEX "measurement_rows_shiftId_idx" ON "measurement_rows"("shiftId");

-- CreateIndex
CREATE INDEX "autoclave_entries_measurementRowId_idx" ON "autoclave_entries"("measurementRowId");

-- CreateIndex
CREATE INDEX "production_logs_shiftId_idx" ON "production_logs"("shiftId");

-- CreateIndex
CREATE INDEX "production_logs_logType_createdAt_idx" ON "production_logs"("logType", "createdAt");

-- CreateIndex
CREATE INDEX "repair_entries_shiftId_idx" ON "repair_entries"("shiftId");

-- CreateIndex
CREATE INDEX "ingredient_records_shiftId_idx" ON "ingredient_records"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "flow_metrics_totals_shiftId_key" ON "flow_metrics_totals"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "shift_images_storagePath_key" ON "shift_images"("storagePath");

-- CreateIndex
CREATE INDEX "shift_images_shiftId_idx" ON "shift_images"("shiftId");

-- CreateIndex
CREATE INDEX "shift_images_shiftId_rowKey_idx" ON "shift_images"("shiftId", "rowKey");

-- CreateIndex
CREATE INDEX "shift_images_shiftId_reviewStatus_idx" ON "shift_images"("shiftId", "reviewStatus");

-- CreateIndex
CREATE INDEX "operator_schedules_operatorUid_shiftDate_idx" ON "operator_schedules"("operatorUid", "shiftDate");

-- CreateIndex
CREATE INDEX "operator_schedules_stationCode_shiftDate_idx" ON "operator_schedules"("stationCode", "shiftDate");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_reads_announcementId_userId_key" ON "announcement_reads"("announcementId", "userId");

-- CreateIndex
CREATE INDEX "instruction_documents_stationCode_isActive_idx" ON "instruction_documents"("stationCode", "isActive");

-- CreateIndex
CREATE INDEX "instruction_documents_roleTarget_isActive_idx" ON "instruction_documents"("roleTarget", "isActive");

-- CreateIndex
CREATE INDEX "instruction_acknowledgements_operatorUid_idx" ON "instruction_acknowledgements"("operatorUid");

-- CreateIndex
CREATE INDEX "instruction_acknowledgements_documentId_idx" ON "instruction_acknowledgements"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "instruction_acknowledgements_documentId_operatorUid_key" ON "instruction_acknowledgements"("documentId", "operatorUid");

-- CreateIndex
CREATE INDEX "notifications_userId_dedupeKey_createdAt_idx" ON "notifications"("userId", "dedupeKey", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_devices_userId_idx" ON "user_devices"("userId");

-- CreateIndex
CREATE INDEX "user_devices_deviceType_idx" ON "user_devices"("deviceType");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_userId_deviceId_key" ON "user_devices"("userId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "control_stations_code_key" ON "control_stations"("code");

-- CreateIndex
CREATE INDEX "control_assignments_masterUid_isActive_idx" ON "control_assignments"("masterUid", "isActive");

-- CreateIndex
CREATE INDEX "control_assignments_operatorUid_isActive_idx" ON "control_assignments"("operatorUid", "isActive");

-- CreateIndex
CREATE INDEX "control_assignments_stationCode_isActive_idx" ON "control_assignments"("stationCode", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "control_assignments_stationCode_operatorUid_masterUid_key" ON "control_assignments"("stationCode", "operatorUid", "masterUid");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- AddForeignKey
ALTER TABLE "shift_handover_approvals" ADD CONSTRAINT "shift_handover_approvals_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_inspections" ADD CONSTRAINT "equipment_inspections_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement_rows" ADD CONSTRAINT "measurement_rows_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoclave_entries" ADD CONSTRAINT "autoclave_entries_measurementRowId_fkey" FOREIGN KEY ("measurementRowId") REFERENCES "measurement_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_entries" ADD CONSTRAINT "repair_entries_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_records" ADD CONSTRAINT "ingredient_records_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_metrics_totals" ADD CONSTRAINT "flow_metrics_totals_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_images" ADD CONSTRAINT "shift_images_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instruction_acknowledgements" ADD CONSTRAINT "instruction_acknowledgements_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "instruction_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
