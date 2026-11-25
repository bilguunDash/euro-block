import { prisma } from '@/lib/prisma';
import { createNotificationDeduped } from '@/lib/server-notifications';
import { writeServerAuditLog } from '@/lib/server-audit';
import { isoDateInTimeZone } from '@/lib/handover-window';

const CANCELLED = new Set(['Цуцлагдсан']);

function normDate(d: unknown): string {
  const s = String(d ?? '').trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : s.slice(0, 10);
}
function normType(t: unknown): string {
  return String(t ?? '')
    .trim()
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ');
}
function normStation(c: unknown): string {
  return String(c ?? '').trim();
}
function today(): string {
  return isoDateInTimeZone();
}

type ScheduleRowLike = { id: string; operatorUid: string; shiftDate: string; shiftType: string; stationCode: string };

function shapeRow(row: ScheduleRowLike) {
  return {
    id: String(row.id),
    shiftDate: normDate(row.shiftDate),
    shiftType: normType(row.shiftType),
    stationCode: normStation(row.stationCode),
  };
}

/** Тухайн хуваарийн слот дээр аль хэдийн (цуцлагдаагүй) Shift эхэлсэн эсэхийг шалгана. */
async function findStartedShiftId(row: ScheduleRowLike): Promise<string | null> {
  const shifts = await prisma.shift.findMany({
    where: {
      operatorUid: row.operatorUid,
      shiftDate: row.shiftDate,
      shiftType: row.shiftType,
      stationCode: row.stationCode,
    },
    select: { id: true, status: true },
    take: 10,
  });
  const hit = shifts.find((s) => !CANCELLED.has(String(s.status ?? '').trim()));
  return hit ? String(hit.id) : null;
}

