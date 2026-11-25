/**
 * Helpers to decompose a form payload into Prisma create inputs
 * and reconstruct form payloads from Prisma query results.
 */

/* ── Station codes ── */

export const STATION_NAME_BY_CODE: Record<string, string> = {
  'ҮЯ-099': 'Ээлжийн мастер',
  'ҮЯ-110': 'Цемент шахах төхөөрөмжийн оператор',
  'ҮЯ-120': 'Шохойн тээрмийн оператор',
  'ҮЯ-121': 'Бөмбөлөгт тээрмийн оператор',
  'ҮЯ-190': 'Чанар шалгагч',
  'ҮЯ-140': 'Хэв эргэлтийн оператор',
  'ҮЯ-130': 'Зуурах цамхагийн оператор',
  'ҮЯ-150': 'Зүсэх дамжлагын оператор',
  'ҮЯ-160': 'Рам эргэлтийн оператор',
  'ҮЯ-161': 'Тэргэнцэр эргэлтийн оператор',
  'ҮЯ-170': 'Савлах төхөөрөмжийн оператор',
  'ҮЯ-210': 'Технологийн зуухны оператор',
  'ҮЯ-180': 'Автоклавын оператор',
  'ҮЯ-181': 'Дулааны мастер',
  'ҮЯ-310': 'Засварын мастер',
  'ҮЯ-320': 'Цахилгаан автоматжуулалтын засварын бүртгэл',
  'ҮЯ-400': 'Үйлдвэрийн процесст тавих хяналтын хуудас',
  'ҮЯ-410': 'Цахилгаан автоматжуулалтын мастер',
  ОНБ: 'Бүтээгдэхүүний орц найрлага өөрчилсөн бүртгэл',
};

export const FORM_KEY_BY_STATION: Record<string, string> = {
  'ҮЯ-110': 'y110StartForm',
  'ҮЯ-120': 'y120HandoverForm',
  'ҮЯ-121': 'y121HandoverForm',
  'ҮЯ-130': 'y130HandoverForm',
  'ҮЯ-140': 'y140HandoverForm',
  'ҮЯ-150': 'y150HandoverForm',
  'ҮЯ-160': 'y160HandoverForm',
  'ҮЯ-161': 'y161HandoverForm',
  'ҮЯ-170': 'y170PackingOperatorForm',
  'ҮЯ-180': 'y180AutoclaveOperatorForm',
  'ҮЯ-190': 'y190HandoverForm',
  'ҮЯ-210': 'y210TechnologyKilnOperatorForm',
  'ҮЯ-310': 'y310RepairMasterForm',
  'ҮЯ-320': 'y320ElectricalAutomationRepairForm',
  'ҮЯ-400': 'factoryProcessControlForm',
  'ҮЯ-410': 'cah02ElectricalControlForm',
  ОНБ: 'ingredientChangeRecordForm',
};

/* ── Types for decomposed data ── */

export interface DecomposedShift {
  shiftScalars: Record<string, unknown>;
  equipmentInspections: Record<string, unknown>[];
  measurementRows: (Record<string, unknown> & { _autoclaves?: Record<string, unknown>[] })[];
  productionLogs: Record<string, unknown>[];
  repairEntries: Record<string, unknown>[];
  ingredientRecords: Record<string, unknown>[];
  flowMetricsTotal: Record<string, unknown> | null;
}

/* ── Inspection row helpers ── */

function inspRow(r: any, i: number, tableType: string): Record<string, unknown> {
  return {
    tableType,
    sortOrder: i,
    itemKey: r.key ?? '',
    itemLabel: r.label ?? '',
    status: r.status ?? '',
    comment: r.comment ?? '',
  };
}

function y310CompressorRow(r: any, i: number): Record<string, unknown> {
  return {
    tableType: 'compressor',
    sortOrder: i,
    itemKey: r.key ?? '',
    itemLabel: r.label ?? '',
    statusOk: r.statusOk ?? '',
    cleaned: r.cleaned ?? '',
    comment: r.comment ?? '',
    emergencyEquipment: r.emergencyEquipment ?? '',
  };
}

function y310SectionRow(r: any, i: number): Record<string, unknown> {
  return {
    tableType: 'section',
    sortOrder: i,
    itemKey: r.key ?? '',
    labelEn: r.labelEn ?? '',
    labelMn: r.labelMn ?? '',
    statusOk: r.statusOk ?? '',
    cleaned: r.cleaned ?? '',
    equipmentNotes: r.equipmentNotes ?? '',
    nextShiftWork: r.nextShiftWork ?? '',
  };
}

function y310RepairEquipRow(r: any, i: number): Record<string, unknown> {
  return {
    tableType: 'repair_equipment',
    sortOrder: i,
    itemKey: r.key ?? '',
    itemLabel: r.label ?? '',
    status: r.status ?? '',
    comment: r.comment ?? '',
    weeklyInspection: r.weeklyInspection ?? '',
  };
}

function processCtrlRow(r: any, i: number, tableType: string): Record<string, unknown> {
  return {
    tableType,
    sortOrder: i,
    itemKey: r.key ?? '',
    itemLabel: r.label ?? '',
    status: r.status ?? '',
    comment: r.comment ?? '',
    requirement: r.requirement ?? '',
  };
}

function siloRow(r: any, i: number): Record<string, unknown> {
  return {
    tableType: 'silo',
    sortOrder: i,
    itemKey: r.key ?? '',
    itemLabel: r.label ?? '',
    percent: r.percent ?? '',
    comment: r.comment ?? '',
  };
}

/* ── Decompose ── */

