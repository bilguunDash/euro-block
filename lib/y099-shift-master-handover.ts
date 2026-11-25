import { createEmptyEnvironmentChecks, type EnvironmentCheckRow } from './environment-check-form';

export type Y099ShiftType = 'Өдрийн' | 'Шөнийн';

export const Y099_STOP_SECTIONS = [
  'Цемент шахах насос',
  'Шохойн тээрэм',
  'Бөмбөлөгт тээрэм',
  'Цамхаг',
  'Хэвний эргэлт',
  'Зүсэх шугам',
  'Рам өргэгч',
  'Тэргэнцэр эргэлт',
  'Савлах',
  'Чанар шалгах',
  'Автоклав',
  'Технологийн зуух',
  'Агуулах, савлалт',
  'Тог тасалт',
  'Түүхий эд',
] as const;

/**
 * A sub-row under the left side (raw material) — e.g. Силос-1, Силос-2 …
 * leftValue is entered per sub-row.
 */
export type Y099LeftSubRow = {
  key: string;
  unit: string;   // e.g. "Силос-1", "Элжид"
  value: string;
};

/**
 * A sub-row under the right side (production) — e.g. Буфер зам-1 … 5
 * dirty/clean/milled/discarded entered per sub-row.
 */
export type Y099ProdSubRow = {
  key: string;
  unit: string;   // e.g. "Буфер зам-1"
  description: string; // e.g. "Цагаан бүтээгдэхүүн, рам/ш"
  dirty: string;
  clean: string;
  milled: string;
  discarded: string;
  /**
   * Дэд мөрийн тайлбар. Автоклавын блокт (мөр 6-8) автоклав бүр ӨӨРИЙН
   * тайлбартай — бусад мөрөнд тайлбар нь мөрийн түвшинд (`Y099MasterHandoverRow.comment`)
   * хэвээр. `hasPerSubRowComments()`-ыг үзнэ үү.
   */
  comment: string;
};

/**
 * Тайлбар нь дэд мөр (автоклав) бүрд тусдаа байх мөрүүд — Автоклавын блок (6-8).
 * Маягт ба зөвхөн-харах хувилбар хоёул үүнийг ашиглана (2 газарт давхардуулахгүй).
 *
 * ЭНЭ БЛОКТ `clean` талбар нь «Залгасан цаг» (HH:MM), `discarded` нь
 * «Бүтээгдэхүүний хэмжээ» утгыг хадгална — бусад мөрөнд «Цэвэр»/«Хаясан» тоо.
 */
export function hasPerSubRowComments(rowNo: number): boolean {
  return rowNo >= 6 && rowNo <= 8;
}

/**
 * «Залгасан цаг»-ийг `<input type="time">` уншиж чадах `HH:MM` болгож хөрвүүлнэ.
 *
 * Талбар нь өмнө нь чөлөөт текст байсан тул бодит бүртгэлд «21», «6.30», «05 15»,
 * «05;00», «24» гэх мэт олон хэлбэр хуримтлагдсан. `type="time"` нь `HH:MM` биш
 * утгыг ХООСОН харуулдаг тул хөрвүүлэхгүй бол дата алга болсон мэт харагдана.
 *
 * Таних боломжгүй утга (ж: «0)») дээр хоосон мөр буцаана — дуудагч тал
 * ийм үед ХУУЧИН утгыг устгалгүй хэвээр үлдээнэ.
 */
export function normalizeY099TimeValue(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2})(?:\s*[.,;:\s]\s*(\d{1,2}))?$/);
  if (!m) return '';
  let hour = Number(m[1]);
  const minute = m[2] === undefined ? 0 : Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '';
  if (hour === 24) hour = 0; // «24» = шөнө дунд
  if (hour > 23 || minute > 59) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export type Y099MasterHandoverRow = {
  key: string;
  no: number;

  // Left side — raw material label (spans all leftSubRows)
  leftLabel: string;
  leftSubRows: Y099LeftSubRow[];

  // Right side — production label (spans all prodSubRows)
  prodLabel: string;
  prodSubRows: Y099ProdSubRow[];

  // Comment spans the whole row
  comment: string;
};

