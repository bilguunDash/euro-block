import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const announcementId = body?.announcementId;
    if (!announcementId) return NextResponse.json({ error: 'Missing announcementId' }, { status: 400 });

    await prisma.announcementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId,
          userId: session.user.id,
        },
      },
      update: {
        readAt: new Date(),
      },
      create: {
        announcementId,
        userId: session.user.id,
        userName: session.user.name || 'Unknown',
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('POST /api/announcements/read', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const role = session?.user?.role;
    if (role !== 'admin' && role !== 'master') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const announcementId = new URL(req.url).searchParams.get('announcementId');
    if (!announcementId) return NextResponse.json({ error: 'Missing announcementId' }, { status: 400 });

    const reads = await prisma.announcementRead.findMany({
      where: { announcementId },
      orderBy: { readAt: 'desc' },
    });

    return NextResponse.json({ ok: true, reads });
  } catch (e: any) {
    console.error('GET /api/announcements/read', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
