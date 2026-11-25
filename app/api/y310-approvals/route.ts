import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { writeServerAuditLog } from '@/lib/server-audit';
import { notifyManyDeduped } from '@/lib/server-notifications';
import { ADMIN_APPROVAL_LOG_TYPES } from '@/lib/master-stations';
import { approvalHistoryPagination, masterApprovedFilter, parseApprovalHistoryQuery } from '@/lib/approval-history-query';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Буцаагдсан мөр pending-ээс гарна. Дахин хадгалахад logs POST тухайн мөрийг шинэчилж
// admin* талбаруудыг хасдаг тул шууд дахин хүлээгдэнэ. adminRejectedAt/createdAt харьцуулалт
// нь хадгалалт бүрт шинэ мөр үүсгэж adminRejected*-ийг хуулдаг байсан хуучин мөрүүдэд зориулагдсан.
// Зөвхөн (shiftId, logType) тус бүрийн СҮҮЛИЙН хувилбарыг тоолно — shift хуудас ч түүнийг л харуулдаг.
// Ээлж нь эцэслэн батлагдсан, эсвэл эцсийн баталгаа хүлээж буй (/api/shifts?queryType=admin_pending)
// ээлжийн мөрөөр харагдаж байгаа маягтыг хасна — эс бөгөөс нэг ээлж хоёр мөрөөр давхар тоологдож,
// эцсийн баталгааны дараа ч маягт энд үүрд pending үлддэг байв. (Мастер станцын ээлж «Мастер» табад,
// ийм маягттай мөр нь ээлжийн мөрөөр орлогдоно.) Сүүлийн нөхцөл нь admin_pending-ийн where-тэй
// ИЖИЛ байх ёстой (app/api/shifts/route.ts).
const PENDING_ADMIN_APPROVAL_WHERE_SQL = `"logType" = ANY($1)
  AND "data"->>'needsAdminApproval' = 'true'
  AND COALESCE("data"->>'adminApproved', 'false') <> 'true'
  AND NOT (
    COALESCE("data"->>'adminRejected', 'false') = 'true'
    AND (
      COALESCE("data"->>'adminRejectedAt', '') = ''
      OR ("data"->>'adminRejectedAt') COLLATE "C" >= to_char("createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM "production_logs" newer
    WHERE newer."shiftId" = "production_logs"."shiftId"
      AND newer."logType" = "production_logs"."logType"
      AND newer."sortOrder" > "production_logs"."sortOrder"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "shifts" s
    WHERE s."id" = "production_logs"."shiftId"
      AND (
        s."adminApproved" = true
        OR s."status" = 'Баталгаажсан'
        OR s."masterApproved" = true
        OR (
          s."currentMasterApprovedAt" IS NOT NULL
          AND (s."handoverStage" = 'accepted' OR s."handoverFinalAcceptedAt" IS NOT NULL)
        )
      )
  )`;

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function isAdminOrChief(role: string) {
  return role === 'admin' || role === 'chief_engineer';
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = String((session?.user as any)?.role || '');
  if (!session?.user?.id || !isAdminOrChief(role)) return jsonError(403, 'Forbidden');

  const searchParams = new URL(req.url).searchParams;
  const state = searchParams.get('state') || 'all';
  if (!['all', 'approved'].includes(state)) return jsonError(400, 'Invalid approval state');
  let query;
  try { query = parseApprovalHistoryQuery(searchParams); }
  catch (error: any) { return jsonError(400, error.message); }

  try {
    const logTypes = [...ADMIN_APPROVAL_LOG_TYPES];
    const filter = masterApprovedFilter(query);
    const [approved, approvedTotalRows] = await prisma.$transaction([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT l."id", l."shiftId", l."logType", l."data", l."createdAt",
          CASE WHEN s."id" IS NULL THEN NULL ELSE json_build_object(
            'shiftDate', s."shiftDate", 'shiftType', s."shiftType", 'stationCode', s."stationCode",
            'operatorName', s."operatorName", 'operatorUid', s."operatorUid") END AS shift
         ${filter.fromSql} WHERE ${filter.whereSql}
         ORDER BY l."createdAt" DESC, l."id" DESC
         LIMIT $${filter.params.length + 1} OFFSET $${filter.params.length + 2}`,
        ...filter.params, query.pageSize, query.skip
      ),
      prisma.$queryRawUnsafe<Array<{ count: number }>>(
        `SELECT COUNT(*)::int AS count ${filter.fromSql} WHERE ${filter.whereSql}`, ...filter.params
      ),
    ], { isolationLevel: 'RepeatableRead' });
    const approvedTotal = approvedTotalRows[0]?.count ?? 0;
    const pagination = approvalHistoryPagination(query, approvedTotal);
    if (state === 'approved') {
      return NextResponse.json({ ok: true, approved, approvedTotal, total: approvedTotal, ...pagination });
    }

    const productionLogSelect = {
      id: true,
      shiftId: true,
      logType: true,
      data: true,
      createdAt: true,
      shift: {
        select: {
          shiftDate: true,
          shiftType: true,
          stationCode: true,
          operatorName: true,
          operatorUid: true,
        },
      },
    } as const;

    const [pendingTotalRows, pendingIdRows] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ count: number }>>(
        `SELECT COUNT(*)::int AS count FROM "production_logs"
         WHERE ${PENDING_ADMIN_APPROVAL_WHERE_SQL}`,
        logTypes
      ),
      // Дархлаа: pending жагсаалт нь approved логуудтай "хамгийн сүүлийн 200"
      // гэсэн НЭГ цонхыг ХУВААЛЦАХГҮЙ байх ёстой — эс тэгвэл эртний pending
      // бичлэгүүд шинэ approved бичлэгүүдэд шахагдаж жагсаалтаас алга болно
      // (badge нь тоолохдоо энэ цонхыг ашигладаггүй тул тоо зөв ч жагсаалт хоосорно).
      prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "production_logs"
         WHERE ${PENDING_ADMIN_APPROVAL_WHERE_SQL}
         ORDER BY "createdAt" DESC, "id" DESC
         LIMIT 2000`,
        logTypes
      ),
    ]);

    const pendingIds = pendingIdRows.map((r) => r.id);
    const pending = pendingIds.length
      ? await prisma.productionLog.findMany({
          where: { id: { in: pendingIds } },
          select: productionLogSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
      : [];

    const pendingTotal = pendingTotalRows[0]?.count ?? 0;

    return NextResponse.json({ ok: true, pending, approved, pendingTotal, approvedTotal, ...pagination });
  } catch (e) {
    console.error('GET /api/y310-approvals', e);
    return jsonError(500, 'Алдаа гарлаа.');
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const actorId = String((session?.user as any)?.id || '');
  const actorName = String((session?.user as any)?.name || '');
  const role = String((session?.user as any)?.role || '');
  if (!actorId || !isAdminOrChief(role)) return jsonError(403, 'Forbidden');

  let body: any;
  try { body = await req.json(); } catch { return jsonError(400, 'Invalid JSON'); }

  const logId = String(body?.logId || '').trim();
  const action = String(body?.action || 'approve').trim();
  if (!UUID_RE.test(logId)) return jsonError(400, 'logId шаардлагатай.');
  if (action !== 'approve' && action !== 'reject') return jsonError(400, 'action: approve | reject');

  try {
    const ALLOWED_LOG_TYPES = new Set<string>(ADMIN_APPROVAL_LOG_TYPES);
    const decision = await prisma.$transaction(async (tx) => {
      const log = await tx.productionLog.findUnique({
        where: { id: logId },
        select: { id: true, shiftId: true, data: true, logType: true },
      });
      if (!log || !ALLOWED_LOG_TYPES.has(log.logType)) return { status: 'not-found' as const };

      // Use the exact pending predicate used by GET, including newest-log and
      // final-shift checks. A stale approval card cannot decide an old form.
      const pending = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "production_logs"
         WHERE ${PENDING_ADMIN_APPROVAL_WHERE_SQL} AND "id" = $2::uuid`,
        [...ADMIN_APPROVAL_LOG_TYPES], logId
      );
      if (pending.length !== 1) return { status: 'conflict' as const };

      const prev = (log.data as any) ?? {};
      const now = new Date().toISOString();
      const updated = action === 'approve'
        ? { ...prev, adminApproved: true, adminApprovedBy: actorName, adminApprovedAt: now, adminRejected: false }
        : { ...prev, adminApproved: false, adminRejected: true, adminRejectedBy: actorName, adminRejectedAt: now };
      const result = await tx.productionLog.updateMany({
        where: { id: logId, data: { equals: log.data as any } },
        data: { data: updated },
      });
      if (result.count !== 1) return { status: 'conflict' as const };
      return { status: 'updated' as const, shiftId: log.shiftId };
    }, { isolationLevel: 'Serializable' });

    if (decision.status === 'not-found') return jsonError(404, 'Not found');
    if (decision.status === 'conflict') return jsonError(409, 'Бүртгэлийн төлөв өөрчлөгдсөн. Жагсаалтыг шинэчилнэ үү.');

    await writeServerAuditLog({
      actorUid: actorId,
      actorName: actorName || null,
      action: action === 'approve' ? 'y310_admin_approved' : 'y310_admin_rejected',
      entityType: 'production_log',
      entityId: logId,
      details: `shiftId:${decision.shiftId}`,
    });

    // Notify the master who submitted
    const shift = await prisma.shift.findUnique({
      where: { id: decision.shiftId },
      select: { operatorUid: true, shiftMasterUid: true, stationCode: true, shiftDate: true, shiftType: true },
    });
    const notifyUids = [shift?.operatorUid, shift?.shiftMasterUid].filter(Boolean) as string[];
    if (notifyUids.length) {
      const stationLabel = shift?.stationCode || 'Мастер';
      const title = action === 'approve' ? `${stationLabel} бүртгэл баталгаажлаа` : `${stationLabel} бүртгэл буцаагдлаа`;
      const body =
        action === 'approve'
          ? `${shift?.shiftDate} ${shift?.shiftType} — Admin ${actorName} таны бүртгэлийг баталгаажууллаа.`
          : `${shift?.shiftDate} ${shift?.shiftType} — Admin ${actorName} таны бүртгэлийг буцааж, засахыг хүслээ.`;
      await notifyManyDeduped(
        notifyUids,
        { kind: `y310_${action}d`, title, body, link: `/shift/${decision.shiftId}`, dedupeKey: `y310_${action}:${logId}` },
        { windowMinutes: 60 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2034') {
      return jsonError(409, 'Бүртгэлийн төлөв өөрчлөгдсөн. Жагсаалтыг шинэчилнэ үү.');
    }
    console.error('PATCH /api/y310-approvals', e);
    return jsonError(500, 'Алдаа гарлаа.');
  }
}