/** Тухайн хуваарийн мөрөөр солилцох боломжтой (ижил станц) операторуудыг ирээдүйн мөрүүдтэй нь буцаана. */
export async function findSwapCandidates({ requesterUid, scheduleId }: { requesterUid: string; scheduleId: string }) {
  const requesterRow = await prisma.operatorSchedule.findUnique({ where: { id: scheduleId } });
  if (!requesterRow) return { ok: false as const, error: 'Хуваарийн мөр олдсонгүй.' };
  if (String(requesterRow.operatorUid) !== requesterUid) {
    return { ok: false as const, error: 'Зөвхөн өөрийн хуваарийг санал болгож болно.' };
  }

  const todayIso = today();
  if (normDate(requesterRow.shiftDate) < todayIso) {
    return { ok: false as const, error: 'Өнгөрсөн ээлжийг солилцох боломжгүй.' };
  }
  if (await findStartedShiftId(requesterRow as ScheduleRowLike)) {
    return { ok: false as const, error: 'Энэ ээлж эхэлсэн тул солилцох боломжгүй.' };
  }
  const requesterPending = await prisma.shiftSwapRequest.findFirst({
    where: { status: 'pending', OR: [{ requesterScheduleId: scheduleId }, { targetScheduleId: scheduleId }] },
    select: { id: true },
  });
  if (requesterPending) {
    return { ok: false as const, error: 'Энэ ээлжинд аль хэдийн хүлээгдэж буй хүсэлт бий.' };
  }

  const stationCode = normStation(requesterRow.stationCode);
  const rows = await prisma.operatorSchedule.findMany({
    where: { stationCode, operatorUid: { not: requesterUid }, shiftDate: { gte: todayIso } },
    orderBy: [{ shiftDate: 'asc' }, { shiftType: 'asc' }],
    take: 500,
  });

  if (rows.length === 0) {
    return { ok: true as const, requesterRow: shapeRow(requesterRow as ScheduleRowLike), candidates: [] as Array<{ uid: string; name: string; rows: any[] }> };
  }

  const uids = Array.from(new Set(rows.map((r) => String(r.operatorUid))));
  const users = await prisma.user.findMany({
    where: { id: { in: uids }, role: 'operator' },
    select: { id: true, name: true, email: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const rowIds = rows.map((r) => String(r.id));
  const pending = await prisma.shiftSwapRequest.findMany({
    where: {
      status: 'pending',
      OR: [{ requesterScheduleId: { in: rowIds } }, { targetScheduleId: { in: rowIds } }],
    },
    select: { requesterScheduleId: true, targetScheduleId: true },
  });
  const pendingRowIds = new Set<string>();
  for (const p of pending) {
    pendingRowIds.add(p.requesterScheduleId);
    pendingRowIds.add(p.targetScheduleId);
  }

  const startedShiftRows = await prisma.shift.findMany({
    where: { stationCode, shiftDate: { gte: todayIso }, operatorUid: { in: uids } },
    select: { operatorUid: true, shiftDate: true, shiftType: true, stationCode: true, status: true },
    take: 2000,
  });
  const startedKey = (o: string, d: string, t: string, c: string) => `${o}|${normDate(d)}|${normType(t)}|${normStation(c)}`;
  const startedSet = new Set(
    startedShiftRows
      .filter((s) => !CANCELLED.has(String(s.status ?? '').trim()))
      .map((s) => startedKey(String(s.operatorUid), s.shiftDate, s.shiftType, s.stationCode))
  );

  const byUser = new Map<string, { uid: string; name: string; rows: any[] }>();
  for (const r of rows) {
    const uid = String(r.operatorUid);
    const user = userById.get(uid);
    if (!user) continue; // role солигдсон/устгагдсан хэрэглэгч
    if (!byUser.has(uid)) byUser.set(uid, { uid, name: user.name || user.email || uid, rows: [] });
    const id = String(r.id);
    let blockedReason: 'already_pending' | 'shift_started' | null = null;
    if (pendingRowIds.has(id)) blockedReason = 'already_pending';
    else if (startedSet.has(startedKey(uid, r.shiftDate, r.shiftType, r.stationCode))) blockedReason = 'shift_started';
    byUser.get(uid)!.rows.push({
      id,
      shiftDate: normDate(r.shiftDate),
      shiftType: normType(r.shiftType),
      stationCode: normStation(r.stationCode),
      blocked: blockedReason !== null,
      blockedReason,
    });
  }

  return { ok: true as const, requesterRow: shapeRow(requesterRow as ScheduleRowLike), candidates: Array.from(byUser.values()) };
}

async function validateSwapCreate({
  requesterUid,
  requesterScheduleId,
  targetUid,
  targetScheduleId,
}: {
  requesterUid: string;
  requesterScheduleId: string;
  targetUid: string;
  targetScheduleId: string;
}) {
  if (requesterScheduleId === targetScheduleId) return { ok: false as const, error: 'Хүчингүй хүсэлт.' };

  const [requesterRow, targetRow] = await Promise.all([
    prisma.operatorSchedule.findUnique({ where: { id: requesterScheduleId } }),
    prisma.operatorSchedule.findUnique({ where: { id: targetScheduleId } }),
  ]);
  if (!requesterRow || !targetRow) return { ok: false as const, error: 'Хуваарийн мэдээлэл олдсонгүй.' };
  if (String(requesterRow.operatorUid) !== requesterUid) {
    return { ok: false as const, error: 'Зөвхөн өөрийн хуваарийг санал болгож болно.' };
  }
  if (String(targetRow.operatorUid) !== targetUid) {
    return { ok: false as const, error: 'Сонгосон хуваарь тухайн хүнд харьяалагдахгүй байна.' };
  }
  if (requesterUid === targetUid) return { ok: false as const, error: 'Өөртэйгөө солилцох боломжгүй.' };

  const [requesterUser, targetUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: requesterUid }, select: { role: true, name: true } }),
    prisma.user.findUnique({ where: { id: targetUid }, select: { role: true, name: true } }),
  ]);
  if (!requesterUser || requesterUser.role !== 'operator' || !targetUser || targetUser.role !== 'operator') {
    return { ok: false as const, error: 'Хоёр тал хоёулаа оператор байх ёстой.' };
  }

  if (normStation(requesterRow.stationCode) !== normStation(targetRow.stationCode)) {
    return { ok: false as const, error: 'Зөвхөн ижил дамжлагын хооронд солилцох боломжтой.' };
  }

  const todayIso = today();
  if (normDate(requesterRow.shiftDate) < todayIso || normDate(targetRow.shiftDate) < todayIso) {
    return { ok: false as const, error: 'Өнгөрсөн ээлжийг солилцох боломжгүй.' };
  }
  if (
    normDate(requesterRow.shiftDate) === normDate(targetRow.shiftDate) &&
    normType(requesterRow.shiftType) === normType(targetRow.shiftType)
  ) {
    return { ok: false as const, error: 'Ижил өдөр, ижил ээлжийг солилцох шаардлагагүй.' };
  }

  const [requesterStarted, targetStarted] = await Promise.all([
    findStartedShiftId(requesterRow as ScheduleRowLike),
    findStartedShiftId(targetRow as ScheduleRowLike),
  ]);
  if (requesterStarted || targetStarted) {
    return { ok: false as const, error: 'Ээлж эхэлсэн тул солилцох боломжгүй.' };
  }

  const existingPending = await prisma.shiftSwapRequest.findFirst({
    where: {
      status: 'pending',
      OR: [
        { requesterScheduleId: { in: [requesterScheduleId, targetScheduleId] } },
        { targetScheduleId: { in: [requesterScheduleId, targetScheduleId] } },
      ],
    },
    select: { id: true },
  });
  if (existingPending) {
    return { ok: false as const, error: 'Сонгосон хуваарийн аль нэг мөрт аль хэдийн хүлээгдэж буй хүсэлт бий.' };
  }

  return { ok: true as const, requesterRow, targetRow, requesterUser, targetUser };
}

