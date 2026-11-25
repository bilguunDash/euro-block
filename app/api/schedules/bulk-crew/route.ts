import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api/responses';
import { writeServerAuditLog } from '@/lib/server-audit';
import { createNotificationDeduped } from '@/lib/server-notifications';
import {
  CREW_RANGE_MAX_DAYS,
  expandDateRange,
  isKnownShiftType,
  isIsoDate,
  normalizeShiftGroup,
  normalizeShiftType,
  shiftGroupLabel,
  splitCrewMembers,
  type CrewMember,
} from '@/lib/shift-crew';

function requireAdmin(session: any) {
  const role = String(session?.user?.role || '');
  if (!session?.user?.id || (role !== 'admin' && role !== 'chief_engineer')) return null;
  return {
    id: String(session.user.id),
    name: String(session.user.name || session.user.email || ''),
  };
}

type PlannedRow = {
  member: CrewMember;
  stationCode: string;
  shiftDate: string;
  shiftType: string;
};

/**
 * POST /api/schedules/bulk-crew — багийн бүх гишүүнд нэг дор хуваарь оноох.
 *
 * `{ shiftGroup, startDate, endDate?, shiftTypes: string[], preview?: boolean }`
 *
 * Оператор өөрийн `stationCode` дээр `operator_schedules`, мастер өөрийн мастер
 * станц дээр `master_schedules` авна. Бүх бичилт НЭГ transaction дотор — дунд нь
 * тасарвал юу ч үлдэхгүй. Мэдэгдлийг commit хийсний дараа илгээнэ.
 *
 * `preview: true` үед юу ч бичихгүй, зөвхөн тооцоог буцаана.
 */