export function decomposePayload(stationCode: string, formPayload: any): DecomposedShift {
  const result: DecomposedShift = {
    shiftScalars: {},
    equipmentInspections: [],
    measurementRows: [],
    productionLogs: [],
    repairEntries: [],
    ingredientRecords: [],
    flowMetricsTotal: null,
  };

  const s = result.shiftScalars;
  const p = formPayload;
  if (!p) return result;

  s.formVersion = p.formVersion ?? 1;
  s.submittedAt = p.submittedAt ?? '';

  switch (stationCode) {
    case 'ҮЯ-110': {
      s.notes = p.shiftNotes ?? '';
      s.hseInfo = p.hseInfo ?? '';
      s.hseComment = p.hseComment ?? '';
      s.equipmentInfo = p.equipmentInfo ?? '';
      s.equipmentComment = p.equipmentComment ?? '';
      s.pipelineStatus = p.pipeline?.status ?? '';
      s.pipelineComment = p.pipeline?.comment ?? '';
      s.airPressureStatus = p.airPressure?.status ?? '';
      s.airPressureComment = p.airPressure?.comment ?? '';
      s.lubricationStatus = p.lubrication?.status ?? '';
      s.lubricationComment = p.lubrication?.comment ?? '';
      s.rawCementUnloadTons = p.rawCementUnloadTons ?? '';
      s.rawWagonCleaningCount = p.rawWagonCleaningCount ?? '';
      s.workplaceStatus = p.workplaceTidiness?.status ?? '';
      s.workplaceComment = p.workplaceTidiness?.comment ?? '';
      s.sigHandingOver = p.sigHandingOver ?? '';
      s.sigReceiving = p.sigReceiving ?? '';
      s.sigShiftMaster = p.sigShiftMaster ?? '';
      result.equipmentInspections = [
        ...(p.compressors ?? []).map((r: any, i: number) => inspRow(r, i, 'compressor')),
        ...(p.silos ?? []).map((r: any, i: number) => siloRow(r, i)),
      ];
      break;
    }

    case 'ҮЯ-120': {
      s.notes = p.shiftNotes ?? '';
      s.hseInfo = p.hseInfo ?? '';
      s.equipmentInfo = p.equipmentInfo ?? '';
      s.workplaceStatus = p.workplaceTidiness?.status ?? '';
      s.workplaceComment = p.workplaceTidiness?.comment ?? '';
      s.sigHandingOver = p.sigHandingOver ?? '';
      s.sigReceiving = p.sigReceiving ?? '';
      s.sigShiftMaster = p.sigShiftMaster ?? '';
      result.equipmentInspections = (p.inspections ?? []).map((r: any, i: number) => inspRow(r, i, 'inspection'));
      result.productionLogs = (p.milledMaterials ?? []).map((r: any, i: number) => ({
        logType: 'milled', sortOrder: i, data: r,
      }));
      break;
    }

    case 'ҮЯ-121': {
      s.notes = p.shiftNotes ?? '';
      s.hseInfo = p.hseInfo ?? '';
      s.equipmentInfo = p.equipmentInfo ?? '';
      s.workplaceStatus = p.workplaceTidiness?.status ?? '';
      s.workplaceComment = p.workplaceTidiness?.comment ?? '';
      s.sigHandingOver = p.sigHandingOver ?? '';
      s.sigReceiving = p.sigReceiving ?? '';
      s.sigShiftMaster = p.sigShiftMaster ?? '';
      result.equipmentInspections = (p.inspections ?? []).map((r: any, i: number) => inspRow(r, i, 'inspection'));
      result.productionLogs = (p.flowMetrics ?? []).map((r: any, i: number) => ({
        logType: 'flow_metric', sortOrder: i, data: r,
      }));
      if (p.flowMetricsTotal) {
        const t = p.flowMetricsTotal;
        result.flowMetricsTotal = {
          workingStarted: t.workingStarted ?? '',
          workingStopped: t.workingStopped ?? '',
          sampleTime: t.sampleTime ?? '',
          currentA: t.currentA ?? '',
          electricityKwh: t.electricityKwh ?? '',
          waterM3h: t.waterM3h ?? '',
          sandTh: t.sandTh ?? '',
          millDensityKgM3: t.millDensityKgM3 ?? '',
          electricityKwhPerT: t.electricityKwhPerT ?? '',
        };
      }
      break;
    }

    case 'ҮЯ-130': {
      s.notes = p.shiftNotes ?? '';
      s.hseInfo = p.hseInfo ?? '';
      s.equipmentInfo = p.equipmentInfo ?? '';
      s.ingredientChangeNote = p.ingredientChangeNote ?? '';
      s.workplaceStatus = p.workplaceCleaning?.status ?? '';
      s.workplaceComment = p.workplaceCleaning?.comment ?? p.workplaceCleaningNote ?? '';
      s.sigHandingOver = p.sigHandingOver ?? '';
      s.sigReceiving = p.sigReceiving ?? '';
      s.sigShiftMaster = p.sigShiftMaster ?? '';
      result.equipmentInspections = (p.equipmentInspections ?? []).map((r: any, i: number) => inspRow(r, i, 'inspection'));
      result.productionLogs = (p.indicators ?? []).map((r: any, i: number) => ({
        logType: 'indicator', sortOrder: i, data: r,
      }));
      break;
    }

    case 'ҮЯ-140': {
      s.notes = p.shiftNotes ?? '';
      s.hseInfo = p.hseInfo ?? '';
      s.equipmentInfo = p.equipmentInfo ?? '';
      s.platformMaintenanceNote = p.platformMaintenanceNote ?? '';
      s.moldMaintenanceNote = p.moldMaintenanceNote ?? '';
      s.sigHandingOver = p.sigHandingOver ?? '';
      s.sigReceiving = p.sigReceiving ?? '';
      s.sigShiftMaster = p.sigShiftMaster ?? '';
      result.equipmentInspections = (p.equipmentInspections ?? []).map((r: any, i: number) => inspRow(r, i, 'inspection'));
      result.productionLogs = (p.castingLog ?? []).map((r: any, i: number) => ({
        logType: 'casting', sortOrder: i, data: r,
      }));
      break;
    }

    case 'ҮЯ-150': {
      s.notes = p.shiftNotes ?? '';
      s.sigHandingOver = p.sigHandingOver ?? '';
      s.sigReceiving = p.sigReceiving ?? '';
      s.sigShiftMaster = p.sigShiftMaster ?? '';
      result.equipmentInspections = (p.equipmentInspections ?? []).map((r: any, i: number) => inspRow(r, i, 'inspection'));
      result.productionLogs = (p.cuttingLog ?? []).map((r: any, i: number) => ({
        logType: 'cutting', sortOrder: i, data: r,
      }));
      break;
    }

    case 'ҮЯ-160': {
      s.notes = p.shiftNotes ?? '';
      s.sigHandingOver = p.sigHandingOver ?? '';
      s.sigReceiving = p.sigReceiving ?? '';
      s.sigShiftMaster = p.sigShiftMaster ?? '';
      result.equipmentInspections = (p.equipmentInspections ?? []).map((r: any, i: number) => inspRow(r, i, 'inspection'));
      break;
    }

    case 'ҮЯ-161': {
      s.notes = p.shiftNotes ?? '';
      s.sigHandingOver = p.sigHandingOver ?? '';
      s.sigReceiving = p.sigReceiving ?? '';
      s.sigShiftMaster = p.sigShiftMaster ?? '';
      result.equipmentInspections = (p.equipmentInspections ?? []).map((r: any, i: number) => inspRow(r, i, 'inspection'));
      result.productionLogs = (p.productLog ?? []).map((r: any, i: number) => ({
        logType: 'product', sortOrder: i, data: r,
      }));
      break;
    }

    case 'ҮЯ-170': {
      s.notes = p.shiftNotes ?? '';
      s.sigHandingOver = p.sigHandingOver ?? '';
      s.sigReceiving = p.sigReceiving ?? '';
      s.sigShiftMaster = p.sigShiftMaster ?? '';
      result.equipmentInspections = (p.equipmentInspections ?? []).map((r: any, i: number) => inspRow(r, i, 'inspection'));
      break;
    }

    case 'ҮЯ-180': {
      s.notes = p.notes ?? '';
      s.sigHandingOver = p.sigHandingOver ?? '';
      s.sigReceiving = p.sigReceiving ?? '';
      s.sigShiftMaster = p.sigShiftMaster ?? '';
      result.equipmentInspections = (p.equipmentInspections ?? []).map((r: any, i: number) => inspRow(r, i, 'inspection'));
      result.measurementRows = (p.timeRows ?? []).map((tr: any, i: number) => ({
        sortOrder: i,
        timeValue: tr.time ?? '',
        furnacePressure: tr.furnacePressure ?? '',
        steamLinePressure: tr.steamLinePressure ?? '',
        totalProductOut: tr.totalProductOut ?? '',
        totalProductIn: tr.totalProductIn ?? '',
        _autoclaves: (tr.autoclaves ?? []).map((ac: any, ai: number) => ({
          autoclaveNumber: ai + 1,
          startTime: ac.startTime ?? '',
          startRoller: ac.startRoller ?? '',
          stopTime: ac.stopTime ?? '',
          stopRoller: ac.stopRoller ?? '',
          outTrack1: ac.outTrack1 ?? '',
          outTrack2: ac.outTrack2 ?? '',
          inTrack3: ac.inTrack3 ?? '',
          inTrack4: ac.inTrack4 ?? '',
        })),
      }));
      break;
    }

    case 'ҮЯ-190': {
      s.notes = p.shiftNotes ?? '';
      s.hseInfo = p.hseInfo ?? '';
      s.equipmentInfo = p.equipmentInfo ?? '';
      s.sigHandingOver = p.sigHandingOver ?? '';
      s.sigReceiving = p.sigReceiving ?? '';
      s.sigShiftMaster = p.sigShiftMaster ?? '';
      result.equipmentInspections = (p.inspections ?? []).map((r: any, i: number) => inspRow(r, i, 'inspection'));
      result.productionLogs = (p.productSummary ?? []).map((r: any, i: number) => ({
        logType: 'product_summary', sortOrder: i, data: r,
      }));
      break;
    }

    case 'ҮЯ-210': {
      s.totalNote = p.totalNote ?? '';
      s.report = p.report ?? '';
      s.sigHandingOver = p.sigHandingOver ?? '';
      s.sigReceiving = p.sigReceiving ?? '';
      s.sigShiftMaster = p.sigShiftMaster ?? '';
      result.measurementRows = (p.rows ?? []).map((r: any, i: number) => ({
        sortOrder: i,
        timeValue: r.time ?? '',
        kilnPowerTransmissionPct: r.kilnPowerTransmissionPct ?? '',
        kilnPressureBar: r.kilnPressureBar ?? '',
        kilnLevelPct: r.kilnLevelPct ?? '',
        boosterAmountPct: r.boosterAmountPct ?? '',
        screenTempMaxC: r.screenTempMaxC ?? '',
        grateCastIronTempMaxC: r.grateCastIronTempMaxC ?? '',
        condensateTank3LevelPct: r.condensateTank3LevelPct ?? '',
        condensateTank3TempC: r.condensateTank3TempC ?? '',
        feedWaterToTankTempC: r.feedWaterToTankTempC ?? '',
        ashDischargeHours: r.ashDischargeHours ?? '',
        feedWaterBankPressurePct: r.feedWaterBankPressurePct ?? '',
        feedWaterBankLevelPct: r.feedWaterBankLevelPct ?? '',
        feedWaterBankTempPct: r.feedWaterBankTempPct ?? '',
        stateMeterReadingCondensateM3: r.stateMeterReadingCondensateM3 ?? '',
        kilnWaterReadingM3: r.kilnWaterReadingM3 ?? '',
        kilnFiringPct: r.kilnFiringPct ?? '',
        airSupplyPct: r.airSupplyPct ?? '',
        airSuctionPct: r.airSuctionPct ?? '',
        y210Status: r.status ?? '',
        saltConsumptionKg: r.saltConsumptionKg ?? '',
        kilnOperatingHours: r.kilnOperatingHours ?? '',
        coalBuckets: r.coalBuckets ?? '',
      }));
      break;
    }

    case 'ҮЯ-310': {
      s.sigHandingOver = p.sigHandingOver ?? '';
      s.sigReceiving = p.sigReceiving ?? '';
      s.sigEngineer = p.sigEngineer ?? '';
      result.equipmentInspections = [
        ...(p.repairEquipment ?? []).map((r: any, i: number) => y310RepairEquipRow(r, i)),
        ...(p.compressors ?? []).map((r: any, i: number) => y310CompressorRow(r, i)),
        ...(p.sections ?? []).map((r: any, i: number) => y310SectionRow(r, i)),
      ];
      result.repairEntries = (p.repairWork ?? []).map((r: any, i: number) => ({
        entryType: 'repair_work',
        sortOrder: i,
        itemKey: r.key ?? '',
        labelEn: r.labelEn ?? '',
        labelMn: r.labelMn ?? '',
        unplannedTime: r.unplannedTime ?? '',
        plannedTime: r.plannedTime ?? '',
        comment: r.comment ?? '',
        additionalWork: r.additionalWork ?? '',
      }));
      break;
    }

    case 'ҮЯ-320': {
      s.sigHandingOver = p.sigHandingOver ?? '';
      s.sigReceiving = p.sigReceiving ?? '';
      result.repairEntries = (p.rows ?? []).map((r: any, i: number) => ({
        entryType: 'electrical_repair',
        sortOrder: i,
        section: r.section ?? '',
        enteredRepairDate: r.enteredRepairDate ?? '',
        leftRepairDate: r.leftRepairDate ?? '',
        shiftValue: r.shift ?? '',
        repairStartTime: r.repairStartTime ?? '',
        repairEndTime: r.repairEndTime ?? '',
        toolReceivedTime: r.toolReceivedTime ?? '',
        partsReceivedTime: r.partsReceivedTime ?? '',
        affectedProduction: r.affectedProduction ?? '',
        shiftNumber: r.shiftNumber ?? '',
        repairType: r.repairType ?? '',
        damageCondition: r.damageCondition ?? '',
        damageCause: r.damageCause ?? '',
        repairWorkDone: r.repairWorkDone ?? '',
        performerName: r.performerName ?? '',
        performerPosition: r.performerPosition ?? '',
        performerManHours: r.performerManHours ?? '',
        receiverName: r.receiverName ?? '',
        receiverPosition: r.receiverPosition ?? '',
        totalDuration: r.totalDuration ?? '',
        workerCount: r.workerCount ?? '',
      }));
      break;
    }

    case 'ҮЯ-400': {
      s.sigMaster = p.sigMaster ?? '';
      s.sigHandingOver = p.operatorName ?? '';
      result.equipmentInspections = [
        ...(p.rows ?? []).map((r: any, i: number) => processCtrlRow(r, i, 'process')),
        ...(p.failureRows ?? []).map((r: any, i: number) => processCtrlRow(r, i, 'failure')),
        ...(p.equipmentRows ?? []).map((r: any, i: number) => processCtrlRow(r, i, 'equipment_ctrl')),
      ];
      break;
    }

    case 'ҮЯ-410': {
      s.sigHandingOver = p.sigHandingOver ?? '';
      s.sigReceiving = p.sigReceiving ?? '';
      s.attentionNotes = p.attentionNotes ?? '';
      s.workPerformed = p.workPerformed ?? '';
      result.measurementRows = (p.rows ?? []).map((r: any, i: number) => ({
        sortOrder: i,
        timeValue: r.measuredTime ?? '',
        scheduledDay: r.scheduledDay ?? '',
        scheduledNight: r.scheduledNight ?? '',
        measuredTime: r.measuredTime ?? '',
        lineVoltage: r.lineVoltage ?? '',
        transformerTempA: r.transformerTempA ?? '',
        transformerTempB: r.transformerTempB ?? '',
        transformerTempC: r.transformerTempC ?? '',
        transformerCurrentInput1: r.transformerCurrentInput1 ?? '',
        transformerCurrentInput2: r.transformerCurrentInput2 ?? '',
        dieselMotorHours: r.dieselMotorHours ?? '',
        dieselOilTemp: r.dieselOilTemp ?? '',
        fuel: r.fuel ?? '',
        mebu1Voltage: r.mebu1Voltage ?? '',
        mebu1Current: r.mebu1Current ?? '',
        mebu1SectionSwitch: r.mebu1SectionSwitch ?? '',
        mebu2Voltage: r.mebu2Voltage ?? '',
        mebu2Current: r.mebu2Current ?? '',
        mebu2SectionSwitch: r.mebu2SectionSwitch ?? '',
        measuredTime35: r.measuredTime35 ?? '',
        lineVoltage35: r.lineVoltage35 ?? '',
        transHighCurrentT1: r.transHighCurrentT1 ?? '',
        transHighCurrentT2: r.transHighCurrentT2 ?? '',
        transHighCurrentWindoor: r.transHighCurrentWindoor ?? '',
        transLowCurrentInput1: r.transLowCurrentInput1 ?? '',
        transLowCurrentInput2: r.transLowCurrentInput2 ?? '',
      }));
      break;
    }

    case 'ОНБ': {
      s.explanation = p.explanation ?? '';
      s.sigOperator = p.sigOperator ?? '';
      s.sigTechnologistEngineer = p.sigTechnologistEngineer ?? '';
      s.sigChiefTechnologist = p.sigChiefTechnologist ?? '';
      s.sigQualitySpecialist = p.sigQualitySpecialist ?? '';
      result.ingredientRecords = (p.rows ?? []).map((r: any, i: number) => ({
        sortOrder: i,
        itemKey: r.key ?? '',
        label: r.label ?? '',
        originalValue: r.originalValue ?? '',
        changedValue: r.changedValue ?? '',
      }));
      break;
    }
  }

  return result;
}

