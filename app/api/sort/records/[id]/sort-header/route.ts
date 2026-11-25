import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api/responses';
import { writeServerAuditLog } from '@/lib/server-audit';
import { canEditSortFrameAndSize, type SessionActor } from '@/lib/sort-api-permissions';
import { isSpecialDualSize } from '@/lib/sort-work-calc';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/**
 * Narrow СОРТ allowance: frame#/size only. Port of the old system's
 * PUT /records/{id}/u2-header. Unlike the old system, specialDualMode IS
 * recomputed here — operators asked that a wrong base size be fully fixable
 * from the СОРТ side, which requires the dual-mode flag to follow the size
 * (600x250x200 must switch the form into the 200+100 dual entry mode).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const actor = sessionActor(session as any);
  if (!actor) return jsonError(401, 'Unauthorized');

  const raw = await params;
  const id = String(raw?.id || '').trim();
  if (!UUID_RE.test(id)) return jsonError(400, 'Invalid id');

  const existing = await prisma.sortWorkRecord.findUnique({ where: { id } });
  if (!existing) return jsonError(404, 'Not found');
  if (!canEditSortFrameAndSize(actor, existing.status)) return jsonError(403, 'Forbidden');

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON');
  }

  const sort1FrameNo = String(body.sort1FrameNo ?? '').trim();
  const sort1SizeMm = String(body.sort1SizeMm ?? '').trim();

  const record = await prisma.sortWorkRecord.update({
    where: { id },
    data: { sort1FrameNo, sort1SizeMm, specialDualMode: isSpecialDualSize(sort1SizeMm) },
  });

  await writeServerAuditLog({
    actorUid: actor.id,
    actorName: actor.name ?? null,
    action: 'sort_record_sort_header_updated',
    entityType: 'sort_work_record',
    entityId: record.id,
    details: `${sort1FrameNo} ${sort1SizeMm}`,
  });

  return NextResponse.json({ ok: true, data: record });
}
