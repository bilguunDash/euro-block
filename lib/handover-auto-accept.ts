// Дараагийн оператор «Хүлээн авах» товчийг дараагүй ч тухайн дамжлагад ӨӨРИЙН ээлжээ эхлүүлсэн бол
// түүнд хүлээлгэн өгсөн өмнөх ээлжүүдийг хүлээн авсанд тооцно.
//
// Яагаад: мастер баталсны дараа ээлж `waiting_next_operator` шатанд дараагийн операторыг хүлээдэг.
// Хүлээлцэх бүрэн дуусаагүй ээлж админы баталгаажуулалтад очдоггүй. Операторууд товчийг дардаггүй
// байсан тул PC-2 дээр 60 хоногт 105 ээлж гацсан (2026-11); 59-д нь дараагийн оператор тэр
// дамжлагад өөрийн ээлжээ бүртгэсэн байв. «Хүлээн авах» / «Буцаах» товч хэвээр ажиллана — ээлжээ
// эхлүүлэхээс өмнө буцаасан ээлж энд хамаарахгүй.

import type { Prisma } from '../generated/prisma/client';

/** Хүлээн авсан хүний нэрийн ард залгана — гарын үсгийн талбарт өөрөө дарсантай андуурахгүй. */
export const AUTO_ACCEPT_NAME_SUFFIX = ' (автоматаар)';
export const AUTO_ACCEPT_COMMENT =
  'Автоматаар хүлээн авсан: дараагийн оператор энэ дамжлагад ээлжээ эхлүүлсэн.';
export const AUTO_ACCEPT_STAGE = 'waiting_next_operator';

const OPEN_STATUSES = ['Хадгалсан', 'Ноорог'];
const MAX_AUTO_ACCEPT = 200;

type ShiftSlot = { shiftDate: unknown; shiftType: unknown };

export type StartedShift = {
  id?: string;
  operatorUid: string;
  operatorName: string | null;
  stationCode: string;
  shiftDate: string;
  shiftType: string;
};

const PENDING_SELECT = {
  id: true, operatorUid: true, operatorName: true, shiftMasterUid: true, stationCode: true,
  shiftDate: true, shiftType: true, status: true, adminApproved: true, masterApproved: true,
  handoverStage: true, handoverAwaitingAcceptance: true, nextOperatorUid: true,
  currentMasterApprovedAt: true, currentMasterApprovedByName: true, currentMasterName: true,
} as const satisfies Prisma.ShiftSelect;

export type PendingHandover = Prisma.ShiftGetPayload<{ select: typeof PENDING_SELECT }>;

const text = (value: unknown) => String(value ?? '').trim();

function shiftTypeOrder(value: unknown) {
  const type = text(value).toLowerCase();
  if (type.includes('өдр')) return 1;
  if (type.includes('шөн')) return 2;
  return 99;
}

/** Ээлжийн дараалал: огноо, дараа нь Өдрийн < Шөнийн. Сөрөг = `a` нь `b`-ээс өмнө. */
export function compareShiftSlots(a: ShiftSlot, b: ShiftSlot): number {
  const byDate = text(a.shiftDate).slice(0, 10).localeCompare(text(b.shiftDate).slice(0, 10));
  return byDate !== 0 ? byDate : shiftTypeOrder(a.shiftType) - shiftTypeOrder(b.shiftType);
}

/** `prev`-ийг `started` ээлжийг эхлүүлсэн оператор хүлээн авсанд тооцож болох эсэх. */
export function isAutoAcceptable(prev: PendingHandover, started: StartedShift): boolean {
  const operatorUid = text(started.operatorUid);
  if (!operatorUid) return false;
  if (text(prev.handoverStage) !== AUTO_ACCEPT_STAGE || prev.handoverAwaitingAcceptance !== true) return false;
  if (!OPEN_STATUSES.includes(text(prev.status)) || prev.adminApproved) return false;
  if (text(prev.nextOperatorUid) !== operatorUid) return false; // зөвхөн өөрт нь хүлээлгэн өгсөн ээлж
  if (text(prev.operatorUid) === operatorUid) return false;
  if (text(prev.stationCode) !== text(started.stationCode)) return false;
  return compareShiftSlots(prev, started) < 0; // зөвхөн шинэ ээлжээс ӨМНӨХ ээлж
}

