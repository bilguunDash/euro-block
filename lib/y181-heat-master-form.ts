import { createEmptyEnvironmentChecks, type EnvironmentCheckRow } from './environment-check-form';

/** ДУХ-05: Дулааны мастерын ээлж хүлээлцэх бүртгэлийн хуудас
 *  1. Ус хангамж, бохир ус  2. Технологийн зуух  3. Автоклав  4. Халаалтын зуух, сантехникийн систем */

export type YesNoStatus = '' | 'yes' | 'no';

export interface Y181ChecklistRow {
  key: string;
  label: string;
  status: YesNoStatus;
  /** Тухайн мөрийн нэмэлт утга (жишээ: "Ажиллуулж буй насос: 1 / 2"). Зөвхөн noteLabel-тэй мөрөнд ашиглана. */
  note: string;
  /** `valueOnly` мөрөнд тэмдэглэгээ биш, ганц утгын оролт харагдана (тийм/үгүй байхгүй). */
  valueOnly?: boolean;
}

export type Y181ChecklistItem = {
  key: string;
  label: string;
  /** `note` талбарын placeholder — байхгүй бол note оролт харагдахгүй. */
  noteLabel?: string;
  valueOnly?: boolean;
};

/* ─── 1. Ус хангамж, бохир ус ─── */
export const Y181_WATER_SUPPLY_ITEMS: readonly Y181ChecklistItem[] = [
  { key: 'w1', label: 'Усан сангийн түвшин', valueOnly: true },
  { key: 'w2', label: 'Гүний ус татуулсан', noteLabel: 'Гүний усны насос ажиллуулсан хугацаа' },
  { key: 'w3', label: 'Даралтын насосны ажиллагаа хэвийн', noteLabel: 'Ажиллуулж буй насос (1 / 2)' },
  { key: 'w4', label: 'Усны хэрэгслэлийн бүртгэл хөтөлсөн' },
  { key: 'w5', label: 'Ус хангамжийн насосны ажиллагаа хэвийн эсэх' },
  { key: 'w6', label: 'Бохир усны худгийн түвшин', valueOnly: true, noteLabel: 'Хэдэн удаа соруулсан эсэх' },
] as const;

/* ─── 2. Технологийн зуух ─── */
export const Y181_KILN_ITEMS: readonly Y181ChecklistItem[] = [
  { key: 'k1', label: 'Даралт хэвийн' },
  { key: 'k2', label: 'Тэжээлийн насосны ажиллагаа хэвийн' },
  { key: 'k3', label: 'Үнс гаргагчийн ажиллагаа хэвийн' },
  { key: 'k4', label: 'Ус зээлдрүүлэгчийн ажиллагаа хэвийн', noteLabel: 'Хэрэглээ' },
  { key: 'k5', label: 'Нүүрсний конвейерын ажиллагаа хэвийн' },
  { key: 'k6', label: 'Агуулахад нүүрс оруулсан', noteLabel: 'Нүүрсний хэрэглээ / оруулсан машины тоо' },
] as const;

/* ─── 3. Автоклав ─── */
export const Y181_AUTOCLAVE_ITEMS: readonly Y181ChecklistItem[] = [
  { key: 'a1', label: 'Хаалганы жийрэг тосолж байгаа' },
  { key: 'a2', label: 'Даралтаа алдаж байгаа болон гоожиж байгаа автоклав байгаа эсэх' },
  { key: 'a3', label: 'Хаалтны засвар хийсэн' },
] as const;

/* ─── 4. Халаалтын зуух, сантехникийн систем ─── */
export const Y181_HEATING_ITEMS: readonly Y181ChecklistItem[] = [
  { key: 'h1', label: 'Эвдрэлтэй тоног төхөөрөмж байгаа эсэх' },
  { key: 'h2', label: 'Засварын ажил хийгдсэн' },
  { key: 'h3', label: 'Даралт температур хэвийн' },
] as const;

export interface Y181HeatMasterHandoverPayload {
  formVersion: 1;
  stationCode: 'ҮЯ-181';
  shiftDate: string;
  shiftType: string;
  /** ДУХ-05 цаасан хуудсан дээрх "ЭЭЛЖ: 1 2 3" — ажлын баг (crew), shiftType-ээс тусдаа. */
  crewNumber: '' | '1' | '2' | '3';
  waterSupplyRows: Y181ChecklistRow[];
  kilnRows: Y181ChecklistRow[];
  autoclaveRows: Y181ChecklistRow[];
  heatingRows: Y181ChecklistRow[];
  attentionNotes: string;
  workPerformed: string;
  sigHandingOver: string;
  sigReceiving: string;
  /** Дараагийн мастерын хуваарь олдоогүй үед — admin эцсийн баталгаажуулалт шаардана. */
  needsAdminApproval?: boolean;
  submittedAt: string;
  operatorUid: string;
  operatorName: string;
  /** Байгаль орчны хяналт — бүх станцын маягтад нийтлэг хэсэг. */
  environmentChecks: EnvironmentCheckRow[];
}

export type Y181HeatMasterHandoverDraft = Omit<Y181HeatMasterHandoverPayload, 'submittedAt'> & {
  submittedAt?: string;
};

