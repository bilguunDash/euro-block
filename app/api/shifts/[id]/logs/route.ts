import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { writeServerAuditLog } from '@/lib/server-audit';
import { canAppendShiftLog, canReadShift, type SessionActor } from '@/lib/shift-api-permissions';


import { notifyManyDeduped } from '@/lib/server-notifications';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';
import { getPeriodicIntervalHours } from '@/lib/system-settings';
import { getPeriodicLogStatus, stationUsesPeriodicLogs } from '@/lib/shift-completeness';
import { ADMIN_APPROVAL_LOG_TYPES } from '@/lib/master-stations';
import { normalizeEnvironmentChecks } from '@/lib/environment-check-form';
import { PickedUserSelectionError, resolvePickedUserSelection } from '@/lib/picked-user';

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODAL_LOG_PREFIX = 'modal_';

/**
 * Маягтын өгөгдлийн БҮТЦИЙН шалгалт — талбарууд ХООСОН БАЙЖ БОЛНО.
 *
 * Урьд нь энд дамжлага тус бүрийн «заавал бөглөх» шалгалтууд байсан
 * (`handovers`, `equipment_checks`, `hse_checklist`, `cah02_*`, `y310_*`,
 * `y099_*`, `y181_*`). Хэрэглэгчийн хүсэлтээр бүх станцын маягтын талбарыг
 * заавал биш болгосон тул эдгээрийг ч авав — эс бөгөөс сервер 400 буцааж,
 * оператор яагаад хадгалагдахгүй байгааг ойлгохгүй байх байв.
 *
 * Үлдсэн шалгалт нь зөвхөн эвдэрсэн хүсэлтээс хамгаална (объект мөн эсэх,
 * огт хоосон биш эсэх) — талбарын агуулгыг шаардахгүй.
 */
function validateLogPayload(data: any): string | null {
  if (data == null || typeof data !== 'object') return 'Маягтын өгөгдөл буруу байна.';
  if (Object.keys(data).length === 0) return 'Маягтын өгөгдөл хоосон байна.';
  return null;
}

// Админы баталгаа/буцаалтыг зөвхөн PATCH /api/y310-approvals тавина. Маягт өмнөх
// хувилбарын data-г бүтнээр нь буцааж илгээдэг тул эдгээрийг энд хасахгүй бол дахин
// хадгалсан маягт админ хянаагүй атлаа өмнөх баталгааг өвлөж «баталгаажсан» болно.
const ADMIN_DECISION_KEYS = [
  'adminApproved', 'adminApprovedBy', 'adminApprovedAt',
  'adminRejected', 'adminRejectedBy', 'adminRejectedAt',
] as const;

function stripAdminDecision(data: Record<string, unknown>) {
  const rest = { ...data };
  for (const key of ADMIN_DECISION_KEYS) delete rest[key];
  return rest;
}

function sessionActor(session: any): SessionActor | null {
  if (!session?.user?.id) return null;
  return {
    id: String(session.user.id),
    role: String((session.user as any).role || 'operator'),
    stationCode: (session.user as any).stationCode ?? null,
    name: session.user.name ?? null,
  };
}

async function notifyY099ReceivingMaster(args: {
  shiftId: string;
  logId: string;
  actor: SessionActor;
  shift: {
    stationCode: string;
    shiftDate: string;
    shiftType: string;
    operatorName: string | null;
  };
  recipientId: string;
}) {
  const recipientId = args.recipientId;
  if (!recipientId) return;

  const actorName = args.actor.name || args.shift.operatorName || 'Ээлжийн мастер';
  const title = 'Ээлж хүлээн авах мэдэгдэл';
  const body =
    `${args.shift.stationCode} (${args.shift.shiftDate}, ${args.shift.shiftType}) — ` +
    `${actorName} таныг дараагийн ээлж хүлээн авах мастераар сонголоо.`;
  const link = `/shift/${args.shiftId}`;
  const dedupeKey = `y099_receiving_master:${args.shiftId}:${recipientId}:${args.logId}`;

  await notifyManyDeduped(
    [recipientId],
    { kind: 'y099_receiving_master', title, body, link, dedupeKey },
    { windowMinutes: 10 }
  );
}

