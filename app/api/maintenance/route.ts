import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

    const body = await req.json();

    const request = await prisma.maintenanceRequest.create({
      data: {
        stationCode: body.stationCode,
        reportedByUid: body.reportedByUid,
        reportedByName: body.reportedByName,
        description: body.description,
        priority: body.priority,
        status: body.status || 'Open',
        assignedToUid: body.assignedToUid || null,
        assignedToName: body.assignedToName || null,
        notes: body.notes || null,
      }
    });

    return NextResponse.json({ ok: true, id: request.id.toString() });
  } catch (error: any) {
    console.error('Error POST /api/maintenance:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

const MAINTENANCE_PATCH_ROLES = new Set(['master', 'dispatcher', 'chief_engineer', 'admin']);

export async function PATCH(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = String(session.user?.role || '');
    if (!MAINTENANCE_PATCH_ROLES.has(role)) {
      return NextResponse.json({ error: 'Засварын хүсэлт шинэчлэх эрхгүй.' }, { status: 403 });
    }
    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    // Зөвшөөрөгдсөн талбар л шинэчилнэ — reportedBy/id зэргийг client-ээс дур
    // мэдэн бичихээс сэргийлнэ.
    const data: Record<string, unknown> = {};
    if ('status' in body) data.status = body.status;
    if ('priority' in body) data.priority = body.priority;
    if ('assignedToUid' in body) data.assignedToUid = body.assignedToUid || null;
    if ('assignedToName' in body) data.assignedToName = body.assignedToName || null;
    if ('notes' in body) data.notes = body.notes || null;

    const request = await prisma.maintenanceRequest.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ok: true, id: request.id.toString() });
  } catch (error: any) {
    console.error('Error PATCH /api/maintenance:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
