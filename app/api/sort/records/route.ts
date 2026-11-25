import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api/responses';
import { writeServerAuditLog } from '@/lib/server-audit';
import {
  canCreateSortRecord,
  canViewSortRecords,
  type SessionActor,
} from '@/lib/sort-api-permissions';
import { isSpecialDualSize, parseUlaanbaatarLocal, validateRamHeaderRequired } from '@/lib/sort-work-calc';
import { buildSortRecordsRawFilter, buildSortRecordsWhere } from '@/lib/sort-records-query';

function sessionActor(session: any): SessionActor | null {
  if (!session?.user?.id) return null;
  return {
    id: String(session.user.id),
    role: String((session.user as any).role || 'operator'),
    stationCode: (session.user as any).stationCode ?? null,
    name: session.user.name ?? null,
    sortDualRole: Boolean((session.user as any).sortDualRole),
  };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const actor = sessionActor(session as any);
  if (!actor) return jsonError(401, 'Unauthorized');
  if (!canViewSortRecords(actor)) return jsonError(403, 'Forbidden');

  const { searchParams } = new URL(req.url);

  try {
    const { where, date, shiftTimeOfDay } = buildSortRecordsWhere(searchParams);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit')) || 200));

    // Огноогүйгээр Ээлж (Өдөр/Шөнө) шүүх нь Prisma-ийн where API-аар илэрхийлэгдэхгүй
    // (аль ч өдрийн цагийн цонх, огнооноос үл хамаарсан) тул raw SQL-ээр гүйцэтгэнэ —
    // count/pagination хоёулаа яг ижил шүүлтүүрийг хардаг байх ёстой тул хоёуланг нь
    // энэ салбарт нэгэн зэрэг сольсон.
    if (shiftTimeOfDay) {
      const { whereSql, params } = buildSortRecordsRawFilter(searchParams, shiftTimeOfDay);
      const countRows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
        `SELECT COUNT(*)::int AS count FROM "sort_work_records" WHERE ${whereSql}`,
        ...params
      );
      const limitParam = params.length + 1;
      const offsetParam = params.length + 2;
      const data = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "sort_work_records" WHERE ${whereSql} ORDER BY "createdAt" DESC, "id" DESC LIMIT $${limitParam} OFFSET $${offsetParam}`,
        ...params,
        limit,
        (page - 1) * limit
      );
      return NextResponse.json({ ok: true, data, page, limit, total: countRows[0]?.count ?? 0, filteredDate: date });
    }

    const [total, data] = await Promise.all([
      prisma.sortWorkRecord.count({ where }),
      prisma.sortWorkRecord.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({ ok: true, data, page, limit, total, filteredDate: date });
  } catch (error: any) {
    return jsonError(400, error?.message || 'Invalid query parameters');
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const actor = sessionActor(session as any);
  if (!actor) return jsonError(401, 'Unauthorized');
  if (!canCreateSortRecord(actor)) return jsonError(403, 'Forbidden');

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON');
  }

  // Old client blocked "Сорт руу илгээх" on empty required fields (validate_u1);
  // on the web the API is directly reachable, so enforce the same rule server-side.
  const headerCheck = validateRamHeaderRequired(body);
  if (!headerCheck.ok) return jsonError(400, headerCheck.error!);

  const shiftNo = String(body.shiftNo || body.headerCNumber || '');
  const headerCNumber = String(body.headerCNumber || '');
  const headerPoured = String(body.headerPoured || '');
  const headerCut = String(body.headerCut || '');
  // Заавал биш — бөглөөгүй бол null. Улаанбаатарын ханын цагийг UTC болгоно.
  const pouredAt = parseUlaanbaatarLocal(body.pouredAt);
  const cutAt = parseUlaanbaatarLocal(body.cutAt);
  const autoclaveNo = String(body.autoclaveNo || '');
  const sort1FrameNo = String(body.sort1FrameNo || '');
  const sort1SizeMm = String(body.sort1SizeMm || '');
  const sort1Desc = String(body.sort1Desc || '');
  const ramDefectCode = String(body.ramDefectCode || '');

  const record = await prisma.sortWorkRecord.create({
    data: {
      shiftNo,
      headerCNumber,
      headerPoured,
      headerCut,
      pouredAt,
      cutAt,
      autoclaveNo,
      sort1FrameNo,
      sort1SizeMm,
      sort1Desc,
      ramDefectCode,
      specialDualMode: isSpecialDualSize(sort1SizeMm),
      status: 'waiting_sort',
      createdByUid: actor.id,
      createdByName: actor.name ?? null,
    },
  });

  await writeServerAuditLog({
    actorUid: actor.id,
    actorName: actor.name ?? null,
    action: 'sort_record_created',
    entityType: 'sort_work_record',
    entityId: record.id,
    details: `${headerCNumber} ${sort1FrameNo} ${sort1SizeMm}`,
  });

  return NextResponse.json({ ok: true, data: record });
}
