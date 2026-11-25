import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';
import { findSwapCandidates } from '@/lib/shift-swap-service';

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

    const scheduleId = new URL(req.url).searchParams.get('scheduleId') || '';
    if (!scheduleId) return NextResponse.json({ error: 'scheduleId шаардлагатай' }, { status: 400 });

    const result = await findSwapCandidates({ requesterUid: actor.id, scheduleId });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    return NextResponse.json({ ok: true, requesterRow: result.requesterRow, candidates: result.candidates });
  } catch (e: any) {
    console.error('GET /api/shift-swap-requests/candidates', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
