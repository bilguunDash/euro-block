import { createEmptyEnvironmentChecks, type EnvironmentCheckRow } from './environment-check-form';

/** ҮЯ-400: Үйлдвэрийн процесст тавих хяналтын хуудас */

export type ProcessControlStatus = '' | 'normal' | 'abnormal';

export interface ProcessControlRow {
  key: string;
  label: string;
  requirement: string;
  status: ProcessControlStatus;
  comment: string;
}

export const PROCESS_CONTROL_ITEMS: readonly { key: string; label: string; requirement: string }[] = [
  { key: 'p1', label: 'Тархалт', requirement: '25см' },
  { key: 'p2', label: 'Хөөлтийн хугацаа', requirement: '<180мин' },
  { key: 'p3', label: 'Хөөлтийн тувшин', requirement: '5см' },
  { key: 'p4', label: 'Хатуулаг', requirement: '<400psi' },
  { key: 'p5', label: 'Шинэ зутангийн нягт', requirement: '>1650кг/дм3' },
  { key: 'p6', label: 'Буцах зутангийн нягт', requirement: '>1350кг/дм4' },
  { key: 'p7', label: 'Хэмжээний алдаа (ногоон)', requirement: '<1.5мм' },
  { key: 'p8', label: 'Гологдол (ногоон)', requirement: '0%' },
  { key: 'p9', label: 'Хэмжээний алдаа (цагаан)', requirement: '<1.5мм' },
  { key: 'p10', label: 'Гологдол (цагаан)', requirement: '0%' },
  { key: 'p11', label: 'Огноо тэмдэглэгээ', requirement: 'Хэвийн' },
  { key: 'p12', label: 'Бүтээгдэхүүн савлагаа/багцалгаа', requirement: 'Хэвийн' },
  { key: 'p13', label: 'Цементийн нөөц', requirement: 'гадна, дотор бүх нөөцийг тооцоолон тэмдэглэл хөтлөх' },
  { key: 'p14', label: 'Шохойн нөөц', requirement: 'гадна, дотор бүх нөөцийг тооцоолон тэмдэглэл хөтлөх' },
  { key: 'p15', label: 'Гөлтгөнө нөөц', requirement: 'гадна, дотор бүх нөөцийг тооцоолон тэмдэглэл хөтлөх' },
  { key: 'p16', label: 'Зутан нөөц', requirement: '80/80' },
  { key: 'p17', label: 'Бусад үндсэн, туслах материалын нөөц', requirement: 'Нөөцийн хомсдолтой тэмдэглэлэх' },
] as const;

/* ─── 2. Тоног төхөөрөмжийн доголдол (4 мөр) ─── */
export interface EquipmentFailureRow {
  key: string;
  label: string;
  status: ProcessControlStatus;
  comment: string;
}

export const EQUIPMENT_FAILURE_ITEMS: readonly { key: string; label: string }[] = [
  { key: 'f1', label: 'Хөнгөн цагаан' },
  { key: 'f2', label: 'Шохойн тээрэм' },
  { key: 'f3', label: 'Цемент шахах төхөөрөмж' },
  { key: 'f4', label: 'Бөмбөлөгт тээрэм' },
] as const;

/* ─── 3. Тоног төхөөрөмжийн хяналт (14 мөр, №5–18) ─── */
export interface EquipmentControlRow {
  key: string;
  label: string;
  status: ProcessControlStatus;
  comment: string;
}

export const EQUIPMENT_CONTROL_ITEMS: readonly { key: string; num: number; label: string }[] = [
  { key: 'e5', num: 5, label: 'Хэв эргэлт' },
  { key: 'e6', num: 6, label: 'Зүсэх шугам' },
  { key: 'e7', num: 7, label: 'Рам эргэлт' },
  { key: 'e8', num: 8, label: 'Тэргэнцэр эргэлт' },
  { key: 'e9', num: 9, label: 'Автоклав' },
  { key: 'e10', num: 10, label: 'Чанар шалгагч' },
  { key: 'e11', num: 11, label: 'Бүтээгдэхүүн савлах' },
  { key: 'e12', num: 12, label: 'Уутлах төхөөрөмж' },
  { key: 'e13', num: 13, label: 'Технологийн зуух' },
  { key: 'e14', num: 14, label: 'Халаалтын зуух' },
  { key: 'e15', num: 15, label: 'У-блок бэлтгэх' },
  { key: 'e16', num: 16, label: 'Ачаа буулгагч' },
  { key: 'e17', num: 17, label: 'Бутлуур' },
  { key: 'e18', num: 18, label: 'Нэмэлт:' },
] as const;