export async function createSwapRequest({
  requesterUid,
  requesterScheduleId,
  targetUid,
  targetScheduleId,
  message,
}: {
  requesterUid: string;
  requesterScheduleId: string;
  targetUid: string;
  targetScheduleId: string;
  message?: string | null;
}) {
  const validation = await validateSwapCreate({ requesterUid, requesterScheduleId, targetUid, targetScheduleId });
  if (!validation.ok) return validation;
  const { requesterRow, targetRow, requesterUser, targetUser } = validation;
  const trimmedMessage = message ? String(message).trim().slice(0, 500) || null : null;

  const created = await prisma.shiftSwapRequest.create({
    data: {
      requesterScheduleId,
      requesterUid,
      requesterName: requesterUser.name || null,
      requesterShiftDate: normDate(requesterRow.shiftDate),
      requesterShiftType: normType(requesterRow.shiftType),
      requesterStationCode: normStation(requesterRow.stationCode),
      targetScheduleId,
      targetUid,
      targetName: targetUser.name || null,
      targetShiftDate: normDate(targetRow.shiftDate),
      targetShiftType: normType(targetRow.shiftType),
      targetStationCode: normStation(targetRow.stationCode),
      message: trimmedMessage,
    },
  });

  await createNotificationDeduped(
    {
      userId: targetUid,
      kind: 'shift_swap_requested',
      dedupeKey: `shift_swap_requested:${created.id}`,
      title: 'Ээлж солилцох хүсэлт',
      body: `${requesterUser.name || 'Оператор'} танай ${created.targetShiftDate} (${created.targetShiftType}) ээлжийг өөрийн ${created.requesterShiftDate} (${created.requesterShiftType}) ээлжтэй солихыг хүсэж байна.`,
      link: '/dashboard',
    },
    { windowMinutes: 60 }
  );

  await writeServerAuditLog({
    actorUid: requesterUid,
    actorName: requesterUser.name || null,
    action: 'shift_swap_requested',
    entityType: 'shift_swap_request',
    entityId: String(created.id),
    details: JSON.stringify({ requesterScheduleId, targetScheduleId, targetUid }),
  });

  return { ok: true as const, id: String(created.id) };
}

export async function listSwapRequests({ uid, box }: { uid: string; box: 'incoming' | 'outgoing' }) {
  const where = box === 'incoming' ? { targetUid: uid } : { requesterUid: uid };
  const rows = await prisma.shiftSwapRequest.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
  const todayIso = today();
  return rows.map((r) => ({
    ...r,
    id: String(r.id),
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
    expired: r.status === 'pending' && (r.requesterShiftDate < todayIso || r.targetShiftDate < todayIso),
  }));
}