/* ── Reconstruct ── */

export function reconstructPayload(shift: any): Record<string, any> {
  const sc = shift.stationCode;
  const formKey = FORM_KEY_BY_STATION[sc];
  if (!formKey) return {};

  const eqs = (shift.equipmentInspections ?? []) as any[];
  const mrs = (shift.measurementRows ?? []) as any[];
  const pls = (shift.productionLogs ?? []) as any[];
  const res = (shift.repairEntries ?? []) as any[];
  const irs = (shift.ingredientRecords ?? []) as any[];
  const fmt = shift.flowMetricsTotal as any;

  const common = {
    stationCode: sc,
    shiftDate: shift.shiftDate,
    shiftType: shift.shiftType,
    formVersion: shift.formVersion ?? 1,
    submittedAt: shift.submittedAt ?? '',
    operatorUid: shift.operatorUid,
    operatorName: shift.operatorName,
  };

  let payload: any = null;

  switch (sc) {
    case 'ҮЯ-110': {
      payload = {
        ...common,
        compressors: eqs.filter((r: any) => r.tableType === 'compressor').map(eqToInsp),
        silos: eqs.filter((r: any) => r.tableType === 'silo').map((r: any) => ({
          key: r.itemKey, label: r.itemLabel, percent: r.percent ?? '', comment: r.comment ?? '',
        })),
        pipeline: { status: shift.pipelineStatus ?? '', comment: shift.pipelineComment ?? '' },
        airPressure: { status: shift.airPressureStatus ?? '', comment: shift.airPressureComment ?? '' },
        lubrication: { status: shift.lubricationStatus ?? '', comment: shift.lubricationComment ?? '' },
        hseInfo: shift.hseInfo ?? '',
        hseComment: shift.hseComment ?? '',
        equipmentInfo: shift.equipmentInfo ?? '',
        equipmentComment: shift.equipmentComment ?? '',
        workplaceTidiness: { status: shift.workplaceStatus ?? '', comment: shift.workplaceComment ?? '' },
        rawCementUnloadTons: shift.rawCementUnloadTons ?? '',
        rawWagonCleaningCount: shift.rawWagonCleaningCount ?? '',
        shiftNotes: shift.notes ?? '',
        sigHandingOver: shift.sigHandingOver ?? '',
        sigReceiving: shift.sigReceiving ?? '',
        sigShiftMaster: shift.sigShiftMaster ?? '',
      };
      break;
    }

    case 'ҮЯ-120': {
      payload = {
        ...common,
        inspections: eqs.filter((r: any) => r.tableType === 'inspection').map(eqToInsp),
        milledMaterials: plsByType(pls, 'milled'),
        hseInfo: shift.hseInfo ?? '',
        equipmentInfo: shift.equipmentInfo ?? '',
        workplaceTidiness: { status: shift.workplaceStatus ?? '', comment: shift.workplaceComment ?? '' },
        shiftNotes: shift.notes ?? '',
        sigHandingOver: shift.sigHandingOver ?? '',
        sigReceiving: shift.sigReceiving ?? '',
        sigShiftMaster: shift.sigShiftMaster ?? '',
      };
      break;
    }

    case 'ҮЯ-121': {
      payload = {
        ...common,
        inspections: eqs.filter((r: any) => r.tableType === 'inspection').map(eqToInsp),
        flowMetrics: plsByType(pls, 'flow_metric'),
        flowMetricsTotal: fmt ? {
          workingStarted: fmt.workingStarted ?? '',
          workingStopped: fmt.workingStopped ?? '',
          sampleTime: fmt.sampleTime ?? '',
          currentA: fmt.currentA ?? '',
          electricityKwh: fmt.electricityKwh ?? '',
          waterM3h: fmt.waterM3h ?? '',
          sandTh: fmt.sandTh ?? '',
          millDensityKgM3: fmt.millDensityKgM3 ?? '',
          electricityKwhPerT: fmt.electricityKwhPerT ?? '',
        } : null,
        hseInfo: shift.hseInfo ?? '',
        equipmentInfo: shift.equipmentInfo ?? '',
        workplaceTidiness: { status: shift.workplaceStatus ?? '', comment: shift.workplaceComment ?? '' },
        shiftNotes: shift.notes ?? '',
        sigHandingOver: shift.sigHandingOver ?? '',
        sigReceiving: shift.sigReceiving ?? '',
        sigShiftMaster: shift.sigShiftMaster ?? '',
      };
      break;
    }

    case 'ҮЯ-130': {
      payload = {
        ...common,
        indicators: plsByType(pls, 'indicator'),
        equipmentInspections: eqs.filter((r: any) => r.tableType === 'inspection').map(eqToInsp),
        hseInfo: shift.hseInfo ?? '',
        equipmentInfo: shift.equipmentInfo ?? '',
        workplaceCleaning: { status: shift.workplaceStatus ?? '', comment: shift.workplaceComment ?? '' },
        ingredientChangeNote: shift.ingredientChangeNote ?? '',
        shiftNotes: shift.notes ?? '',
        sigHandingOver: shift.sigHandingOver ?? '',
        sigReceiving: shift.sigReceiving ?? '',
        sigShiftMaster: shift.sigShiftMaster ?? '',
      };
      break;
    }

    case 'ҮЯ-140': {
      payload = {
        ...common,
        equipmentInspections: eqs.filter((r: any) => r.tableType === 'inspection').map(eqToInsp),
        castingLog: plsByType(pls, 'casting'),
        hseInfo: shift.hseInfo ?? '',
        equipmentInfo: shift.equipmentInfo ?? '',
        platformMaintenanceNote: shift.platformMaintenanceNote ?? '',
        moldMaintenanceNote: shift.moldMaintenanceNote ?? '',
        shiftNotes: shift.notes ?? '',
        sigHandingOver: shift.sigHandingOver ?? '',
        sigReceiving: shift.sigReceiving ?? '',
        sigShiftMaster: shift.sigShiftMaster ?? '',
      };
      break;
    }

    case 'ҮЯ-150': {
      payload = {
        ...common,
        equipmentInspections: eqs.filter((r: any) => r.tableType === 'inspection').map(eqToInsp),
        cuttingLog: plsByType(pls, 'cutting'),
        shiftNotes: shift.notes ?? '',
        sigHandingOver: shift.sigHandingOver ?? '',
        sigReceiving: shift.sigReceiving ?? '',
        sigShiftMaster: shift.sigShiftMaster ?? '',
      };
      break;
    }

    case 'ҮЯ-160': {
      payload = {
        ...common,
        equipmentInspections: eqs.filter((r: any) => r.tableType === 'inspection').map(eqToInsp),
        shiftNotes: shift.notes ?? '',
        sigHandingOver: shift.sigHandingOver ?? '',
        sigReceiving: shift.sigReceiving ?? '',
        sigShiftMaster: shift.sigShiftMaster ?? '',
      };
      break;
    }

    case 'ҮЯ-161': {
      payload = {
        ...common,
        equipmentInspections: eqs.filter((r: any) => r.tableType === 'inspection').map(eqToInsp),
        productLog: plsByType(pls, 'product'),
        shiftNotes: shift.notes ?? '',
        sigHandingOver: shift.sigHandingOver ?? '',
        sigReceiving: shift.sigReceiving ?? '',
        sigShiftMaster: shift.sigShiftMaster ?? '',
      };
      break;
    }

    case 'ҮЯ-170': {
      payload = {
        ...common,
        equipmentInspections: eqs.filter((r: any) => r.tableType === 'inspection').map(eqToInsp),
        shiftNotes: shift.notes ?? '',
        sigHandingOver: shift.sigHandingOver ?? '',
        sigReceiving: shift.sigReceiving ?? '',
        sigShiftMaster: shift.sigShiftMaster ?? '',
      };
      break;
    }

    case 'ҮЯ-180': {
      payload = {
        ...common,
        timeRows: mrs.map((mr: any) => ({
          time: mr.timeValue ?? '',
          furnacePressure: mr.furnacePressure ?? '',
          steamLinePressure: mr.steamLinePressure ?? '',
          totalProductOut: mr.totalProductOut ?? '',
          totalProductIn: mr.totalProductIn ?? '',
          autoclaves: (mr.autoclaveEntries ?? [])
            .sort((a: any, b: any) => a.autoclaveNumber - b.autoclaveNumber)
            .map((ac: any) => ({
              startTime: ac.startTime ?? '',
              startRoller: ac.startRoller ?? '',
              stopTime: ac.stopTime ?? '',
              stopRoller: ac.stopRoller ?? '',
              outTrack1: ac.outTrack1 ?? '',
              outTrack2: ac.outTrack2 ?? '',
              inTrack3: ac.inTrack3 ?? '',
              inTrack4: ac.inTrack4 ?? '',
            })),
        })),
        equipmentInspections: eqs.filter((r: any) => r.tableType === 'inspection').map(eqToInsp),
        notes: shift.notes ?? '',
        sigHandingOver: shift.sigHandingOver ?? '',
        sigReceiving: shift.sigReceiving ?? '',
        sigShiftMaster: shift.sigShiftMaster ?? '',
      };
      break;
    }

    case 'ҮЯ-190': {
      payload = {
        ...common,
        inspections: eqs.filter((r: any) => r.tableType === 'inspection').map(eqToInsp),
        productSummary: plsByType(pls, 'product_summary'),
        hseInfo: shift.hseInfo ?? '',
        equipmentInfo: shift.equipmentInfo ?? '',
        shiftNotes: shift.notes ?? '',
        sigHandingOver: shift.sigHandingOver ?? '',
        sigReceiving: shift.sigReceiving ?? '',
        sigShiftMaster: shift.sigShiftMaster ?? '',
      };
      break;
    }

    case 'ҮЯ-210': {
      payload = {
        ...common,
        rows: mrs.map((mr: any) => ({
          time: mr.timeValue ?? '',
          kilnPowerTransmissionPct: mr.kilnPowerTransmissionPct ?? '',
          kilnPressureBar: mr.kilnPressureBar ?? '',
          kilnLevelPct: mr.kilnLevelPct ?? '',
          boosterAmountPct: mr.boosterAmountPct ?? '',
          screenTempMaxC: mr.screenTempMaxC ?? '',
          grateCastIronTempMaxC: mr.grateCastIronTempMaxC ?? '',
          condensateTank3LevelPct: mr.condensateTank3LevelPct ?? '',
          condensateTank3TempC: mr.condensateTank3TempC ?? '',
          feedWaterToTankTempC: mr.feedWaterToTankTempC ?? '',
          ashDischargeHours: mr.ashDischargeHours ?? '',
          feedWaterBankPressurePct: mr.feedWaterBankPressurePct ?? '',
          feedWaterBankLevelPct: mr.feedWaterBankLevelPct ?? '',
          feedWaterBankTempPct: mr.feedWaterBankTempPct ?? '',
          stateMeterReadingCondensateM3: mr.stateMeterReadingCondensateM3 ?? '',
          kilnWaterReadingM3: mr.kilnWaterReadingM3 ?? '',
          kilnFiringPct: mr.kilnFiringPct ?? '',
          airSupplyPct: mr.airSupplyPct ?? '',
          airSuctionPct: mr.airSuctionPct ?? '',
          status: mr.y210Status ?? '',
          saltConsumptionKg: mr.saltConsumptionKg ?? '',
          kilnOperatingHours: mr.kilnOperatingHours ?? '',
          coalBuckets: mr.coalBuckets ?? '',
        })),
        totalNote: shift.totalNote ?? '',
        report: shift.report ?? '',
        sigHandingOver: shift.sigHandingOver ?? '',
        sigReceiving: shift.sigReceiving ?? '',
        sigShiftMaster: shift.sigShiftMaster ?? '',
      };
      break;
    }

    case 'ҮЯ-310': {
      payload = {
        ...common,
        repairEquipment: eqs.filter((r: any) => r.tableType === 'repair_equipment').map((r: any) => ({
          key: r.itemKey, label: r.itemLabel, status: r.status ?? '', comment: r.comment ?? '',
          weeklyInspection: r.weeklyInspection ?? '',
        })),
        compressors: eqs.filter((r: any) => r.tableType === 'compressor').map((r: any) => ({
          key: r.itemKey, label: r.itemLabel, statusOk: r.statusOk ?? '', cleaned: r.cleaned ?? '',
          comment: r.comment ?? '', emergencyEquipment: r.emergencyEquipment ?? '',
        })),
        sections: eqs.filter((r: any) => r.tableType === 'section').map((r: any) => ({
          key: r.itemKey, labelEn: r.labelEn ?? '', labelMn: r.labelMn ?? '',
          statusOk: r.statusOk ?? '', cleaned: r.cleaned ?? '',
          equipmentNotes: r.equipmentNotes ?? '', nextShiftWork: r.nextShiftWork ?? '',
        })),
        repairWork: res.filter((r: any) => r.entryType === 'repair_work').map((r: any) => ({
          key: r.itemKey ?? '', labelEn: r.labelEn ?? '', labelMn: r.labelMn ?? '',
          unplannedTime: r.unplannedTime ?? '', plannedTime: r.plannedTime ?? '',
          comment: r.comment ?? '', additionalWork: r.additionalWork ?? '',
        })),
        sigHandingOver: shift.sigHandingOver ?? '',
        sigReceiving: shift.sigReceiving ?? '',
        sigEngineer: shift.sigEngineer ?? '',
      };
      break;
    }

    case 'ҮЯ-320': {
      payload = {
        ...common,
        rows: res.filter((r: any) => r.entryType === 'electrical_repair').map((r: any) => ({
          id: r.id,
          section: r.section ?? '',
          enteredRepairDate: r.enteredRepairDate ?? '',
          leftRepairDate: r.leftRepairDate ?? '',
          shift: r.shiftValue ?? '',
          repairStartTime: r.repairStartTime ?? '',
          repairEndTime: r.repairEndTime ?? '',
          toolReceivedTime: r.toolReceivedTime ?? '',
          partsReceivedTime: r.partsReceivedTime ?? '',
          affectedProduction: r.affectedProduction ?? '',
          shiftNumber: r.shiftNumber ?? '',
          repairType: r.repairType ?? '',
          damageCondition: r.damageCondition ?? '',
          damageCause: r.damageCause ?? '',
          repairWorkDone: r.repairWorkDone ?? '',
          performerName: r.performerName ?? '',
          performerPosition: r.performerPosition ?? '',
          performerManHours: r.performerManHours ?? '',
          receiverName: r.receiverName ?? '',
          receiverPosition: r.receiverPosition ?? '',
          totalDuration: r.totalDuration ?? '',
          workerCount: r.workerCount ?? '',
        })),
        sigHandingOver: shift.sigHandingOver ?? '',
        sigReceiving: shift.sigReceiving ?? '',
      };
      break;
    }

    case 'ҮЯ-400': {
      payload = {
        ...common,
        rows: eqs.filter((r: any) => r.tableType === 'process').map(eqToProcess),
        failureRows: eqs.filter((r: any) => r.tableType === 'failure').map(eqToProcess),
        equipmentRows: eqs.filter((r: any) => r.tableType === 'equipment_ctrl').map(eqToProcess),
        sigMaster: shift.sigMaster ?? '',
      };
      break;
    }

    case 'ҮЯ-410': {
      payload = {
        ...common,
        rows: mrs.map((mr: any) => ({
          id: mr.id,
          scheduledDay: mr.scheduledDay ?? '',
          scheduledNight: mr.scheduledNight ?? '',
          measuredTime: mr.measuredTime ?? '',
          lineVoltage: mr.lineVoltage ?? '',
          transformerTempA: mr.transformerTempA ?? '',
          transformerTempB: mr.transformerTempB ?? '',
          transformerTempC: mr.transformerTempC ?? '',
          transformerCurrentInput1: mr.transformerCurrentInput1 ?? '',
          transformerCurrentInput2: mr.transformerCurrentInput2 ?? '',
          dieselMotorHours: mr.dieselMotorHours ?? '',
          dieselOilTemp: mr.dieselOilTemp ?? '',
          fuel: mr.fuel ?? '',
          mebu1Voltage: mr.mebu1Voltage ?? '',
          mebu1Current: mr.mebu1Current ?? '',
          mebu1SectionSwitch: mr.mebu1SectionSwitch ?? '',
          mebu2Voltage: mr.mebu2Voltage ?? '',
          mebu2Current: mr.mebu2Current ?? '',
          mebu2SectionSwitch: mr.mebu2SectionSwitch ?? '',
          measuredTime35: mr.measuredTime35 ?? '',
          lineVoltage35: mr.lineVoltage35 ?? '',
          transHighCurrentT1: mr.transHighCurrentT1 ?? '',
          transHighCurrentT2: mr.transHighCurrentT2 ?? '',
          transHighCurrentWindoor: mr.transHighCurrentWindoor ?? '',
          transLowCurrentInput1: mr.transLowCurrentInput1 ?? '',
          transLowCurrentInput2: mr.transLowCurrentInput2 ?? '',
        })),
        sigHandingOver: shift.sigHandingOver ?? '',
        sigReceiving: shift.sigReceiving ?? '',
        attentionNotes: shift.attentionNotes ?? '',
        workPerformed: shift.workPerformed ?? '',
      };
      break;
    }

    case 'ОНБ': {
      payload = {
        ...common,
        rows: irs.map((r: any) => ({
          key: r.itemKey ?? '',
          label: r.label ?? '',
          originalValue: r.originalValue ?? '',
          changedValue: r.changedValue ?? '',
        })),
        explanation: shift.explanation ?? '',
        sigOperator: shift.sigOperator ?? '',
        sigTechnologistEngineer: shift.sigTechnologistEngineer ?? '',
        sigChiefTechnologist: shift.sigChiefTechnologist ?? '',
        sigQualitySpecialist: shift.sigQualitySpecialist ?? '',
      };
      break;
    }
  }

  return payload ? { [formKey]: payload } : {};
}

