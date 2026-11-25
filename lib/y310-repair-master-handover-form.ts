import { createEmptyEnvironmentChecks, type EnvironmentCheckRow } from './environment-check-form';

/** ҮЯ-310: Засварын мастерын ээлж хүлээлцэх бүртгэл */

export type Y310Status = '' | 'normal' | 'abnormal';

/* ─── 1. Засварын тоног төхөөрөмж (6 мөр) ─── */
export interface Y310RepairEquipmentRow {
  key: string;
  label: string;
  status: Y310Status;
  comment: string;
  weeklyInspection: string;
}

export const Y310_REPAIR_EQUIPMENT: { key: string; label: string }[] = [
  { key: 'r1', label: 'Суурин точиль' },
  { key: 'r2', label: 'Суурин өрөм' },
  { key: 'r3', label: 'Гидро пресс 100 тн' },
  { key: 'r4', label: 'Хашааны цэвэрлэгээ' },
  { key: 'r5', label: 'Тэргэнцэр засварын хашаа' },
  { key: 'r6', label: 'Хуваарьт хэсгийн цэвэрлэгээ, шал угаах' },
];

/* ─── 2. Хийн хангалт / Компрессор (4 мөр) ─── */
export interface Y310CompressorRow {
  key: string;
  label: string;
  statusOk: Y310Status;
  cleaned: Y310Status;
  comment: string;
  emergencyEquipment: string;
}

export const Y310_COMPRESSORS: { key: string; label: string }[] = [
  { key: 'c1', label: 'GA55FF компрессор' },
  { key: 'c2', label: 'GA75FF компрессор' },
  { key: 'c3', label: 'GA90FF компрессор' },
  { key: 'c4', label: 'Агаар хатаагч' },
];

/* ─── 3. Хэсэг / Sections (11 мөр) ─── */
export interface Y310SectionRow {
  key: string;
  labelEn: string;
  labelMn: string;
  statusOk: Y310Status;
  cleaned: Y310Status;
  equipmentNotes: string;
  nextShiftWork: string;
}

export const Y310_SECTIONS: { key: string; labelEn: string; labelMn: string }[] = [
  { key: 's1', labelEn: 'Raw Material Preperation CEMENT', labelMn: 'Цемент TELSCHIG' },
  { key: 's2', labelEn: 'Raw Material Preperations LIME MILL', labelMn: 'Шохой тээрэм /PM20U3/' },
  { key: 's3', labelEn: 'Raw Material Preperations Ball mill', labelMn: 'Бөмбөлөгт тээрэм' },
  { key: 's4', labelEn: 'SLURRY System', labelMn: 'Зутан систем' },
  { key: 's5', labelEn: 'MIXER & ALUMINUM', labelMn: 'Цамхаг /Хөнгөнцагаан/' },
  { key: 's6', labelEn: 'Mold turning part', labelMn: 'Хэв эргэх' },
  { key: 's7', labelEn: 'CUTTING LINE', labelMn: 'Блок зүсэх дамжлага' },
  { key: 's8', labelEn: '/FRAME SYSTEM/', labelMn: 'Рам эргэх хэсэг' },
  { key: 's9', labelEn: 'Packaging section', labelMn: 'Савлах' },
  { key: 's10', labelEn: 'SteamBoiler, Autoclave', labelMn: 'Технологийн зуух, автоклав' },
  { key: 's11', labelEn: '', labelMn: 'Арматуртай хийцийн хэсэг' },
];

/* ─── 4. Засварын ажлын бүртгэл (18 мөр) ─── */
export interface Y310RepairWorkRow {
  key: string;
  labelEn: string;
  labelMn: string;
  unplannedTime: string;
  plannedTime: string;
  comment: string;
  additionalWork: string;
}

