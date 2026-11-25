import { createEmptyEnvironmentChecks, type EnvironmentCheckRow } from './environment-check-form';

/**
 * ҮЯ-180: Автоклавын операторын бүртгэл.
 * formVersion 2: ажилбарын мөрүүд (MS Forms «Автоклавын операторын бүртгэл» загвар) +
 * тоног төхөөрөмжийн шалгалт (1-ТЕХ-180). formVersion 1-ийн цагийн хүснэгт зөвхөн хуучин бүртгэлд.
 */

export type Y180NormStatus = '' | 'normal' | 'abnormal';

/* ─── Тоног төхөөрөмжийн шалгалт (доод хүснэгт, 12 мөр) ─── */
export interface Y180EquipmentRow {
  key: string;
  label: string;
  status: Y180NormStatus;
  comment: string;
}

export const Y180_EQUIPMENT_LABELS: { key: string; label: string }[] = [
  { key: 'e1', label: 'Хөндлөн тэргэнцэрийн ажиллагаа' },
  { key: 'e2', label: 'уурын шугам хоолой ' },
  { key: 'e3', label: 'Хийн даралт' },
  { key: 'e4', label: 'Уурын даралт' },
  { key: 'e5', label: 'Хаалт арматурын ажиллагаа' },
  { key: 'e6', label: 'Автоклавын хаалганы редуктор' },
  { key: 'e7', label: 'Автоклавын хаалганы жийрэг резин' },
  { key: 'e8', label: 'Хийн хаалтны цан резин' },
  { key: 'e9', label: 'Конденсац хаялт' },
  { key: 'e10', label: 'Удирлагын самбарын ажиллагаа' },
  { key: 'e11', label: 'Ажлын байрны цэвэрлэгээ, эмх цэгц' },
  { key: 'e12', label: 'Автоклавын роликны үзлэг' },
];

/* ─── Автоклав бүрийн мэдээлэл (мөр тус бүрт) ─── */
export interface Y180AutoclaveData {
  startTime: string;
  startRoller: string;
  stopTime: string;
  stopRoller: string;
  outTrack1: string;
  outTrack2: string;
  inTrack3: string;
  inTrack4: string;
}

export const Y180_AUTOCLAVE_COUNT = 6;
export const Y180_DEFAULT_TIME_ROW_COUNT = 12;

function emptyAutoclaveData(): Y180AutoclaveData {
  return {
    startTime: '', startRoller: '',
    stopTime: '', stopRoller: '',
    outTrack1: '', outTrack2: '',
    inTrack3: '', inTrack4: '',
  };
}

/* ─── Нэг цагийн мөр ─── */
export interface Y180TimeRow {
  /** ISO datetime, жишээ нь "2026-04-07T08:00:00" */
  time: string;
  furnacePressure: string;
  steamLinePressure: string;
  autoclaves: Y180AutoclaveData[];
  totalProductOut: string;
  totalProductIn: string;
}

/* ─── Автоклавын ажилбарын бүртгэл (formVersion 2) ───
 * MS Forms «Автоклавын операторын бүртгэл»-ийн нэг хариулт = нэг мөр: оператор ээлжийн турш
 * автоклав оруулах/гаргах ажилбар бүрийг «Мөр нэмэх»-ээр бүртгэнэ. Хуучин цагийн хүснэгтийг
 * (`timeRows`) орлоно — хуучин бүртгэлийн `timeRows` харах горимд хэвээр харагдана.
 */
export const Y180_BLOCK_SIZES = ['100', '125', '150', '200', '250', '300', '375'] as const;
export const Y180_LOAD_DIRECTIONS = ['оруулсан', 'гаргасан'] as const;
export type Y180LoadDirection = '' | (typeof Y180_LOAD_DIRECTIONS)[number];
export const Y180_DEFAULT_CONDITION = 'хэвийн';
export const Y180_DEFAULT_OTHER_FACTORS = 'байхгүй';

export interface Y180OperationRow {
  id: string;
  /** Бүтээгдэхүүний хэмжээ (мм) */
  blockSize: string;
  /** Автоклавын дугаар '1'–'6' */
  autoclaveNum: string;
  loadDirection: Y180LoadDirection;
  /** HH:mm — Автоклавыг эхлүүлсэн цаг (ихэвчлэн «оруулсан» үед) */
  startedTime: string;
  /** HH:mm — Автоклавыг онгойлгосон цаг (ихэвчлэн «гаргасан» үед) */
  openedTime: string;
  /** Тухайн автоклавын ажиллагаа (анхдагч «хэвийн») */
  autoclaveCondition: string;
  /** Автоклавын ажиллагаанд нөлөөлсөн бусад зүйл (анхдагч «байхгүй») */
  otherFactors: string;
  /** Нэмэлт ажил /засварын ажил, ажлын байрны цэвэрлэгээ, бусад/ */
  extraWork: string;
  /** Бүртгэл хөтөлсөн */
  recordedBy: string;
}