export interface FactoryProcessControlPayload {
  formVersion: 1;
  stationCode: 'ҮЯ-400';
  shiftDate: string;
  shiftType: string;
  rows: ProcessControlRow[];
  failureRows: EquipmentFailureRow[];
  equipmentRows: EquipmentControlRow[];
  sigMaster: string;
  submittedAt: string;
  operatorUid: string;
  operatorName: string;
  /** Байгаль орчны хяналт — бүх станцын маягтад нийтлэг хэсэг. */
  environmentChecks: EnvironmentCheckRow[];
}

export type FactoryProcessControlDraft = Omit<FactoryProcessControlPayload, 'submittedAt'> & {
  submittedAt?: string;
};

function normalizeStatus(status: unknown): ProcessControlStatus {
  return status === 'normal' || status === 'abnormal' ? status : '';
}

function hydrateRows<T extends { key: string; label: string; status: ProcessControlStatus; comment: string }>(
  defaults: T[],
  incoming: unknown,
): T[] {
  const incomingRows = Array.isArray(incoming) ? incoming : [];
  return defaults.map((base, index) => {
    const saved =
      incomingRows.find((row: any) => row?.key && row.key === base.key) ??
      incomingRows[index] ??
      {};
    return {
      ...base,
      status: normalizeStatus((saved as any).status),
      comment: String((saved as any).comment ?? ''),
      ...('requirement' in base
        ? { requirement: String((saved as any).requirement || (base as any).requirement || '') }
        : {}),
    } as T;
  });
}

export function createEmptyFactoryProcessControlPayload(partial: {
  shiftDate: string;
  shiftType: string;
  operatorUid: string;
  operatorName: string;
}): FactoryProcessControlDraft {
  return {
    environmentChecks: createEmptyEnvironmentChecks(),
    formVersion: 1,
    stationCode: 'ҮЯ-400',
    shiftDate: partial.shiftDate,
    shiftType: partial.shiftType,
    rows: PROCESS_CONTROL_ITEMS.map(({ key, label, requirement }) => ({
      key, label, requirement, status: '' as const, comment: '',
    })),
    failureRows: EQUIPMENT_FAILURE_ITEMS.map(({ key, label }) => ({
      key, label, status: '' as const, comment: '',
    })),
    equipmentRows: EQUIPMENT_CONTROL_ITEMS.map(({ key, label }) => ({
      key, label, status: '' as const, comment: '',
    })),
    sigMaster: '',
    operatorUid: partial.operatorUid,
    operatorName: partial.operatorName,
  };
}

export function normalizeFactoryProcessControlPayload(
  payload: Partial<FactoryProcessControlPayload> | null | undefined,
  fallback: {
    shiftDate: string;
    shiftType: string;
    operatorUid: string;
    operatorName: string;
  },
): FactoryProcessControlDraft {
  const empty = createEmptyFactoryProcessControlPayload(fallback);
  const p = payload ?? {};

  return {
    ...empty,
    ...p,
    formVersion: 1,
    stationCode: 'ҮЯ-400',
    shiftDate: p.shiftDate || empty.shiftDate,
    shiftType: p.shiftType || empty.shiftType,
    operatorUid: p.operatorUid || empty.operatorUid,
    operatorName: p.operatorName || empty.operatorName,
    rows: hydrateRows(empty.rows, p.rows),
    failureRows: hydrateRows(empty.failureRows, p.failureRows),
    equipmentRows: hydrateRows(empty.equipmentRows, p.equipmentRows),
    sigMaster: p.sigMaster ?? empty.sigMaster,
    submittedAt: p.submittedAt,
  };
}
