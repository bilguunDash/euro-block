import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api/responses';
import { writeServerAuditLog } from '@/lib/server-audit';
import { normalizeShiftGroup, shiftGroupLabel } from '@/lib/shift-crew';

/** Багт харьяалагдаж болох role-ууд — оператор ба мастер хамт. */
const CREW_ROLES = new Set(['operator', 'master']);

const MAX_USERS_PER_CALL = 500;

function requireAdmin(session: any) {
  const role = String(session?.user?.role || '');
  if (!session?.user?.id || (role !== 'admin' && role !== 'chief_engineer')) return null;
  return {
    id: String(session.user.id),
    name: String(session.user.name || session.user.email || ''),
  };
}

/**
 * POST /api/users/shift-group — багийн бүрэлдэхүүнийг олноор оноох.
 *
 * `{ userIds: string[], shiftGroup: '1' | '2' | '3' | null }`
 *
 * `/api/users` PATCH нь нэг хэрэглэгчийн бүтэн бичлэгийг дахин бичдэг тул тусад нь
 * үлдээв — энэ нь зөвхөн `shiftGroup`-ыг хөндөнө. Утга нь бодитоор өөрчлөгдөж
 * буй хэрэглэгчдийг л шинэчилж, тус бүрд аудит бичнэ.
 */
export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as any;
  const actor = requireAdmin(session);
  if (!actor) return jsonError(401, 'Unauthorized');

  try {
    const body = await req.json();

    const rawIds: unknown[] = Array.isArray(body?.userIds) ? body.userIds : [];
    const userIds: string[] = Array.from(
      new Set(rawIds.map((id) => String(id ?? '').trim()).filter(Boolean))
    );
    if (userIds.length === 0) return jsonError(400, 'Хэрэглэгч сонгоно уу.');
    if (userIds.length > MAX_USERS_PER_CALL) {
      return jsonError(400, `Нэг удаад ${MAX_USERS_PER_CALL}-аас олон хэрэглэгч сонгох боломжгүй.`);
    }

    // null = багаас хасах. Буруу утга ирвэл мөн null болно — тусад нь ялгахгүй.
    const shiftGroup = normalizeShiftGroup(body?.shiftGroup);

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, role: true, shiftGroup: true },
    });

    const wrongRole = users.filter((u) => !CREW_ROLES.has(String(u.role || '')));
    if (wrongRole.length > 0) {
      const names = wrongRole.map((u) => u.name || u.email || u.id).join(', ');
      return jsonError(400, `Зөвхөн оператор, мастерыг багт оноох боломжтой: ${names}`);
    }

    // Утга нь аль хэдийн ижил байгаа хүнийг хөндөхгүй — аудит лог цэвэр байлгана.
    const changed = users.filter((u) => (u.shiftGroup ?? null) !== shiftGroup);
    if (changed.length === 0) {
      return NextResponse.json({ ok: true, updated: 0, skipped: users.length });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { id: { in: changed.map((u) => u.id) } },
        data: { shiftGroup },
      });
    });

    const suffix = changed.length > 1 ? ' (bulk)' : '';
    for (const user of changed) {
      await writeServerAuditLog({
        actorUid: actor.id,
        actorName: actor.name,
        action: 'user_shift_group_changed',
        entityType: 'user',
        entityId: user.id,
        details: JSON.stringify({
          user: user.name || user.email || user.id,
          from: user.shiftGroup ?? null,
          to: shiftGroup,
          label: shiftGroupLabel(shiftGroup) + suffix,
        }),
      });
    }

    return NextResponse.json({
      ok: true,
      updated: changed.length,
      skipped: users.length - changed.length,
      shiftGroup,
    });
  } catch (error: any) {
    console.error('POST /api/users/shift-group', error);
    return jsonError(500, error?.message || 'Database error');
  }
}