export async function acceptSwapRequest({ requestId, uid: actorUid, name: actorName, note }: { requestId: string; uid: string; name: string | null; note?: string | null }) {
  const request = await prisma.shiftSwapRequest.findUnique({ where: { id: requestId } });
  if (!request) return { ok: false as const, error: 'Хүсэлт олдсонгүй.' };
  if (request.status !== 'pending') return { ok: false as const, error: 'Хүсэлт аль хэдийн шийдвэрлэгдсэн.' };
  if (request.targetUid !== actorUid) return { ok: false as const, error: 'Танд энэ хүсэлтийг шийдвэрлэх эрх байхгүй.' };

  const [requesterRow, targetRow] = await Promise.all([
    prisma.operatorSchedule.findUnique({ where: { id: request.requesterScheduleId } }),
    prisma.operatorSchedule.findUnique({ where: { id: request.targetScheduleId } }),
  ]);
  if (!requesterRow || !targetRow) {
    return { ok: false as const, error: 'Хуваарийн мэдээлэл олдсонгүй. Магадгүй устгагдсан байна.' };
  }
  if (String(requesterRow.operatorUid) !== request.requesterUid || String(targetRow.operatorUid) !== request.targetUid) {
    return { ok: false as const, error: 'Хуваарийн мэдээлэл өөрчлөгдсөн тул баталгаажуулах боломжгүй.' };
  }

  const [requesterUser, targetUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: request.requesterUid }, select: { role: true, name: true } }),
    prisma.user.findUnique({ where: { id: request.targetUid }, select: { role: true, name: true } }),
  ]);
  if (!requesterUser || requesterUser.role !== 'operator' || !targetUser || targetUser.role !== 'operator') {
    return { ok: false as const, error: 'Хоёр тал хоёулаа оператор байх ёстой.' };
  }

  if (normStation(requesterRow.stationCode) !== normStation(targetRow.stationCode)) {
    return { ok: false as const, error: 'Дамжлага өөрчлөгдсөн тул баталгаажуулах боломжгүй.' };
  }

  const todayIso = today();
  if (normDate(requesterRow.shiftDate) < todayIso || normDate(targetRow.shiftDate) < todayIso) {
    return { ok: false as const, error: 'Хугацаа хэтэрсэн тул баталгаажуулах боломжгүй.' };
  }

  const [requesterStarted, targetStarted] = await Promise.all([
    findStartedShiftId(requesterRow as ScheduleRowLike),
    findStartedShiftId(targetRow as ScheduleRowLike),
  ]);
  if (requesterStarted || targetStarted) {
    return { ok: false as const, error: 'Ээлж эхэлсэн тул баталгаажуулах боломжгүй.' };
  }

  const [requesterConflict, targetConflict] = await Promise.all([
    prisma.operatorSchedule.findFirst({
      where: {
        operatorUid: request.requesterUid,
        shiftDate: targetRow.shiftDate,
        shiftType: targetRow.shiftType,
        id: { notIn: [requesterRow.id, targetRow.id] },
      },
      select: { id: true },
    }),
    prisma.operatorSchedule.findFirst({
      where: {
        operatorUid: request.targetUid,
        shiftDate: requesterRow.shiftDate,
        shiftType: requesterRow.shiftType,
        id: { notIn: [requesterRow.id, targetRow.id] },
      },
      select: { id: true },
    }),
  ]);
  if (requesterConflict || targetConflict) {
    return { ok: false as const, error: 'Солилцоо хийвэл давхар ээлж үүсэх тул баталгаажуулах боломжгүй.' };
  }

  const trimmedNote = note ? String(note).trim().slice(0, 500) || null : null;
  let cascadeRejectedIds: string[] = [];
  let cascadeUids: string[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      // Давхардлын шалгалтыг transaction дотор (tx-ээр) дахин хийнэ — өмнөх
      // (transaction-ийн гадна хийсэн) шалгалт хурдан UX-д зориулсан бөгөөд
      // хоёр өөр pending хүсэлт бараг зэрэг accept хийгдэх race-ийг барьж
      // чадахгүй. tx нь зөвхөн ЭНЭ commit хийгдсэн өгөгдлийг харах тул өмнөх
      // (аль хэдийн committed) зэрэгцээ swap байвал энд заавал илэрнэ.
      const [requesterConflictTx, targetConflictTx] = await Promise.all([
        tx.operatorSchedule.findFirst({
          where: {
            operatorUid: request.requesterUid,
            shiftDate: targetRow.shiftDate,
            shiftType: targetRow.shiftType,
            id: { notIn: [requesterRow.id, targetRow.id] },
          },
          select: { id: true },
        }),
        tx.operatorSchedule.findFirst({
          where: {
            operatorUid: request.targetUid,
            shiftDate: requesterRow.shiftDate,
            shiftType: requesterRow.shiftType,
            id: { notIn: [requesterRow.id, targetRow.id] },
          },
          select: { id: true },
        }),
      ]);
      if (requesterConflictTx || targetConflictTx) {
        throw new Error('SWAP_CONFLICT');
      }

      await tx.operatorSchedule.update({
        where: { id: requesterRow.id },
        data: { operatorUid: request.targetUid, operatorName: targetUser.name || null },
      });
      await tx.operatorSchedule.update({
        where: { id: targetRow.id },
        data: { operatorUid: request.requesterUid, operatorName: requesterUser.name || null },
      });

      // MasterSchedule-д operatorName талбар байхгүй тул зөвхөн operatorUid-г sync хийнэ.
      await tx.masterSchedule.updateMany({
        where: {
          shiftDate: requesterRow.shiftDate,
          shiftType: requesterRow.shiftType,
          stationCode: requesterRow.stationCode,
          operatorUid: request.requesterUid,
        },
        data: { operatorUid: request.targetUid },
      });
      await tx.masterSchedule.updateMany({
        where: {
          shiftDate: targetRow.shiftDate,
          shiftType: targetRow.shiftType,
          stationCode: targetRow.stationCode,
          operatorUid: request.targetUid,
        },
        data: { operatorUid: request.requesterUid },
      });

      const flip = await tx.shiftSwapRequest.updateMany({
        where: { id: request.id, status: 'pending' },
        data: {
          status: 'accepted',
          decisionNote: trimmedNote,
          decidedByUid: actorUid,
          decidedByName: actorName,
          decidedAt: new Date(),
        },
      });
      if (flip.count !== 1) throw new Error('CONCURRENT_DECISION');

      const others = await tx.shiftSwapRequest.findMany({
        where: {
          status: 'pending',
          id: { not: request.id },
          OR: [
            { requesterScheduleId: { in: [request.requesterScheduleId, request.targetScheduleId] } },
            { targetScheduleId: { in: [request.requesterScheduleId, request.targetScheduleId] } },
          ],
        },
      });
      if (others.length > 0) {
        await tx.shiftSwapRequest.updateMany({
          where: { id: { in: others.map((o) => o.id) } },
          data: {
            status: 'rejected',
            decisionNote: 'Автоматаар цуцлагдсан: холбогдох хуваарь өөр солилцоогоор баталгаажлаа.',
            decidedByUid: actorUid,
            decidedByName: actorName,
            decidedAt: new Date(),
          },
        });
      }
      cascadeRejectedIds = others.map((o) => String(o.id));
      cascadeUids = Array.from(new Set(others.flatMap((o) => [o.requesterUid, o.targetUid])));

      await tx.auditLog.create({
        data: {
          actorUid,
          actorName,
          action: 'shift_swap_accepted',
          entityType: 'shift_swap_request',
          entityId: request.id,
          details: JSON.stringify({
            requesterScheduleId: request.requesterScheduleId,
            targetScheduleId: request.targetScheduleId,
            before: { requesterUid: request.requesterUid, targetUid: request.targetUid },
            after: { requesterScheduleOperatorUid: request.targetUid, targetScheduleOperatorUid: request.requesterUid },
            cascadeRejected: cascadeRejectedIds,
          }),
        },
      });
    });
  } catch (e: any) {
    if (e?.message === 'CONCURRENT_DECISION') {
      return { ok: false as const, error: 'Хүсэлтийг өөр үйлдлээр зэрэг шийдвэрлэсэн тул дахин оролдоно уу.' };
    }
    if (e?.message === 'SWAP_CONFLICT') {
      return { ok: false as const, error: 'Солилцоо хийвэл давхар ээлж үүсэх тул баталгаажуулах боломжгүй.' };
    }
    throw e;
  }

  await createNotificationDeduped(
    {
      userId: request.requesterUid,
      kind: 'shift_swap_accepted',
      dedupeKey: `shift_swap_accepted:${request.id}`,
      title: 'Ээлж солилцох хүсэлт зөвшөөрөгдлөө',
      body: `${targetUser.name || 'Оператор'} таны ${request.requesterShiftDate} (${request.requesterShiftType}) ээлжийг ${request.targetShiftDate} (${request.targetShiftType})-тэй солихыг зөвшөөрлөө.`,
      link: '/dashboard',
    },
    { windowMinutes: 60 }
  );

  for (const uid of cascadeUids) {
    await createNotificationDeduped(
      {
        userId: uid,
        kind: 'shift_swap_rejected',
        dedupeKey: `shift_swap_auto_rejected:${uid}:${cascadeRejectedIds.join(',')}`,
        title: 'Ээлж солилцох хүсэлт цуцлагдлаа',
        body: 'Холбогдох хуваарийн мөр өөр солилцоогоор аль хэдийн баталгаажсан тул таны хүсэлт автоматаар цуцлагдлаа.',
        link: '/dashboard',
      },
      { windowMinutes: 60 }
    );
  }

  return { ok: true as const };
}