export const Y310_REPAIR_WORK: { key: string; labelEn: string; labelMn: string }[] = [
  { key: 'w1', labelEn: 'Raw Material Preperation CEMENT', labelMn: 'Цемент TELSCHIG' },
  { key: 'w2', labelEn: 'Raw Material Preperations LIME MILL', labelMn: 'Шохой тээрэм /PM20U3/' },
  { key: 'w3', labelEn: 'Raw Material Preperations Ball mill', labelMn: 'Бөмбөлөгт тээрэм' },
  { key: 'w4', labelEn: 'SLURRY System', labelMn: 'Зутан систем' },
  { key: 'w5', labelEn: 'MIXER & ALUMINUM', labelMn: 'Цамхаг /Хөнгөнцагаан/' },
  { key: 'w6', labelEn: 'Mold turning part', labelMn: 'Хэв эргэх' },
  { key: 'w7', labelEn: 'CUTTING LINE', labelMn: 'Блок зүсэх дамжлага' },
  { key: 'w8', labelEn: '/FRAME SYSTEM/', labelMn: 'Рам эргэх хэсэг' },
  { key: 'w9', labelEn: 'Packaging section', labelMn: 'Савлах' },
  { key: 'w10', labelEn: 'SteamBoiler, Autoclave', labelMn: 'Технологийн зуух, автоклав' },
  { key: 'w11', labelEn: '', labelMn: 'Арматуртай хийцийн хэсэг' },
  { key: 'w12', labelEn: '', labelMn: 'Агуулах суллалт' },
  { key: 'w13', labelEn: '', labelMn: 'Тог тасралт' },
  { key: 'w14', labelEn: '', labelMn: 'Түүхий эд / Поддон' },
  { key: 'w15', labelEn: '', labelMn: 'Цайны цагаар дамжлагат гарсан цаг' },
  { key: 'w16', labelEn: '', labelMn: 'Оператортгүй' },
  { key: 'w17', labelEn: '', labelMn: 'Сэлбэг материал' },
  { key: 'w18', labelEn: '', labelMn: 'Нярав хүлээсэн, шалтгаалсан' },
];

/* ─── Payload ─── */
export interface Y310RepairMasterHandoverPayload {
  formVersion: 1;
  stationCode: 'ҮЯ-310';
  shiftDate: string;
  shiftType: string;
  repairEquipment: Y310RepairEquipmentRow[];
  compressors: Y310CompressorRow[];
  sections: Y310SectionRow[];
  repairWork: Y310RepairWorkRow[];
  sigHandingOver: string;
  sigReceiving: string;
  sigEngineer: string;
  submittedAt: string;
  operatorUid: string;
  operatorName: string;
  /** Байгаль орчны хяналт — бүх станцын маягтад нийтлэг хэсэг. */
  environmentChecks: EnvironmentCheckRow[];
}

export function createEmptyY310Payload(partial: {
  shiftDate: string;
  shiftType: string;
  operatorUid: string;
  operatorName: string;
}): Omit<Y310RepairMasterHandoverPayload, 'submittedAt'> & { submittedAt?: string } {
  return {
    environmentChecks: createEmptyEnvironmentChecks(),
    formVersion: 1,
    stationCode: 'ҮЯ-310',
    shiftDate: partial.shiftDate,
    shiftType: partial.shiftType,
    repairEquipment: Y310_REPAIR_EQUIPMENT.map(({ key, label }) => ({
      key, label, status: '' as const, comment: '', weeklyInspection: '',
    })),
    compressors: Y310_COMPRESSORS.map(({ key, label }) => ({
      key, label, statusOk: '' as const, cleaned: '' as const, comment: '', emergencyEquipment: '',
    })),
    sections: Y310_SECTIONS.map(({ key, labelEn, labelMn }) => ({
      key, labelEn, labelMn, statusOk: '' as const, cleaned: '' as const, equipmentNotes: '', nextShiftWork: '',
    })),
    repairWork: Y310_REPAIR_WORK.map(({ key, labelEn, labelMn }) => ({
      key, labelEn, labelMn, unplannedTime: '', plannedTime: '', comment: '', additionalWork: '',
    })),
    sigHandingOver: partial.operatorName,
    sigReceiving: '',
    sigEngineer: '',
    operatorUid: partial.operatorUid,
    operatorName: partial.operatorName,
  };
}

