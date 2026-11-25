import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api/responses';
import { writeServerAuditLog } from '@/lib/server-audit';
import { canEditSortCounts, type SessionActor } from '@/lib/sort-api-permissions';
import {
  computeTotalM3,
  updateSortTotals,
  validateNonNegativeQuantities,
  validateTotalM3,
  type SortCountsInput,
} from '@/lib/sort-work-calc';

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
 * Sort counts entry + auto-complete. Port of the old system's PUT
 * /records/{id}/u2 — validates the 5.4 m³ total before persisting anything,
 * then marks the record completed in the same call. The old system's
 * separate POST /records/{id}/complete is intentionally not ported here —
 * this route already validates+completes in one call, matching the actual
 * one-button UX.
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
  if (!canEditSortCounts(actor, existing.status)) return jsonError(403, 'Forbidden');

  let body: SortCountsInput;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON');
  }

  const negCheck = validateNonNegativeQuantities(body);
  if (!negCheck.ok) return jsonError(400, negCheck.error!);

  const totals = updateSortTotals(existing.sort1SizeMm, existing.specialDualMode, body);
  const totalM3 = computeTotalM3(totals);
  const totalCheck = validateTotalM3(totalM3);
  if (!totalCheck.ok) return jsonError(400, totalCheck.error!);

  const record = await prisma.sortWorkRecord.update({
    where: { id },
    data: {
      ...totals,
      status: 'completed',
      completedAt: new Date(),
      sortedByUid: actor.id,
      sortedByName: actor.name ?? null,
    },
  });

  await writeServerAuditLog({
    actorUid: actor.id,
    actorName: actor.name ?? null,
    action: 'sort_record_completed',
    entityType: 'sort_work_record',
    entityId: record.id,
    details: `total_m3=${totalM3.toFixed(3)}`,
  });

  return NextResponse.json({ ok: true, data: record });
}
