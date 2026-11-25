import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const DEVICE_ID_COOKIE = 'euroblock_device_id';
export const DEVICE_TYPES = new Set(['tablet', 'mobile', 'desktop', 'unknown']);

export type DeviceType = 'tablet' | 'mobile' | 'desktop' | 'unknown';

export type DeviceAccessResult = {
  allowed: boolean;
  deviceType: DeviceType;
  reason: string;
  tabletAccessAllowed: boolean;
  mobileAccessAllowed: boolean;
};

function roleRequiresDeviceGate(role: string) {
  return role === 'operator' || role === 'master';
}

export function normalizeDeviceType(value: unknown): DeviceType {
  const type = String(value || '').trim().toLowerCase();
  return DEVICE_TYPES.has(type) ? (type as DeviceType) : 'unknown';
}

export function evaluateDeviceAccess(args: {
  role: string;
  deviceType: DeviceType;
  tabletAccessAllowed: boolean;
  mobileAccessAllowed: boolean;
}): DeviceAccessResult {
  const role = String(args.role || '').trim().toLowerCase();
  const deviceType = normalizeDeviceType(args.deviceType);
  const tabletAccessAllowed = Boolean(args.tabletAccessAllowed);
  const mobileAccessAllowed = Boolean(args.mobileAccessAllowed);

  if (!roleRequiresDeviceGate(role)) {
    return { allowed: true, deviceType, tabletAccessAllowed, mobileAccessAllowed, reason: 'management_role_allowed' };
  }
  if ((deviceType === 'tablet' || deviceType === 'desktop' || deviceType === 'unknown') && tabletAccessAllowed) {
    return { allowed: true, deviceType, tabletAccessAllowed, mobileAccessAllowed, reason: 'tablet_access_allowed_by_admin' };
  }
  if (deviceType === 'tablet' || deviceType === 'desktop' || deviceType === 'unknown') {
    return { allowed: false, deviceType, tabletAccessAllowed, mobileAccessAllowed, reason: 'tablet_access_not_enabled' };
  }
  if (deviceType === 'mobile' && mobileAccessAllowed) {
    return { allowed: true, deviceType, tabletAccessAllowed, mobileAccessAllowed, reason: 'mobile_allowed_by_admin' };
  }
  if (deviceType === 'mobile') {
    return { allowed: false, deviceType, tabletAccessAllowed, mobileAccessAllowed, reason: 'mobile_access_not_enabled' };
  }
  return { allowed: false, deviceType, tabletAccessAllowed, mobileAccessAllowed, reason: 'device_type_not_allowed' };
}

function readCookie(headers: Headers, name: string) {
  const raw = headers.get('cookie') || '';
  const pairs = raw.split(';').map((part) => part.trim());
  const prefix = `${name}=`;
  const found = pairs.find((part) => part.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : '';
}

export async function getDeviceAccessForRequest(session: any, req: Request): Promise<DeviceAccessResult> {
  const role = String((session?.user as any)?.role || '').trim().toLowerCase();
  const userId = String((session?.user as any)?.id || '').trim();

  if (!roleRequiresDeviceGate(role)) {
    return { allowed: true, deviceType: 'unknown', tabletAccessAllowed: true, mobileAccessAllowed: true, reason: 'management_role_allowed' };
  }

  if (!userId) {
    return { allowed: false, deviceType: 'unknown', tabletAccessAllowed: false, mobileAccessAllowed: false, reason: 'missing_user' };
  }

  const deviceId = req.headers.get('x-device-id') || readCookie(req.headers, DEVICE_ID_COOKIE);
  if (!deviceId) {
    return { allowed: false, deviceType: 'unknown', tabletAccessAllowed: false, mobileAccessAllowed: false, reason: 'device_not_registered' };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      tabletAccessAllowed: true,
      mobileAccessAllowed: true,
      devices: {
        where: { deviceId },
        select: { deviceType: true },
        take: 1,
      },
    },
  });

  if (!user) {
    return { allowed: false, deviceType: 'unknown', tabletAccessAllowed: false, mobileAccessAllowed: false, reason: 'missing_user' };
  }

  const device = user.devices[0];
  if (!device) {
    return {
      allowed: false,
      deviceType: 'unknown',
      tabletAccessAllowed: user.tabletAccessAllowed,
      mobileAccessAllowed: user.mobileAccessAllowed,
      reason: 'device_not_registered',
    };
  }

  return evaluateDeviceAccess({
    role,
    deviceType: normalizeDeviceType(device.deviceType),
    tabletAccessAllowed: user.tabletAccessAllowed,
    mobileAccessAllowed: user.mobileAccessAllowed,
  });
}

export function deviceForbiddenResponse(result: DeviceAccessResult) {
  return NextResponse.json(
    {
      ok: false,
      error: 'DEVICE_NOT_ALLOWED',
      reason: result.reason,
      deviceType: result.deviceType,
      tabletAccessAllowed: result.tabletAccessAllowed,
      mobileAccessAllowed: result.mobileAccessAllowed,
    },
    { status: 403 }
  );
}
