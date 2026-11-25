import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import {
  STATION_NAME_BY_CODE,
  FORM_KEY_BY_STATION,
  decomposePayload,
  toShiftClientPayload,
} from '@/lib/shift-db';
import { writeServerAuditLog } from '@/lib/server-audit';
import { notifyManyDeduped } from '@/lib/server-notifications';
import {
  AUTO_ACCEPT_NAME_SUFFIX, autoAcceptHandoversOnShiftStart, type StartedShift,
} from '@/lib/handover-auto-accept';
import { canCreateShiftFor, canQueryShifts, type SessionActor } from '@/lib/shift-api-permissions';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';
import { resolveDispatcherCompliance } from '@/lib/dispatcher-compliance';
import { isMasterStationCode } from '@/lib/master-stations';
import { masterApprovalPendingWhere } from '@/lib/master-pending';
import { isoDateInTimeZone } from '@/lib/handover-window';
import { crewOperatorUids, resolveCrewMasterForShift } from '@/lib/crew-master';
import {
  approvalHistoryPagination, operatorApprovedSearchFilter, operatorApprovedWhere, parseApprovalHistoryQuery, parseApprovalStationKind,
  type ApprovalStationKind,
} from '@/lib/approval-history-query';

const MODAL_LOG_PREFIX = 'modal_';

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * Давхцахааргүй, уншихад ойлгомжтой ээлжийн дугаар: YYMMDD-HHMMSS-RR
 * (Asia/Ulaanbaatar цаг + 2 оронтой санамсаргүй дагавар). Хуучин санамсаргүй
 * Math.random() дугаар давхцах эрсдэлтэй байсныг орлоно.
 */
function makeShiftNumber() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const stamp = `${get('year')}${get('month')}${get('day')}-${get('hour')}${get('minute')}${get('second')}`;
  const suffix = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `${stamp}-${suffix}`;
}

const CANCELLED_SHIFT_STATUSES = new Set(['Цуцлагдсан']);
// Шинэ ээлж зөвхөн эдгээр төлөвөөр үүснэ — 'Баталгаажсан' зэргийг клиентээс
// хүлээн авбал KPI-ийн «Баталгаажсан ээлж» хуурамчаар өсөж, маягт түгжигдэнэ.
const CREATABLE_SHIFT_STATUSES = new Set(['Хадгалсан', 'Ноорог']);