async function notifyY310AdminApproval(args: {
  shiftId: string;
  logId: string;
  actor: SessionActor;
  shift: {
    stationCode: string;
    shiftDate: string;
    shiftType: string;
    operatorName: string | null;
    approvalAdminUid?: string | null;
  };
}) {
  // Ээлж дуусгагч «батлах админ» сонгосон бол зөвхөн түүнд мэдэгдэнэ — эс бол бүх
  // админд. (Сонголт нь чиглүүлэлт; батлах эрх бусад админд хэвээр байна.)
  const directedUid = String(args.shift.approvalAdminUid || '').trim();
  const admins = await prisma.user.findMany({
    where: directedUid
      ? { id: directedUid, isApproved: true }
      : { role: { in: ['admin', 'chief_engineer'] }, isApproved: true },
    select: { id: true },
  });
  const adminIds = admins.map((u) => u.id);
  if (!adminIds.length) return;

  const actorName = args.actor.name || args.shift.operatorName || 'Мастер';
  const stationLabel = args.shift.stationCode || 'Мастер';
  const title = `${stationLabel} бүртгэл баталгаажуулах хүсэлт`;
  const body =
    `${args.shift.shiftDate} ${args.shift.shiftType} — ${actorName} ээлж хүлээлцэх бүртгэлийг Admin баталгаажуулахыг хүсэж байна.`;
  const link = `/shift/${args.shiftId}`;
  const dedupeKey = `y310_admin_approval:${args.shiftId}:${args.logId}`;

  await notifyManyDeduped(
    adminIds,
    { kind: 'y310_admin_approval', title, body, link, dedupeKey },
    { windowMinutes: 60 }
  );
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const actor = sessionActor(session as any);
  if (!actor) return jsonError(401, 'Unauthorized');
  const deviceAccess = await getDeviceAccessForRequest(session, req);
  if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

  const { id } = await params;
  if (!UUID_RE.test(id)) return jsonError(400, 'Invalid id');
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON');
  }

  const type = String(body?.type || '').trim();
  const data = body?.data;
  const editIdRaw = body?.editId;
  const editId = typeof editIdRaw === 'string' ? editIdRaw.trim() : '';
  const mode = (String(body?.mode || 'submit').trim().toLowerCase() === 'draft' ? 'draft' : 'submit') as
    | 'draft'
    | 'submit';
  if (!type) return jsonError(400, 'Missing type');

  const logType = type.startsWith(MODAL_LOG_PREFIX) ? type : `${MODAL_LOG_PREFIX}${type}`;
  const vErr = validateLogPayload(data);
  if (vErr) return jsonError(400, vErr);

  try {
    const shift = await prisma.shift.findUnique({
      where: { id },
      select: {
        operatorUid: true,
        stationCode: true,
        handoverToOperatorUid: true,
        shiftMasterUid: true,
        shiftDate: true,
        shiftType: true,
        operatorName: true,
        checkIn: true,
        approvalAdminUid: true,
      },
    });
    if (!shift) return jsonError(404, 'Not found');

    if (
      !canReadShift(
        {
          operatorUid: shift.operatorUid,
          stationCode: shift.stationCode,
          handoverToOperatorUid: shift.handoverToOperatorUid ?? null,
        },
        actor
      )
    ) {
      return jsonError(403, 'Forbidden');
    }

    if (!canAppendShiftLog(actor, shift.operatorUid)) {
      return jsonError(403, 'Бүртгэл нэмэх эрхгүй');
    }

    const isPeriodic = String(logType).toLowerCase() === 'modal_periodic_logs';
    let dataToSave = data ?? {};
    if (isPeriodic) {
      if (!stationUsesPeriodicLogs(shift.stationCode)) {
        return jsonError(400, 'Тогтмол бүртгэл зөвхөн ээлжийн мастер / процессын дамжлагад хамаарна.');
      }
      const periodicIntervalHours = await getPeriodicIntervalHours();
      const existingLogs = await prisma.productionLog.findMany({
        where: {
          shiftId: id,
          logType: 'modal_periodic_logs',
          ...(editId && UUID_RE.test(editId) ? { id: { not: editId } } : {}),
        },
        select: { id: true, createdAt: true, data: true },
        orderBy: { sortOrder: 'asc' },
      });
      const periodicStatus = getPeriodicLogStatus({
        stationCode: shift.stationCode,
        checkInIso: shift.checkIn,
        periodicIntervalHours,
        periodicLogs: existingLogs.map((log: any) => ({
          id: log.id,
          createdAt: log.createdAt,
          ...((log.data as Record<string, unknown> | null) || {}),
        })),
      });
      const nowIso = new Date().toISOString();
      dataToSave = {
        ...(data ?? {}),
        periodicIntervalHours,
        slotDeadlineMs: periodicStatus.nextDeadlineMs,
        isLate:
          mode === 'submit' &&
          periodicStatus.nextDeadlineMs !== null &&
          Date.now() > periodicStatus.nextDeadlineMs,
        ...(mode === 'submit' ? { submittedAt: data?.submittedAt || nowIso } : { draftSavedAt: data?.draftSavedAt || nowIso }),
      };
    }

    // Байгаль орчны хяналт нь БҮХ станцын маягтад нийтлэг. Цэвэрлэгээг маягт бүрд
    // давтахын оронд энд НЭГ л удаа хийнэ: бөглөөгүй нэмэлт мөрийг хаяж, стандарт
    // 3 мөрийг нэргүй үлдээхгүй (Excel тайланд багана болж чаддаггүй).
    if (dataToSave && typeof dataToSave === 'object' && 'environmentChecks' in dataToSave) {
      dataToSave = {
        ...dataToSave,
        environmentChecks: normalizeEnvironmentChecks((dataToSave as any).environmentChecks),
      };
    }

    dataToSave = stripAdminDecision(dataToSave);

    // Resolve before writing: an ambiguous recipient must not save a log or notify anyone.
    let y099RecipientId = '';
    if (String(logType).toLowerCase() === 'modal_y099_master_handover_v1') {
      const recipient = await resolvePickedUserSelection({
        uid: dataToSave.receivedByUid, label: dataToSave.receivedBy, roles: ['master'],
      });
      if ((dataToSave.receivedByUid || dataToSave.receivedBy) && !recipient) {
        return jsonError(400, 'Сонгосон хүлээн авах мастер олдсонгүй эсвэл идэвхгүй байна.');
      }
      if (recipient) {
        y099RecipientId = recipient.id;
        dataToSave = { ...dataToSave, receivedByUid: recipient.id, receivedBy: recipient.name || '' };
      }
    }

    const needsAdmin = (dataToSave as any)?.needsAdminApproval === true;
    const lt = String(logType).toLowerCase();
    const isAdminApprovalType = (ADMIN_APPROVAL_LOG_TYPES as readonly string[]).includes(lt);

    // Админ баталгаажуулах маягт нь ээлж тутамд НЭГ бичлэг. Клиент editId дамжуулдаггүй тул
    // дахин хадгалахад хамгийн сүүлийн мөрийг шинэчилнэ — эс бөгөөс хадгалалт бүр шинэ
    // pending мөр үүсгэж, хуучин хувилбарууд «Мастер» табад үүрд pending үлддэг байв.
    let targetEditId = editId && UUID_RE.test(editId) ? editId : '';
    if (!targetEditId && isAdminApprovalType) {
      const latest = await prisma.productionLog.findFirst({
        where: { shiftId: id, logType },
        orderBy: { sortOrder: 'desc' },
        select: { id: true },
      });
      if (latest) targetEditId = latest.id;
    }

    if (targetEditId) {
      const updated = await prisma.productionLog.updateMany({
        where: { id: targetEditId, shiftId: id, logType },
        data: { data: dataToSave },
      });
      if (updated.count !== 1) return jsonError(404, 'Not found');

      await writeServerAuditLog({
        actorUid: actor.id,
        actorName: actor.name ?? null,
        action: 'shift_log_updated',
        entityType: 'production_log',
        entityId: targetEditId,
        details: logType,
      });

      if (mode === 'submit' && lt === 'modal_y099_master_handover_v1') {
        await notifyY099ReceivingMaster({
          shiftId: id,
          logId: targetEditId,
          actor,
          shift,
          recipientId: y099RecipientId,
        });
      }

      // Шинэчилсэн маягт admin баталгаагүй болсон (stripAdminDecision) тул дахин хүлээгдэнэ.
      if (mode === 'submit' && needsAdmin && isAdminApprovalType) {
        await notifyY310AdminApproval({ shiftId: id, logId: targetEditId, actor, shift });
      }

      return NextResponse.json({ ok: true, id: targetEditId, updated: true });
    }

    const last = await prisma.productionLog.findFirst({
      where: { shiftId: id, logType },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const sortOrder = (last?.sortOrder ?? -1) + 1;

    const log = await prisma.productionLog.create({
      data: {
        shiftId: id,
        logType,
        sortOrder,
        data: dataToSave,
      },
      select: { id: true, createdAt: true },
    });

    await writeServerAuditLog({
      actorUid: actor.id,
      actorName: actor.name ?? null,
      action: 'shift_log_created',
      entityType: 'production_log',
      entityId: log.id,
      details: logType,
    });

    if (mode === 'submit' && String(logType).toLowerCase() === 'modal_y099_master_handover_v1') {
      await notifyY099ReceivingMaster({
        shiftId: id,
        logId: log.id,
        actor,
        shift,
        recipientId: y099RecipientId,
      });
    }

    if (mode === 'submit' && needsAdmin && isAdminApprovalType) {
      await notifyY310AdminApproval({ shiftId: id, logId: log.id, actor, shift });
    }

     return NextResponse.json({ ok: true, id: log.id });
  } catch (e) {
    if (e instanceof PickedUserSelectionError) return jsonError(400, e.message);
    console.error('POST /api/shifts/[id]/logs', e);
    return jsonError(500, 'Database error');
  }
}
