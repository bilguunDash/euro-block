import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { normalizeDate, normalizeShiftType } from '@/lib/shift-crew';
import { startedScheduleCutoff } from '@/lib/not-started-schedules';

/** «Хийгдэж эхлээгүй» — хуваарьт оноогдсон атлаа ээлж огт үүсээгүй мөрүүд. */

/** Цуцлагдсан ээлж «эхэлсэн» гэж тооцогдохгүй (DB талын NOT EXISTS-д параметр болгон дамжина). */
const CANCELLED_STATUSES = ['Цуцлагдсан'];
/** Эцсийн (аль хэдийн NOT EXISTS-ээр зөв шүүгдсэн) жагсаалт дээрх хамгаалалтын дээд хязгаар. */
const MAX_ROWS = 2000;

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function isAdminOrChief(role: string) {
  return role === 'admin' || role === 'chief_engineer';
}

function normStation(value: unknown): string {
  return String(value ?? '').trim();
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = String((session?.user as any)?.role || '');
  if (!session?.user?.id || !isAdminOrChief(role)) return jsonError(403, 'Forbidden');

  const { searchParams } = new URL(req.url);
  const since = normalizeDate(searchParams.get('since') || '');
  const until = normalizeDate(searchParams.get('until') || '');
  const sinceParam = /^\d{4}-\d{2}-\d{2}$/.test(since) ? since : null;
  const untilParam = /^\d{4}-\d{2}-\d{2}$/.test(until) ? until : null;
  const cutoff = startedScheduleCutoff();

  try {
    // Дархлаа (y310-approvals-д ижил төрлийн алдаа засагдсантай адил): «эхлээгүй»
    // мөрийг тодорхойлохдоо хуваарь ба ээлжийн бүртгэлийг (take-ээр хязгаарлаж)
    // тус тусад нь JS-д татаж хооронд нь харьцуулахгүй. Тийм байсан бол хоёр
    // эрсдэл гарна:
    //  1) Хуваарийн мөрүүд (эхэлсэн + эхлээгүй хольцоор, НЭГ цонход) хэт олон
    //     бол эртний «эхлээгүй» мөрүүд цонхноос шахагдаж алга болно.
    //  2) «Эхэлсэн эсэх»-ийг шалгах зорилгоор ээлжийн бүртгэлийг (мөн
    //     хязгаарлаж) татсан бол цонхноос давсан жинхэнэ эхэлсэн ээлж
    //     «эхлээгүй» мэт худал сануулга болно.
    // Иймд NOT EXISTS-ийг DB түвшинд, хоёр талыг ч cap-гүйгээр ажиллуулж,
    // ЭЦСИЙН (аль хэдийн зөв шүүгдсэн) үр дүн дээр л хамгаалалтын LIMIT тавина.
    const [operatorIdRows, masterIdRows] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT os."id" FROM "operator_schedules" os
         WHERE ($2::text IS NULL OR os."shiftDate" >= $2)
           AND ($3::text IS NULL OR os."shiftDate" <= $3)
           AND (os."shiftDate" < $4 OR (os."shiftDate" = $4 AND os."shiftType" = ANY($5::text[])))
           AND NOT EXISTS (
             SELECT 1 FROM "shifts" s
             WHERE s."operatorUid" = os."operatorUid"
               AND s."shiftDate" = os."shiftDate"
               AND s."shiftType" = os."shiftType"
               AND s."stationCode" = os."stationCode"
               AND NOT (s."status" = ANY($1))
           )
         ORDER BY os."shiftDate" DESC, os."createdAt" DESC
         LIMIT ${MAX_ROWS}`,
        CANCELLED_STATUSES,
        sinceParam,
        untilParam,
        cutoff.date,
        cutoff.shiftTypes
      ),
      // Мастер станцын ээлжид мастер өөрөө `operatorUid` болж бүртгэгддэг тул
      // `shifts.operatorUid`-г `master_schedules.masterUid`-тай тааруулна.
      prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT ms."id" FROM "master_schedules" ms
         WHERE ($2::text IS NULL OR ms."shiftDate" >= $2)
           AND ($3::text IS NULL OR ms."shiftDate" <= $3)
           AND (ms."shiftDate" < $4 OR (ms."shiftDate" = $4 AND ms."shiftType" = ANY($5::text[])))
           AND NOT EXISTS (
             SELECT 1 FROM "shifts" s
             WHERE s."operatorUid" = ms."masterUid"
               AND s."shiftDate" = ms."shiftDate"
               AND s."shiftType" = ms."shiftType"
               AND s."stationCode" = ms."stationCode"
               AND NOT (s."status" = ANY($1))
           )
         ORDER BY ms."shiftDate" DESC, ms."createdAt" DESC
         LIMIT ${MAX_ROWS}`,
        CANCELLED_STATUSES,
        sinceParam,
        untilParam,
        cutoff.date,
        cutoff.shiftTypes
      ),
    ]);

    const operatorIds = operatorIdRows.map((r) => r.id);
    const masterIds = masterIdRows.map((r) => r.id);

    const [operatorSchedules, masterSchedules] = await Promise.all([
      operatorIds.length
        ? prisma.operatorSchedule.findMany({
            where: { id: { in: operatorIds } },
            select: {
              id: true,
              shiftDate: true,
              shiftType: true,
              stationCode: true,
              operatorUid: true,
              operatorName: true,
            },
            orderBy: [{ shiftDate: 'desc' }, { createdAt: 'desc' }],
          })
        : Promise.resolve([]),
      masterIds.length
        ? prisma.masterSchedule.findMany({
            where: { id: { in: masterIds } },
            select: {
              id: true,
              shiftDate: true,
              shiftType: true,
              stationCode: true,
              masterUid: true,
              masterName: true,
            },
            orderBy: [{ shiftDate: 'desc' }, { createdAt: 'desc' }],
          })
        : Promise.resolve([]),
    ]);

    const operatorRows = operatorSchedules.map((r) => ({
      id: String(r.id),
      kind: 'operator' as const,
      shiftDate: normalizeDate(r.shiftDate),
      shiftType: normalizeShiftType(r.shiftType),
      stationCode: normStation(r.stationCode),
      assigneeUid: String(r.operatorUid || ''),
      assigneeName: String(r.operatorName || ''),
    }));

    const masterRows = masterSchedules.map((r) => ({
      id: String(r.id),
      kind: 'master' as const,
      shiftDate: normalizeDate(r.shiftDate),
      shiftType: normalizeShiftType(r.shiftType),
      stationCode: normStation(r.stationCode),
      assigneeUid: String(r.masterUid || ''),
      assigneeName: String(r.masterName || ''),
    }));

    return NextResponse.json({ ok: true, operator: operatorRows, master: masterRows });
  } catch (e) {
    console.error('GET /api/approvals/not-started', e);
    return jsonError(500, 'Хийгдэж эхлээгүй хуваарийг татахад алдаа гарлаа.');
  }
}
