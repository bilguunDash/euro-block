-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
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
    "notes" TEXT,
    "hseInfo" TEXT,
    "equipmentInfo" TEXT,
    "explanation" TEXT,
    "totalNote" TEXT,
    "report" TEXT,
    "ingredientChangeNote" TEXT,
    "platformMaintenanceNote" TEXT,
    "moldMaintenanceNote" TEXT,
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

-- CreateIndex
CREATE INDEX "shifts_operatorUid_shiftDate_idx" ON "shifts"("operatorUid", "shiftDate");

-- CreateIndex
CREATE INDEX "shifts_stationCode_shiftDate_idx" ON "shifts"("stationCode", "shiftDate");

-- CreateIndex
CREATE INDEX "equipment_inspections_shiftId_idx" ON "equipment_inspections"("shiftId");

-- CreateIndex
CREATE INDEX "measurement_rows_shiftId_idx" ON "measurement_rows"("shiftId");

-- CreateIndex
CREATE INDEX "autoclave_entries_measurementRowId_idx" ON "autoclave_entries"("measurementRowId");

-- CreateIndex
CREATE INDEX "production_logs_shiftId_idx" ON "production_logs"("shiftId");

-- CreateIndex
CREATE INDEX "repair_entries_shiftId_idx" ON "repair_entries"("shiftId");

-- CreateIndex
CREATE INDEX "ingredient_records_shiftId_idx" ON "ingredient_records"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "flow_metrics_totals_shiftId_key" ON "flow_metrics_totals"("shiftId");

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
