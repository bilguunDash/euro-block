// Хүлээлцэх хүсэлт нь одоо ХЭНД Ч очоогүй байгаа ээлжүүд — эзэн нь өөрөө илгээх ёстой.
//
// 1) «Илгээгээгүй»: «Ээлж дуусгах» товч ээлжийг зөвхөн дууссан гэж тэмдэглэнэ — мастерт юу ч
//    илгээдэггүй, ээлж нүүр хуудасны «Идэвхтэй»-гаас алга болно. Хүсэлтийг зөвхөн «Хүлээлцэх хүсэлт
//    илгээх» товч илгээнэ. Операторууд үүнийг андуурч, маягттай бүртгэл нь мастерт хүрэлгүй үлдэж
//    байсан (ҮЯ-180, 2026-11). Мастер өөрийн дамжлагын ээлж дээр мөн адил андуурдаг.
// 2) «Буцаагдсан»: мастер (эсвэл админ) буцаасан ээлж мөн нүүр хуудаснаас алга болдог; оператор
//    засаад ДАХИН илгээх хүртэл хэний ч жагсаалтад байхгүй.

const OPEN_STATUSES = new Set(['Хадгалсан', 'Ноорог']);
const CANCELLED_STATUSES = new Set(['Цуцлагдсан']);

/** Нүүр хуудсанд хэдэн хоногийн өмнөх хүртэлх илгээгээгүй ээлжийг сануулах вэ. */
export const UNSENT_HANDOVER_LOOKBACK_DAYS = 30;

export type HandoverShiftLike = {
  id?: unknown;
  shiftDate?: unknown;
  shiftType?: unknown;
  stationCode?: unknown;
  status?: unknown;
  createdAt?: unknown;
  checkOut?: unknown;
  operatorShiftCompleted?: unknown;
  handoverAwaitingAcceptance?: unknown;
  handoverRequestedAt?: unknown;
  handoverStage?: unknown;
  handoverFinalAcceptedAt?: unknown;
  handoverReturnReason?: unknown;
  masterApproved?: unknown;
  adminApproved?: unknown;
};

/** `unsent` — дууссан, хэзээ ч илгээгээгүй; `returned` — буцаагдсан, дахин илгээгээгүй. */
export type UnsentHandoverKind = 'unsent' | 'returned';

const text = (value: unknown) => (value instanceof Date ? value.toISOString() : String(value ?? '').trim());
const stageOf = (shift: HandoverShiftLike) => text(shift.handoverStage) || 'none';
const isApproved = (shift: HandoverShiftLike) =>
  Boolean(shift.masterApproved || shift.adminApproved || shift.handoverFinalAcceptedAt);

/** Ээлж дууссан, гэхдээ хүлээлцэх хүсэлт хэзээ ч илгээгдээгүй (мастер энэ бүртгэлийг харахгүй). */
export function isCompletedWithoutHandoverRequest(shift: HandoverShiftLike | null | undefined): boolean {
  if (!shift) return false;
  if (!OPEN_STATUSES.has(text(shift.status))) return false;
  if (!shift.operatorShiftCompleted && !shift.checkOut) return false;
  if (shift.handoverAwaitingAcceptance || shift.handoverRequestedAt) return false;
  if (stageOf(shift) !== 'none') return false;
  return !isApproved(shift);
}

/** Буцаагдсан, засаад дахин илгээгээгүй ээлж («Ээлж дуусгах»-ыг дахин дарсан эсэхээс үл хамаарна). */
export function isReturnedAwaitingResend(shift: HandoverShiftLike | null | undefined): boolean {
  if (!shift) return false;
  if (!OPEN_STATUSES.has(text(shift.status))) return false;
  if (stageOf(shift) !== 'returned') return false;
  if (shift.handoverAwaitingAcceptance) return false;
  return !isApproved(shift);
}

/** Эзэн нь хүсэлт илгээх ёстой ээлжийн төрөл; тийм биш бол `null`. */
export function unsentHandoverKind(shift: HandoverShiftLike | null | undefined): UnsentHandoverKind | null {
  if (isReturnedAwaitingResend(shift)) return 'returned';
  if (isCompletedWithoutHandoverRequest(shift)) return 'unsent';
  return null;
}

