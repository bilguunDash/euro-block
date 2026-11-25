import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { createNotificationDeduped } from '@/lib/server-notifications';
import { isMasterStationCode } from '@/lib/master-stations';

/** Normalize DB / querystring variants (ISO prefix, NBSP, spaces). */
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

const CANCELLED_SHIFT_STATUSES = new Set(['Цуцлагдсан']);

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
    if (dates.length > BULK_RANGE_MAX_DAYS) break;
  }
  return dates;
}

async function notifyMasterScheduleRemoved(row: {
  masterUid: string;
  shiftDate: string;
  shiftType: string;
  stationCode: string;
}) {
  await createNotificationDeduped(
    {
      userId: row.masterUid,
      kind: 'shift_schedule_removed',
      dedupeKey: `shift_schedule_removed:${row.shiftDate}:${row.shiftType}:${row.stationCode}`,
      title: 'Ээлжийн оноолт цуцлагдсан',
      body: `${row.shiftDate} өдрийн ${row.shiftType} ээлж (${row.stationCode}) цуцлагдлаа.`,
      link: '/dashboard',
    },
    { windowMinutes: 24 * 60 }
  );
}

function monthToRange(month: string): { gte: string; lte: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || '').trim());
  if (!m) return null;
  const y = Number.parseInt(m[1], 10);
  const mm = Number.parseInt(m[2], 10);
  if (!Number.isFinite(y) || !Number.isFinite(mm) || mm < 1 || mm > 12) return null;
  const start = `${String(y).padStart(4, '0')}-${String(mm).padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(y, mm, 0)); // last day of month
  const end = endDate.toISOString().slice(0, 10);
  return { gte: start, lte: end };
}

export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const queryType = searchParams.get('queryType') || 'mine';
    
    // Convert current 30 days ago
    const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];

    if (queryType === 'mine') {
      // Canonical user id from DB so masterUid / operatorUid always match assigned schedules + shifts.
      const email = String(session.user?.email || '').trim().toLowerCase();
      let uid = String(session.user?.id || '').trim();
      if (email) {
        const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (u?.id) uid = String(u.id).trim();
      }

      if (!uid) {
        return NextResponse.json({ ok: true, schedules: [] });
      }

      const schedules = await prisma.masterSchedule.findMany({
        where: {
          masterUid: uid,
          shiftDate: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Any shift for this assignee + normalized slot hides the schedule row (no 30d cutoff on shifts — avoids missed matches).
      const startedShifts = uid
        ? await prisma.shift.findMany({
            where: { operatorUid: uid },
            select: { shiftDate: true, shiftType: true, stationCode: true, operatorUid: true, status: true },
            orderBy: { createdAt: 'desc' },
            take: 2000,
          })
        : [];

      const visible = schedules.filter((row) => {
        const code = normStation(row.stationCode);
        const rd = normDate(row.shiftDate);
        const rt = normType(row.shiftType);
        if (!rd || !rt || !code) return true;
        const master = String(row.masterUid || '').trim();
        const taken = startedShifts.some((s) => {
          if (CANCELLED_SHIFT_STATUSES.has(String(s.status ?? '').trim())) return false;
          return (
            String(s.operatorUid || '').trim() === master &&
            normDate(s.shiftDate) === rd &&
            normType(s.shiftType) === rt &&
            normStation(s.stationCode) === code
          );
        });
        return !taken;
      });

      return NextResponse.json({
        ok: true,
        schedules: visible.map((s) => ({ ...s, id: s.id.toString(), createdAt: s.createdAt.toISOString() })),
      });
    }

    if (queryType === 'mine_calendar') {
      // Мастерын «Миний хуваарь» календарь — /api/operator-schedules?queryType=mine_calendar-тай
      // ижил бүтэцтэй, зөвхөн masterSchedule/masterUid ашиглана.
      const email = String(session.user?.email || '').trim().toLowerCase();
      let uid = String(session.user?.id || '').trim();
      if (email) {
        const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (u?.id) uid = String(u.id).trim();
      }
      if (!uid) return NextResponse.json({ ok: true, schedules: [] });

      const month = searchParams.get('month') || '';
      const from = normDate(searchParams.get('from') || '');
      const to = normDate(searchParams.get('to') || '');
      const monthRange = month ? monthToRange(month) : null;
      const range =
        /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)
          ? { gte: from, lte: to }
          : monthRange;

      const where: any = { masterUid: uid };
      if (range) where.shiftDate = range;

      const schedules = await prisma.masterSchedule.findMany({
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
        const master = String(row.masterUid || '').trim();
        const existingShift = started.find((s) => {
          if (CANCELLED_SHIFT_STATUSES.has(String(s.status ?? '').trim())) return false;
          return (
            String(s.operatorUid || '').trim() === master &&
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

    if (queryType === 'all') {
      const r = String((session.user as any)?.role || '');
      if (!['admin', 'dispatcher', 'master', 'chief_engineer'].includes(r)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const month = searchParams.get('month') || '';
      const shiftType = searchParams.get('shiftType') || '';
      const stationCode = normStation(searchParams.get('stationCode') || '');
      const masterUid = String(searchParams.get('masterUid') || '').trim();

      const range = month ? monthToRange(month) : null;
      const where: any = { shiftDate: { gte: thirtyDaysAgo } };
      if (range) where.shiftDate = { gte: range.gte, lte: range.lte };
      if (shiftType) where.shiftType = normType(shiftType);
      if (stationCode) where.stationCode = stationCode;
      if (masterUid) where.masterUid = masterUid;

      const schedules = await prisma.masterSchedule.findMany({
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
  } catch (error: any) {
    console.error('Error GET /api/schedules:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const role = String((session?.user as any)?.role || '');
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    
    // Validate
    if (!body.shiftDate || !body.shiftType || !body.stationCode || !body.masterUid) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const masterUid = String(body.masterUid).trim();
    const shiftDate = normDate(body.shiftDate);
    const shiftType = normType(body.shiftType);
    const stationCode = normStation(body.stationCode);

    /**
     * Зөвхөн мастерын хуваарийг үүсгэнэ. Операторын хуваарь энэ дуудлагаас
     * автоматаар үүсэхээ БОЛЬСОН — операторуудыг `POST /api/schedules/bulk-crew`
     * (ээлжийн багаар) эсвэл `POST /api/operator-schedules` (нэг хүнээр) оноодог.
     * docs/shift-crew-architecture.md §6
     */
    const createForDate = async (date: string): Promise<{ status: 'created' | 'duplicate'; id: string }> => {
      const existing = await prisma.masterSchedule.findFirst({
        where: { shiftDate: date, shiftType, stationCode, masterUid },
        orderBy: { createdAt: 'desc' },
      });
      if (existing?.id) return { status: 'duplicate', id: existing.id.toString() };

      const schedule = await prisma.masterSchedule.create({
        data: {
          shiftDate: date, shiftType, stationCode,
          masterUid,
          masterName: body.masterName || 'Unknown',
        },
      });
      return { status: 'created', id: schedule.id.toString() };
    };

    // ── Bulk (огнооны муж) — endDate бөглөгдсөн бол [shiftDate..endDate] бүх өдөрт ──
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

      let created = 0;
      let skipped = 0;
      for (const d of dates) {
        const res = await createForDate(d);
        if (res.status === 'created') created += 1;
        else skipped += 1;
      }

      if (created > 0) {
        await createNotificationDeduped(
          {
            userId: masterUid,
            kind: 'shift_assigned',
            dedupeKey: `shift_assigned_bulk:${shiftDate}:${endDate}:${shiftType}:${stationCode}`,
            title: 'Ээлж оноолт',
            body: `${shiftDate}–${endDate} хооронд ${shiftType} ээлжийн ${stationCode} дамжлагад оноогдлоо.`,
            link: '/dashboard',
          },
          { windowMinutes: 24 * 60 }
        );
      }

      return NextResponse.json({ ok: true, created, skipped });
    }

    // ── Single day ──
    const single = await createForDate(shiftDate);
    if (single.status === 'created') {
      await createNotificationDeduped(
        {
          userId: masterUid,
          kind: 'shift_assigned',
          dedupeKey: `shift_assigned:${shiftDate}:${shiftType}:${stationCode}`,
          title: 'Ээлж оноолт',
          body: `${shiftDate} өдрийн ${shiftType} ээлжинд ${stationCode} дамжлага дээр оноогдлоо.`,
          link: '/dashboard',
        },
        { windowMinutes: 24 * 60 }
      );
    }
    return NextResponse.json({
      ok: true,
      id: single.id,
      duplicate: single.status === 'duplicate',
    });
  } catch (error: any) {
    console.error('Error POST /api/schedules:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const role = String((session?.user as any)?.role || '');
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const prev = await prisma.masterSchedule.findUnique({ where: { id } });
    if (!prev) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Зөвхөн мастерын хуваарийг засна — операторын мөрүүд энэ дуудлагаас хамаарахаа больсон.
    const data: any = {};
    if (body.shiftDate != null) data.shiftDate = normDate(body.shiftDate);
    if (body.shiftType != null) data.shiftType = normType(body.shiftType);
    if (body.stationCode != null) data.stationCode = normStation(body.stationCode);
    if (body.masterUid != null) data.masterUid = String(body.masterUid).trim();
    if (body.masterName !== undefined) data.masterName = body.masterName ? String(body.masterName) : null;

    const row = await prisma.masterSchedule.update({ where: { id }, data });
    return NextResponse.json({ ok: true, id: row.id.toString() });
  } catch (error: any) {
    console.error('Error PATCH /api/schedules:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const roleDel = String((session?.user as any)?.role || '');
    if (!session?.user?.email || roleDel !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const schedule = await prisma.masterSchedule.findUnique({ where: { id } });
    if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Зөвхөн мастерын мөрийг устгана. Операторын хуваарь энэ мөрөөс дериватив
    // байхаа больсон тул хамт устгахгүй — операторыг тусад нь хасна.
    await prisma.masterSchedule.delete({ where: { id } });

    await notifyMasterScheduleRemoved({
      masterUid: schedule.masterUid,
      shiftDate: normDate(schedule.shiftDate),
      shiftType: normType(schedule.shiftType),
      stationCode: normStation(schedule.stationCode),
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error DELETE /api/schedules:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