function addDaysIso(date: string, days: number) {
  const [y, m, d] = String(date || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

function normalizeDate(value: unknown) {
  const s = String(value ?? '').trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return match ? match[1] : s.slice(0, 10);
}

function normalizeShiftType(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ');
}

function previousHandoverSlot(shiftDate: unknown, shiftType: unknown) {
  const date = normalizeDate(shiftDate);
  const type = normalizeShiftType(shiftType);
  if (!date || !type) return null;
  if (shiftTypeSortOrder(type) === 1) {
    return { shiftDate: addDaysIso(date, -1), shiftType: 'Шөнийн' };
  }
  return { shiftDate: date, shiftType: 'Өдрийн' };
}

function mergeShiftRows(rows: any[]) {
  const map = new Map<string, any>();
  for (const row of rows) {
    if (!row?.id) continue;
    map.set(String(row.id), row);
  }
  return Array.from(map.values()).sort((a, b) =>
    String(b?.createdAt || b?.handoverRequestedAt || '').localeCompare(String(a?.createdAt || a?.handoverRequestedAt || ''))
  );
}

function shiftTypeSortOrder(value: unknown) {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'өдрийн' || type.includes('өдр')) return 1;
  if (type === 'шөнийн' || type.includes('шөн')) return 2;
  return 99;
}

function scheduleSlotKey(input: { shiftDate: unknown; shiftType: unknown; stationCode: unknown }) {
  return `${String(input.shiftDate || '').slice(0, 10)}|${String(input.shiftType || '').trim()}|${String(input.stationCode || '').trim()}`;
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

/**
 * Мастерын харах эрхийн хүрээ — өөрийн багийн операторуудын uid.
 * Мастер багт харьяалагдаагүй бол `null` (хүрээ хязгаарлахгүй).
 */
async function masterScopeOperatorUids(actor: SessionActor): Promise<string[] | null> {
  if (actor.role !== 'master') return null;
  return crewOperatorUids(actor.id);
}

/**
 * Ээлжийг хариуцах мастер — багийн аль ч мастер аль ч операторыг хариуцаж болно.
 * Сонголтын дүрэм: тухайн slot-д хуваарьтай мастер эхэнд, дараа нь ҮЯ-099.
 */
async function findAssignedMasterForShift(input: {
  shiftDate: string;
  shiftType: string;
  stationCode: string;
  operatorUid: string;
}) {
  return resolveCrewMasterForShift({
    operatorUid: input.operatorUid,
    shiftDate: input.shiftDate,
    shiftType: input.shiftType,
  });
}

function withOperatorScopeFilter(baseWhere: any, uids: string[] | null) {
  if (!uids) return baseWhere;
  return { ...baseWhere, operatorUid: { in: uids } };
}

async function masterScopedShiftWhere(actor: SessionActor, baseWhere: any = {}) {
  const uids = await masterScopeOperatorUids(actor);
  if (actor.role !== 'master') return withOperatorScopeFilter(baseWhere, uids);

  const scopeFilters: any[] = [];
  if (uids) scopeFilters.push({ operatorUid: { in: uids } });

  // Мастерын өөрийн станцын бүх ээлж (жишээ нь ҮЯ-310 дээрх бусад мастерын маягт).
  if (actor.stationCode && isMasterStationCode(actor.stationCode)) {
    scopeFilters.push({ stationCode: String(actor.stationCode).trim() });
  }

  return {
    AND: [baseWhere],
    OR: [
      { shiftMasterUid: actor.id },
      { currentMasterUid: actor.id },
      { nextMasterUid: actor.id },
      ...scopeFilters,
    ],
  };
}

/** GET /api/shifts — list recent slots for an operator, or detailed shifts by queryType */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const actor = sessionActor(session as any);
  if (!actor) return jsonError(401, 'Unauthorized');
  const deviceAccess = await getDeviceAccessForRequest(session, req);
  if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

  try {
    const { searchParams } = new URL(req.url);
    const queryType = searchParams.get('queryType') || 'slots';
    const operatorUid = String(searchParams.get('operatorUid') || '').trim();
    const since = searchParams.get('since') || '';

    const thirtyDaysAgo =
      since && /^\d{4}-\d{2}-\d{2}$/.test(since)
        ? since
        : addDaysIso(isoDateInTimeZone(), -30);

    if (!canQueryShifts(actor, queryType, operatorUid)) {
      return jsonError(403, 'Forbidden');
    }

    const includeFullData = {
      equipmentInspections: true,
      measurementRows: { include: { autoclaveEntries: true } },
      productionLogs: true,
      repairEntries: true,
      ingredientRecords: true,
      flowMetricsTotal: true,
    };

    if (queryType === 'slots') {
      if (!operatorUid) return jsonError(400, 'Missing operatorUid');
      const shifts = await prisma.shift.findMany({
        where: { operatorUid, shiftDate: { gte: thirtyDaysAgo } },
        select: { shiftDate: true, shiftType: true, stationCode: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return NextResponse.json({ ok: true, shifts });
    }

    if (queryType === 'operator') {
      if (!operatorUid) return jsonError(400, 'Missing operatorUid');
      const shifts = await prisma.shift.findMany({
        where: { operatorUid },
        include: includeFullData,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return NextResponse.json({ ok: true, shifts: shifts.map((s) => toShiftClientPayload(s)) });
    }

    if (queryType === 'active') {
      if (!operatorUid) return jsonError(400, 'Missing operatorUid');
      const shift = await prisma.shift.findFirst({
        where: { operatorUid, status: { in: ['Хадгалсан', 'Ноорог'] }, checkOut: null, operatorShiftCompleted: false },
        orderBy: { createdAt: 'desc' },
        select: { id: true, stationCode: true, shiftType: true, shiftDate: true },
      });
      return NextResponse.json({ ok: true, shift });
    }

    if (queryType === 'active_all') {
      const shifts = await prisma.shift.findMany({
        where: await masterScopedShiftWhere(actor, {
          status: { in: ['Хадгалсан', 'Ноорог'] },
          checkOut: null,
          operatorShiftCompleted: false,
        }),
        include: includeFullData,
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return NextResponse.json({
        ok: true,
        shifts: shifts.map((s: any) => {
          const stationProductionLogs = (s.productionLogs ?? []).filter((p: any) => !String(p?.logType || '').startsWith(MODAL_LOG_PREFIX));
          const modalLogs = (s.productionLogs ?? []).filter((p: any) => String(p?.logType || '').startsWith(MODAL_LOG_PREFIX));
          const payload = toShiftClientPayload({ ...s, productionLogs: stationProductionLogs });
          return { ...payload, modalLogs };
        }),
      });
    }

    if (queryType === 'master_overview') {
      const shiftDate = searchParams.get('shiftDate') || isoDateInTimeZone();
      const shiftType = searchParams.get('shiftType') || 'Өдрийн';
      const shifts = await prisma.shift.findMany({
        where: await masterScopedShiftWhere(actor, { shiftDate, shiftType }),
        include: includeFullData,
      });
      return NextResponse.json({ ok: true, shifts: shifts.map((s) => toShiftClientPayload(s)) });
    }

    if (queryType === 'dispatcher_compliance') {
      if (!['dispatcher', 'admin', 'chief_engineer', 'master'].includes(actor.role)) {
        return jsonError(403, 'Forbidden');
      }
      const shiftDate = searchParams.get('shiftDate') || isoDateInTimeZone();
      const shiftType = searchParams.get('shiftType') || 'Өдрийн';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate)) return jsonError(400, 'Invalid shiftDate');
      if (!['Өдрийн', 'Шөнийн'].includes(shiftType)) return jsonError(400, 'Invalid shiftType');
      const compliance = await resolveDispatcherCompliance({ shiftDate, shiftType });
      return NextResponse.json({ ok: true, ...compliance });
    }

    if (queryType === 'pending') {
      const shifts = await prisma.shift.findMany({
        where: await masterScopedShiftWhere(actor, masterApprovalPendingWhere(actor)),
        include: includeFullData,
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ ok: true, shifts: shifts.map((s) => toShiftClientPayload(s)) });
    }

    if (queryType === 'handover_context') {
      let where: any;
      let scheduleDerivedShifts: any[] = [];
      if (actor.role === 'operator') {
        where = {
          operatorUid: { not: actor.id },
          handoverRequestedAt: { not: null },
          OR: [{ nextOperatorUid: actor.id }, { handoverToOperatorUid: actor.id }],
        };

        const currentSchedules = await prisma.operatorSchedule.findMany({
          where: {
            operatorUid: actor.id,
            shiftDate: { gte: thirtyDaysAgo },
          },
          orderBy: [{ shiftDate: 'desc' }, { createdAt: 'desc' }],
          take: 80,
        });
        const currentActorShifts = await prisma.shift.findMany({
          where: {
            operatorUid: actor.id,
            shiftDate: { gte: thirtyDaysAgo },
            status: { notIn: Array.from(CANCELLED_SHIFT_STATUSES) },
          },
          select: { shiftDate: true, shiftType: true, stationCode: true },
          orderBy: { createdAt: 'desc' },
          take: 80,
        });

        const currentSlots = [...currentSchedules, ...currentActorShifts];
        const previousSlotFilters = currentSlots
          .map((schedule) => {
            const previous = previousHandoverSlot(schedule.shiftDate, schedule.shiftType);
            const stationCode = String(schedule.stationCode || '').trim();
            if (!previous?.shiftDate || !previous?.shiftType || !stationCode) return null;
            return {
              shiftDate: previous.shiftDate,
              shiftType: previous.shiftType,
              stationCode,
              operatorUid: { not: actor.id },
            };
          })
          .filter(Boolean) as any[];

        if (previousSlotFilters.length > 0) {
          scheduleDerivedShifts = await prisma.shift.findMany({
            where: {
              OR: previousSlotFilters,
              status: { notIn: Array.from(CANCELLED_SHIFT_STATUSES) },
            },
            include: includeFullData,
            orderBy: { createdAt: 'desc' },
            take: 80,
          });
        }
      } else if (actor.role === 'master') {
        where = await masterScopedShiftWhere(actor, {});
      } else {
        where = {};
      }

      const shifts = await prisma.shift.findMany({
        where,
        include: includeFullData,
        orderBy: { createdAt: 'desc' },
        take: 120,
      });
      const merged = mergeShiftRows([...shifts, ...scheduleDerivedShifts]);
      return NextResponse.json({ ok: true, shifts: merged.map((s) => toShiftClientPayload(s)) });
    }

    if (queryType === 'handover') {
      const where: any = {
        handoverAwaitingAcceptance: true,
        handoverRequestedAt: { not: null },
        operatorUid: { not: actor.id },
      };
      if (actor.role === 'operator') {
        where.handoverStage = { in: ['waiting_next_operator', 'waiting_next_master'] };
        where.OR = [
          { nextOperatorUid: actor.id },
          { handoverToOperatorUid: actor.id },
        ];
      } else if (actor.role === 'master') {
        where.OR = [
          { handoverStage: 'waiting_current_master', currentMasterUid: actor.id },
          { handoverStage: 'waiting_next_master', nextMasterUid: actor.id, nextOperatorUid: null },
          {
            shiftMasterUid: actor.id,
            OR: [{ handoverStage: null }, { handoverStage: '' }, { handoverStage: 'none' }],
          },
        ];
      }
      let shifts = await prisma.shift.findMany({
        where,
        include: includeFullData,
        orderBy: [{ handoverRequestedAt: 'asc' }, { id: 'asc' }],
      });
      if (actor.role === 'master') {
        shifts = shifts.filter((shift) => {
          const stage = String(shift.handoverStage || '').trim();
          if (stage === 'waiting_current_master') {
            // Хүсэлт илгээхэд хадгалсан хариуцагчийг canAcceptHandover-той адил хэрэглэнэ.
            return shift.currentMasterUid === actor.id;
          }
          if (stage === 'waiting_next_master') {
            return !shift.nextOperatorUid && shift.nextMasterUid === actor.id;
          }
          const isLegacyStage = !stage || stage === 'none';
          return isLegacyStage && shift.shiftMasterUid === actor.id;
        });
      }
      return NextResponse.json({ ok: true, shifts: shifts.map((s) => toShiftClientPayload(s)) });
    }

    if (queryType === 'admin_pending') {
      // Энэ нөхцөлийг /api/y310-approvals-ийн PENDING SQL давтдаг (мастер маягтыг «Мастер»
      // табаас хасахад) — өөрчилбөл тэндээ ч адил өөрчил.
      // Станцаар ХЯЗГААРЛАХГҮЙ: Нүүрийн «Админ баталгаажуулах» нийт тоо бүх ээлжийг тоолно. Оператор /
      // Мастер табад хуваахдаа клиент `approvalStationKind`-аар (lib/approval-history-query.ts) ялгана —
      // мастер станцын ээлж «Мастер» табад гарна.
      const where: any = {
        adminApproved: false,
        OR: [
          { masterApproved: true },
          {
            currentMasterApprovedAt: { not: null },
            OR: [
              { handoverStage: 'accepted' },
              { handoverFinalAcceptedAt: { not: null } },
            ],
          },
        ],
      };
      const [shifts, total] = await Promise.all([
        prisma.shift.findMany({
          where,
          include: includeFullData,
          orderBy: { createdAt: 'desc' },
          take: 2000,
        }),
        prisma.shift.count({ where }),
      ]);
      return NextResponse.json({ ok: true, shifts: shifts.map((s) => toShiftClientPayload(s)), total });
    }

    if (queryType === 'admin_approved') {
      let query;
      let stationKind: ApprovalStationKind | '' = '';
      try {
        query = parseApprovalHistoryQuery(searchParams);
        // «Оператор» таб 'operator', Мастер табын ээлжийн жагсаалт 'master' гэж дууддаг;
        // заагаагүй бол бүх станц (Нүүрийн «баталгаажсан» тоо).
        stationKind = parseApprovalStationKind(searchParams);
      }
      catch (error: any) { return jsonError(400, error.message); }
      if (query.query) {
        const filter = operatorApprovedSearchFilter(query, stationKind);
        const [shifts, total] = await prisma.$transaction(async (tx) => {
          const [ids, counts] = await Promise.all([
            tx.$queryRawUnsafe<Array<{ id: string }>>(
              `SELECT s."id" ${filter.fromSql} WHERE ${filter.whereSql}
               ORDER BY s."createdAt" DESC, s."id" DESC
               LIMIT $${filter.params.length + 1} OFFSET $${filter.params.length + 2}`,
              ...filter.params, query.pageSize, query.skip
            ),
            tx.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count ${filter.fromSql} WHERE ${filter.whereSql}`, ...filter.params),
          ]);
          const rows = ids.length ? await tx.shift.findMany({
            where: { id: { in: ids.map((row) => row.id) } },
            include: includeFullData, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          }) : [];
          return [rows, counts[0]?.count ?? 0] as const;
        }, { isolationLevel: 'RepeatableRead' });
        return NextResponse.json({ ok: true, shifts: shifts.map((s) => toShiftClientPayload(s)), total, ...approvalHistoryPagination(query, total) });
      }
      const crewUids = query.crew
        ? (await prisma.user.findMany({ where: { shiftGroup: query.crew }, select: { id: true } })).map((user) => user.id)
        : undefined;
      const where = operatorApprovedWhere(query, crewUids, stationKind);
      const [shifts, total] = await prisma.$transaction([
        prisma.shift.findMany({
          where,
          include: includeFullData,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: query.pageSize,
          skip: query.skip,
        }),
        prisma.shift.count({ where }),
      ], { isolationLevel: 'RepeatableRead' });
      return NextResponse.json({ ok: true, shifts: shifts.map((s) => toShiftClientPayload(s)), total, ...approvalHistoryPagination(query, total) });
    }

    if (queryType === 'kpi') {
      // ЗАСВАР: `withOperatorScopeFilter`-г шууд ашиглавал `crewOperatorUids` нь
      // `null` (баг тодорхойгүй мастер) буцаах үед ХЯЗГААРЛАЛТГҮЙ болж, тухайн
      // мастер БҮХ станцын БҮХ операторын ээлжийг харах алдаа гарч байсан.
      // `masterScopedShiftWhere` нь баггүй мастерыг ч зөв хязгаарлана (зөвхөн
      // өөрт нь шууд оноогдсон ба өөрийн станцын ээлжүүд).
      // Хязгаар (take) нь ачааллын хамгаалалт (нэг ээлж ~7.6KB, 8 сек тутам poll хийгддэг).
      // orderBy-гүй үед Prisma `ORDER BY id` (санамсаргүй UUID) гэж эрэмбэлж, 400-аас олон
      // ээлж байхад өдөр бүрээс санамсаргүй дутуу авдаг байсан — одоо хамгийн сүүлийнхээс.
      // Admin Нүүрийн 7 хоногийн тоог энэ жагсаалтаас биш `kpi_trend`-ээр серверт тоолно.
      const shifts = await prisma.shift.findMany({
        where: await masterScopedShiftWhere(actor, { shiftDate: { gte: thirtyDaysAgo } }),
        include: includeFullData,
        orderBy: [{ shiftDate: 'desc' }, { createdAt: 'desc' }],
        take: 400,
      });
      return NextResponse.json({
        ok: true,
        shifts: shifts.map((s: any) => {
          const stationProductionLogs = (s.productionLogs ?? []).filter((p: any) => !String(p?.logType || '').startsWith(MODAL_LOG_PREFIX));
          const modalLogs = (s.productionLogs ?? []).filter((p: any) => String(p?.logType || '').startsWith(MODAL_LOG_PREFIX));
          const payload = toShiftClientPayload({ ...s, productionLogs: stationProductionLogs });
          return { ...payload, modalLogs };
        }),
      });
    }

    if (queryType === 'kpi_trend') {
      // Admin Нүүрийн «Сүүлийн 7 хоног»: `until` (толгойд сонгосон огноо) хүртэлх 7 өдрийн
      // ээлжийг серверт БҮТЭН тоолно (kpi-ийн хязгаартай жагсаалтаас биш).
      const until = String(searchParams.get('until') || '').trim() || isoDateInTimeZone();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) return jsonError(400, 'Invalid until');
      const from = addDaysIso(until, -6);
      const groups = await prisma.shift.groupBy({
        by: ['shiftDate', 'status'],
        where: await masterScopedShiftWhere(actor, { shiftDate: { gte: from, lte: until } }),
        _count: { _all: true },
      });
      const trend = new Map<string, { date: string; total: number; approved: number; pending: number }>();
      for (let d = from; d <= until; d = addDaysIso(d, 1)) trend.set(d, { date: d, total: 0, approved: 0, pending: 0 });
      for (const g of groups) {
        const row = trend.get(String(g.shiftDate || '').slice(0, 10));
        if (!row) continue;
        const n = g._count._all;
        row.total += n;
        const status = String(g.status || '').toLowerCase();
        if (status.includes('баталгаажсан') || status.includes('approved')) row.approved += n;
        else row.pending += n;
      }
      return NextResponse.json({ ok: true, trend: Array.from(trend.values()) });
    }

    return jsonError(400, 'Invalid queryType');
  } catch (e) {
    console.error('GET /api/shifts', e);
    return jsonError(500, 'Database error');
  }
}

/** POST /api/shifts — create a new shift record */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const actor = sessionActor(session as any);
  if (!actor) return jsonError(401, 'Unauthorized');
  const deviceAccess = await getDeviceAccessForRequest(session, req);
  if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON');
  }

  const operatorUid = String(body.operatorUid || '');
  const operatorName = String(body.operatorName || '');
  const stationCode = String(body.stationCode || '');
  const shiftType = body.shiftType as string;
  const shiftDate = String(body.shiftDate || isoDateInTimeZone());
  const status = String(body.status || 'Хадгалсан');

  if (!canCreateShiftFor(actor, operatorUid)) {
    return jsonError(403, 'Энэ хэрэглэгчийн нэрээр ээлж үүсгэх эрхгүй');
  }

  if (!operatorUid || !operatorName) return jsonError(400, 'Missing operator info');
  if (!stationCode) return jsonError(400, 'Missing stationCode');
  if (shiftType !== 'Өдрийн' && shiftType !== 'Шөнийн') return jsonError(400, 'Invalid shiftType');
  if (!CREATABLE_SHIFT_STATUSES.has(status)) return jsonError(400, 'Invalid status');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate)) return jsonError(400, 'Invalid shiftDate');

  // Оператор нэг ээлжид (огноо + ээлж + дамжлага) нэг л бүртгэлтэй. Урьд нь зөвхөн тухайн өдөр
  // хуваарьтай үед (доорх `scheds.length > 0`) шалгадаг байсан тул хуваарьгүй оператор (ж: ҮЯ-180)
  // ижил ээлжийг дахин эхлүүлж, маягт нь нэг бичлэгт, мастерт илгээсэн нь нөгөө (хоосон) бичлэгт
  // үлддэг байв. `existingShiftId`-аар клиент өмнөх бүртгэл рүү нь шилжүүлнэ.
  if (actor.role === 'operator') {
    const existingShift = await prisma.shift.findFirst({
      where: {
        operatorUid,
        shiftDate,
        shiftType,
        stationCode,
        status: { notIn: Array.from(CANCELLED_SHIFT_STATUSES) },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (existingShift) {
      return NextResponse.json(
        {
          ok: false,
          error: `Энэ ээлж (${shiftDate} ${shiftType}, ${stationCode}) аль хэдийн эхэлсэн байна. Өмнөх бүртгэлээ үргэлжлүүлнэ үү.`,
          existingShiftId: existingShift.id,
        },
        { status: 409 }
      );
    }
  }

  // Fix 1: Өмнөх ээлжийн хүлээлцэх процесс дуусаагүй бол дараагийн оператор ээлж эхлүүлэхийг хориглох.
  // Зөвхөн оператор роль-д хамаарна (admin/master bypass хийнэ).
  if (actor.role === 'operator') {
    const prevSlot = previousHandoverSlot(shiftDate, shiftType);
    if (prevSlot?.shiftDate && prevSlot?.shiftType) {
      const prevShift = await prisma.shift.findFirst({
        where: {
          stationCode,
          shiftDate: prevSlot.shiftDate,
          shiftType: prevSlot.shiftType,
          status: { notIn: Array.from(CANCELLED_SHIFT_STATUSES) },
        },
        select: {
          id: true,
          operatorName: true,
          operatorShiftCompleted: true,
          handoverRequestedAt: true,
          handoverFinalAcceptedAt: true,
          handoverStage: true,
          currentMasterApprovedAt: true,
          nextMasterApprovedAt: true,
          masterApproved: true,
          handoverReturnReason: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      const prevSchedule = await prisma.operatorSchedule.findFirst({
        where: {
          stationCode,
          shiftDate: prevSlot.shiftDate,
          shiftType: prevSlot.shiftType,
        },
        select: {
          operatorName: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (prevSchedule && !prevShift) {
        return jsonError(
          403,
          `Өмнөх ээлж (${prevSlot.shiftDate} ${prevSlot.shiftType}${prevSchedule.operatorName ? ' — ' + prevSchedule.operatorName : ''}) хараахан эхэлж/дуусгаагүй байна. Өмнөх operator ээлжээ дуусгаж master баталгаажуулсны дараа дараагийн operator ээлж эхлүүлнэ.`
        );
      }
      if (prevShift) {
        const stage = String(prevShift.handoverStage || '').trim();
        const isPreviousOperatorFinished =
          !!prevShift.operatorShiftCompleted ||
          !!prevShift.handoverRequestedAt ||
          !!prevShift.currentMasterApprovedAt ||
          !!prevShift.nextMasterApprovedAt ||
          !!prevShift.handoverFinalAcceptedAt ||
          stage === 'waiting_current_master' ||
          stage === 'waiting_next_master' ||
          stage === 'waiting_next_operator' ||
          stage === 'accepted';
        const isPreviousMasterApproved =
          !!prevShift.currentMasterApprovedAt ||
          !!prevShift.nextMasterApprovedAt ||
          !!prevShift.masterApproved ||
          !!prevShift.handoverFinalAcceptedAt ||
          stage === 'waiting_next_master' ||
          stage === 'waiting_next_operator' ||
          stage === 'accepted';

        if (!isPreviousOperatorFinished) {
          return jsonError(
            403,
            `Өмнөх ээлж (${prevSlot.shiftDate} ${prevSlot.shiftType}${prevShift.operatorName ? ' — ' + prevShift.operatorName : ''}) дуусаагүй байна. Өмнөх operator ээлжээ дуусгаж master-руу илгээсний дараа дараагийн operator эхлүүлнэ.`
          );
        }
        if (stage === 'returned') {
          return jsonError(
            403,
            `Өмнөх ээлж (${prevSlot.shiftDate} ${prevSlot.shiftType}${prevShift.operatorName ? ' — ' + prevShift.operatorName : ''}) master-аас буцаагдсан байна.${prevShift.handoverReturnReason ? ' Шалтгаан: ' + prevShift.handoverReturnReason : ''}`
          );
        }
        if (!isPreviousMasterApproved) {
          return jsonError(
            403,
            `Өмнөх ээлж (${prevSlot.shiftDate} ${prevSlot.shiftType}${prevShift.operatorName ? ' — ' + prevShift.operatorName : ''}) master-аар баталгаажаагүй байна. Master баталгаажуулсны дараа дараагийн operator ээлж эхлүүлнэ.`
          );
        }
      }
    }
  }

  // If admin assigned a schedule for this slot, operator must start on that station.
  if (actor.role === 'operator') {
    const scheds = await prisma.operatorSchedule.findMany({
      where: { operatorUid, shiftDate },
      select: { id: true, stationCode: true, shiftType: true, createdAt: true },
      orderBy: [{ shiftDate: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    });
    if (scheds.length > 0) {
      const selectedKey = scheduleSlotKey({ shiftDate, shiftType, stationCode });
      const stationScheds = scheds.filter((s) => String(s.stationCode || '').trim() === stationCode);
      const ok = stationScheds.some(
        (s) => String(s.shiftType || '') === shiftType
      );
      if (!ok) return jsonError(403, 'Оноогдсон хуваарийн дагуу ээлж эхлүүлнэ үү');

      const started = await prisma.shift.findMany({
        where: { operatorUid, shiftDate, stationCode },
        select: { stationCode: true, shiftType: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      const startedKeys = new Set(
        started
          .filter((s) => !CANCELLED_SHIFT_STATUSES.has(String(s.status || '').trim()))
          .map((s) => scheduleSlotKey({ shiftDate, shiftType: s.shiftType, stationCode: s.stationCode }))
      );
      if (startedKeys.has(selectedKey)) {
        return jsonError(409, 'Энэ хуваарь дээр ээлж аль хэдийн эхэлсэн байна.');
      }

      const nextOpen = stationScheds
        .filter((s) => !startedKeys.has(scheduleSlotKey({ shiftDate, shiftType: s.shiftType, stationCode: s.stationCode })))
        .sort((a, b) => {
          const typeCompare = shiftTypeSortOrder(a.shiftType) - shiftTypeSortOrder(b.shiftType);
          if (typeCompare !== 0) return typeCompare;
          return a.createdAt.getTime() - b.createdAt.getTime();
        })[0];
      const nextOpenKey = nextOpen
        ? scheduleSlotKey({ shiftDate, shiftType: nextOpen.shiftType, stationCode: nextOpen.stationCode })
        : null;
      if (nextOpenKey && nextOpenKey !== selectedKey) {
        return jsonError(403, 'Ээлжийг хуваарийн дарааллаар эхлүүлнэ үү. Өмнөх хуваарь эхлээгүй байна.');
      }
    }
  }

  if (actor.role === 'master' && actor.id === operatorUid) {
    if (!isMasterStationCode(stationCode)) {
      return jsonError(400, 'Мастер зөвхөн мастерын дамжлага дээр ээлж эхлүүлнэ.');
    }

    // Ижил slot дээр ээлж аль хэдийн эхэлсэн эсэхийг шалгана.
    const existingMasterShift = await prisma.shift.findFirst({
      where: {
        operatorUid: actor.id,
        shiftDate,
        shiftType,
        stationCode,
        status: { notIn: Array.from(CANCELLED_SHIFT_STATUSES) },
      },
      select: { id: true },
    });
    if (existingMasterShift) {
      return jsonError(409, 'Энэ хуваарь дээр ээлж аль хэдийн эхэлсэн байна.');
    }
  }

  // Master shifts (ҮЯ-099/310/410) start empty; form is filled on the shift page.
  const formKey = FORM_KEY_BY_STATION[stationCode];
  if (!formKey && !isMasterStationCode(stationCode)) {
    return jsonError(400, `Unsupported stationCode: ${stationCode}`);
  }

  const formPayload = formKey ? body[formKey] : null;
  const decomposed = formPayload ? decomposePayload(stationCode, formPayload) : null;
  const shiftScalars = decomposed?.shiftScalars ?? {};
  const equipmentInspections = decomposed?.equipmentInspections ?? [];
  const measurementRows = decomposed?.measurementRows ?? [];
  const productionLogs = decomposed?.productionLogs ?? [];
  const repairEntries = decomposed?.repairEntries ?? [];
  const ingredientRecords = decomposed?.ingredientRecords ?? [];
  const flowMetricsTotal = decomposed?.flowMetricsTotal ?? null;

  try {
    const data: any = {
      operatorUid,
      operatorName,
      stationCode,
      stationName: STATION_NAME_BY_CODE[stationCode],
      shiftType,
      shiftDate,
      checkIn: new Date().toISOString(),
      status,
      shiftNumber: makeShiftNumber(),
      ...shiftScalars,
    };

    if (equipmentInspections.length > 0) data.equipmentInspections = { create: equipmentInspections };

    if (measurementRows.length > 0) {
      data.measurementRows = {
        create: measurementRows.map((mr) => {
          const { _autoclaves, ...rest } = mr;
          const row: any = { ...rest };
          if (_autoclaves && (_autoclaves as any[]).length > 0)
            row.autoclaveEntries = { create: _autoclaves };
          return row;
        }),
      };
    }

    if (productionLogs.length > 0) data.productionLogs = { create: productionLogs };

    if (repairEntries.length > 0) data.repairEntries = { create: repairEntries };

    if (ingredientRecords.length > 0) data.ingredientRecords = { create: ingredientRecords };

    if (flowMetricsTotal) data.flowMetricsTotal = { create: flowMetricsTotal };

    const assignedMaster = await findAssignedMasterForShift({
      shiftDate,
      shiftType,
      stationCode,
      operatorUid,
    });
    if (assignedMaster?.masterUid) {
      if (String(assignedMaster.masterUid).trim() === String(operatorUid).trim()) {
        return jsonError(400, 'Мастер болон оператор нэг хэрэглэгч байж болохгүй. Admin хуваарь/хяналтын бүтцийг шалгана уу.');
      }
      data.shiftMasterUid = String(assignedMaster.masterUid);
    } else if (actor.role === 'master' && actor.id === operatorUid) {
      data.shiftMasterUid = actor.id;
    }

    const shift = await prisma.shift.create({ data });

    await writeServerAuditLog({
      actorUid: actor.id,
      actorName: actor.name ?? null,
      action: 'shift_created',
      entityType: 'shift',
      entityId: shift.id,
      details: `${stationCode} ${shiftDate} ${shiftType}`,
    });

    // Оператор өөрөө ээлжээ эхлүүлсэн үед л — түүнд хүлээлгэн өгсөн өмнөх ээлжүүдийг хүлээн авсанд тооцно.
    const autoAcceptedHandovers =
      actor.role === 'operator' && actor.id === operatorUid
        ? await autoAcceptPreviousHandovers({ id: shift.id, operatorUid, operatorName, stationCode, shiftDate, shiftType })
        : [];

    return NextResponse.json({ ok: true, id: shift.id, autoAcceptedHandovers });
  } catch (e) {
    console.error('POST /api/shifts', e);
    return jsonError(500, 'Database error');
  }
}

/**
 * Оператор тухайн дамжлагад ээлжээ эхлүүлмэгц түүнд хүлээлгэн өгсөн өмнөх ээлжүүдийг хүлээн авсанд
 * тооцно (дүрэм: lib/handover-auto-accept.ts). Алдаа гарсан ч ээлж эхлүүлэхийг ЗОГСООХГҮЙ — ээлж
 * аль хэдийн үүссэн, хүлээн авалтыг гараар хийх боломж хэвээр.
 */
async function autoAcceptPreviousHandovers(started: StartedShift & { id: string }) {
  try {
    const accepted = await autoAcceptHandoversOnShiftStart(prisma, started);
    for (const prev of accepted) {
      await writeServerAuditLog({
        actorUid: started.operatorUid,
        actorName: started.operatorName,
        action: 'shift_handover_auto_accepted',
        entityType: 'shift',
        entityId: prev.id,
        details: `${prev.stationCode} ${prev.shiftDate} ${prev.shiftType} — ${started.shiftDate} ${started.shiftType} ээлж эхэлсэн (${started.id})`,
      });
      const recipients = [prev.operatorUid, prev.shiftMasterUid].filter((uid): uid is string => Boolean(uid));
      await notifyManyDeduped(
        recipients,
        {
          kind: 'handover_accepted',
          title: 'Ээлж хүлээлцэх баталгаажсан',
          body: `${prev.stationCode} (${prev.shiftDate}, ${prev.shiftType}) — Хүлээн авсан: ${started.operatorName || ''}${AUTO_ACCEPT_NAME_SUFFIX}`,
          link: `/shift/${prev.id}`,
          dedupeKey: `handover_accepted:${prev.id}`,
        },
        { windowMinutes: 12 * 60 }
      );
    }
    return accepted.map((prev) => ({
      id: prev.id,
      shiftDate: prev.shiftDate,
      shiftType: prev.shiftType,
      operatorName: prev.operatorName,
    }));
  } catch (e) {
    console.error('POST /api/shifts auto-accept', e);
    return [];
  }
}
