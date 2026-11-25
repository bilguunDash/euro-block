import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';

export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

    const uid = session.user.id;
    const role = (session.user as any).role;

    // Keep the visible list short, but count every open request for Home.
    const [maintenanceRequests, openMaintenanceCount] = await Promise.all([
      prisma.maintenanceRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.maintenanceRequest.count({ where: { status: { in: ['Open', 'In Progress'] } } }),
    ]);

    const hseLogTake = role === 'hse_engineer' ? 120 : 20;
    const hseLogs = await prisma.hseLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: hseLogTake,
    });

    let hseChecklistLogs: any[] = [];
    if (role === 'hse_engineer') {
      const checklistRows = await prisma.productionLog.findMany({
        where: { logType: 'modal_hse_checklist' },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          shift: {
            select: {
              id: true,
              stationCode: true,
              operatorName: true,
              operatorUid: true,
              shiftDate: true,
              shiftType: true,
              status: true,
              shiftImages: {
                where: { section: 'hse_checklist' },
                orderBy: { createdAt: 'desc' },
                take: 20,
              },
            },
          },
        },
      });
      hseChecklistLogs = checklistRows.map((r) => ({
        id: r.id.toString(),
        shiftId: r.shiftId,
        createdAt: r.createdAt.toISOString(),
        logType: r.logType,
        data: r.data,
        stationCode: r.shift?.stationCode ?? '',
        operatorName: r.shift?.operatorName ?? '',
        operatorUid: r.shift?.operatorUid ?? '',
        shiftDate: r.shift?.shiftDate ?? '',
        shiftType: r.shift?.shiftType ?? '',
        shiftStatus: r.shift?.status ?? '',
        images: (r.shift?.shiftImages ?? []).map((img) => ({
          id: img.id,
          name: img.rowLabel || img.caption || 'ХАБЭА-н зураг',
          url: img.publicUrl,
          publicUrl: img.publicUrl,
          storagePath: img.storagePath,
          mimeType: img.mimeType,
          sizeBytes: img.sizeBytes,
          uploadedAt: img.createdAt.toISOString(),
          uploadedByName: img.uploadedByName,
          caption: img.caption,
          rowLabel: img.rowLabel,
        })),
      }));
    }

    // Fetch Notifications for user
    const notifications = await prisma.notification.findMany({
      where: { userId: uid },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });

    // Fetch Audit Logs if admin/auditor
    let auditLogs: any[] = [];
    let auditLogCount = 0;
    if (['admin', 'auditor', 'chief_engineer', 'dispatcher'].includes(role)) {
      const [count, rows] = await Promise.all([
        prisma.auditLog.count(),
        prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
      ]);
      auditLogCount = count;
      auditLogs = rows;
    }

    // Helper to format dates consistently for the client.
    return NextResponse.json({
      ok: true,
      maintenanceRequests: maintenanceRequests.map(m => ({ ...m, id: m.id.toString(), createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString() })),
      openMaintenanceCount,
      hseLogs: hseLogs.map(h => ({ ...h, id: h.id.toString(), timestamp: h.createdAt.toISOString(), incidents: typeof h.incidents === 'string' ? JSON.parse(h.incidents) : h.incidents, hseApprovedAt: (h as any).hseApprovedAt ? (h as any).hseApprovedAt.toISOString() : null })),
      hseChecklistLogs,
      notifications: notifications.map(n => ({ ...n, id: n.id.toString(), createdAt: n.createdAt.toISOString() })),
      auditLogCount,
      auditLogs: auditLogs.map(a => ({ ...a, id: a.id.toString(), timestamp: a.createdAt.toISOString() })),
    });

  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

    const body = await req.json();

    if (['approveHseLog', 'updateHseLogNote', 'updateHseChecklistNote'].includes(body.action) && session.user.role !== 'hse_engineer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // For now, handling only HSE log approval directly in dashboard route
    if (body.action === 'approveHseLog' && session.user.role === 'hse_engineer') {
      const { logId, note } = body;
      
      await prisma.$transaction([
        prisma.hseLog.update({
          where: { id: logId },
          data: {
            hseEngineerApproved: true,
            hseApprovedByUid: session.user.id,
            hseApprovedByName: session.user.name || '',
            hseApprovedAt: new Date(),
            hseEngineerNote: typeof note === 'string' ? note : undefined,
          }
        }),
        prisma.auditLog.create({
          data: {
            actorUid: session.user.id,
            actorName: session.user.name || '',
            action: 'hse_log_approved',
            entityType: 'hse_log',
            entityId: logId,
            details: 'HSE Log approved via Dashboard REST API'
          }
        })
      ]);

      return NextResponse.json({ ok: true });
    }

    if (body.action === 'updateHseLogNote' && session.user.role === 'hse_engineer') {
      const logId = String(body.logId || '').trim();
      const note = String(body.note ?? '').trim().slice(0, 8000);
      if (!logId) return NextResponse.json({ error: 'Missing logId' }, { status: 400 });

      await prisma.$transaction([
        prisma.hseLog.update({
          where: { id: logId },
          data: { hseEngineerNote: note },
        }),
        prisma.auditLog.create({
          data: {
            actorUid: session.user.id,
            actorName: session.user.name || '',
            action: 'hse_log_note_updated',
            entityType: 'hse_log',
            entityId: logId,
            details: 'HSE engineer note updated via Dashboard REST API',
          },
        }),
      ]);

      return NextResponse.json({ ok: true });
    }

    if (body.action === 'updateHseChecklistNote' && session.user.role === 'hse_engineer') {
      const logId = String(body.logId || '').trim();
      const note = String(body.note ?? '').trim().slice(0, 8000);
      if (!logId) return NextResponse.json({ error: 'Missing logId' }, { status: 400 });

      const row = await prisma.productionLog.findUnique({ where: { id: logId } });
      if (!row || row.logType !== 'modal_hse_checklist') {
        return NextResponse.json({ error: 'Checklist log not found' }, { status: 404 });
      }
      const currentData =
        row.data && typeof row.data === 'object' && !Array.isArray(row.data)
          ? (row.data as Record<string, any>)
          : {};

      await prisma.$transaction([
        prisma.productionLog.update({
          where: { id: logId },
          data: {
            data: {
              ...currentData,
              hseEngineerNote: note,
              hseEngineerNoteByUid: session.user.id,
              hseEngineerNoteByName: session.user.name || '',
              hseEngineerNoteAt: new Date().toISOString(),
            },
          },
        }),
        prisma.auditLog.create({
          data: {
            actorUid: session.user.id,
            actorName: session.user.name || '',
            action: 'hse_checklist_note_updated',
            entityType: 'production_log',
            entityId: logId,
            details: 'HSE checklist note updated via Dashboard REST API',
          },
        }),
      ]);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in dashboard PATCH:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
