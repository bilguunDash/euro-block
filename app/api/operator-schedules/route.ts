import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { createNotificationDeduped } from '@/lib/server-notifications';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';
import { resolveCrewMasterForShift } from '@/lib/crew-master';

function normDate(d: unknown): string {
  const s = String(d ?? '').trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : s.slice(0, 10);
}
function normType(t: unknown): string {
  return String(t ?? '')
    .trim()
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ');
}
function normStation(c: unknown): string {
  return String(c ?? '').trim();
}

const CANCELLED = new Set(['Цуцлагдсан']);

const BULK_RANGE_MAX_DAYS = 92;

/** [start..end] ISO өдрүүдийг (хоёр захыг оруулаад) буцаана. */
function expandDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  let cur = Date.UTC(sy, sm - 1, sd);
  const last = Date.UTC(ey, em - 1, ed);
  while (cur <= last) {
    dates.push(new Date(cur).toISOString().slice(0, 10));
    cur += 24 * 60 * 60 * 1000;
    if (dates.length > BULK_RANGE_MAX_DAYS + 1) break;
  }
  return dates;
}

function shiftTypeSortOrder(value: unknown) {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'өдрийн' || type.includes('өдр')) return 1;
  if (type === 'шөнийн' || type.includes('шөн')) return 2;
  return 99;
}

function compareScheduleRows(a: any, b: any) {
  const dateCompare = normDate(a?.shiftDate).localeCompare(normDate(b?.shiftDate));
  if (dateCompare !== 0) return dateCompare;
  const typeCompare = shiftTypeSortOrder(a?.shiftType) - shiftTypeSortOrder(b?.shiftType);
  if (typeCompare !== 0) return typeCompare;
  return new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime();
}

function sessionActor(session: any) {
  if (!session?.user?.id) return null;
  return {
    id: String(session.user.id),
    role: String((session.user as any).role || 'operator'),
    email: String(session.user?.email || '').trim().toLowerCase(),
  };
}

function canManage(actor: { role: string }) {
  return actor.role === 'admin' || actor.role === 'dispatcher';
}

function canWriteSchedules(actor: { role: string }) {
  return actor.role === 'admin';
}