/**
 * `waiting_next_operator` → `accepted` шилжилт. `app/api/shifts/[id]/route.ts` PATCH-ийн ижил
 * салбартай адил талбаруудыг тавина (мастерын баталгааг энд түгжинэ — CLAUDE.md).
 */
export function autoAcceptData(
  prev: PendingHandover,
  actor: { id: string; name: string | null },
  now: string,
): Prisma.ShiftUpdateManyMutationInput {
  const data: Prisma.ShiftUpdateManyMutationInput = {
    handoverStage: 'accepted',
    handoverAwaitingAcceptance: false,
    handoverAcceptedByUid: actor.id,
    handoverAcceptedByName: `${text(actor.name) || actor.id}${AUTO_ACCEPT_NAME_SUFFIX}`,
    handoverAcceptedAt: now,
    handoverFinalAcceptedAt: now,
  };
  if (prev.masterApproved !== true && prev.currentMasterApprovedAt) {
    data.masterApproved = true;
    data.masterApprovedBy = prev.currentMasterApprovedByName ?? prev.currentMasterName ?? null;
    data.masterApprovedDate = prev.currentMasterApprovedAt;
  }
  return data;
}

/** Ээлж эхлүүлсэн операторт харуулах мэдэгдэл; хүлээн авсан ээлж байхгүй бол ''. */
export function autoAcceptedMessage(
  accepted: ReadonlyArray<{ shiftDate?: unknown; shiftType?: unknown; operatorName?: unknown }> | null | undefined,
): string {
  const rows = Array.isArray(accepted) ? accepted : [];
  if (rows.length === 0) return '';
  if (rows.length === 1) {
    const [row] = rows;
    const from = text(row.operatorName);
    return `Өмнөх ээлжийг (${text(row.shiftDate)} ${text(row.shiftType)}${from ? `, ${from}` : ''}) хүлээн авсанд тооцлоо.`;
  }
  const dates = rows.map((row) => text(row.shiftDate)).sort();
  return `Танд хүлээлгэн өгсөн өмнөх ${rows.length} ээлжийг (${dates[0]} – ${dates[dates.length - 1]}) хүлээн авсанд тооцлоо.`;
}

/** Prisma client эсвэл transaction client. */
export type AutoAcceptDb = Pick<Prisma.TransactionClient, 'shift' | 'shiftHandoverApproval'>;

/**
 * `started` ээлжийг эхлүүлсэн операторт хүлээлгэн өгсөн, тухайн дамжлагын өмнөх ээлжүүдийг хүлээн
 * авсанд тооцно. Хүлээн авсан ээлжүүдийг буцаана (мэдэгдэл / аудитыг дуудагч бичнэ).
 */
export async function autoAcceptHandoversOnShiftStart(
  db: AutoAcceptDb,
  started: StartedShift,
  now: string = new Date().toISOString(),
): Promise<PendingHandover[]> {
  const operatorUid = text(started.operatorUid);
  if (!operatorUid) return [];

  const candidates = await db.shift.findMany({
    where: {
      stationCode: started.stationCode,
      handoverStage: AUTO_ACCEPT_STAGE,
      handoverAwaitingAcceptance: true,
      nextOperatorUid: operatorUid,
      operatorUid: { not: operatorUid },
      status: { in: [...OPEN_STATUSES] },
      adminApproved: false,
    },
    select: PENDING_SELECT,
    orderBy: [{ shiftDate: 'asc' }, { createdAt: 'asc' }],
    take: MAX_AUTO_ACCEPT,
  });

  const actor = { id: operatorUid, name: started.operatorName };
  const accepted: PendingHandover[] = [];
  for (const prev of candidates) {
    if (!isAutoAcceptable(prev, started)) continue;
    // Уншсаны дараа хэн нэгэн хүлээн авсан / буцаасан бол дарж бичихгүй.
    const res = await db.shift.updateMany({
      where: { id: prev.id, handoverStage: AUTO_ACCEPT_STAGE, handoverAwaitingAcceptance: true },
      data: autoAcceptData(prev, actor, now),
    });
    if (res.count !== 1) continue;
    await db.shiftHandoverApproval.create({
      data: {
        shiftId: prev.id,
        stage: AUTO_ACCEPT_STAGE,
        action: 'accepted',
        actorUid: actor.id,
        actorName: actor.name ?? null,
        comment: AUTO_ACCEPT_COMMENT,
      },
    });
    accepted.push(prev);
  }
  return accepted;
}
