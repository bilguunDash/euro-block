import { createEmptyEnvironmentChecks, type EnvironmentCheckRow } from './environment-check-form';

/** ҮЯ-210: Технологийн зуухны операторын бүртгэл (Excel/зураг загвар) */

export type Y210NormStatus = '' | 'normal' | 'abnormal';

/** Мөр бүрт: цаг + параметрүүд + ус зөөлрүүлэгчийн төлөв */
export interface Y210ParamRow {
  /** e.g. 08:00 */
  time: string;
  /** 1. Зуухны цахилгаан дамжуулах (%) */
  kilnPowerTransmissionPct: string;
  /** 2. Зуухны даралт (бар) */
  kilnPressureBar: string;
  /** 3. Зуухны түвшин (%) */
  kilnLevelPct: string;
  /** 4. Хүчитгэгчийн хэмжээ (%) */
  boosterAmountPct: string;
  /** 5. Экран температур /хамгийн их/ (с) */
  screenTempMaxC: string;
  /** 6. Ул ширмийн температур /хамгийн их/ (с) */
  grateCastIronTempMaxC: string;
  /** 7. Конденсат танкны №3 хэмжээ (%) */
  condensateTank3LevelPct: string;
  /** 8. Конденсат танкны №3 температур (с) */
  condensateTank3TempC: string;
  /** 9. Тэжээлийн усны танкруу өгөх усны температур (с) */
  feedWaterToTankTempC: string;
  /** 10. Үнс асгасан цаг (цаг) */
  ashDischargeHours: string;
  /** 11. Тэжээлийн усны банкны даралт (%) */
  feedWaterBankPressurePct: string;
  /** 12. Тэжээлийн усны банкны түвшин (%) */
  feedWaterBankLevelPct: string;
  /** 13. Тэжээлийн усны банкны температур (%) */
  feedWaterBankTempPct: string;
  /** 14. Төрийн тоолуурын заалт /конденсат/ (м³) */
  stateMeterReadingCondensateM3: string;
  /** 15. Зуухны усны заалт (м³) */
  kilnWaterReadingM3: string;
  /** 16. Зуухны галлагааны хувь (%) */
  kilnFiringPct: string;
  /** 17. Агаар өгөх (%) */
  airSupplyPct: string;
  /** 18. Агаар сорох (%) */
  airSuctionPct: string;
  /** 19. Ус зөөлрүүлэгчийн ажиллагаа — Хэвийн / Хэвийн бус */
  status: Y210NormStatus;
  /** 20. Давсны хэрэглээ (кг) */
  saltConsumptionKg: string;
  /** 21. Зуухны ажиллаж байгаа цагууд (М/цаг) */
  kilnOperatingHours: string;
  /** 22. Нүүрс (шанага) */
  coalBuckets: string;
}

export interface Y210TechnologyKilnOperatorPayload {
  formVersion: 1;
  stationCode: 'ҮЯ-210';
  shiftDate: string;
  shiftType: string;
  rows: Y210ParamRow[];
  totalNote: string;
  report: string;
  sigHandingOver: string;
  sigReceiving: string;
  sigShiftMaster: string;
  submittedAt: string;
  operatorUid: string;
  operatorName: string;
  /** Байгаль орчны хяналт — бүх станцын маягтад нийтлэг хэсэг. */
  environmentChecks: EnvironmentCheckRow[];
}

export const Y210_DEFAULT_TIMES = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];

type Y210ParamCol = { key: keyof Omit<Y210ParamRow, 'time' | 'status'>; label: string; unit?: string };