function str(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function normalizeYesNo(value: unknown): YesNoStatus {
  return value === 'yes' || value === 'no' ? value : '';
}

function normalizeCrewNumber(value: unknown): '' | '1' | '2' | '3' {
  const s = str(value);
  return s === '1' || s === '2' || s === '3' ? s : '';
}

function emptyChecklistRows(items: readonly Y181ChecklistItem[]): Y181ChecklistRow[] {
  return items.map(({ key, label, valueOnly }) => ({ key, label, status: '' as const, note: '', valueOnly }));
}

function hydrateChecklistRows(defaults: Y181ChecklistRow[], incoming: unknown): Y181ChecklistRow[] {
  const incomingRows = Array.isArray(incoming) ? incoming : [];
  return defaults.map((base, index) => {
    const saved = incomingRows.find((row: any) => row?.key && row.key === base.key) ?? incomingRows[index] ?? {};
    return {
      ...base,
      status: normalizeYesNo((saved as any).status),
      note: str((saved as any).note),
    };
  });
}

export function createEmptyY181HeatMasterHandoverPayload(partial: {
  shiftDate: string;
  shiftType: string;
  operatorUid: string;
  operatorName: string;
}): Y181HeatMasterHandoverDraft {
  return {
    environmentChecks: createEmptyEnvironmentChecks(),
    formVersion: 1,
    stationCode: 'ҮЯ-181',
    shiftDate: partial.shiftDate,
    shiftType: partial.shiftType,
    crewNumber: '',
    waterSupplyRows: emptyChecklistRows(Y181_WATER_SUPPLY_ITEMS),
    kilnRows: emptyChecklistRows(Y181_KILN_ITEMS),
    autoclaveRows: emptyChecklistRows(Y181_AUTOCLAVE_ITEMS),
    heatingRows: emptyChecklistRows(Y181_HEATING_ITEMS),
    attentionNotes: '',
    workPerformed: '',
    sigHandingOver: partial.operatorName,
    sigReceiving: '',
    operatorUid: partial.operatorUid,
    operatorName: partial.operatorName,
  };
}

export function normalizeY181HeatMasterHandoverPayload(
  payload: Partial<Y181HeatMasterHandoverPayload> | null | undefined,
  fallback: {
    shiftDate: string;
    shiftType: string;
    operatorUid: string;
    operatorName: string;
  },
): Y181HeatMasterHandoverDraft {
  const empty = createEmptyY181HeatMasterHandoverPayload(fallback);
  const p = payload ?? {};

  return {
    ...empty,
    ...p,
    formVersion: 1,
    stationCode: 'ҮЯ-181',
    shiftDate: str(p.shiftDate) || empty.shiftDate,
    shiftType: str(p.shiftType) || empty.shiftType,
    crewNumber: normalizeCrewNumber(p.crewNumber),
    waterSupplyRows: hydrateChecklistRows(empty.waterSupplyRows, p.waterSupplyRows),
    kilnRows: hydrateChecklistRows(empty.kilnRows, p.kilnRows),
    autoclaveRows: hydrateChecklistRows(empty.autoclaveRows, p.autoclaveRows),
    heatingRows: hydrateChecklistRows(empty.heatingRows, p.heatingRows),
    attentionNotes: str(p.attentionNotes),
    workPerformed: str(p.workPerformed),
    sigHandingOver: str(p.sigHandingOver) || empty.sigHandingOver,
    sigReceiving: str(p.sigReceiving),
    needsAdminApproval: p.needsAdminApproval === true,
    operatorUid: str(p.operatorUid) || empty.operatorUid,
    operatorName: str(p.operatorName) || empty.operatorName,
    submittedAt: p.submittedAt,
  };
}

/**
 * Submit-ийн өмнөх шалгалт — бүх мөр бөглөгдсөн эсэх. Хүлээн авсан гарын үсэг нь
 * `needsAdminApproval=true` үед заавал биш (дараагийн мастерын хуваарь олдоогүй
 * тохиолдол — CAH-02/ҮЯ-310-той адил admin эцсийн баталгаажуулалт хийнэ).
 */
export function validateY181HeatMasterHandoverPayload(
  data: Partial<Y181HeatMasterHandoverPayload> | null | undefined,
): string | null {
  const p = data ?? {};
  const sections: [string, Y181ChecklistRow[] | undefined][] = [
    ['Ус хангамж, бохир ус', p.waterSupplyRows as any],
    ['Технологийн зуух', p.kilnRows as any],
    ['Автоклав', p.autoclaveRows as any],
    ['Халаалтын зуух, сантехникийн систем', p.heatingRows as any],
  ];
  for (const [sectionLabel, rows] of sections) {
    for (const row of rows || []) {
      if (row.valueOnly) continue;
      if (row.status !== 'yes' && row.status !== 'no') {
        return `«${sectionLabel} — ${row.label}» тийм/үгүй эсэхийг сонгоно уу.`;
      }
    }
  }
  if (!p.needsAdminApproval && !str((p as any).sigReceiving).trim()) {
    return 'Ээлж хүлээн авсан мастерын нэрийг оруулна уу.';
  }
  return null;
}