/**
 * Ээлжийн хуудасны анхааруулгын текст. Мастерын дамжлагын ээлжийг (`ҮЯ-099/181/310/400/410`) мастер
 * өөрөө ДАРААГИЙН МАСТЕРТ хүлээлгэн өгдөг тул үг нь өөр.
 */
export function unsentHandoverNotice(kind: UnsentHandoverKind, isMasterStation: boolean): { title: string; body: string } {
  if (kind === 'returned') {
    return {
      title: 'Буцаагдсан ээлжийг дахин илгээгээгүй байна',
      body: 'Бүртгэлээ засаад «Хүлээлцэх хүсэлт илгээх» товчийг дахин дарна уу. Дарах хүртэл энэ бүртгэл хэнд ч очихгүй.',
    };
  }
  return isMasterStation
    ? {
        title: 'Ээлж дууссан ч дараагийн мастерт хүсэлт илгээгээгүй байна',
        body: 'Дараагийн мастер энэ бүртгэлийг харахгүй. Дээрээс хүлээн авах мастераа сонгоод «Хүлээлцэх хүсэлт илгээх» товчийг дарна уу.',
      }
    : {
        title: 'Ээлж дууссан ч мастерт хүсэлт илгээгээгүй байна',
        body: 'Мастер энэ бүртгэлийг харахгүй. Дээрээс мастераа сонгоод «Хүлээлцэх хүсэлт илгээх» товчийг дарна уу.',
      };
}

/** «Ээлж дуусгах» дарсны дараах сануулга (хүсэлт хараахан илгээгээгүй үед). */
export function completedWithoutRequestWarning(isMasterStation: boolean): string {
  return `${isMasterStation ? 'Дараагийн мастерт' : 'Мастерт'} хүсэлт хараахан илгээгээгүй байна — «Хүлээлцэх хүсэлт илгээх» товчийг дарна уу.`;
}

/** Ижил огноо + ээлж + дамжлагын ӨӨР бүртгэл аль хэдийн цааш явсан эсэх (давхар бүртгэлийг таних). */
function wasSentForward(shift: HandoverShiftLike): boolean {
  if (CANCELLED_STATUSES.has(text(shift.status))) return false;
  if (unsentHandoverKind(shift)) return false; // буцаагдсан ээлж өөрөө «явсан»-д тооцогдохгүй
  return Boolean(shift.handoverRequestedAt || stageOf(shift) !== 'none' || isApproved(shift));
}

const slotKey = (shift: HandoverShiftLike) => `${text(shift.shiftDate)}|${text(shift.shiftType)}|${text(shift.stationCode)}`;

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type UnsentHandoverItem<T extends HandoverShiftLike> = {
  shift: T;
  kind: UnsentHandoverKind;
  /** Энэ ээлжийн өөр бүртгэл аль хэдийн цааш явсан — энэ нь давхар бүртгэл байх магадлалтай. */
  duplicateOfSent: boolean;
};

/**
 * Хэрэглэгчийн өөрийн ээлжүүдээс хүсэлт илгээх ёстой ээлжүүд — сүүлийн
 * `UNSENT_HANDOVER_LOOKBACK_DAYS` хоногийнх, шинэ нь эхэндээ.
 */
export function unsentCompletedShifts<T extends HandoverShiftLike>(
  shifts: readonly T[] | null | undefined,
  today: string,
): UnsentHandoverItem<T>[] {
  const rows = Array.isArray(shifts) ? shifts : [];
  const cutoff = addDays(today, -UNSENT_HANDOVER_LOOKBACK_DAYS);
  const sentSlots = new Set(rows.filter(wasSentForward).map(slotKey));
  const items: UnsentHandoverItem<T>[] = [];
  for (const shift of rows) {
    const kind = unsentHandoverKind(shift);
    if (!kind || text(shift.shiftDate) < cutoff) continue;
    items.push({ shift, kind, duplicateOfSent: sentSlots.has(slotKey(shift)) });
  }
  return items.sort((a, b) =>
    text(b.shift.shiftDate).localeCompare(text(a.shift.shiftDate)) ||
    text(b.shift.createdAt).localeCompare(text(a.shift.createdAt)),
  );
}
