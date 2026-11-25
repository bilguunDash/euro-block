import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';
import { canDecideSwap, canRequestSwap } from '@/lib/shift-swap-permissions';
import { acceptSwapRequest, cancelSwapRequest, rejectSwapRequest } from '@/lib/shift-swap-service';

function sessionActor(session: any) {
  if (!session?.user?.id) return null;
  return {
    id: String(session.user.id),
    role: String((session.user as any).role || 'operator'),
    name: (session.user?.name as string | undefined) ?? null,
  };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = (await getServerSession(authOptions)) as any;
    const actor = sessionActor(session);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);
    if (actor.role !== 'operator') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const action = String(body?.action || '');
    const note = body?.note != null ? String(body.note) : null;
    if (!['accept', 'reject', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'action нь accept/reject/cancel байх ёстой' }, { status: 400 });
    }

    const request = await prisma.shiftSwapRequest.findUnique({ where: { id }, select: { requesterUid: true, targetUid: true } });
    if (!request) return NextResponse.json({ error: 'Хүсэлт олдсонгүй.' }, { status: 404 });

    if (action === 'cancel') {
      if (!canRequestSwap(actor, request.requesterUid)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const result = await cancelSwapRequest({ requestId: id, uid: actor.id, name: actor.name, note });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (!canDecideSwap(actor, request.targetUid)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const result =
      action === 'accept'
        ? await acceptSwapRequest({ requestId: id, uid: actor.id, name: actor.name, note })
        : await rejectSwapRequest({ requestId: id, uid: actor.id, name: actor.name, note });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('PATCH /api/shift-swap-requests/[id]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