function monthToRange(month: string): { gte: string; lte: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || '').trim());
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(y) || !Number.isFinite(mm) || mm < 1 || mm > 12) return null;
  const start = `${String(y).padStart(4, '0')}-${String(mm).padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(y, mm, 0)); // last day of month
  const end = endDate.toISOString().slice(0, 10);
  return { gte: start, lte: end };
}

export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const actor = sessionActor(session);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

    const { searchParams } = new URL(req.url);
    const queryType = searchParams.get('queryType') || 'mine';
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (queryType === 'assigned_master') {
      const shiftDate = searchParams.get('shiftDate') || '';
      const shiftType = searchParams.get('shiftType') || '';
      const stationCode = normStation(searchParams.get('stationCode'));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate) || !shiftType || !stationCode) {
        return NextResponse.json({ error: 'Missing shiftDate, shiftType, or stationCode' }, { status: 400 });
      }

      let uid = actor.id;
      if (canManage(actor)) {
        const requestedOperatorUid = String(searchParams.get('operatorUid') || '').trim();
        if (requestedOperatorUid) uid = requestedOperatorUid;
      } else if (actor.email) {
        const u = await prisma.user.findUnique({ where: { email: actor.email }, select: { id: true } });
        if (u?.id) uid = String(u.id);
      }

      // Багийн аль ч мастер аль ч операторыг хариуцаж болно — сонголтын дүрэм
      // `lib/crew-master.ts`-д (slot-д хуваарьтай мастер эхэнд, дараа нь ҮЯ-099).
      const assignment = await resolveCrewMasterForShift({
        operatorUid: uid,
        shiftDate: normDate(shiftDate),
        shiftType: normType(shiftType),
      });

      return NextResponse.json({
        ok: true,
        master: assignment
          ? {
              masterUid: assignment.masterUid,
              masterName: assignment.masterName || null,
            }
          : null,
      });
    }

    if (queryType === 'for_slot') {
      const shiftDate = searchParams.get('shiftDate') || '';
      const shiftType = searchParams.get('shiftType') || '';
      const stationCode = normStation(searchParams.get('stationCode'));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate) || !shiftType || !stationCode) {
        return NextResponse.json({ error: 'Missing shiftDate, shiftType, or stationCode' }, { status: 400 });
      }
      const rows = await prisma.operatorSchedule.findMany({
        where: {
          shiftDate: normDate(shiftDate),
          shiftType: normType(shiftType),
          stationCode,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      return NextResponse.json({
        ok: true,
        schedules: rows.map((s) => ({ ...s, id: s.id.toString(), createdAt: s.createdAt.toISOString() })),
      });
    }

    if (queryType === 'mine_calendar') {
      let uid = actor.id;
      if (actor.email) {
        const u = await prisma.user.findUnique({ where: { email: actor.email }, select: { id: true } });
        if (u?.id) uid = String(u.id);
      }

      const month = searchParams.get('month') || '';
      const from = normDate(searchParams.get('from') || '');
      const to = normDate(searchParams.get('to') || '');
      const monthRange = month ? monthToRange(month) : null;
      const range =
        /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)
          ? { gte: from, lte: to }
          : monthRange;

      const where: any = { operatorUid: uid };
      if (range) where.shiftDate = range;

      const schedules = await prisma.operatorSchedule.findMany({
        where,
        orderBy: [{ shiftDate: 'asc' }, { createdAt: 'desc' }],
        take: 500,
      });

      const started = await prisma.shift.findMany({
        where: { operatorUid: uid },
        select: { id: true, operatorUid: true, shiftDate: true, shiftType: true, stationCode: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: 2000,
      });

      const annotated = schedules.map((row) => {
        const code = normStation(row.stationCode);
        const rd = normDate(row.shiftDate);
        const rt = normType(row.shiftType);
        const op = String(row.operatorUid || '').trim();
        const existingShift = started.find((s) => {
          if (CANCELLED.has(String(s.status ?? '').trim())) return false;
          return (
            String(s.operatorUid || '').trim() === op &&
            normDate(s.shiftDate) === rd &&
            normType(s.shiftType) === rt &&
            normStation(s.stationCode) === code
          );
        });
        return {
          ...row,
          existingShiftId: existingShift?.id ? String(existingShift.id) : null,
          existingShiftStatus: existingShift?.status || null,
        };
      });

      return NextResponse.json({
        ok: true,
        schedules: annotated.map((s) => ({ ...s, id: s.id.toString(), createdAt: s.createdAt.toISOString() })),
      });
    }

    if (queryType === 'mine') {
      let uid = actor.id;
      if (actor.email) {
        const u = await prisma.user.findUnique({ where: { email: actor.email }, select: { id: true } });
        if (u?.id) uid = String(u.id);
      }

      const schedules = await prisma.operatorSchedule.findMany({
        where: { operatorUid: uid, shiftDate: { gte: thirtyDaysAgo } },
        orderBy: { createdAt: 'desc' },
      });

      const started = await prisma.shift.findMany({
        where: { operatorUid: uid },
        select: { operatorUid: true, shiftDate: true, shiftType: true, stationCode: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: 2000,
      });

      const visible = schedules.filter((row) => {
        const code = normStation(row.stationCode);
        const rd = normDate(row.shiftDate);
        const rt = normType(row.shiftType);
        const op = String(row.operatorUid || '').trim();
        const taken = started.some((s) => {
          if (CANCELLED.has(String(s.status ?? '').trim())) return false;
          return (
            String(s.operatorUid || '').trim() === op &&
            normDate(s.shiftDate) === rd &&
            normType(s.shiftType) === rt &&
            normStation(s.stationCode) === code
          );
        });
        return !taken;
      });

      return NextResponse.json({
        ok: true,
        schedules: visible
          .slice()
          .sort(compareScheduleRows)
          .map((s) => ({ ...s, id: s.id.toString(), createdAt: s.createdAt.toISOString() })),
      });
    }

    if (queryType === 'all') {
      if (!canManage(actor) && actor.role !== 'master' && actor.role !== 'chief_engineer') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const month = searchParams.get('month') || '';
      const shiftType = searchParams.get('shiftType') || '';
      const stationCode = normStation(searchParams.get('stationCode') || '');
      const operatorUid = String(searchParams.get('operatorUid') || '').trim();

      const range = month ? monthToRange(month) : null;
      const where: any = { shiftDate: { gte: thirtyDaysAgo } };
      if (range) where.shiftDate = { gte: range.gte, lte: range.lte };
      if (shiftType) where.shiftType = normType(shiftType);
      if (stationCode) where.stationCode = stationCode;
      if (operatorUid) where.operatorUid = operatorUid;

      const schedules = await prisma.operatorSchedule.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 2000,
      });
      return NextResponse.json({
        ok: true,
        schedules: schedules.map((s) => ({ ...s, id: s.id.toString(), createdAt: s.createdAt.toISOString() })),
      });
    }

    return NextResponse.json({ error: 'Invalid queryType' }, { status: 400 });
  } catch (e: any) {
    console.error('GET /api/operator-schedules', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const actor = sessionActor(session);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);
    if (!canWriteSchedules(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    if (!body.shiftDate || !body.shiftType || !body.stationCode || !body.operatorUid) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const shiftDate = normDate(body.shiftDate);
    const shiftType = normType(body.shiftType);
    const stationCode = normStation(body.stationCode);
    const operatorUid = String(body.operatorUid).trim();
    const operator = await prisma.user.findUnique({
      where: { id: operatorUid },
      select: { role: true },
    });
    if (!operator || operator.role !== 'operator') {
      return NextResponse.json({ error: 'Зөв оператор сонгоно уу.' }, { status: 400 });
    }

    // ── Bulk (огнооны муж) — endDate бөглөгдсөн бол [shiftDate..endDate] бүх өдөрт оноох ──
    const endDate = normDate(body.endDate || '');
    if (endDate && endDate !== shiftDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        return NextResponse.json({ error: 'Дуусах огноо буруу байна.' }, { status: 400 });
      }
      if (endDate < shiftDate) {
        return NextResponse.json({ error: 'Дуусах огноо эхлэхээс өмнө байж болохгүй.' }, { status: 400 });
      }
      const dates = expandDateRange(shiftDate, endDate);
      if (dates.length > BULK_RANGE_MAX_DAYS) {
        return NextResponse.json({ error: `Огнооны муж хэт урт байна (дээд тал нь ${BULK_RANGE_MAX_DAYS} өдөр).` }, { status: 400 });
      }

      const existingRows = await prisma.operatorSchedule.findMany({
        where: { shiftType, stationCode, operatorUid, shiftDate: { in: dates } },
        select: { shiftDate: true },
      });
      const existingSet = new Set(existingRows.map((r) => normDate(r.shiftDate)));
      const toCreate = dates.filter((d) => !existingSet.has(d));

      if (toCreate.length > 0) {
        await prisma.operatorSchedule.createMany({
          data: toCreate.map((d) => ({
            shiftDate: d,
            shiftType,
            stationCode,
            operatorUid,
            operatorName: body.operatorName || null,
          })),
        });

        await createNotificationDeduped(
          {
            userId: operatorUid,
            kind: 'shift_assigned',
            dedupeKey: `shift_assigned_bulk:${shiftDate}:${endDate}:${shiftType}:${stationCode}`,
            title: 'Ээлж оноолт',
            body: `${shiftDate}–${endDate} хооронд ${shiftType} ээлжийн ${stationCode} дамжлагад ${toCreate.length} өдөр оноогдлоо.`,
            link: '/dashboard',
          },
          { windowMinutes: 24 * 60 }
        );

        await prisma.auditLog.create({
          data: {
            actorUid: actor.id,
            actorName: session.user?.name || '',
            action: 'operator_schedule_created',
            entityType: 'operator_schedule',
            entityId: operatorUid,
            details: JSON.stringify({ bulk: true, shiftDate, endDate, shiftType, stationCode, created: toCreate.length }),
          },
        });
      }

      return NextResponse.json({ ok: true, created: toCreate.length, skipped: dates.length - toCreate.length });
    }

    const existing = await prisma.operatorSchedule.findFirst({
      where: {
        shiftDate,
        shiftType,
        stationCode,
        operatorUid,
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (existing?.id) {
      return NextResponse.json({ ok: true, id: existing.id.toString(), duplicate: true });
    }

    const row = await prisma.operatorSchedule.create({
      data: {
        shiftDate,
        shiftType,
        stationCode,
        operatorUid,
        operatorName: body.operatorName || null,
      },
    });

    await createNotificationDeduped(
      {
        userId: row.operatorUid,
        kind: 'shift_assigned',
        dedupeKey: `shift_assigned:${row.shiftDate}:${row.shiftType}:${row.stationCode}`,
        title: 'Ээлж оноолт',
        body: `${row.shiftDate} өдрийн ${row.shiftType} ээлжинд ${row.stationCode} дамжлага дээр оноогдлоо.`,
        link: '/dashboard',
      },
      { windowMinutes: 24 * 60 }
    );

    await prisma.auditLog.create({
      data: {
        actorUid: actor.id,
        actorName: session.user?.name || '',
        action: 'operator_schedule_created',
        entityType: 'operator_schedule',
        entityId: row.id,
        details: JSON.stringify({ shiftDate: row.shiftDate, stationCode: row.stationCode }),
      },
    });

    return NextResponse.json({ ok: true, id: row.id.toString() });
  } catch (e: any) {
    console.error('POST /api/operator-schedules', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const actor = sessionActor(session);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);
    if (!canWriteSchedules(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const data: any = {};
    if (body.shiftDate != null) data.shiftDate = normDate(body.shiftDate);
    if (body.shiftType != null) data.shiftType = normType(body.shiftType);
    if (body.stationCode != null) data.stationCode = normStation(body.stationCode);
    if (body.operatorUid != null) data.operatorUid = String(body.operatorUid).trim();
    if (body.operatorName !== undefined) data.operatorName = body.operatorName ? String(body.operatorName) : null;

    const prev = await prisma.operatorSchedule.findUnique({
      where: { id },
      select: { id: true, shiftDate: true, shiftType: true, stationCode: true, operatorUid: true },
    });
    if (!prev) return NextResponse.json({ error: 'Операторын хуваарь олдсонгүй. Жагсаалтаа шинэчлээд дахин оролдоно уу.' }, { status: 404 });

    const nextOperatorUid = body.operatorUid != null ? String(body.operatorUid).trim() : String(prev?.operatorUid || '').trim();
    if (nextOperatorUid) {
      const operator = await prisma.user.findUnique({
        where: { id: nextOperatorUid },
        select: { role: true },
      });
      if (!operator || operator.role !== 'operator') {
        return NextResponse.json({ error: 'Зөв оператор сонгоно уу.' }, { status: 400 });
      }
    }
    const row = await prisma.operatorSchedule.update({ where: { id }, data });

    const changedSlot =
      !prev ||
      normDate(prev.shiftDate) !== normDate(row.shiftDate) ||
      normType(prev.shiftType) !== normType(row.shiftType) ||
      normStation(prev.stationCode) !== normStation(row.stationCode) ||
      String(prev.operatorUid || '').trim() !== String(row.operatorUid || '').trim();
    if (changedSlot) {
      const prevOperatorUid = String(prev?.operatorUid || '').trim();
      const nextOperatorUid = String(row.operatorUid || '').trim();
      const prevShiftDate = normDate(prev?.shiftDate);
      const prevShiftType = normType(prev?.shiftType);
      const prevStationCode = normStation(prev?.stationCode);

      if (prevOperatorUid) {
        await prisma.notification.updateMany({
          where: {
            userId: prevOperatorUid,
            kind: 'shift_assigned',
            dedupeKey: `shift_assigned:${prevShiftDate}:${prevShiftType}:${prevStationCode}`,
            read: false,
          },
          data: { read: true },
        });
      }

      if (prevOperatorUid && prevOperatorUid !== nextOperatorUid) {
        await createNotificationDeduped(
          {
            userId: prevOperatorUid,
            kind: 'shift_schedule_removed',
            dedupeKey: `shift_schedule_removed:${id}:${prevShiftDate}:${prevShiftType}:${prevStationCode}`,
            title: 'Ээлжийн оноолт өөрчлөгдсөн',
            body: `${prevShiftDate} өдрийн ${prevShiftType} ээлж (${prevStationCode}) өөрчлөгдлөө.`,
            link: '/dashboard',
          },
          { windowMinutes: 24 * 60 }
        );
      }

      await createNotificationDeduped(
        {
          userId: row.operatorUid,
          kind: 'shift_assigned',
          dedupeKey: `shift_assigned:${row.shiftDate}:${row.shiftType}:${row.stationCode}`,
          title: 'Ээлж оноолт (шинэчлэгдсэн)',
          body: `${row.shiftDate} өдрийн ${row.shiftType} ээлжинд ${row.stationCode} дамжлага дээр оноогдлоо.`,
          link: '/dashboard',
        },
        { windowMinutes: 24 * 60 }
      );
    }

    await prisma.auditLog.create({
      data: {
        actorUid: actor.id,
        actorName: session.user?.name || '',
          action: 'operator_schedule_updated',
          entityType: 'operator_schedule',
          entityId: row.id,
          details: JSON.stringify({ shiftDate: row.shiftDate, stationCode: row.stationCode }),
        },
      });

    return NextResponse.json({
      ok: true,
      schedule: { ...row, id: row.id.toString(), createdAt: row.createdAt.toISOString() },
    });
  } catch (e: any) {
    console.error('PATCH /api/operator-schedules', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const actor = sessionActor(session);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);
    if (!canWriteSchedules(actor)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const existing = await prisma.operatorSchedule.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Операторын хуваарь олдсонгүй. Жагсаалтаа шинэчлээд дахин оролдоно уу.' }, { status: 404 });

    const deleted = await prisma.operatorSchedule.delete({ where: { id } });

    await createNotificationDeduped(
      {
        userId: deleted.operatorUid,
        kind: 'shift_schedule_removed',
        dedupeKey: `shift_schedule_removed:${deleted.shiftDate}:${deleted.shiftType}:${deleted.stationCode}`,
        title: 'Ээлжийн оноолт цуцлагдсан',
        body: `${deleted.shiftDate} өдрийн ${deleted.shiftType} ээлж (${deleted.stationCode}) цуцлагдлаа.`,
        link: '/dashboard',
      },
      { windowMinutes: 24 * 60 }
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('DELETE /api/operator-schedules', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
