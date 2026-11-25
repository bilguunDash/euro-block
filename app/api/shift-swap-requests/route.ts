import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';
import { canRequestSwap } from '@/lib/shift-swap-permissions';
import { createSwapRequest, listSwapRequests } from '@/lib/shift-swap-service';

function sessionActor(session: any) {
  if (!session?.user?.id) return null;
  return { id: String(session.user.id), role: String((session.user as any).role || 'operator') };
}

export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const actor = sessionActor(session);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);
    if (actor.role !== 'operator') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const box = new URL(req.url).searchParams.get('box');
    if (box !== 'incoming' && box !== 'outgoing') {
      return NextResponse.json({ error: 'box нь incoming эсвэл outgoing байх ёстой' }, { status: 400 });
    }

    const requests = await listSwapRequests({ uid: actor.id, box });
    return NextResponse.json({ ok: true, requests });
  } catch (e: any) {
    console.error('GET /api/shift-swap-requests', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const actor = sessionActor(session);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);
    if (!canRequestSwap(actor, actor.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const requesterScheduleId = String(body?.requesterScheduleId || '').trim();
    const targetUid = String(body?.targetUid || '').trim();
    const targetScheduleId = String(body?.targetScheduleId || '').trim();
    const message = body?.message != null ? String(body.message) : null;
    if (!requesterScheduleId || !targetUid || !targetScheduleId) {
      return NextResponse.json({ error: 'Шаардлагатай талбар дутуу байна.' }, { status: 400 });
    }

    const result = await createSwapRequest({
      requesterUid: actor.id,
      requesterScheduleId,
      targetUid,
      targetScheduleId,
      message,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    return NextResponse.json({ ok: true, id: result.id });
  } catch (e: any) {
    console.error('POST /api/shift-swap-requests', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
