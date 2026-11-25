import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';

export async function PATCH(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

    const body = await req.json().catch(() => null);
    const name = String(body?.name || '').trim();

    if (name.length < 2) {
      return NextResponse.json({ ok: false, error: 'Нэр хамгийн багадаа 2 тэмдэгт байна.' }, { status: 400 });
    }
    if (name.length > 120) {
      return NextResponse.json({ ok: false, error: 'Нэр хэт урт байна.' }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: session.user.id },
        data: { name },
        select: { id: true, name: true, email: true },
      });
      await tx.auditLog.create({
        data: {
          actorUid: user.id,
          actorName: user.name || user.email || '',
          action: 'profile_name_updated',
          entityType: 'user',
          entityId: user.id,
          details: 'User updated own display name from profile settings',
        },
      });
      return user;
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (error: any) {
    console.error('PATCH /api/auth/profile', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
