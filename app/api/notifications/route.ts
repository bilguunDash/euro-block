import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const role = String((session.user as any)?.role || '');
    const targetUserId = String(body.userId || '').trim();
    if (
      targetUserId &&
      targetUserId !== session.user.id &&
      role !== 'admin' &&
      role !== 'dispatcher' &&
      role !== 'master'
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create new notification
    const notification = await prisma.notification.create({
      data: {
        userId: targetUserId || session.user.id,
        kind: body.kind || 'info',
        title: body.title,
        body: body.body,
        link: body.link || '',
        read: false,
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error in POST /api/notifications:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    if (body.action === 'clearAll') {
      const result = await prisma.notification.deleteMany({
        where: { userId: session.user.id },
      });

      return NextResponse.json({ ok: true, deletedCount: result.count });
    }

    const { notificationId } = body;

    await prisma.notification.updateMany({
      where: { id: notificationId, userId: session.user.id },
      data: { read: true }
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error in PATCH /api/notifications:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