let operationRowSeq = 0;

export function newY180OperationRowId(): string {
  operationRowSeq += 1;
  return `op_${Date.now().toString(36)}_${operationRowSeq}_${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyY180OperationRow(recordedBy = '', id = newY180OperationRowId()): Y180OperationRow {
  return {
    id,
    blockSize: '',
    autoclaveNum: '',
    loadDirection: '',
    startedTime: '',
    openedTime: '',
    autoclaveCondition: Y180_DEFAULT_CONDITION,
    otherFactors: Y180_DEFAULT_OTHER_FACTORS,
    extraWork: '',
    recordedBy,
  };
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

export function coerceY180OperationRow(row: unknown, index = 0): Y180OperationRow {
  const data = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
  const direction = textOf(data.loadDirection).trim();
  return {
    id: textOf(data.id).trim() || `op_${index + 1}`,
    blockSize: textOf(data.blockSize).trim(),
    autoclaveNum: textOf(data.autoclaveNum).trim(),
    loadDirection: (Y180_LOAD_DIRECTIONS as readonly string[]).includes(direction) ? (direction as Y180LoadDirection) : '',
    startedTime: toHHMM(textOf(data.startedTime).trim()),
    openedTime: toHHMM(textOf(data.openedTime).trim()),
    autoclaveCondition: textOf(data.autoclaveCondition),
    otherFactors: textOf(data.otherFactors),
    extraWork: textOf(data.extraWork),
    recordedBy: textOf(data.recordedBy),
  };
}

/** Хадгалсан мөрүүдийг хэлбэржүүлнэ (дүүргэхгүй). Давхардсан `id`-г ялгаатай болгоно. */
export function normalizeY180OperationRows(rows: unknown): Y180OperationRow[] {
  const list = Array.isArray(rows) ? rows : [];
  const seen = new Set<string>();
  return list.map((row, index) => {
    const coerced = coerceY180OperationRow(row, index);
    if (seen.has(coerced.id)) coerced.id = `${coerced.id}_${index + 1}`;
    seen.add(coerced.id);
    return coerced;
  });
}

/**
 * Мөрөнд хэрэглэгч ямар нэг зүйл бөглөсөн эсэх. Анхдагч «хэвийн» / «байхгүй» болон
 * бүртгэгчийн нэрийг тооцохгүй — хоосон нэмсэн мөр хадгалагдахгүй.
 */
export function y180OperationRowHasData(row: Y180OperationRow): boolean {
  const changed = (value: string, fallback: string) => Boolean(value.trim()) && value.trim() !== fallback;
  return Boolean(
    row.blockSize.trim() ||
      row.autoclaveNum.trim() ||
      row.loadDirection ||
      row.startedTime.trim() ||
      row.openedTime.trim() ||
      row.extraWork.trim() ||
      changed(row.autoclaveCondition, Y180_DEFAULT_CONDITION) ||
      changed(row.otherFactors, Y180_DEFAULT_OTHER_FACTORS)
  );
}

export interface Y180AutoclaveOperatorPayload {
  /** 1 = хуучин цагийн хүснэгт (`timeRows`), 2 = ажилбарын мөрүүд (`operationRows`). */
  formVersion: 1 | 2;
  stationCode: 'ҮЯ-180';
  shiftDate: string;
  shiftType: string;
  operationRows: Y180OperationRow[];
  /** Хуучин загварын цагийн хүснэгт — зөвхөн өмнө хадгалсан бүртгэлд байна, засварлахад хэвээр үлдэнэ. */
  timeRows: Y180TimeRow[];
  equipmentInspections: Y180EquipmentRow[];
  notes: string;
  sigHandingOver: string;
  sigReceiving: string;
  sigShiftMaster: string;
  submittedAt: string;
  operatorUid: string;
  operatorName: string;
  /** Байгаль орчны хяналт — бүх станцын маягтад нийтлэг хэсэг. */
  environmentChecks: EnvironmentCheckRow[];
}

export function emptyY180TimeRow(time: string): Y180TimeRow {
  return {
    time,
    furnacePressure: '',
    steamLinePressure: '',
    autoclaves: Array.from({ length: Y180_AUTOCLAVE_COUNT }, () => emptyAutoclaveData()),
    totalProductOut: '',
    totalProductIn: '',
  };
}

function coerceAutoclaveData(data: unknown): Y180AutoclaveData {
  const row = data && typeof data === 'object' ? (data as Partial<Y180AutoclaveData>) : {};
  const empty = emptyAutoclaveData();
  return {
    startTime: typeof row.startTime === 'string' ? row.startTime : empty.startTime,
    startRoller: typeof row.startRoller === 'string' ? row.startRoller : empty.startRoller,
    stopTime: typeof row.stopTime === 'string' ? row.stopTime : empty.stopTime,
    stopRoller: typeof row.stopRoller === 'string' ? row.stopRoller : empty.stopRoller,
    outTrack1: typeof row.outTrack1 === 'string' ? row.outTrack1 : empty.outTrack1,
    outTrack2: typeof row.outTrack2 === 'string' ? row.outTrack2 : empty.outTrack2,
    inTrack3: typeof row.inTrack3 === 'string' ? row.inTrack3 : empty.inTrack3,
    inTrack4: typeof row.inTrack4 === 'string' ? row.inTrack4 : empty.inTrack4,
  };
}

export function coerceY180TimeRow(row: unknown, fallbackTime = ''): Y180TimeRow {
  const data = row && typeof row === 'object' ? (row as Partial<Y180TimeRow>) : {};
  const autoclaves = Array.isArray(data.autoclaves) ? data.autoclaves : [];
  return {
    time: typeof data.time === 'string' ? data.time : fallbackTime,
    furnacePressure: typeof data.furnacePressure === 'string' ? data.furnacePressure : '',
    steamLinePressure: typeof data.steamLinePressure === 'string' ? data.steamLinePressure : '',
    autoclaves: Array.from({ length: Y180_AUTOCLAVE_COUNT }, (_, index) => coerceAutoclaveData(autoclaves[index])),
    totalProductOut: typeof data.totalProductOut === 'string' ? data.totalProductOut : '',
    totalProductIn: typeof data.totalProductIn === 'string' ? data.totalProductIn : '',
  };
}

export function mergeY180TimeRows(rows: unknown): Y180TimeRow[] {
  const savedRows = Array.isArray(rows) ? rows : [];
  const rowCount = Math.max(Y180_DEFAULT_TIME_ROW_COUNT, savedRows.length);
  return Array.from({ length: rowCount }, (_, index) => {
    const savedRow = savedRows[index];
    return savedRow ? coerceY180TimeRow(savedRow) : emptyY180TimeRow('');
  });
}

export function y180TimeRowHasData(row: unknown): boolean {
  const r = coerceY180TimeRow(row);
  return Boolean(
    r.time.trim() ||
      r.furnacePressure.trim() ||
      r.steamLinePressure.trim() ||
      r.totalProductOut.trim() ||
      r.totalProductIn.trim() ||
      r.autoclaves.some((ac) => Object.values(ac).some((value) => value.trim()))
  );
}

/** Хуучин (formVersion 1) бүртгэлд бөглөсөн цагийн мөр байгаа эсэх. */
export function y180HasLegacyTimeData(rows: unknown): boolean {
  return Array.isArray(rows) && rows.some(y180TimeRowHasData);
}

export function mergeY180EquipmentRows(rows: unknown): Y180EquipmentRow[] {
  const savedRows = Array.isArray(rows) ? rows : [];
  const savedByKey = new Map(
    savedRows
      .filter((row): row is Partial<Y180EquipmentRow> => Boolean(row && typeof row === 'object'))
      .map((row) => [String(row.key ?? ''), row])
  );
  return Y180_EQUIPMENT_LABELS.map(({ key, label }) => {
    const saved = savedByKey.get(key);
    return {
      key,
      label,
      status: (saved?.status === 'normal' || saved?.status === 'abnormal' ? saved.status : '') as Y180NormStatus,
      comment: typeof saved?.comment === 'string' ? saved.comment : '',
    };
  });
}

/** HH:mm string-ээс ISO datetime руу хөрвүүлэх */
export function toIsoDateTime(shiftDate: string, hhmm: string): string {
  if (!hhmm) return '';
  return `${shiftDate}T${hhmm.length === 5 ? hhmm + ':00' : hhmm}`;
}

/** ISO datetime-аас зөвхөн HH:mm авах (form UI-д ашиглах) */
export function toHHMM(isoOrHhmm: string): string {
  if (!isoOrHhmm) return '';
  if (isoOrHhmm.includes('T')) return isoOrHhmm.split('T')[1]?.slice(0, 5) ?? '';
  return isoOrHhmm.slice(0, 5);
}

export function createEmptyY180Payload(partial: {
  shiftDate: string;
  shiftType: string;
  operatorUid: string;
  operatorName: string;
}): Omit<Y180AutoclaveOperatorPayload, 'submittedAt'> & { submittedAt?: string } {
  return {
    environmentChecks: createEmptyEnvironmentChecks(),
    formVersion: 2,
    stationCode: 'ҮЯ-180',
    shiftDate: partial.shiftDate,
    shiftType: partial.shiftType,
    // `operationRows` нь `timeRows`-оос ӨМНӨ — Excel тайлан эхний мөрийн массивыг мөр мөрөөр задалдаг.
    operationRows: [],
    timeRows: [],
    equipmentInspections: Y180_EQUIPMENT_LABELS.map(({ key, label }) => ({
      key,
      label,
      status: '' as const,
      comment: '',
    })),
    notes: '',
    sigHandingOver: partial.operatorName,
    sigReceiving: '',
    sigShiftMaster: '',
    operatorUid: partial.operatorUid,
    operatorName: partial.operatorName,
  };
}