/** Excel: 1–18 багана (агаар сорох хүртэл) */
export const Y210_PARAM_COLS_MAIN: Y210ParamCol[] = [
  { key: 'kilnPowerTransmissionPct', label: 'Зуухны цахилгаан дамжуулах', unit: '%' },
  { key: 'kilnPressureBar', label: 'Зуухны даралт', unit: 'бар' },
  { key: 'kilnLevelPct', label: 'Зуухны түвшин', unit: '%' },
  { key: 'boosterAmountPct', label: 'Хүчитгэгчийн хэмжээ', unit: '%' },
  { key: 'screenTempMaxC', label: 'Экран температур /хамгийн их/', unit: 'с' },
  { key: 'grateCastIronTempMaxC', label: 'Ул ширмийн температур /хамгийн их/', unit: 'с' },
  { key: 'condensateTank3LevelPct', label: 'Конденсат танкны №3 хэмжээ', unit: '%' },
  { key: 'condensateTank3TempC', label: 'Конденсат танкны №3 температур', unit: 'с' },
  { key: 'feedWaterToTankTempC', label: 'Тэжээлийн усны танкруу өгөх усны температур', unit: 'с' },
  { key: 'ashDischargeHours', label: 'Үнс асгасан цаг', unit: 'цаг' },
  { key: 'feedWaterBankPressurePct', label: 'Тэжээлийн усны банкны даралт', unit: '%' },
  { key: 'feedWaterBankLevelPct', label: 'Тэжээлийн усны банкны түвшин', unit: '%' },
  { key: 'feedWaterBankTempPct', label: 'Тэжээлийн усны банкны температур', unit: '%' },
  { key: 'stateMeterReadingCondensateM3', label: 'Төрийн тоолуурын заалт /конденсат/', unit: 'м³' },
  { key: 'kilnWaterReadingM3', label: 'Зуухны усны заалт', unit: 'м³' },
  { key: 'kilnFiringPct', label: 'Зуухны галлагааны хувь', unit: '%' },
  { key: 'airSupplyPct', label: 'Агаар өгөх', unit: '%' },
  { key: 'airSuctionPct', label: 'Агаар сорох', unit: '%' },
];

/** Excel: ус зөөлрүүлэгчийн дараах 20–22 */
export const Y210_PARAM_COLS_TAIL: Y210ParamCol[] = [
  { key: 'saltConsumptionKg', label: 'Давсны хэрэглээ', unit: 'кг' },
  { key: 'kilnOperatingHours', label: 'Зуухны ажиллаж байгаа мот цагууд', unit: 'М/цаг' },
  { key: 'coalBuckets', label: 'Нүүрс', unit: 'шанага' },
];

/** Бүх тоон багана (хуучин импортын нийцэл) */
export const Y210_PARAM_COLS: Y210ParamCol[] = [...Y210_PARAM_COLS_MAIN, ...Y210_PARAM_COLS_TAIL];

export function emptyY210Row(time: string): Y210ParamRow {
  return {
    time,
    kilnPowerTransmissionPct: '',
    kilnPressureBar: '',
    kilnLevelPct: '',
    boosterAmountPct: '',
    screenTempMaxC: '',
    grateCastIronTempMaxC: '',
    condensateTank3LevelPct: '',
    condensateTank3TempC: '',
    feedWaterToTankTempC: '',
    ashDischargeHours: '',
    feedWaterBankPressurePct: '',
    feedWaterBankLevelPct: '',
    feedWaterBankTempPct: '',
    stateMeterReadingCondensateM3: '',
    kilnWaterReadingM3: '',
    kilnFiringPct: '',
    airSupplyPct: '',
    airSuctionPct: '',
    status: '',
    saltConsumptionKg: '',
    kilnOperatingHours: '',
    coalBuckets: '',
  };
}