export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as any;
  const actor = requireAdmin(session);
  if (!actor) return jsonError(401, 'Unauthorized');

  try {
    const body = await req.json();
    const preview = body?.preview === true;

    const shiftGroup = normalizeShiftGroup(body?.shiftGroup);
    if (!shiftGroup) return jsonError(400, 'Ээлжийн баг сонгоно уу.');

    // Заавал биш — өгвөл багийн зөвхөн ЭНЭ дамжлагатай гишүүдийг оноох (өөр дамжлагатай
    // хамт олныг алгасна). Хоосон бол хуучин зан төлөвөөрөө хүн бүр өөрийн дамжлага дээр орно.
    const stationFilter = String(body?.stationCode || '').trim();

    const startDate = String(body?.startDate || '').trim();
    const endDate = String(body?.endDate || '').trim() || startDate;
    if (!isIsoDate(startDate)) return jsonError(400, 'Эхлэх огноо буруу байна.');
    if (!isIsoDate(endDate)) return jsonError(400, 'Дуусах огноо буруу байна.');
    if (endDate < startDate) return jsonError(400, 'Дуусах огноо эхлэхээсээ өмнө байна.');

    const dates = expandDateRange(startDate, endDate);
    if (dates.length === 0) return jsonError(400, 'Огнооны муж хоосон байна.');
    if (dates.length >= CREW_RANGE_MAX_DAYS) {
      return jsonError(400, `Нэг удаад ${CREW_RANGE_MAX_DAYS} хоногоос уртыг оноох боломжгүй.`);
    }

    const rawTypes: unknown[] = Array.isArray(body?.shiftTypes) ? body.shiftTypes : [];
    const shiftTypes: string[] = Array.from(
      new Set(rawTypes.map((t) => normalizeShiftType(t)).filter(Boolean))
    );
    if (shiftTypes.length === 0) return jsonError(400, 'Ээлжийн төрөл сонгоно уу.');
    const unknownType = shiftTypes.find((t) => !isKnownShiftType(t));
    if (unknownType) return jsonError(400, `Тодорхойгүй ээлжийн төрөл: ${unknownType}`);

    let members = (await prisma.user.findMany({
      where: { shiftGroup, isApproved: true, role: { in: ['operator', 'master'] } },
      select: { id: true, name: true, email: true, role: true, stationCode: true, shiftGroup: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    })) as CrewMember[];

    if (members.length === 0) {
      return jsonError(400, `${shiftGroupLabel(shiftGroup)}-д гишүүн алга байна.`);
    }

    if (stationFilter) {
      members = members.filter((m) => String(m.stationCode || '').trim() === stationFilter);
      if (members.length === 0) {
        return jsonError(400, `${shiftGroupLabel(shiftGroup)}-д ${stationFilter} дамжлагатай гишүүн алга байна.`);
      }
    }

    const split = splitCrewMembers(members);
    if (split.operators.length === 0 && split.masters.length === 0) {
      return jsonError(400, 'Багийн бүх гишүүнд станц тодорхойлогдоогүй байна.');
    }

    const operatorRows: PlannedRow[] = [];
    const masterRows: PlannedRow[] = [];
    for (const shiftDate of dates) {
      for (const shiftType of shiftTypes) {
        for (const member of split.operators) {
          operatorRows.push({ member, stationCode: String(member.stationCode).trim(), shiftDate, shiftType });
        }
        for (const member of split.masters) {
          masterRows.push({ member, stationCode: String(member.stationCode).trim(), shiftDate, shiftType });
        }
      }
    }

    const skipped = split.skipped.map((m) => ({
      id: m.id,
      name: m.name || m.email || m.id,
      role: m.role,
    }));

    if (preview) {
      return NextResponse.json({
        ok: true,
        preview: true,
        shiftGroup,
        dates: dates.length,
        shiftTypes,
        operators: split.operators.length,
        masters: split.masters.length,
        operatorRows: operatorRows.length,
        masterRows: masterRows.length,
        total: operatorRows.length + masterRows.length,
        skipped,
      });
    }

    // Аль хэдийн байгаа мөрийг давхардуулахгүй — өмнөх оноолт дээр давхар дарж болно.
    const [existingOperator, existingMaster] = await Promise.all([
      prisma.operatorSchedule.findMany({
        where: {
          shiftDate: { in: dates },
          shiftType: { in: shiftTypes },
          operatorUid: { in: split.operators.map((m) => m.id) },
        },
        select: { shiftDate: true, shiftType: true, stationCode: true, operatorUid: true },
      }),
      prisma.masterSchedule.findMany({
        where: {
          shiftDate: { in: dates },
          shiftType: { in: shiftTypes },
          masterUid: { in: split.masters.map((m) => m.id) },
        },
        select: { shiftDate: true, shiftType: true, stationCode: true, masterUid: true },
      }),
    ]);

    const key = (a: string, b: string, c: string, d: string) => `${a}|${b}|${c}|${d}`;
    const haveOperator = new Set(
      existingOperator.map((r) => key(r.shiftDate, r.shiftType, r.stationCode, r.operatorUid))
    );
    const haveMaster = new Set(
      existingMaster.map((r) => key(r.shiftDate, r.shiftType, r.stationCode, r.masterUid))
    );

    const newOperatorRows = operatorRows.filter(
      (r) => !haveOperator.has(key(r.shiftDate, r.shiftType, r.stationCode, r.member.id))
    );
    const newMasterRows = masterRows.filter(
      (r) => !haveMaster.has(key(r.shiftDate, r.shiftType, r.stationCode, r.member.id))
    );

    if (newOperatorRows.length === 0 && newMasterRows.length === 0) {
      return NextResponse.json({
        ok: true,
        created: 0,
        duplicates: operatorRows.length + masterRows.length,
        skipped,
        message: 'Энэ хугацаанд бүх хуваарь аль хэдийн оноогдсон байна.',
      });
    }

    await prisma.$transaction(async (tx) => {
      if (newOperatorRows.length > 0) {
        await tx.operatorSchedule.createMany({
          data: newOperatorRows.map((r) => ({
            shiftDate: r.shiftDate,
            shiftType: r.shiftType,
            stationCode: r.stationCode,
            operatorUid: r.member.id,
            operatorName: r.member.name || r.member.email || null,
          })),
        });
      }
      if (newMasterRows.length > 0) {
        await tx.masterSchedule.createMany({
          data: newMasterRows.map((r) => ({
            shiftDate: r.shiftDate,
            shiftType: r.shiftType,
            stationCode: r.stationCode,
            masterUid: r.member.id,
            masterName: r.member.name || r.member.email || null,
          })),
        });
      }
    });

    await writeServerAuditLog({
      actorUid: actor.id,
      actorName: actor.name,
      action: 'crew_schedule_created',
      entityType: 'shift_crew',
      entityId: shiftGroup,
      details: JSON.stringify({
        shiftGroup,
        label: shiftGroupLabel(shiftGroup),
        stationFilter: stationFilter || null,
        startDate,
        endDate,
        shiftTypes,
        days: dates.length,
        operatorRows: newOperatorRows.length,
        masterRows: newMasterRows.length,
        skipped: skipped.map((s) => s.name),
      }),
    });

    // Мэдэгдлийг transaction-ы ГАДНА — нэг хүнд нэг өдөрт нэг л удаа (дедуп).
    const notified = new Set<string>();
    for (const row of [...newOperatorRows, ...newMasterRows]) {
      const dedupeKey = `shift_assigned:${row.shiftDate}:${row.shiftType}:${row.stationCode}`;
      const guard = `${row.member.id}|${dedupeKey}`;
      if (notified.has(guard)) continue;
      notified.add(guard);
      try {
        await createNotificationDeduped(
          {
            userId: row.member.id,
            kind: 'shift_assigned',
            dedupeKey,
            title: 'Ээлж оноолт',
            body: `${row.shiftDate} өдрийн ${row.shiftType} ээлжинд ${row.stationCode} дамжлага дээр оноогдлоо.`,
            link: '/dashboard',
          },
          { windowMinutes: 24 * 60 }
        );
      } catch (error) {
        // Мэдэгдэл амжилтгүй болсон нь хуваарийг буцаах шалтгаан биш.
        console.error('bulk-crew notification failed', row.member.id, error);
      }
    }

    return NextResponse.json({
      ok: true,
      created: newOperatorRows.length + newMasterRows.length,
      operatorRows: newOperatorRows.length,
      masterRows: newMasterRows.length,
      duplicates:
        operatorRows.length + masterRows.length - newOperatorRows.length - newMasterRows.length,
      skipped,
    });
  } catch (error: any) {
    console.error('POST /api/schedules/bulk-crew', error);
    return jsonError(500, error?.message || 'Database error');
  }
}
