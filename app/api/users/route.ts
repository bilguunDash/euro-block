import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { normalizeShiftGroup } from '@/lib/shift-crew';
import { isAllowedRole, normalizeRole as normalizeRoleValue } from '@/lib/roles';

function normalizeRole(role: unknown): string | null {
  if (role == null) return null;
  return normalizeRoleValue(role);
}

export async function GET() {
  const session = (await getServerSession(authOptions)) as any;

  const r = String((session?.user as any)?.role || '');
  if (!session || (r !== 'admin' && r !== 'dispatcher')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        devices: {
          orderBy: { lastSeenAt: 'desc' },
          take: 8,
        },
      },
    });
    return NextResponse.json({
      ok: true,
      users: users.map((user) => ({
        ...user,
        devices: user.devices.map((device) => ({
          ...device,
          firstSeenAt: device.firstSeenAt.toISOString(),
          lastSeenAt: device.lastSeenAt.toISOString(),
        })),
      })),
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = (await getServerSession(authOptions)) as any;

  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, isApproved, role, stationCode, name, tabletAccessAllowed, mobileAccessAllowed, sortDualRole, resetDevices, shiftGroup } = await req.json();
    const normalizedRole = normalizeRole(role);

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    if (normalizedRole != null && !isAllowedRole(normalizedRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    if (name != null && typeof name !== 'string') {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    const before = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        stationCode: true,
        isApproved: true,
        name: true,
        tabletAccessAllowed: true,
        mobileAccessAllowed: true,
        sortDualRole: true,
      },
    });

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        isApproved,
        role: normalizedRole ?? role,
        stationCode,
        ...(typeof tabletAccessAllowed === 'boolean' ? { tabletAccessAllowed } : {}),
        ...(typeof mobileAccessAllowed === 'boolean' ? { mobileAccessAllowed } : {}),
        ...(typeof sortDualRole === 'boolean' ? { sortDualRole } : {}),
        ...(name != null ? { name: String(name).trim() } : {}),
        // Ээлжийн баг — зөвхөн оператор/мастерт утгатай. Бусад role-д цэвэрлэнэ.
        ...(shiftGroup !== undefined
          ? {
              shiftGroup:
                normalizedRole === 'operator' || normalizedRole === 'master'
                  ? normalizeShiftGroup(shiftGroup)
                  : null,
            }
          : {}),
      },
      include: {
        devices: {
          orderBy: { lastSeenAt: 'desc' },
          take: 8,
        },
      },
    });

    if (resetDevices === true) {
      await prisma.userDevice.deleteMany({ where: { userId: id } });
      updatedUser.devices = [];
    }

    const actorUid = String(session.user.id);
    const actorName = String(session.user.name || '');
    const userEmail = String(before?.email || updatedUser.email || '');

    const changes: Array<{ action: string; details: string }> = [];
    if (before && String(before.name || '') !== String(updatedUser.name || '')) {
      changes.push({
        action: 'user_updated',
        details: `${userEmail}: name ${before.name || '-'} -> ${updatedUser.name || '-'}`,
      });
    }
    if (before && before.role !== updatedUser.role) {
      changes.push({
        action: 'user_role_changed',
        details: `${userEmail}: ${before.role} -> ${updatedUser.role}`,
      });
    }
    if (before && String(before.stationCode || '') !== String(updatedUser.stationCode || '')) {
      changes.push({
        action: 'user_station_changed',
        details: `${userEmail}: ${before.stationCode || '-'} -> ${updatedUser.stationCode || '-'}`,
      });
    }
    if (before && Boolean(before.isApproved) !== Boolean(updatedUser.isApproved)) {
      changes.push({
        action: 'user_approved_changed',
        details: `${userEmail}: ${before.isApproved ? 'true' : 'false'} -> ${updatedUser.isApproved ? 'true' : 'false'}`,
      });
    }
    if (before && Boolean(before.tabletAccessAllowed) !== Boolean(updatedUser.tabletAccessAllowed)) {
      changes.push({
        action: 'user_tablet_access_changed',
        details: `${userEmail}: tablet ${before.tabletAccessAllowed ? 'enabled' : 'disabled'} -> ${updatedUser.tabletAccessAllowed ? 'enabled' : 'disabled'}`,
      });
    }
    if (before && Boolean(before.mobileAccessAllowed) !== Boolean(updatedUser.mobileAccessAllowed)) {
      changes.push({
        action: 'user_mobile_access_changed',
        details: `${userEmail}: mobile ${before.mobileAccessAllowed ? 'enabled' : 'disabled'} -> ${updatedUser.mobileAccessAllowed ? 'enabled' : 'disabled'}`,
      });
    }
    if (before && Boolean(before.sortDualRole) !== Boolean(updatedUser.sortDualRole)) {
      changes.push({
        action: 'user_sort_dual_role_changed',
        details: `${userEmail}: sortDualRole ${before.sortDualRole ? 'enabled' : 'disabled'} -> ${updatedUser.sortDualRole ? 'enabled' : 'disabled'}`,
      });
    }
    if (resetDevices === true) {
      changes.push({
        action: 'user_devices_reset',
        details: `${userEmail}: registered devices cleared`,
      });
    }

    // Always write a general update log too
    changes.unshift({
      action: 'user_updated',
      details: `Updated ${userEmail} (name=${updatedUser.name || '-'}, role=${updatedUser.role}, station=${updatedUser.stationCode || '-'}, approved=${updatedUser.isApproved ? 'true' : 'false'}, tablet=${updatedUser.tabletAccessAllowed ? 'true' : 'false'}, mobile=${updatedUser.mobileAccessAllowed ? 'true' : 'false'})`,
    });

    await prisma.auditLog.createMany({
      data: changes.map((c) => ({
        actorUid,
        actorName,
        action: c.action,
        entityType: 'user',
        entityId: updatedUser.id,
        details: c.details,
      })),
    });

    return NextResponse.json({
      ok: true,
      user: {
        ...updatedUser,
        devices: updatedUser.devices.map((device) => ({
          ...device,
          firstSeenAt: device.firstSeenAt.toISOString(),
          lastSeenAt: device.lastSeenAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { email, displayName, role, stationCode, isApproved, tabletAccessAllowed, mobileAccessAllowed } = await req.json();
    const normalizedRole = normalizeRole(role);
    if (normalizedRole != null && !isAllowedRole(normalizedRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // `lib/auth-options.ts`-ийн authorize() нэвтрэх имэйлийг lowercase болгож
    // хайдаг (erp-sync мөн адил хадгалахдаа lowercase болгодог) — энд хөрвүүлэхгүй
    // бол админ Том/Жижиг холимог имэйлээр хэрэглэгч үүсгэсэн тохиолдолд тухайн
    // хэрэглэгч өөр том/жижиг үсгээр бичихэд нэвтэрч чадахгүй болдог байв.
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() || null : email;

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: displayName,
        role: (normalizedRole as any) || role || 'operator',
        stationCode,
        isApproved: isApproved || false,
        tabletAccessAllowed: typeof tabletAccessAllowed === 'boolean' ? tabletAccessAllowed : true,
        mobileAccessAllowed: typeof mobileAccessAllowed === 'boolean' ? mobileAccessAllowed : true,
      }
    });

    return NextResponse.json({ ok: true, user: newUser });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