/** Хуучин formVersion-ийн мөрийг шинэ бүтэц руу тохируулах (идэвхгүй талбарууд хоосон үлдэнэ) */
export function coerceY210Row(row: Partial<Y210ParamRow> & Record<string, unknown>): Y210ParamRow {
  const legacy = row as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...row };
  if (merged.kilnPowerTransmissionPct == null && legacy.kilnFillPct != null)
    merged.kilnPowerTransmissionPct = legacy.kilnFillPct;
  if (merged.kilnLevelPct == null && legacy.fuelRatePct != null) merged.kilnLevelPct = legacy.fuelRatePct;
  if (merged.boosterAmountPct == null && legacy.scrubberPumpPct != null) merged.boosterAmountPct = legacy.scrubberPumpPct;
  if (merged.screenTempMaxC == null && legacy.feedPumpPct != null) merged.screenTempMaxC = legacy.feedPumpPct;
  if (merged.grateCastIronTempMaxC == null && legacy.auxPumpPct != null) merged.grateCastIronTempMaxC = legacy.auxPumpPct;
  if (merged.condensateTank3LevelPct == null && legacy.feedLiquidLevelPct != null)
    merged.condensateTank3LevelPct = legacy.feedLiquidLevelPct;
  if (merged.condensateTank3TempC == null && legacy.feedLiquidTempC != null) merged.condensateTank3TempC = legacy.feedLiquidTempC;
  if (merged.ashDischargeHours == null && legacy.waterDrainageHours != null) merged.ashDischargeHours = legacy.waterDrainageHours;
  if (merged.kilnOperatingHours == null && legacy.dieselConsumptionM3PerHour != null)
    merged.kilnOperatingHours = legacy.dieselConsumptionM3PerHour;
  if (merged.coalBuckets == null && legacy.bucketCount != null) merged.coalBuckets = legacy.bucketCount;

  const t = String(row.time ?? '');
  const base = emptyY210Row(t || '08:00');
  const pick = (k: keyof Y210ParamRow) =>
    typeof merged[k] === 'string' ? (merged[k] as string) : base[k];
  return {
    time: pick('time'),
    kilnPowerTransmissionPct: pick('kilnPowerTransmissionPct'),
    kilnPressureBar: pick('kilnPressureBar'),
    kilnLevelPct: pick('kilnLevelPct'),
    boosterAmountPct: pick('boosterAmountPct'),
    screenTempMaxC: pick('screenTempMaxC'),
    grateCastIronTempMaxC: pick('grateCastIronTempMaxC'),
    condensateTank3LevelPct: pick('condensateTank3LevelPct'),
    condensateTank3TempC: pick('condensateTank3TempC'),
    feedWaterToTankTempC: pick('feedWaterToTankTempC'),
    ashDischargeHours: pick('ashDischargeHours'),
    feedWaterBankPressurePct: pick('feedWaterBankPressurePct'),
    feedWaterBankLevelPct: pick('feedWaterBankLevelPct'),
    feedWaterBankTempPct: pick('feedWaterBankTempPct'),
    stateMeterReadingCondensateM3: pick('stateMeterReadingCondensateM3'),
    kilnWaterReadingM3: pick('kilnWaterReadingM3'),
    kilnFiringPct: pick('kilnFiringPct'),
    airSupplyPct: pick('airSupplyPct'),
    airSuctionPct: pick('airSuctionPct'),
    status: (row.status === 'normal' || row.status === 'abnormal' ? row.status : '') as Y210NormStatus,
    saltConsumptionKg: pick('saltConsumptionKg'),
    kilnOperatingHours: pick('kilnOperatingHours'),
    coalBuckets: pick('coalBuckets'),
  };
}

export function mergeY210Rows(rows: unknown): Y210ParamRow[] {
  const savedRows = Array.isArray(rows) ? rows : [];
  const rowsByTime = new Map<string, unknown>();
  savedRows.forEach((row) => {
    if (row && typeof row === 'object') {
      const time = String((row as Record<string, unknown>).time ?? '').trim();
      if (time) rowsByTime.set(time, row);
    }
  });

  return Y210_DEFAULT_TIMES.map((time, index) => {
    const row = rowsByTime.get(time) ?? savedRows[index];
    if (row && typeof row === 'object') {
      return coerceY210Row({ ...(row as Record<string, unknown>), time } as Partial<Y210ParamRow> & Record<string, unknown>);
    }
    return emptyY210Row(time);
  });
}

export function createEmptyY210Payload(partial: {
  shiftDate: string;
  shiftType: string;
  operatorUid: string;
  operatorName: string;
}): Omit<Y210TechnologyKilnOperatorPayload, 'submittedAt'> & { submittedAt?: string } {
  return {
    environmentChecks: createEmptyEnvironmentChecks(),
    formVersion: 1,
    stationCode: 'ҮЯ-210',
    shiftDate: partial.shiftDate,
    shiftType: partial.shiftType,
    rows: Y210_DEFAULT_TIMES.map(emptyY210Row),
    totalNote: '',
    report: '',
    sigHandingOver: partial.operatorName,
    sigReceiving: '',
    sigShiftMaster: '',
    operatorUid: partial.operatorUid,
    operatorName: partial.operatorName,
  };
}