export async function rejectSwapRequest({ requestId, uid: actorUid, name: actorName, note }: { requestId: string; uid: string; name: string | null; note?: string | null }) {
  const request = await prisma.shiftSwapRequest.findUnique({ where: { id: requestId } });
  if (!request) return { ok: false as const, error: 'Хүсэлт олдсонгүй.' };
  if (request.targetUid !== actorUid) return { ok: false as const, error: 'Танд энэ хүсэлтийг татгалзах эрх байхгүй.' };

  const trimmedNote = note ? String(note).trim().slice(0, 500) || null : null;
  const updated = await prisma.shiftSwapRequest.updateMany({
    where: { id: requestId, status: 'pending' },
    data: { status: 'rejected', decisionNote: trimmedNote, decidedByUid: actorUid, decidedByName: actorName, decidedAt: new Date() },
  });
  if (updated.count !== 1) return { ok: false as const, error: 'Хүсэлт аль хэдийн шийдвэрлэгдсэн байна.' };

  await createNotificationDeduped(
    {
      userId: request.requesterUid,
      kind: 'shift_swap_rejected',
      dedupeKey: `shift_swap_rejected:${requestId}`,
      title: 'Ээлж солилцох хүсэлтийг татгалзлаа',
      body: `${actorName || 'Оператор'} таны ${request.requesterShiftDate} (${request.requesterShiftType}) ↔ ${request.targetShiftDate} (${request.targetShiftType}) солилцох хүсэлтийг татгалзлаа.`,
      link: '/dashboard',
    },
    { windowMinutes: 60 }
  );
  await writeServerAuditLog({
    actorUid,
    actorName,
    action: 'shift_swap_rejected',
    entityType: 'shift_swap_request',
    entityId: requestId,
    details: JSON.stringify({ note: trimmedNote }),
  });
  return { ok: true as const };
}