/** DB shift row + reconstructed form payload (lists/detail helpers that need `id` at top level). */
export function toShiftClientPayload(shift: any): Record<string, any> {
  const meta = {
    id: shift.id,
    status: shift.status,
    shiftDate: shift.shiftDate,
    shiftType: shift.shiftType,
    stationCode: shift.stationCode,
    stationName: STATION_NAME_BY_CODE[shift.stationCode] ?? shift.stationName ?? null,
    operatorUid: shift.operatorUid,
    operatorName: shift.operatorName,
    checkIn: shift.checkIn ?? null,
    checkOut: shift.checkOut ?? null,
    shiftNumber: shift.shiftNumber ?? null,
    formVersion: shift.formVersion ?? 1,
    submittedAt: shift.submittedAt ?? null,
    handoverAwaitingAcceptance: shift.handoverAwaitingAcceptance ?? false,
    handoverRequestedAt: shift.handoverRequestedAt ?? null,
    handoverToOperatorUid: shift.handoverToOperatorUid ?? null,
    handoverToOperatorName: shift.handoverToOperatorName ?? null,
    handoverAcceptedByUid: shift.handoverAcceptedByUid ?? null,
    handoverAcceptedByName: shift.handoverAcceptedByName ?? null,
    handoverAcceptedAt: shift.handoverAcceptedAt ?? null,
    operatorShiftCompleted: shift.operatorShiftCompleted ?? false,
    handoverTimingStatus: shift.handoverTimingStatus ?? null,
    handoverTimingReason: shift.handoverTimingReason ?? null,
    handoverTimingRecordedAt: shift.handoverTimingRecordedAt ?? null,
    handoverStage: shift.handoverStage ?? null,
    currentMasterUid: shift.currentMasterUid ?? null,
    currentMasterName: shift.currentMasterName ?? null,
    currentMasterApprovedByUid: shift.currentMasterApprovedByUid ?? null,
    currentMasterApprovedByName: shift.currentMasterApprovedByName ?? null,
    currentMasterApprovedAt: shift.currentMasterApprovedAt ?? null,
    currentMasterComment: shift.currentMasterComment ?? null,
    nextMasterUid: shift.nextMasterUid ?? null,
    nextMasterName: shift.nextMasterName ?? null,
    nextMasterApprovedByUid: shift.nextMasterApprovedByUid ?? null,
    nextMasterApprovedByName: shift.nextMasterApprovedByName ?? null,
    nextMasterApprovedAt: shift.nextMasterApprovedAt ?? null,
    nextMasterComment: shift.nextMasterComment ?? null,
    nextOperatorUid: shift.nextOperatorUid ?? null,
    nextOperatorName: shift.nextOperatorName ?? null,
    handoverFinalAcceptedAt: shift.handoverFinalAcceptedAt ?? null,
    handoverReturnedByUid: shift.handoverReturnedByUid ?? null,
    handoverReturnedByName: shift.handoverReturnedByName ?? null,
    handoverReturnedAt: shift.handoverReturnedAt ?? null,
    handoverReturnReason: shift.handoverReturnReason ?? null,
    shiftMasterUid: shift.shiftMasterUid ?? null,
    masterApproved: shift.masterApproved ?? false,
    masterApprovedBy: shift.masterApprovedBy ?? null,
    masterApprovedDate: shift.masterApprovedDate ?? null,
    adminApproved: shift.adminApproved ?? false,
    adminApprovedBy: shift.adminApprovedBy ?? null,
    adminApprovedDate: shift.adminApprovedDate ?? null,
    createdAt: shift.createdAt,
  };
  return { ...meta, ...reconstructPayload(shift) };
}

/* ── Small mappers ── */

function eqToInsp(r: any) {
  return { key: r.itemKey ?? '', label: r.itemLabel ?? '', status: r.status ?? '', comment: r.comment ?? '' };
}

function eqToProcess(r: any) {
  return {
    key: r.itemKey ?? '', label: r.itemLabel ?? '', status: r.status ?? '',
    comment: r.comment ?? '', requirement: r.requirement ?? '',
  };
}

function plsByType(pls: any[], logType: string): any[] {
  return pls
    .filter((p: any) => p.logType === logType)
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
    .map((p: any) => p.data);
}