export type Y099ShiftMasterHandoverPayload = {
  formVersion: number;
  stationCode: 'ҮЯ-099';
  shiftDate: string;       // YYYY-MM-DD
  shiftType: Y099ShiftType;
  masterUid: string;
  masterName: string;
  submittedAt?: string;    // ISO

  rows: Y099MasterHandoverRow[];
  
  hseInfo: string;
  equipmentInfo: string;
  workplaceInfo: string;
  nextShiftInfo: string;
  handedOverBy: string;
  handedOverByUid?: string;
  receivedBy: string;
  receivedByUid?: string;

  // New fields for the second table
  stopRemarks: string[];    // Array of 15 remarks for the 15 sections
  downtimeInfo: string;     // The large textarea for downtime
  additionalWork: string;   // The large textarea for additional work
  attendance: {
    present: string;        // 3 fields for attendance
    coming: string;
    arrived: string;
    absent: string;
    absentNames: string;
    onLeave: string;
    onLeaveNames: string;
    sick: string;
    sickNames: string;
    extra: string;
  };
  /** Байгаль орчны хяналт — бүх станцын маягтад нийтлэг хэсэг. */
  environmentChecks: EnvironmentCheckRow[];
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function emptyLeft(key: string, unit: string): Y099LeftSubRow {
  return { key, unit, value: '' };
}

function emptyProd(key: string, unit: string): Y099ProdSubRow {
  return { key, unit, description: '', dirty: '', clean: '', milled: '', discarded: '', comment: '' };
}

// ─── factory ──────────────────────────────────────────────────────────────────

export function createEmptyY099MasterHandoverPayload(args: {
  shiftDate: string;
  shiftType: Y099ShiftType;
  masterUid: string;
  masterName: string;
}): Y099ShiftMasterHandoverPayload {
  return {
    environmentChecks: createEmptyEnvironmentChecks(),
    formVersion: 2,
    stationCode: 'ҮЯ-099',
    shiftDate: args.shiftDate,
    shiftType: args.shiftType,
    masterUid: args.masterUid,
    masterName: args.masterName,
    submittedAt: '',
    rows: [
      // ── Row 1: Тээрэмдсэн шохой ────────────────────────────────────────────
      {
        key: 'r1',
        no: 1,
        leftLabel: 'Тээрэмдсэн шохой, тн',
        leftSubRows: [emptyLeft('r1-l1', 'Силос/цамхаг/')],
        prodLabel: 'Цутгалт',
        prodSubRows: [{ ...emptyProd('r1-p1', 'Ширхэг'), description: 'Цутгалт' }],
        comment: '',
      },

      // ── Row 2: Тээрэмдсэн гөлтгөнө ────────────────────────────────────────
      {
        key: 'r2',
        no: 2,
        leftLabel: 'Тээрэмдсэн гөлтгөнө, тн',
        leftSubRows: [emptyLeft('r2-l1', 'Силос/цамхаг/')],
        prodLabel: 'Зүсэлт',
        prodSubRows: [{ ...emptyProd('r2-p1', 'Ширхэг'), description: 'Зүсэлт' }],
        comment: '',
      },

      // ── Row 3: Тээрэмдсэн элс ──────────────────────────────────────────────
      {
        key: 'r3',
        no: 3,
        leftLabel: 'Тээрэмдсэн элс, тн',
        leftSubRows: [emptyLeft('r3-l1', 'Ээлжид')],
        prodLabel: 'Цагаан бүтээгдэхүүн, рам/ш',
        prodSubRows: [
          { ...emptyProd('r3-p1', 'Буфер зам-1'), description: 'Цагаан бүтээгдэхүүн, рам/ш' },
        ],
        comment: '',
      },

      // ── Row 4: Цементийн дамжлага ──────────────────────────────────────────
      {
        key: 'r4',
        no: 4,
        leftLabel: 'Цементийн дамжлага/ силос дүүргэлт, тн',
        leftSubRows: [
          emptyLeft('r4-l1', 'Силос-1'),
          emptyLeft('r4-l2', 'Силос-2'),
        ],
        prodLabel: 'Цагаан бүтээгдэхүүн, рам/ш',
        prodSubRows: [
          { ...emptyProd('r4-p2', 'Буфер зам-2'), description: 'Цагаан бүтээгдэхүүн, рам/ш' },
          { ...emptyProd('r4-p3', 'Буфер зам-3'), description: 'Ногоон бүтээгдэхүүн, рам/ш' },
        ],
        comment: '',
      },

      // ── Row 5: Цемент гадна силос ──────────────────────────────────────────
      {
        key: 'r5',
        no: 5,
        leftLabel: 'Цемент гадна силос дүүргэлт, тн',
        leftSubRows: [
          emptyLeft('r5-l1', 'Силос-1 /500тн/'),
          emptyLeft('r5-l2', 'Силос-2 /500тн/'),
          emptyLeft('r5-l3', 'Силос-3 /700тн/'),
        ],
        prodLabel: 'Ногоон бүтээгдэхүүн, рам/ш',
        prodSubRows: [
          { ...emptyProd('r5-p4', 'Буфер зам-4'), description: 'Ногоон бүтээгдэхүүн, рам/ш' },
          emptyProd('r5-p5', 'Буфер зам-5'),
        ],
        comment: '',
      },

      {
        key: 'r6',
        no: 6,
        leftLabel: 'Шинэ зутан,%',
        leftSubRows: [
          emptyLeft('r6-l1', 'Танк-1'),
          emptyLeft('r6-l2', 'Танк-2'),
        ],
        prodLabel: 'Ногоон бүтээгдэхүүн, рам/ш',
        prodSubRows: [
          { ...emptyProd('r6-p1', 'Автоклав-1'), description: 'Автоклав' },
          emptyProd('r6-p2', 'Автоклав-2'),
        ],
        comment: '',
      },
      {
        key: 'r7',
        no: 7,
        leftLabel: 'Буцах зутан,%',
        leftSubRows: [
          emptyLeft('r7-l1', 'Танк-1'),
          emptyLeft('r7-l2', 'Танк-2'),
        ],
        prodLabel: '',
        prodSubRows: [
          { ...emptyProd('r7-p3', 'Автоклав-3'), description: 'Автоклав' },
          emptyProd('r7-p4', 'Автоклав-4'),
        ],
        comment: '',
      },
      {
        key: 'r8',
        no: 8,
        leftLabel: 'Цамхагийн худаг,%',
        leftSubRows: [emptyLeft('r8-l1', '')],
        prodLabel: '',
        prodSubRows: [
          { ...emptyProd('r8-p5', 'Автоклав-5'), description: 'Автоклав' },
          emptyProd('r8-p6', 'Автоклав-6'),
          emptyProd('r8-p7', 'Автоклав-7'),
        ],
        comment: '',
      },
      {
        key: 'r9',
        no: 9,
        leftLabel: 'Зүсэх шугамын худаг,%',
        leftSubRows: [emptyLeft('r9-l1', '')],
        prodLabel: '',
        prodSubRows: [
          { ...emptyProd('r9-p6', ' Цагаан'), description: 'Рам/ш' },
        ],
        comment: '',
      },
      {
        key: 'r10',
        no: 10,
        leftLabel: 'Аваарийн худаг,%',
        leftSubRows: [emptyLeft('r10-l1', '')],
        prodLabel: '',
        prodSubRows: [
          { ...emptyProd('r10-p7', 'U-блок'), description: 'Метр' },
        ],
        comment: '',
      },
    ],
    hseInfo: '',
    equipmentInfo: '',
    workplaceInfo: '',
    nextShiftInfo: '',
    handedOverBy: args.masterName,
    handedOverByUid: args.masterUid,
    receivedBy: '',
    receivedByUid: '',
    stopRemarks: Array(15).fill(''),
    downtimeInfo: '',
    additionalWork: '',
    attendance: {
      present: '',
      coming: '',
      arrived: '',
      absent: '',
      absentNames: '',
      onLeave: '',
      onLeaveNames: '',
      sick: '',
      sickNames: '',
      extra: '',
    },
  };
}

// ─── merge helper (used by the form) ─────────────────────────────────────────

function mergeSubRows<T extends { key: string }>(defaults: T[], saved: unknown): T[] {
  const arr = Array.isArray(saved) ? (saved as any[]) : [];
  if (!arr.length) return defaults;
  const byKey = new Map<string, any>(arr.map((r) => [String(r?.key ?? ''), r]));
  return defaults.map((d) => {
    const s = byKey.get(d.key);
    return s && typeof s === 'object' ? { ...d, ...s } : d;
  });
}

/**
 * Хуучин бүртгэлийн нийцтэй байдал.
 *
 * Автоклавын блокт тайлбар өмнө нь МӨРИЙН түвшинд (`row.comment`) байсан бөгөөд
 * бодит бүртгэлүүдэд утга бичигдсэн байдаг. Тайлбарыг автоклав бүрд тусдаа
 * болгосон тул хуучин мөрийн тайлбарыг эхний дэд мөрөнд шилжүүлж, хэрэглэгчид
 * харагдахаар нь үлдээнэ (эс бөгөөс UI-аас алга болно).
 *
 * Дэд мөрүүдэд аль хэдийн тайлбар байвал хөндөхгүй — дахин дуудагдахад идемпотент.
 */
function carryLegacyRowComment(
  subRows: Y099ProdSubRow[],
  rowComment: string,
): Y099ProdSubRow[] {
  if (!rowComment.trim()) return subRows;
  if (subRows.some((s) => (s.comment || '').trim())) return subRows;
  return subRows.map((s, i) => (i === 0 ? { ...s, comment: rowComment } : s));
}

/**
 * «Залгасан цаг»-ийг `HH:MM` болгож жигдрүүлнэ (`<input type="time">`-д зориулж).
 * Таних боломжгүй хуучин утгыг ХЭВЭЭР үлдээнэ — устгахгүй.
 */
function normalizeAutoclaveTimes(subRows: Y099ProdSubRow[]): Y099ProdSubRow[] {
  return subRows.map((s) => {
    const normalized = normalizeY099TimeValue(s.clean);
    if (!normalized || normalized === s.clean) return s;
    return { ...s, clean: normalized };
  });
}

export function mergeY099Payload(
  empty: Y099ShiftMasterHandoverPayload,
  saved: Partial<Y099ShiftMasterHandoverPayload> | null | undefined,
): Y099ShiftMasterHandoverPayload {
  if (!saved) return empty;
  const savedRows = Array.isArray((saved as any).rows) ? (saved as any).rows : [];
  const byKey = new Map<string, any>(savedRows.map((r: any) => [String(r?.key ?? ''), r]));

  const mergedStopRemarks = Array.isArray(saved.stopRemarks) 
    ? [...saved.stopRemarks] 
    : [...empty.stopRemarks];
  while (mergedStopRemarks.length < 15) mergedStopRemarks.push('');

  return {
    ...empty,
    ...saved,
    stationCode: 'ҮЯ-099',
    formVersion: 2,
    rows: empty.rows.map((def) => {
      const s = byKey.get(def.key);
      if (!s || typeof s !== 'object') return def;
      const comment = typeof s.comment === 'string' ? s.comment : def.comment;
      const prodSubRows = mergeSubRows(def.prodSubRows, s.prodSubRows);
      return {
        ...def,
        ...s,
        leftSubRows: mergeSubRows(def.leftSubRows, s.leftSubRows),
        prodSubRows: hasPerSubRowComments(def.no)
          ? normalizeAutoclaveTimes(carryLegacyRowComment(prodSubRows, comment))
          : prodSubRows,
        comment,
      };
    }),
    hseInfo: saved.hseInfo ?? empty.hseInfo,
    equipmentInfo: saved.equipmentInfo ?? empty.equipmentInfo,
    workplaceInfo: saved.workplaceInfo ?? empty.workplaceInfo,
    nextShiftInfo: saved.nextShiftInfo ?? empty.nextShiftInfo,
    handedOverBy: saved.handedOverBy ?? empty.handedOverBy,
    handedOverByUid: saved.handedOverByUid ?? empty.handedOverByUid,
    receivedBy: saved.receivedBy ?? empty.receivedBy,
    receivedByUid: saved.receivedByUid ?? empty.receivedByUid,
    stopRemarks: mergedStopRemarks,
    downtimeInfo: saved.downtimeInfo ?? empty.downtimeInfo,
    additionalWork: saved.additionalWork ?? empty.additionalWork,
    attendance: {
      ...empty.attendance,
      ...(saved.attendance || {}),
    },
  };
}

/**
 * Маягтын БҮТЦИЙН шалгалт — талбарууд ХООСОН БАЙЖ БОЛНО.
 *
 * Бүх талбарыг заавал бөглүүлэх шаардлага бодит хэрэглээнд саад болж байсныг
 * хэрэглэгч мэдээлсэн тул (мөр бүрийн «Тайлбар»-ыг өмнө нь чөлөөлсөнтэй адил)
 * «заавал бөглөх» бүх шалгалтыг авав. Одоо зөвхөн payload-ын бүтэц зөв эсэхийг
 * шалгана — дутуу бөглөсөн маягтыг ч хадгална.
 *
 * Энэ функцийг клиент (`Y099ShiftMasterHandoverForm`) ба сервер
 * (`app/api/shifts/[id]/logs/route.ts`) хоёул дууддаг тул хоёр талд зэрэг үйлчилнэ.
 *
 * `_skipReceivedBy` нь одоо ашиглагдахгүй ч дуудагчдын гарын үсэг эвдэрхгүйн
 * тулд үлдээв.
 */
export function validateY099ShiftMasterHandoverPayload(
  payload: Partial<Y099ShiftMasterHandoverPayload> | null | undefined,
  _skipReceivedBy?: boolean,
): string | null {
  if (!payload || !Array.isArray(payload.rows)) {
    return 'Маягтын өгөгдөл дутуу байна.';
  }

  return null;
}
