import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { reconstructPayload, STATION_NAME_BY_CODE } from '@/lib/shift-db';
import { writeServerAuditLog } from '@/lib/server-audit';
import { createNotificationDeduped, notifyManyDeduped } from '@/lib/server-notifications';
import {
  buildAuthorizedPatchData,
  canReadShift,
  type SessionActor,
} from '@/lib/shift-api-permissions';
import {
  getHandoverTimingStatus,
  getPeriodicIntervalHours,
  isHandoverWindowStrict,
} from '@/lib/system-settings';
import { getPeriodicLogStatus } from '@/lib/shift-completeness';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';
import { resolveNextMasterScheduleForShift } from '@/lib/master-handover';
import {
  normalizeStationCode,
  resolveNextOperatorSchedule,
} from '@/lib/operator-schedule-resolver';
import { resolveCrewMasterForShift } from '@/lib/crew-master';
import { PickedUserSelectionError, resolvePickedUserSelection } from '@/lib/picked-user';

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function resolvePickedUser(uid: unknown, label: unknown, role: 'master' | 'operator') {
  return resolvePickedUserSelection({ uid, label, roles: [role] });
}

/** Эцсийн баталгаажуулалт хийх эрхтэй хүн (admin эсвэл chief_engineer). */
async function resolvePickedApprovalAdmin(uid: unknown, label: unknown) {
  return resolvePickedUserSelection({ uid, label, roles: ['admin', 'chief_engineer'] });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODAL_LOG_PREFIX = 'modal_';
const HANDOVER_REQUEST_STAGES = ['', 'none', 'returned'];

function sessionActor(session: any): SessionActor | null {
  if (!session?.user?.id) return null;
  return {
    id: String(session.user.id),
    role: String((session.user as any).role || 'operator'),
    stationCode: (session.user as any).stationCode ?? null,
    name: session.user.name ?? null,
  };
}

async function notifyHandoverPending(shift: {
  id: string;
  stationCode: string;
  shiftType: string;
  shiftDate: string;
  operatorName: string;
  handoverToOperatorUid: string | null;
  shiftMasterUid: string | null;
  handoverStage?: string | null;
  currentMasterUid?: string | null;
  nextMasterUid?: string | null;
  nextOperatorUid?: string | null;
}) {
  const link = `/shift/${shift.id}`;
  const title = 'Ээлж хүлээлцэх хүлээгдэж байна';
  const bodyText = `${shift.stationCode} (${shift.shiftDate}, ${shift.shiftType}) — ${shift.operatorName}`;
  const stage = String(shift.handoverStage || 'pending');
  const dedupeKey = `handover_pending:${shift.id}:${stage}`;

  const recipients = new Set<string>();
  if (stage === 'waiting_current_master') {
    if (shift.currentMasterUid || shift.shiftMasterUid) recipients.add(String(shift.currentMasterUid || shift.shiftMasterUid));
  } else if (stage === 'waiting_next_master') {
    if (shift.nextMasterUid) recipients.add(shift.nextMasterUid);
  } else if (stage === 'waiting_next_operator') {
    if (shift.nextOperatorUid || shift.handoverToOperatorUid) recipients.add(String(shift.nextOperatorUid || shift.handoverToOperatorUid));
  } else {
    if (shift.handoverToOperatorUid) recipients.add(shift.handoverToOperatorUid);
    if (shift.shiftMasterUid) recipients.add(shift.shiftMasterUid);
  }

  const dispatchers = await prisma.user.findMany({
    where: { role: 'dispatcher' },
    select: { id: true },
    take: 20,
  });
  for (const u of dispatchers) recipients.add(u.id);

  await notifyManyDeduped(
    Array.from(recipients),
    { kind: 'handover_pending', title, body: bodyText, link, dedupeKey },
    { windowMinutes: 180 }
  );
}

async function canReadAsScheduledNextOperator(
  shift: { shiftDate: string; shiftType: string; stationCode: string; operatorUid: string },
  actor: SessionActor
) {
  if ((actor.role || 'operator') !== 'operator') return false;
  if (shift.operatorUid === actor.id) return true;
  const resolution = await resolveNextOperatorSchedule({
    shiftDate: shift.shiftDate,
    shiftType: shift.shiftType,
    stationCode: shift.stationCode,
    currentOperatorUid: shift.operatorUid,
  });
  return Boolean(resolution.eligible && resolution.schedule?.operatorUid === actor.id);
}

async function writeHandoverApproval(args: {
  shiftId: string;
  stage: string;
  action: string;
  actor: SessionActor;
  comment?: string;
}) {
  await prisma.shiftHandoverApproval.create({
    data: {
      shiftId: args.shiftId,
      stage: args.stage,
      action: args.action,
      actorUid: args.actor.id,
      actorName: args.actor.name ?? null,
      comment: args.comment || null,
    },
  });
}

async function resolveMasterStationCode(masterUid: string, knownCode: string | null): Promise<string | null> {
  if (knownCode) return knownCode;
  const user = await prisma.user.findUnique({ where: { id: masterUid }, select: { stationCode: true } });
  return user?.stationCode ?? null;
}

/**
 * Ээлжийг хариуцах мастерыг тодорхойлно.
 *
 * Багийн аль ч мастер тухайн багийн аль ч операторыг хариуцаж болно —
 * станцын харьяалал гэсэн ойлголт байхгүй. Сонголтын дүрэм нь
 * `lib/crew-master.ts`-д: slot-д хуваарьтай мастер эхэнд, дараа нь ҮЯ-099.
 */
async function findAssignedMasterForShift(shift: {
  shiftDate: string;
  shiftType: string;
  stationCode: string;
  operatorUid: string;
}): Promise<{ masterUid: string; masterName: string | null; masterStationCode: string | null } | null> {
  const ref = await resolveCrewMasterForShift({
    operatorUid: shift.operatorUid,
    shiftDate: shift.shiftDate,
    shiftType: shift.shiftType,
  });
  if (!ref) return null;
  return {
    masterUid: ref.masterUid,
    masterName: ref.masterName,
    masterStationCode: await resolveMasterStationCode(ref.masterUid, ref.masterStationCode),
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const actor = sessionActor(session as any);
  if (!actor) return jsonError(401, 'Unauthorized');
  const deviceAccess = await getDeviceAccessForRequest(session, req);
  if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

  const { id } = await params;
  if (!UUID_RE.test(id)) return jsonError(400, 'Invalid id');

  try {
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        equipmentInspections: { orderBy: { sortOrder: 'asc' } },
        measurementRows: {
          orderBy: { sortOrder: 'asc' },
          include: { autoclaveEntries: { orderBy: { autoclaveNumber: 'asc' } } },
        },
        productionLogs: { orderBy: { sortOrder: 'asc' } },
        repairEntries: { orderBy: { sortOrder: 'asc' } },
        ingredientRecords: { orderBy: { sortOrder: 'asc' } },
        flowMetricsTotal: true,
        shiftImages: { orderBy: { createdAt: 'desc' } },
        handoverApprovals: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!shift) return jsonError(404, 'Not found');

    const canReadByPermission = canReadShift(
      {
        operatorUid: shift.operatorUid,
        stationCode: shift.stationCode,
        handoverToOperatorUid: shift.handoverToOperatorUid ?? null,
        nextOperatorUid: shift.nextOperatorUid ?? null,
      },
      actor
    );
    const canReadBySchedule = canReadByPermission ? false : await canReadAsScheduledNextOperator(shift, actor);
    if (!canReadByPermission && !canReadBySchedule) {
      return jsonError(403, 'Forbidden');
    }

    const stationProductionLogs = (shift.productionLogs ?? []).filter((p: any) => !String(p?.logType || '').startsWith(MODAL_LOG_PREFIX));
    const modalLogs = (shift.productionLogs ?? []).filter((p: any) => String(p?.logType || '').startsWith(MODAL_LOG_PREFIX));
    const formPayload = reconstructPayload({ ...shift, productionLogs: stationProductionLogs });
    const assignedMaster = await findAssignedMasterForShift({
      shiftDate: shift.shiftDate,
      shiftType: shift.shiftType,
      stationCode: shift.stationCode,
      operatorUid: shift.operatorUid,
    });
    const effectiveShiftMasterUid = assignedMaster?.masterUid ?? shift.shiftMasterUid ?? null;
    const periodicIntervalHours = await getPeriodicIntervalHours();
    const periodicLogs = modalLogs
      .filter((log: any) => String(log?.logType || '') === 'modal_periodic_logs')
      .map((log: any) => ({
        id: log.id,
        createdAt: log.createdAt,
        ...((log.data as Record<string, unknown> | null) || {}),
      }));
    const periodicStatus = getPeriodicLogStatus({
      stationCode: shift.stationCode,
      periodicLogs,
      checkInIso: shift.checkIn,
      checkOutIso: shift.checkOut,
      periodicIntervalHours,
    });

    if (
      periodicStatus.isOverdue &&
      !shift.operatorShiftCompleted &&
      shift.status !== 'Баталгаажсан'
    ) {
      const recipients = [shift.operatorUid, effectiveShiftMasterUid].filter(Boolean) as string[];
      try {
        await notifyManyDeduped(
          recipients,
          {
            kind: 'periodic_late',
            title: 'Тогтмол бүртгэл хоцорсон',
            body: `${shift.stationCode} (${shift.shiftDate}, ${shift.shiftType}) — ${periodicStatus.missingCount} бүртгэл дутуу байна.`,
            link: `/shift/${shift.id}#periodic`,
            dedupeKey: `periodic_late:${shift.id}:${periodicStatus.requiredCount}`,
          },
          { windowMinutes: Math.max(60, Math.ceil(periodicIntervalHours * 60)) }
        );
      } catch (notificationError) {
        console.error('Periodic notification error', notificationError);
      }
    }

    return NextResponse.json({
      ok: true,
      shift: {
        _id: shift.id,
        operatorUid: shift.operatorUid,
        operatorName: shift.operatorName,
        stationCode: shift.stationCode,
        stationName: STATION_NAME_BY_CODE[shift.stationCode] ?? shift.stationName,
        shiftType: shift.shiftType,
        shiftDate: shift.shiftDate,
        checkIn: shift.checkIn,
        status: shift.status,
        createdAt: shift.createdAt,
        shiftNumber: shift.shiftNumber,
        checkOut: shift.checkOut ?? null,
        operatorShiftCompleted: shift.operatorShiftCompleted ?? false,
        handoverAwaitingAcceptance: shift.handoverAwaitingAcceptance ?? false,
        handoverRequestedAt: shift.handoverRequestedAt ?? null,
        handoverAcceptedByUid: shift.handoverAcceptedByUid ?? null,
        handoverAcceptedByName: shift.handoverAcceptedByName ?? null,
        handoverAcceptedAt: shift.handoverAcceptedAt ?? null,
        handoverToOperatorUid: shift.handoverToOperatorUid ?? null,
        handoverToOperatorName: shift.handoverToOperatorName ?? null,
        handoverTimingStatus: shift.handoverTimingStatus ?? null,
        handoverTimingReason: shift.handoverTimingReason ?? null,
        handoverTimingRecordedAt: shift.handoverTimingRecordedAt ?? null,
        handoverStage: shift.handoverStage ?? null,
        currentMasterUid: shift.currentMasterUid ?? null,
        currentMasterName: shift.currentMasterName ?? null,
        currentMasterApprovedByUid: shift.currentMasterApprovedByUid ?? null,
        currentMasterApprovedByName: shift.currentMasterApprovedByName ?? null,
        currentMasterApprovedAt: shift.currentMasterApprovedAt ?? null,
        currentMasterComment: shift.currentMasterComment ?? null,
        nextMasterUid: shift.nextMasterUid ?? null,
        nextMasterName: shift.nextMasterName ?? null,
        nextMasterApprovedByUid: shift.nextMasterApprovedByUid ?? null,
        nextMasterApprovedByName: shift.nextMasterApprovedByName ?? null,
        nextMasterApprovedAt: shift.nextMasterApprovedAt ?? null,
        nextMasterComment: shift.nextMasterComment ?? null,
        nextOperatorUid: shift.nextOperatorUid ?? null,
        nextOperatorName: shift.nextOperatorName ?? null,
        handoverFinalAcceptedAt: shift.handoverFinalAcceptedAt ?? null,
        handoverReturnedByUid: shift.handoverReturnedByUid ?? null,
        handoverReturnedByName: shift.handoverReturnedByName ?? null,
        handoverReturnedAt: shift.handoverReturnedAt ?? null,
        handoverReturnReason: shift.handoverReturnReason ?? null,
        shiftMasterUid: effectiveShiftMasterUid,
        // Хүлээлгэн өгөх цонхонд урьдчилан сонгогдох мастерын нэр (маягтын мастертай тулгахад).
        shiftMasterName: assignedMaster?.masterUid
          ? assignedMaster.masterName ?? null
          : shift.shiftMasterUid && shift.shiftMasterUid === shift.currentMasterUid
            ? shift.currentMasterName ?? null
            : null,
        shiftMasterStationCode: assignedMaster?.masterStationCode ?? null,
        masterApproved: shift.masterApproved ?? false,
        masterApprovedBy: shift.masterApprovedBy ?? null,
        masterApprovedDate: shift.masterApprovedDate ?? null,
        adminApproved: shift.adminApproved ?? false,
        adminApprovedBy: shift.adminApprovedBy ?? null,
        adminApprovedDate: shift.adminApprovedDate ?? null,
        periodicStatus,
        modalLogs,
        handoverApprovals: (shift.handoverApprovals ?? []).map((row: any) => ({
          ...row,
          id: String(row.id),
          shiftId: String(row.shiftId),
          createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
        })),
        shiftImages: (shift.shiftImages ?? []).map((image: any) => ({
          id: image.id,
          shiftId: image.shiftId,
          section: image.section,
          rowKey: image.rowKey,
          rowLabel: image.rowLabel,
          caption: image.caption,
          storagePath: image.storagePath,
          publicUrl: image.publicUrl,
          url: image.publicUrl,
          mimeType: image.mimeType,
          sizeBytes: image.sizeBytes,
          uploadedByUid: image.uploadedByUid,
          uploadedByName: image.uploadedByName,
          reviewStatus: image.reviewStatus ?? 'pending_review',
          reviewComment: image.reviewComment,
          reviewedByUid: image.reviewedByUid,
          reviewedByName: image.reviewedByName,
          reviewedAt: image.reviewedAt instanceof Date ? image.reviewedAt.toISOString() : image.reviewedAt,
          createdAt: image.createdAt instanceof Date ? image.createdAt.toISOString() : image.createdAt,
        })),
        ...formPayload,
      },
    });
  } catch (e) {
    console.error('GET /api/shifts/[id]', e);
    return jsonError(500, 'Database error');
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  try {
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: { productionLogs: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!shift) return jsonError(404, 'Not found');

    if (
      !canReadShift(
        {
          operatorUid: shift.operatorUid,
          stationCode: shift.stationCode,
          handoverToOperatorUid: shift.handoverToOperatorUid ?? null,
          nextOperatorUid: shift.nextOperatorUid ?? null,
        },
        actor
      )
    ) {
      return jsonError(403, 'Forbidden');
    }

    const assignedMaster = shift.shiftMasterUid
      ? null
      : await findAssignedMasterForShift({
          shiftDate: shift.shiftDate,
          shiftType: shift.shiftType,
          stationCode: shift.stationCode,
          operatorUid: shift.operatorUid,
        });
    const effectiveShiftMasterUid = shift.shiftMasterUid ?? assignedMaster?.masterUid ?? null;

    const { data, error } = buildAuthorizedPatchData(
      {
        operatorUid: shift.operatorUid,
        stationCode: shift.stationCode,
        shiftMasterUid: effectiveShiftMasterUid,
        handoverToOperatorUid: shift.handoverToOperatorUid ?? null,
        handoverStage: shift.handoverStage ?? null,
        currentMasterUid: shift.currentMasterUid ?? effectiveShiftMasterUid,
        nextMasterUid: shift.nextMasterUid ?? null,
        nextOperatorUid: shift.nextOperatorUid ?? shift.handoverToOperatorUid ?? null,
        adminApproved: shift.adminApproved,
        status: shift.status,
      },
      actor,
      body
    );
    if (error || !data) return jsonError(403, error || 'Forbidden');

    const wantsHandoverRequest = data.handoverAwaitingAcceptance === true;
    const wantsComplete = data.operatorShiftCompleted === true;
    const wantsHandoverAccept = Boolean(data.handoverAcceptedAt);
    const wantsHandoverReturn =
      data.handoverAwaitingAcceptance === false && !wantsHandoverAccept && shift.handoverAwaitingAcceptance === true;

    if (wantsHandoverRequest) {
      const stage = String(shift.handoverStage || '').trim();
      if (stage === 'accepted' || shift.handoverFinalAcceptedAt || shift.adminApproved || shift.status === 'Баталгаажсан') {
        return jsonError(409, 'Хүлээлцэх процесс хүлээн авагдсан эсвэл эцэслэн баталгаажсан тул дахин хүсэлт илгээх боломжгүй.');
      }
      if (shift.handoverAwaitingAcceptance || !HANDOVER_REQUEST_STAGES.includes(stage)) {
        return jsonError(409, 'Хүлээлцэх хүсэлт аль хэдийн илгээгдсэн байна. Буцаагдсан үед дахин илгээнэ үү.');
      }
    }

    if (
      (actor.role === 'operator' || actor.role === 'master') &&
      (wantsHandoverRequest || wantsComplete || wantsHandoverAccept)
    ) {
      const timing = await getHandoverTimingStatus(shift.shiftType);

      // Хугацааны зөрчил гэдэг нь ЭЭЛЖ ХҮЛЭЭЛЦЭХ ХҮСЭЛТ гаргасан мөчийн шинж чанар.
      // Урьд нь хүлээн авагч бүр (мастер, дараагийн оператор) үүнийг дарж бичдэг
      // байсан тул операторын «Эрт/Хоцорч хүлээлцсэн» бүртгэл ба түүний тайлбар
      // чимээгүй устаж, dispatcher-ийн зөрчлийн тайлангаас (lib/dispatcher-compliance.ts)
      // алга болдог байв. Хүлээн авагчийн тайлбар нь `currentMasterComment` /
      // `nextMasterComment`-д тусад нь хадгалагддаг тул энд дарж бичих шаардлагагүй.
      const recordsTiming = wantsHandoverRequest || wantsComplete || !shift.handoverTimingStatus;
      if (recordsTiming) {
        data.handoverTimingStatus = timing.label;
        data.handoverTimingRecordedAt = new Date().toISOString();
      } else {
        delete data.handoverTimingStatus;
        delete data.handoverTimingRecordedAt;
      }

      if (timing.key !== 'normal') {
        if (wantsHandoverRequest && (await isHandoverWindowStrict())) {
          return jsonError(
            403,
            `Ээлж хүлээлцэх цагийн цонх хаалттай байна. ${shift.shiftType} ээлжийн хүсэлтийг ${timing.window.label} хооронд илгээнэ.`
          );
        }
        const reason = String(body.handoverTimingReason || body.notes || body.attentionNotes || '').trim();
        // Тайлбар зөвхөн ХҮСЭЛТ ИЛГЭЭХ/ЭЭЛЖ ДУУСГАХ үед заавал — клиент дээр эдгээрийн
        // диалог "Тайлбар (ЗААВАЛ)" гэж тодорхой шошиглодог. ХҮЛЭЭН АВАХ/БАТАЛГААЖУУЛАХ
        // (`wantsHandoverAccept`) үед клиент дээр "Тайлбар (СОНГОЛТТОЙ)" гэдэг тул энд
        // ч заавал шаардахгүй — эс бөгөөс "сонголттой" шошго худал болж, хүлээн авагч
        // (мастер/дараагийн оператор) хоосон тайлбараар товч дараад зогсонги алдаа
        // авдаг байв (client-side шалгалтыг өмнө хассан ч энэ server-side хуулбар
        // хэвээрээ байсан тул алдаа persist хийж байв).
        if (!reason && (wantsHandoverRequest || wantsComplete)) {
          return jsonError(
            400,
            `${timing.label}. ${shift.shiftType} ээлжийн стандарт хугацаа ${timing.window.label}. Тайлбар заавал бичнэ үү.`
          );
        }
        if (reason) {
          if (recordsTiming) data.handoverTimingReason = reason;
          else delete data.handoverTimingReason;
          if ((wantsComplete || wantsHandoverRequest) && !data.notes) data.notes = reason;
          if (wantsHandoverAccept && !data.attentionNotes) data.attentionNotes = reason;
        } else if (!recordsTiming) {
          delete data.handoverTimingReason;
        } else if (data.handoverTimingReason === undefined) {
          data.handoverTimingReason = null;
        }
      } else if (!recordsTiming) {
        delete data.handoverTimingReason;
      } else if (data.handoverTimingReason === undefined) {
        data.handoverTimingReason = null;
      }
    }

    // ДУТУУ БҮРТГЭЛ ЭЭЛЖ ДУУСГАХЫГ БЛОКЛОХГҮЙ (хэрэглэгчийн хүсэлт).
    //
    // Урьд нь энд `getShiftCompleteness` шалгаж, маягт дутуу бол 403 буцаан,
    // бүх станцын маягтыг заавал бөглүүлдэг байсан. Бүх маягтын талбарыг заавал
    // биш болгосонтой нийцүүлэн энэ хоригийг авав — «дутуу бүртгэл» мэдээлэл нь
    // ээлжийн хуудасны шар анхааруулга, мастер/диспетчерийн самбар, тайланд
    // ХЭВЭЭР харагдана (`getShiftCompleteness` тэдгээрт ашиглагдсаар байна).

    // Manual masterApproved payload is blocked until handover is done.
    // Current-master handover approval can set masterApproved automatically below.
    if (data.masterApproved === true) {
      const isHandoverDone =
        !!shift.handoverFinalAcceptedAt ||
        shift.handoverStage === 'accepted';
      if (!isHandoverDone) {
        return jsonError(
          403,
          'Ээлж хүлээлцэх процесс бүрэн дуусаагүй байна. Дараагийн оператор хүлээн авч баталгаажуулсны дараа мастер батлах боломжтой.'
        );
      }
    }

    if (data.adminApproved === true || data.status === 'Баталгаажсан') {
      if (actor.role !== 'admin' && actor.role !== 'chief_engineer') {
        return jsonError(403, 'Admin эцсийн баталгаажуулалт хийх эрхгүй.');
      }
      const isHandoverDone =
        !!shift.handoverFinalAcceptedAt ||
        shift.handoverStage === 'accepted';
      const legacyMasterApproved =
        !!shift.currentMasterApprovedAt &&
        (!!shift.handoverFinalAcceptedAt || shift.handoverStage === 'accepted');
      const isMasterApproved = shift.masterApproved === true || data.masterApproved === true || legacyMasterApproved;
      if (!isHandoverDone) {
        return jsonError(403, 'Ээлж хүлээлцэх процесс бүрэн дууссаны дараа admin эцсийн баталгаажуулалт хийнэ.');
      }
      if (!isMasterApproved) {
        return jsonError(403, 'Эхлээд хариуцсан мастер баталгаажуулах ёстой.');
      }
      if (legacyMasterApproved && shift.masterApproved !== true) {
        data.masterApproved = true;
        data.masterApprovedBy = shift.currentMasterApprovedByName || shift.currentMasterUid || null;
        data.masterApprovedDate = shift.currentMasterApprovedAt;
      }
    }

    let approvalEvent: { stage: string; action: string; comment?: string } | null = null;

    if (wantsHandoverRequest) {
      const isMasterSelfHandover = actor.role === 'master' && shift.operatorUid === actor.id;

      if (isMasterSelfHandover) {
        const nextMasterSchedule = await resolveNextMasterScheduleForShift({
          shiftDate: shift.shiftDate,
          shiftType: shift.shiftType,
          stationCode: shift.stationCode,
        });

        // Гараар сонгосон нь хуваарийг ДАРНА (чөлөө/ажил таслалт хуваарьт тусдаггүй).
        // Сонгоогүй бол хуваарийн мастерыг ашиглана.
        const pickedNextMaster = await resolvePickedUser(body.nextMasterUid, body.nextMasterName, 'master');
        if ((body.nextMasterName || body.nextMasterUid) && !pickedNextMaster) {
          return jsonError(400, 'Сонгосон дараагийн мастер олдсонгүй эсвэл идэвхгүй байна.');
        }
        const nextMasterUid = pickedNextMaster
          ? pickedNextMaster.id
          : String(nextMasterSchedule?.masterUid || '').trim();
        const nextMasterName = pickedNextMaster
          ? String(pickedNextMaster.name || '')
          : String(nextMasterSchedule?.masterName || '').trim();
        if (!nextMasterUid) {
          return jsonError(400, 'Дараагийн мастерын хуваарь олдсонгүй. Хүлээн авах мастерыг сонгоно уу.');
        }
        if (nextMasterUid === String(shift.operatorUid).trim()) {
          return jsonError(400, 'Дараагийн мастер одоогийн мастераас өөр байх ёстой.');
        }

        // Батлах админ — ЧИГЛҮҮЛЭЛТ. Мэдэгдэл түүн рүү очно, гэхдээ өөр admin /
        // chief_engineer мөн батлах эрхтэй хэвээр (гацахаас сэргийлнэ).
        const pickedApprovalAdmin = await resolvePickedApprovalAdmin(
          body.approvalAdminUid, body.approvalAdminName
        );
        if ((body.approvalAdminName || body.approvalAdminUid) && !pickedApprovalAdmin) {
          return jsonError(400, 'Сонгосон батлах админ олдсонгүй эсвэл идэвхгүй байна.');
        }
        data.approvalAdminUid = pickedApprovalAdmin?.id ?? null;
        data.approvalAdminName = pickedApprovalAdmin?.name ?? null;

        data.handoverStage = 'waiting_next_master';
        data.shiftMasterUid = shift.operatorUid;
        data.currentMasterUid = shift.operatorUid;
        data.currentMasterName = shift.operatorName || actor.name || null;
        data.currentMasterApprovedByUid = actor.id;
        data.currentMasterApprovedByName = actor.name ?? shift.operatorName ?? null;
        data.currentMasterApprovedAt = new Date().toISOString();
        data.currentMasterComment = String(data.notes || '') || null;
        data.nextMasterUid = nextMasterUid;
        data.nextMasterName = nextMasterName || null;
        data.nextMasterApprovedByUid = null;
        data.nextMasterApprovedByName = null;
        data.nextMasterApprovedAt = null;
        data.nextMasterComment = null;
        data.nextOperatorUid = null;
        data.nextOperatorName = null;
        data.handoverToOperatorUid = null;
        data.handoverToOperatorName = null;
        approvalEvent = { stage: 'waiting_next_master', action: 'requested', comment: String(data.notes || '') };
      } else {
        // Ээлж дуусгаж буй хүн баталгаажуулах мастерыг ГАРААР сонгосон бол түүнийг
        // авна (чөлөө/ажил таслалтаас болж хуваарийн мастер ажил дээр байхгүй байж
        // болно). Сонгоогүй бол багаас автоматаар тодорхойлсон мастер хэвээр.
        const pickedConfirmMaster = await resolvePickedUser(
          body.confirmMasterUid, body.confirmMasterName,
          'master'
        );
        if ((body.confirmMasterName || body.confirmMasterUid) && !pickedConfirmMaster) {
          return jsonError(400, 'Сонгосон баталгаажуулах мастер олдсонгүй эсвэл идэвхгүй байна.');
        }

        const currentMaster = pickedConfirmMaster
          ? { masterUid: pickedConfirmMaster.id, masterName: pickedConfirmMaster.name }
          : effectiveShiftMasterUid
            ? { masterUid: effectiveShiftMasterUid, masterName: assignedMaster?.masterName || shift.currentMasterName || null }
            : null;
        if (!currentMaster?.masterUid) return jsonError(400, 'Баталгаажуулах мастер олдсонгүй. Мастерыг сонгоно уу.');
        if (String(currentMaster.masterUid).trim() === String(shift.operatorUid).trim()) {
          return jsonError(400, 'Баталгаажуулах мастер болон оператор нэг хэрэглэгч байж болохгүй.');
        }

        // Ээлж хүлээж авах дараагийн операторыг мөн энд сонгож болно. Сонгосон бол
        // мастерын баталгаажуулах шатанд хуваарийг ДАРНА (доорх `wantsHandoverAccept`).
        const pickedNextOperator = await resolvePickedUser(
          body.nextOperatorUid, body.nextOperatorName,
          'operator'
        );
        if ((body.nextOperatorName || body.nextOperatorUid) && !pickedNextOperator) {
          return jsonError(400, 'Сонгосон дараагийн оператор олдсонгүй эсвэл идэвхгүй байна.');
        }
        // Өөрийгөө сонгохыг хориглоно. (Ээлж сунгах тохиолдолд өөртөө хүлээлцэх нь
        // хиймэл бичлэг үүсгээд, дараагийн ээлжийн бүртгэлийг үүсгэдэггүй тул
        // асуудлыг шийддэггүй — админ хуваарь нэмэх замаар шийднэ.)
        if (pickedNextOperator && pickedNextOperator.id === String(shift.operatorUid).trim()) {
          return jsonError(400, 'Дараагийн оператор одоогийн оператороос өөр байх ёстой.');
        }

        data.handoverStage = 'waiting_current_master';
        data.shiftMasterUid = currentMaster.masterUid;
        data.currentMasterUid = currentMaster.masterUid;
        data.currentMasterName = currentMaster.masterName || null;
        data.currentMasterApprovedByUid = null;
        data.currentMasterApprovedByName = null;
        data.currentMasterApprovedAt = null;
        data.currentMasterComment = null;
        data.nextMasterUid = null;
        data.nextMasterName = null;
        data.nextMasterApprovedByUid = null;
        data.nextMasterApprovedByName = null;
        data.nextMasterApprovedAt = null;
        data.nextMasterComment = null;
        // Сонгосон бол хадгална — мастер баталгаажуулах үедээ үүнийг ашиглана.
        data.nextOperatorUid = pickedNextOperator?.id ?? null;
        data.nextOperatorName = pickedNextOperator?.name ?? null;
        data.handoverToOperatorUid = null;
        data.handoverToOperatorName = null;
        approvalEvent = { stage: 'waiting_current_master', action: 'requested', comment: String(data.notes || '') };
      }

      data.handoverFinalAcceptedAt = null;
      data.handoverAcceptedByUid = null;
      data.handoverAcceptedByName = null;
      data.handoverAcceptedAt = null;
      data.handoverReturnedByUid = null;
      data.handoverReturnedByName = null;
      data.handoverReturnedAt = null;
      data.handoverReturnReason = null;
    }

    // Хүлээлцэх процесс аль хэдийн дууссан бол дахин «хүлээн авах» хүсэлтийг ХААНА.
    // Эс бөгөөс доорх нөхцөл биелэхгүй атлаа `handoverAcceptedByUid/Name/At` нь
    // `data`-д үлдэж, DB рүү бичигдээд «хэн хүлээн авсан» бичлэгийг дарж бичдэг байв
    // (төлөв өөрчлөгдөхгүй ч бүртгэл худал болно).
    // `handoverAcceptedAt`-гүй, зөвхөн `handoverAwaitingAcceptance: false` илгээсэн
    // хүсэлт (буцаалт) мөн энд таарна. Урьд нь зөвхөн `wantsHandoverAccept`-ийг
    // шалгадаг байсан тул аль хэдийн шийдэгдсэн ээлж рүү дахин буцаалт илгээхэд
    // 200 буцааж, `attentionNotes` зэргийг чимээгүй дарж бичдэг байв.
    if (
      (wantsHandoverAccept || data.handoverAwaitingAcceptance === false) &&
      !shift.handoverAwaitingAcceptance
    ) {
      return jsonError(409, 'Энэ ээлжийн хүлээлцэх процесс аль хэдийн дууссан байна.');
    }

    if (wantsHandoverAccept && shift.handoverAwaitingAcceptance) {
      const stage = String(shift.handoverStage || '').trim();
      const comment = String(body.attentionNotes || body.handoverTimingReason || '').trim();
      const actorName = actor.name ?? null;

      // Мастерын станцын маягт дутуу байсан ч баталгаажуулахыг БЛОКЛОХГҮЙ
      // (хэрэглэгчийн хүсэлт — бүх маягтын талбар заавал биш болсонтой нийцүүлэв).
      // Урьд нь энд маягтгүй бол 422 буцаадаг байв.

      if (stage === 'waiting_current_master') {
        if (actor.role !== 'admin' && actor.role !== 'chief_engineer' && shift.currentMasterUid !== actor.id) {
          return jsonError(403, 'Одоогийн ээлжийн мастер баталгаажуулах эрхгүй');
        }
        const nextOperatorResolution = await resolveNextOperatorSchedule({
          shiftDate: shift.shiftDate,
          shiftType: shift.shiftType,
          stationCode: shift.stationCode,
          currentOperatorUid: shift.operatorUid,
        });
        // Дараалал: ① энэ хүсэлтэд мастер гараар сонгосон → ② оператор хүсэлт гаргахдаа
        // сонгосон (shift.nextOperatorUid) → ③ хуваарь.
        // Гараар сонгосон нь хуваарийг ДАРНА: чөлөө авсан / ажилдаа ирээгүй хүн хуваарь
        // дээр хэвээр байдаг тул хуваарь дангаараа бодит байдлыг илэрхийлэхгүй.
        let nextOperator: { operatorUid: string; operatorName: string | null; stationCode: string } | null = null;

        const manualPicked = await resolvePickedUser(body.nextOperatorUid, body.nextOperatorName, 'operator');
        if ((body.nextOperatorName || body.nextOperatorUid) && !manualPicked) {
          return jsonError(400, 'Сонгосон дараагийн оператор олдсонгүй эсвэл идэвхгүй байна.');
        }
        if (manualPicked) {
          nextOperator = { operatorUid: manualPicked.id, operatorName: manualPicked.name, stationCode: shift.stationCode };
        } else if (shift.nextOperatorUid) {
          nextOperator = {
            operatorUid: String(shift.nextOperatorUid),
            operatorName: shift.nextOperatorName ?? null,
            stationCode: shift.stationCode,
          };
        } else if (nextOperatorResolution.eligible && nextOperatorResolution.schedule?.operatorUid) {
          nextOperator = nextOperatorResolution.schedule;
        }

        if (nextOperator && String(nextOperator.operatorUid) === String(shift.operatorUid).trim()) {
          return jsonError(400, 'Дараагийн оператор одоогийн оператороос өөр байх ёстой.');
        }

        if (
          nextOperator &&
          normalizeStationCode(nextOperator.stationCode) !== normalizeStationCode(shift.stationCode)
        ) {
          return jsonError(400, 'Дараагийн операторын дамжлага одоогийн дамжлагатай адил байх ёстой.');
        }
        const approvedAt = new Date().toISOString();
        data.currentMasterApprovedByUid = actor.id;
        data.currentMasterApprovedByName = actorName;
        data.currentMasterApprovedAt = approvedAt;
        data.currentMasterComment = comment || null;
        data.nextMasterUid = null;
        data.nextMasterName = null;
        data.nextMasterApprovedByUid = null;
        data.nextMasterApprovedByName = null;
        data.nextMasterApprovedAt = null;
        data.nextMasterComment = null;
        if (nextOperator) {
          // Дараагийн оператор хараахан хүлээн аваагүй тул дамжлага бүрэн дуусаагүй —
          // masterApproved-г энд ТҮГЖИХГҮЙ (CLAUDE.md-ийн баталгаа: дамжлага бүрэн
          // дуусаагүй бол masterApproved set хийхийг блоклоно — эс тэгвээс "Ээлж
          // баталгаажсан" мэдэгдэл болон admin_pending жагсаалт хугацаанаас өмнө гарна).
          delete data.handoverAcceptedByUid;
          delete data.handoverAcceptedByName;
          delete data.handoverAcceptedAt;
          data.nextOperatorUid = nextOperator.operatorUid;
          data.nextOperatorName = nextOperator.operatorName || null;
          data.handoverToOperatorUid = nextOperator.operatorUid;
          data.handoverToOperatorName = nextOperator.operatorName || null;
          data.handoverAwaitingAcceptance = true;
          data.handoverStage = 'waiting_next_operator';
        } else {
          data.masterApproved = true;
          data.masterApprovedBy = actorName;
          data.masterApprovedDate = approvedAt;
          data.nextOperatorUid = null;
          data.nextOperatorName = null;
          data.handoverToOperatorUid = null;
          data.handoverToOperatorName = null;
          data.handoverAwaitingAcceptance = false;
          data.handoverStage = 'accepted';
          data.handoverAcceptedByUid = actor.id;
          data.handoverAcceptedByName = actorName;
          data.handoverAcceptedAt = approvedAt;
          data.handoverFinalAcceptedAt = approvedAt;
        }
        approvalEvent = { stage, action: 'approved', comment };
      } else if (stage === 'waiting_next_master') {
        if (shift.nextOperatorUid) {
          // Дараагийн оператор нь дараагийн мастерын өмнөөс хүлээн авч байна
          if (actor.role !== 'admin' && actor.role !== 'chief_engineer' && shift.nextOperatorUid !== actor.id) {
            return jsonError(403, 'Дараагийн оператор хүлээн авах эрхгүй');
          }
          const acceptedAt = new Date().toISOString();
          data.nextMasterUid = null;
          data.nextMasterName = null;
          data.nextMasterApprovedByUid = null;
          data.nextMasterApprovedByName = null;
          data.nextMasterApprovedAt = null;
          data.nextMasterComment = null;
          data.masterApproved = true;
          data.masterApprovedBy = actorName;
          data.masterApprovedDate = acceptedAt;
          data.handoverStage = 'accepted';
          data.handoverAwaitingAcceptance = false;
          data.handoverAcceptedByUid = actor.id;
          data.handoverAcceptedByName = actorName;
          data.handoverAcceptedAt = acceptedAt;
          data.handoverFinalAcceptedAt = acceptedAt;
          approvalEvent = { stage, action: 'accepted', comment };
        } else {
          // Дараагийн мастер өөрөө баталгаажуулж байна
          if (actor.role !== 'admin' && actor.role !== 'chief_engineer' && shift.nextMasterUid !== actor.id) {
            return jsonError(403, 'Дараагийн ээлжийн мастер баталгаажуулах эрхгүй');
          }
          const approvedAt = new Date().toISOString();
          data.nextMasterApprovedByUid = actor.id;
          data.nextMasterApprovedByName = actorName;
          data.nextMasterApprovedAt = approvedAt;
          data.nextMasterComment = comment || null;
          data.masterApproved = true;
          data.masterApprovedBy = actorName;
          data.masterApprovedDate = approvedAt;
          data.handoverAwaitingAcceptance = false;
          data.handoverStage = 'accepted';
          data.handoverAcceptedByUid = actor.id;
          data.handoverAcceptedByName = actorName;
          data.handoverAcceptedAt = approvedAt;
          data.handoverFinalAcceptedAt = approvedAt;
          approvalEvent = { stage, action: 'approved', comment };
        }
      } else if (stage === 'waiting_next_operator') {
        if (actor.role !== 'admin' && actor.role !== 'chief_engineer' && shift.nextOperatorUid !== actor.id) {
          return jsonError(403, 'Дараагийн оператор хүлээн авах эрхгүй');
        }
        const acceptedAt = new Date().toISOString();
        data.handoverStage = 'accepted';
        data.handoverAwaitingAcceptance = false;
        data.handoverAcceptedByUid = actor.id;
        data.handoverAcceptedByName = actorName;
        data.handoverAcceptedAt = acceptedAt;
        data.handoverFinalAcceptedAt = acceptedAt;
        // `waiting_current_master` шатанд мастер баталгаажуулсан ч дамжлага бүрэн
        // дуусаагүй байсан тул `masterApproved`-г ЗОРИУДААР тавьдаггүй. Дамжлага яг
        // ЭНД бүрэн дуусч байгаа тул мастерын баталгааг одоо бичнэ — эс бөгөөс
        // `masterApproved` үүрд false үлдэж, KPI тайлангийн «Мастер баталгаажсан»
        // багана буруу «Үгүй» гэж гарна. (Баталгаажуулагч нь хүлээн авсан оператор
        // биш, өмнө нь зөвшөөрсөн МАСТЕР.)
        if (shift.masterApproved !== true && shift.currentMasterApprovedAt) {
          data.masterApproved = true;
          data.masterApprovedBy = shift.currentMasterApprovedByName ?? shift.currentMasterName ?? null;
          data.masterApprovedDate = shift.currentMasterApprovedAt;
        }
        approvalEvent = { stage, action: 'accepted', comment };
      } else {
        data.handoverStage = 'accepted';
        data.handoverFinalAcceptedAt = String(data.handoverAcceptedAt || new Date().toISOString());
        approvalEvent = { stage: stage || 'legacy', action: 'accepted', comment };
      }
    }

    if (wantsHandoverReturn) {
      const stage = String(shift.handoverStage || 'legacy').trim();
      const comment = String(body.attentionNotes || body.handoverTimingReason || '').trim();
      data.handoverStage = 'returned';
      data.handoverReturnedByUid = actor.id;
      data.handoverReturnedByName = actor.name ?? null;
      data.handoverReturnedAt = new Date().toISOString();
      data.handoverReturnReason = comment || null;
      // Ээлжийг «дуусаагүй» болгож БУЦААНА — эс бөгөөс `operatorShiftCompleted`
      // `true` хэвээр үлдэж, `canEditStationMainForm` (app/shift/[id]/page.tsx)
      // операторын маягт засах эрхийг хаадаг. Буцаах гэдэг нь «алдаагаа зас»
      // гэсэн утгатай атлаа оператор яг тэр л буруу өгөгдлийг дахин илгээхээс
      // өөр сонголтгүй болдог байв.
      //
      // `checkOut`-ыг ЗОРИУДААР хэвээр үлдээнэ: цэвэрлэвэл ҮЯ-400-ийн тогтмол
      // бүртгэлийн шаардлага (getPeriodicLogStatus) цаг өнгөрөх тусам өсөж,
      // шинэ хаалт үүсгэнэ. Дахин хүсэлт илгээхэд `checkOut` шинэчлэгдэнэ.
      data.operatorShiftCompleted = false;
      approvalEvent = { stage, action: 'returned', comment };
    }

    // Handover салбар аль хэдийн тодорхой мастер (гараар сонгосон эсвэл багийнх)
    // тавьсан бол ДАРЖ БИЧИХГҮЙ — эс бөгөөс сонгосон мастер автоматаараа солигдоно.
    if (
      data.handoverAwaitingAcceptance === true &&
      !shift.shiftMasterUid &&
      effectiveShiftMasterUid &&
      !data.shiftMasterUid
    ) {
      data.shiftMasterUid = effectiveShiftMasterUid;
    }

    // Хүсэлт зөвхөн анхны/буцаагдсан төлөвөөс, хүлээн авах/буцаах нь хүлээгдэж
    // буй төлөвөөс шилжинэ. Уншилтын дараа төлөв солигдсон ч бүртгэлийг дарж
    // бичихгүй байхаар нөхцөлийг UPDATE-ийн WHERE-т давхар шалгана.
    let updated: any;
    if (wantsHandoverRequest || wantsHandoverAccept || wantsHandoverReturn) {
      const res = await prisma.shift.updateMany({
        where: wantsHandoverRequest
          ? {
              id,
              adminApproved: false,
              status: { not: 'Баталгаажсан' },
              handoverFinalAcceptedAt: null,
              handoverAwaitingAcceptance: false,
              OR: [{ handoverStage: null }, { handoverStage: { in: HANDOVER_REQUEST_STAGES } }],
            }
          : { id, handoverAwaitingAcceptance: true },
        data: data as any,
      });
      if (res.count !== 1) {
        return jsonError(
          409,
          'Энэ ээлжийн хүлээлцэх төлөв өөрчлөгдсөн байна. Хуудсаа сэргээгээд дахин шалгана уу.'
        );
      }
      updated = await prisma.shift.findUnique({ where: { id } });
      if (!updated) return jsonError(404, 'Not found');
    } else {
      updated = await prisma.shift.update({ where: { id }, data: data as any });
    }

    await writeServerAuditLog({
      actorUid: actor.id,
      actorName: actor.name ?? null,
      action: 'shift_patch',
      entityType: 'shift',
      entityId: id,
      details: JSON.stringify(Object.keys(data)),
    });

    if (data.handoverAwaitingAcceptance === true) {
      await notifyHandoverPending({
        id: updated.id,
        stationCode: updated.stationCode,
        shiftType: updated.shiftType,
        shiftDate: updated.shiftDate,
        operatorName: updated.operatorName,
        handoverToOperatorUid: updated.handoverToOperatorUid ?? null,
        shiftMasterUid: updated.shiftMasterUid ?? null,
        handoverStage: updated.handoverStage ?? null,
        currentMasterUid: updated.currentMasterUid ?? null,
        nextMasterUid: updated.nextMasterUid ?? null,
        nextOperatorUid: updated.nextOperatorUid ?? null,
      });
    }

    if (approvalEvent) {
      await writeHandoverApproval({
        shiftId: updated.id,
        stage: approvalEvent.stage,
        action: approvalEvent.action,
        actor,
        comment: approvalEvent.comment,
      });
    }

    // Буцаалтын мэдэгдэл — урьд нь буцаах үед ЯМАР Ч мэдэгдэл илгээгддэггүй байсан
    // (доорх бүх блок нь хүлээн авах / баталгаажуулахад л ажилладаг), тиймээс
    // оператор ээлж нь буцаагдсаныг зөвхөн хуудсаа нээж үзэж мэдэх боломжтой байв.
    if (wantsHandoverReturn) {
      const link = `/shift/${updated.id}`;
      const title = 'Ээлж хүлээлцэх буцаагдлаа';
      const reasonText = updated.handoverReturnReason ? ` — Шалтгаан: ${updated.handoverReturnReason}` : '';
      const bodyText =
        `${updated.stationCode} (${updated.shiftDate}, ${updated.shiftType}) — ` +
        `Буцаасан: ${updated.handoverReturnedByName || ''}${reasonText}`.trim();
      const dedupeKey = `handover_returned:${updated.id}:${updated.handoverReturnedAt}`;

      const recipients = new Set<string>();
      recipients.add(updated.operatorUid);
      if (updated.shiftMasterUid) recipients.add(String(updated.shiftMasterUid));
      const dispatchers = await prisma.user.findMany({ where: { role: 'dispatcher' }, select: { id: true }, take: 20 });
      for (const u of dispatchers) recipients.add(u.id);

      await notifyManyDeduped(
        Array.from(recipients),
        { kind: 'handover_returned', title, body: bodyText, link, dedupeKey },
        { windowMinutes: 60 }
      );
    }

    // Handover accepted decision
    const becameAccepted = !!updated.handoverAcceptedAt && !shift.handoverAcceptedAt;
    if (becameAccepted) {
      const link = `/shift/${updated.id}`;
      const title = 'Ээлж хүлээлцэх баталгаажсан';
      const bodyText = `${updated.stationCode} (${updated.shiftDate}, ${updated.shiftType}) — Хүлээн авсан: ${updated.handoverAcceptedByName || ''}`.trim();
      const dedupeKey = `handover_accepted:${updated.id}`;

      const recipients = new Set<string>();
      recipients.add(updated.operatorUid);
      if (updated.shiftMasterUid) recipients.add(String(updated.shiftMasterUid));
      const dispatchers = await prisma.user.findMany({ where: { role: 'dispatcher' }, select: { id: true }, take: 20 });
      for (const u of dispatchers) recipients.add(u.id);

      await notifyManyDeduped(
        Array.from(recipients),
        { kind: 'handover_accepted', title, body: bodyText, link, dedupeKey },
        { windowMinutes: 12 * 60 }
      );
    }

    // Master approval decision
    const becameApproved = updated.masterApproved === true && shift.masterApproved !== true;
    if (becameApproved) {
      const link = `/shift/${updated.id}`;
      const title = 'Ээлж баталгаажсан';
      const bodyText = `${updated.stationCode} (${updated.shiftDate}, ${updated.shiftType}) — Баталгаажуулсан: ${updated.masterApprovedBy || ''}`.trim();
      const dedupeKey = `master_approved:${updated.id}`;

      const recipients = new Set<string>();
      recipients.add(updated.operatorUid);
      const dispatchers = await prisma.user.findMany({ where: { role: 'dispatcher' }, select: { id: true }, take: 20 });
      for (const u of dispatchers) recipients.add(u.id);
      await notifyManyDeduped(
        Array.from(recipients),
        { kind: 'master_approved', title, body: bodyText, link, dedupeKey },
        { windowMinutes: 24 * 60 }
      );
    }

    // Admin approval decision
    const becameAdminApproved = updated.adminApproved === true && shift.adminApproved !== true;
    if (becameAdminApproved) {
      const link = `/shift/${updated.id}`;
      const title = 'Эцсийн баталгаажуулалт хийгдсэн';
      const bodyText = `${updated.stationCode} (${updated.shiftDate}, ${updated.shiftType}) — Баталгаажуулсан: ${updated.adminApprovedBy || ''}`.trim();
      const dedupeKey = `admin_approved:${updated.id}`;

      const recipients = new Set<string>();
      recipients.add(updated.operatorUid);
      if (updated.shiftMasterUid) recipients.add(String(updated.shiftMasterUid));
      const dispatchers = await prisma.user.findMany({ where: { role: 'dispatcher' }, select: { id: true }, take: 20 });
      for (const u of dispatchers) recipients.add(u.id);

      await notifyManyDeduped(
        Array.from(recipients),
        { kind: 'admin_approved', title, body: bodyText, link, dedupeKey },
        { windowMinutes: 48 * 60 }
      );
    }

    return NextResponse.json({ ok: true, id: updated.id });
  } catch (e) {
    if (e instanceof PickedUserSelectionError) return jsonError(400, e.message);
    console.error('PATCH /api/shifts/[id]', e);
    return jsonError(500, 'Database error');
  }
}