export async function cancelSwapRequest({ requestId, uid: actorUid, name: actorName, note }: { requestId: string; uid: string; name: string | null; note?: string | null }) {
  const request = await prisma.shiftSwapRequest.findUnique({ where: { id: requestId } });
  if (!request) return { ok: false as const, error: 'Хүсэлт олдсонгүй.' };
  if (request.requesterUid !== actorUid) return { ok: false as const, error: 'Танд энэ хүсэлтийг цуцлах эрх байхгүй.' };

  const trimmedNote = note ? String(note).trim().slice(0, 500) || null : null;
  const updated = await prisma.shiftSwapRequest.updateMany({
    where: { id: requestId, status: 'pending' },
    data: { status: 'cancelled', decisionNote: trimmedNote, decidedByUid: actorUid, decidedByName: actorName, decidedAt: new Date() },
  });
  if (updated.count !== 1) return { ok: false as const, error: 'Хүсэлт аль хэдийн шийдвэрлэгдсэн байна.' };

  await createNotificationDeduped(
    {
      userId: request.targetUid,
      kind: 'shift_swap_cancelled',
      dedupeKey: `shift_swap_cancelled:${requestId}`,
      title: 'Ээлж солилцох хүсэлт цуцлагдлаа',
      body: `${actorName || 'Оператор'} ${request.requesterShiftDate} (${request.requesterShiftType}) ↔ ${request.targetShiftDate} (${request.targetShiftType}) солилцох хүсэлтээ цуцаллаа.`,
      link: '/dashboard',
    },
    { windowMinutes: 60 }
  );
  await writeServerAuditLog({
    actorUid,
    actorName,
    action: 'shift_swap_cancelled',
    entityType: 'shift_swap_request',
    entityId: requestId,
    details: JSON.stringify({ note: trimmedNote }),
  });
  return { ok: true as const };
}
