import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

    const body = await req.json().catch(() => null);
    const currentPassword = String(body?.currentPassword || '');
    const newPassword = String(body?.newPassword || '');

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ ok: false, error: 'Бүх талбарыг бөглөнө үү.' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { ok: false, error: 'Шинэ нууц үг хамгийн багадаа 6 тэмдэгт байна.' },
        { status: 400 }
      );
    }
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { ok: false, error: 'Шинэ нууц үг одоогийн нууц үгээс өөр байх ёстой.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, passwordHash: true },
    });

    if (!user?.passwordHash) {
      return NextResponse.json(
        { ok: false, error: 'Энэ хэрэглэгчийн нууц үг тохируулагдаагүй байна.' },
        { status: 400 }
      );
    }

    const passwordOk = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordOk) {
      return NextResponse.json({ ok: false, error: 'Одоогийн нууц үг буруу байна.' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.auditLog.create({
        data: {
          actorUid: user.id,
          actorName: user.name || session.user.email || '',
          action: 'password_changed',
          entityType: 'user',
          entityId: user.id,
          details: 'User changed own password from profile settings',
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('POST /api/auth/change-password', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