export function mergeY310RepairEquipment(rows: unknown): Y310RepairEquipmentRow[] {
  const savedRows = Array.isArray(rows) ? rows : [];
  const savedByKey = new Map(
    savedRows
      .filter((row): row is Partial<Y310RepairEquipmentRow> => Boolean(row && typeof row === 'object'))
      .map((row) => [String(row.key ?? ''), row])
  );
  return Y310_REPAIR_EQUIPMENT.map(({ key, label }) => {
    const saved = savedByKey.get(key);
    return {
      key,
      label,
      status: (saved?.status === 'normal' || saved?.status === 'abnormal' ? saved.status : '') as Y310Status,
      comment: typeof saved?.comment === 'string' ? saved.comment : '',
      weeklyInspection: typeof saved?.weeklyInspection === 'string' ? saved.weeklyInspection : '',
    };
  });
}

export function mergeY310Compressors(rows: unknown): Y310CompressorRow[] {
  const savedRows = Array.isArray(rows) ? rows : [];
  const savedByKey = new Map(
    savedRows
      .filter((row): row is Partial<Y310CompressorRow> => Boolean(row && typeof row === 'object'))
      .map((row) => [String(row.key ?? ''), row])
  );
  return Y310_COMPRESSORS.map(({ key, label }) => {
    const saved = savedByKey.get(key);
    return {
      key,
      label,
      statusOk: (saved?.statusOk === 'normal' || saved?.statusOk === 'abnormal' ? saved.statusOk : '') as Y310Status,
      cleaned: (saved?.cleaned === 'normal' || saved?.cleaned === 'abnormal' ? saved.cleaned : '') as Y310Status,
      comment: typeof saved?.comment === 'string' ? saved.comment : '',
      emergencyEquipment: typeof saved?.emergencyEquipment === 'string' ? saved.emergencyEquipment : '',
    };
  });
}

export function mergeY310Sections(rows: unknown): Y310SectionRow[] {
  const savedRows = Array.isArray(rows) ? rows : [];
  const savedByKey = new Map(
    savedRows
      .filter((row): row is Partial<Y310SectionRow> => Boolean(row && typeof row === 'object'))
      .map((row) => [String(row.key ?? ''), row])
  );
  return Y310_SECTIONS.map(({ key, labelEn, labelMn }) => {
    const saved = savedByKey.get(key);
    return {
      key,
      labelEn,
      labelMn,
      statusOk: (saved?.statusOk === 'normal' || saved?.statusOk === 'abnormal' ? saved.statusOk : '') as Y310Status,
      cleaned: (saved?.cleaned === 'normal' || saved?.cleaned === 'abnormal' ? saved.cleaned : '') as Y310Status,
      equipmentNotes: typeof saved?.equipmentNotes === 'string' ? saved.equipmentNotes : '',
      nextShiftWork: typeof saved?.nextShiftWork === 'string' ? saved.nextShiftWork : '',
    };
  });
}

export function mergeY310RepairWork(rows: unknown): Y310RepairWorkRow[] {
  const savedRows = Array.isArray(rows) ? rows : [];
  const savedByKey = new Map(
    savedRows
      .filter((row): row is Partial<Y310RepairWorkRow> => Boolean(row && typeof row === 'object'))
      .map((row) => [String(row.key ?? ''), row])
  );
  return Y310_REPAIR_WORK.map(({ key, labelEn, labelMn }) => {
    const saved = savedByKey.get(key);
    return {
      key,
      labelEn,
      labelMn,
      unplannedTime: typeof saved?.unplannedTime === 'string' ? saved.unplannedTime : '',
      plannedTime: typeof saved?.plannedTime === 'string' ? saved.plannedTime : '',
      comment: typeof saved?.comment === 'string' ? saved.comment : '',
      additionalWork: typeof saved?.additionalWork === 'string' ? saved.additionalWork : '',
    };
  });
}

export function mergeY310PayloadRows(payload: Partial<Y310RepairMasterHandoverPayload> | null | undefined) {
  return {
    repairEquipment: mergeY310RepairEquipment(payload?.repairEquipment),
    compressors: mergeY310Compressors(payload?.compressors),
    sections: mergeY310Sections(payload?.sections),
    repairWork: mergeY310RepairWork(payload?.repairWork),
  };
}
