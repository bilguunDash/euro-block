import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api/responses';
import { writeServerAuditLog } from '@/lib/server-audit';
import {
  canDeleteSortRecord,
  canEditSortHeader,
  canViewSortRecords,
  type SessionActor,
} from '@/lib/sort-api-permissions';
import { isSpecialDualSize, parseUlaanbaatarLocal, validateRamHeaderRequired } from '@/lib/sort-work-calc';

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

async function resolveId(params: Promise<{ id: string }>): Promise<string | null> {
  const raw = await params;
  const id = String(raw?.id || '').trim();
  return UUID_RE.test(id) ? id : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const actor = sessionActor(session as any);
  if (!actor) return jsonError(401, 'Unauthorized');
  if (!canViewSortRecords(actor)) return jsonError(403, 'Forbidden');

  const id = await resolveId(params);
  if (!id) return jsonError(400, 'Invalid id');

  const record = await prisma.sortWorkRecord.findUnique({ where: { id } });
  if (!record) return jsonError(404, 'Not found');
  return NextResponse.json({ ok: true, data: record });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const actor = sessionActor(session as any);
  if (!actor) return jsonError(401, 'Unauthorized');

  const id = await resolveId(params);
  if (!id) return jsonError(400, 'Invalid id');

  const existing = await prisma.sortWorkRecord.findUnique({ where: { id } });
  if (!existing) return jsonError(404, 'Not found');
  if (!canEditSortHeader(actor, existing.status)) return jsonError(403, 'Forbidden');

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON');
  }

  // Full header replace — same required-field rule as create (old validate_u1).
  const headerCheck = validateRamHeaderRequired(body);
  if (!headerCheck.ok) return jsonError(400, headerCheck.error!);

  const shiftNo = String(body.shiftNo || body.headerCNumber || existing.shiftNo || '');
  const headerCNumber = String(body.headerCNumber || '');
  const headerPoured = String(body.headerPoured || '');
  const headerCut = String(body.headerCut || '');
  // Толгойг БҮТНЭЭР солино (create-тэй ижил) — цаг нь заавал биш тул хоосон бол null.
  const pouredAt = parseUlaanbaatarLocal(body.pouredAt);
  const cutAt = parseUlaanbaatarLocal(body.cutAt);
  const autoclaveNo = String(body.autoclaveNo || '');
  const sort1FrameNo = String(body.sort1FrameNo || '');
  const sort1SizeMm = String(body.sort1SizeMm || '');
  const sort1Desc = String(body.sort1Desc || '');
  const ramDefectCode = String(body.ramDefectCode || '');

  const reopen = existing.status !== 'deleted';

  const record = await prisma.sortWorkRecord.update({
    where: { id },
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
      ...(reopen ? { status: 'waiting_sort', completedAt: null } : {}),
    },
  });

  await writeServerAuditLog({
    actorUid: actor.id,
    actorName: actor.name ?? null,
    action: 'sort_record_header_updated',
    entityType: 'sort_work_record',
    entityId: record.id,
    details: `${headerCNumber} ${sort1FrameNo} ${sort1SizeMm}`,
  });

  return NextResponse.json({ ok: true, data: record });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const actor = sessionActor(session as any);
  if (!actor) return jsonError(401, 'Unauthorized');
  if (!canDeleteSortRecord(actor)) return jsonError(403, 'Forbidden');

  const id = await resolveId(params);
  if (!id) return jsonError(400, 'Invalid id');

  const existing = await prisma.sortWorkRecord.findUnique({ where: { id } });
  if (!existing) return jsonError(404, 'Not found');

  await prisma.sortWorkRecord.update({ where: { id }, data: { status: 'deleted' } });

  await writeServerAuditLog({
    actorUid: actor.id,
    actorName: actor.name ?? null,
    action: 'sort_record_deleted',
    entityType: 'sort_work_record',
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
