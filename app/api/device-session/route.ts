import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import {
  DEVICE_ID_COOKIE,
  evaluateDeviceAccess,
  normalizeDeviceType,
} from '@/lib/device-access';

function clientIp(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  return forwarded.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
}

export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const deviceId = String(body?.deviceId || '').trim();
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: 'Missing deviceId' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: String(session.user.id) },
    select: { id: true, role: true, tabletAccessAllowed: true, mobileAccessAllowed: true },
  });
  if (!user) {
    return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
  }

  const deviceType = normalizeDeviceType(body?.deviceType);
  const access = evaluateDeviceAccess({
    role: user.role,
    deviceType,
    tabletAccessAllowed: user.tabletAccessAllowed,
    mobileAccessAllowed: user.mobileAccessAllowed,
  });

  const userAgent = String(body?.userAgent || req.headers.get('user-agent') || '').slice(0, 1000);
  const platform = String(body?.platform || '').slice(0, 200);
  const ipAddress = clientIp(req);

  const saved = await prisma.userDevice.upsert({
    where: {
      userId_deviceId: {
        userId: user.id,
        deviceId,
      },
    },
    create: {
      userId: user.id,
      deviceId,
      deviceType,
      userAgent,
      platform,
      ipAddress,
      allowed: access.allowed,
      blockedReason: access.allowed ? null : access.reason,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    },
    update: {
      deviceType,
      userAgent,
      platform,
      ipAddress,
      allowed: access.allowed,
      blockedReason: access.allowed ? null : access.reason,
      lastSeenAt: new Date(),
    },
  });

  const res = NextResponse.json({
    ok: true,
    allowed: access.allowed,
    reason: access.reason,
    deviceType: access.deviceType,
    tabletAccessAllowed: access.tabletAccessAllowed,
    mobileAccessAllowed: access.mobileAccessAllowed,
    device: {
      id: saved.id,
      deviceId: saved.deviceId,
      deviceType: saved.deviceType,
      allowed: saved.allowed,
      blockedReason: saved.blockedReason,
      firstSeenAt: saved.firstSeenAt.toISOString(),
      lastSeenAt: saved.lastSeenAt.toISOString(),
    },
  });
  res.cookies.set(DEVICE_ID_COOKIE, deviceId, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
