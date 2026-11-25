import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';
import { parseUlaanbaatarLocal } from '@/lib/ulaanbaatar-time';

function actor(session: any) {
  const user = session?.user;
  if (!user?.id) return null;
  return {
    id: String(user.id),
    name: String(user.name || ''),
    role: String(user.role || 'operator'),
    stationCode: String(user.stationCode || ''),
  };
}

function canManage(role: string) {
  /** Admin, Shift Master and Dispatcher can broadcast notices */
  return role === 'admin' || role === 'master' || role === 'dispatcher';
}

const ANNOUNCEMENT_TARGET_ROLES = new Set(['operator', 'master', 'admin', 'dispatcher', 'hse_engineer']);

function activeAnnouncementWhere(now = new Date()) {
  return {
    isActive: true,
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: now } },
    ],
  };
}

function normalizeTargetArray(value: unknown, allowed?: Set<string>) {
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  for (const item of raw) {
    const text = String(item ?? '').trim();
    if (!text) continue;
    if (allowed && !allowed.has(text)) continue;
    seen.add(text);
  }
  return Array.from(seen);
}

function normalizeTargetRoles(value: unknown) {
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const invalid = new Set<string>();

  for (const item of raw) {
    const role = String(item ?? '').trim();
    if (!role) continue;
    if (!ANNOUNCEMENT_TARGET_ROLES.has(role)) {
      invalid.add(role);
      continue;
    }
    seen.add(role);
  }

  return {
    roles: Array.from(seen),
    invalidRoles: Array.from(invalid),
  };
}

/**
 * Дуусах хугацааг задлаж шалгана.
 *
 * ЦАГИЙН БҮС: клиент `datetime-local`-ийн бүсгүй мөр (`2026-08-18T13:45`) эсвэл
 * бүсэлсэн ISO илгээж болно. Эхнийхийг `new Date(...)`-аар шууд задлавал
 * СЕРВЕРИЙН бүсээр тайлагдаж, UTC сервер дээр 8 цагаар ухардаг байв —
 * улмаар зарлал үүсмэгцээ «хугацаа дууссан» болж байсан.
 *
 * ӨНГӨРСӨН ХУГАЦАА: хугацаа дууссан зарлалыг АВТОМАТААР УСТГАДАГ болсон тул
 * өнгөрсөн огноо оруулахыг хориглоно — эс бөгөөс хадгалсан зарлал шууд устана.
 */
function parseRequiredExpiresAt(value: unknown, now = new Date()) {
  if (!value) {
    return { expiresAt: null, error: 'Дуусах огноо, цагийг заавал оруулна уу.' };
  }

  const expiresAt = parseUlaanbaatarLocal(value);
  if (!expiresAt) {
    return { expiresAt: null, error: 'Дуусах огноо, цаг буруу байна.' };
  }
  if (expiresAt.getTime() <= now.getTime()) {
    return { expiresAt: null, error: 'Дуусах хугацаа ирээдүйн цаг байх ёстой.' };
  }

  return { expiresAt, error: null };
}

/**
 * Хугацаа нь дууссан зарлалыг БҮРМӨСӨН устгана (уншсан тэмдэглэл нь cascade-аар
 * дагаж устана).
 *
 * Жагсаалт татах болгонд дуудагдана — тусдаа cron шаардахгүй, идемпотент бөгөөд
 * нэг `deleteMany`. Өмнө нь зөвхөн query-гээр нуудаг байсан тул админы
 * «Зарлалын удирдлага» жагсаалтад хугацаа дууссан зарлал амьд мэт харагддаг байв.
 */
async function purgeExpiredAnnouncements(now = new Date()) {
  const expired = await prisma.announcement.findMany({
    where: { expiresAt: { not: null, lte: now } },
    select: { id: true, title: true },
  });
  if (expired.length === 0) return 0;

  await prisma.announcement.deleteMany({ where: { id: { in: expired.map((a) => a.id) } } });
  await prisma.auditLog.createMany({
    data: expired.map((a) => ({
      actorUid: 'system',
      actorName: 'Систем',
      action: 'announcement_expired_purged',
      entityType: 'announcement',
      entityId: a.id,
      details: a.title,
    })),
  });
  return expired.length;
}

function audienceWhere(targetRoles: string[], targetStations: string[]) {
  const where: any = { isApproved: true };
  if (targetRoles.length > 0) where.role = { in: targetRoles };
  if (targetStations.length > 0) where.stationCode = { in: targetStations };
  return where;
}

export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const a = actor(session);
    if (!a) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

    const includeInactive = new URL(req.url).searchParams.get('includeInactive') === '1';
    const managementView = includeInactive && canManage(a.role);
    const now = new Date();

    // Жагсаалт гаргахын ӨМНӨ хугацаа дууссаныг устгана — админы жагсаалт ч,
    // хэрэглэгчийн жагсаалт ч цэвэр байна.
    await purgeExpiredAnnouncements(now);

    const where: any = managementView ? {} : activeAnnouncementWhere(now);

    // Apply audience filtering if it's NOT the management view (includeInactive=1)
    // or if the user is a regular user.
    if (!managementView) {
      where.AND = [
        activeAnnouncementWhere(now),
        {
          OR: [
            { targetRoles: { equals: [] } },
            { targetRoles: { has: a.role } }
          ]
        },
        a.stationCode
          ? { OR: [{ targetStations: { equals: [] } }, { targetStations: { has: a.stationCode } }] }
          : { targetStations: { equals: [] } }
      ];
    }
    
    const announcements = await prisma.announcement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ ok: true, announcements });
  } catch (e: any) {
    console.error('GET /api/announcements', e);
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const a = actor(session);
    if (!a || !canManage(a.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || '').trim();
    const content = String(body?.content || '').trim();
    const type = String(body?.type || 'info').trim();
    const expiresAtResult = parseRequiredExpiresAt(body?.expiresAt);
    if (expiresAtResult.error) {
      return NextResponse.json({ error: expiresAtResult.error }, { status: 400 });
    }
    const expiresAt = expiresAtResult.expiresAt;
    const targetRoleResult = normalizeTargetRoles(body?.targetRoles);
    if (targetRoleResult.invalidRoles.length > 0) {
      return NextResponse.json({ error: 'Зарлалын хүлээн авагч role буруу байна.' }, { status: 400 });
    }
    const targetRoles = targetRoleResult.roles;
    const targetStations = normalizeTargetArray(body?.targetStations);

    if (!title || !content) return NextResponse.json({ error: 'Missing title or content' }, { status: 400 });

    const ann = await prisma.announcement.create({
      data: {
        title,
        content,
        type,
        expiresAt,
        isActive: body?.isActive !== undefined ? Boolean(body.isActive) : true,
        targetRoles,
        targetStations,
        authorUid: a.id,
        authorName: a.name,
        authorRole: a.role,
      },
    });

    let notificationRecipients = 0;

    // Send notifications to targets
    try {
      if (ann.isActive) {
        const targetUsers = await prisma.user.findMany({
          where: audienceWhere(targetRoles, targetStations),
          select: { id: true },
        });
        notificationRecipients = targetUsers.length;
        if (targetUsers.length > 0) {
          const { notifyManyDeduped } = await import('@/lib/server-notifications');
          await notifyManyDeduped(
            targetUsers.map((u) => u.id),
            {
              kind: 'announcement',
              title: `Шинэ зарлал: ${title}`,
              body: content.length > 100 ? content.slice(0, 97) + '...' : content,
              link: '/announcements',
              dedupeKey: `ann-${ann.id}`,
            }
          );
        }
      }
    } catch (notifyErr) {
      console.error('Failed to send announcement notifications:', notifyErr);
    }

    await prisma.auditLog.create({
      data: {
        actorUid: a.id,
        actorName: a.name,
        action: 'announcement_created',
        entityType: 'announcement',
        entityId: ann.id,
        details: JSON.stringify({
          title,
          targetRoles,
          targetStations,
          notificationRecipients,
        }),
      },
    });

    return NextResponse.json({ ok: true, announcement: ann, notificationRecipients });
  } catch (e: any) {
    console.error('POST /api/announcements', e);
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const a = actor(session);
    if (!a || !canManage(a.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = body?.id;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    if (body.expiresAt === undefined) {
      return NextResponse.json({ error: 'Дуусах огноо, цагийг заавал оруулна уу.' }, { status: 400 });
    }

    const updateData: any = {};
    if (body.title !== undefined) updateData.title = String(body.title).trim();
    if (body.content !== undefined) updateData.content = String(body.content).trim();
    if (body.type !== undefined) updateData.type = String(body.type).trim();
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);
    if (body.expiresAt !== undefined) {
      const expiresAtResult = parseRequiredExpiresAt(body.expiresAt);
      if (expiresAtResult.error) {
        return NextResponse.json({ error: expiresAtResult.error }, { status: 400 });
      }
      updateData.expiresAt = expiresAtResult.expiresAt;
    }
    if (body.targetRoles !== undefined) {
      const targetRoleResult = normalizeTargetRoles(body.targetRoles);
      if (targetRoleResult.invalidRoles.length > 0) {
        return NextResponse.json({ error: 'Зарлалын хүлээн авагч role буруу байна.' }, { status: 400 });
      }
      updateData.targetRoles = targetRoleResult.roles;
    }
    if (body.targetStations !== undefined) updateData.targetStations = normalizeTargetArray(body.targetStations);

    const ann = await prisma.announcement.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ ok: true, announcement: ann });
  } catch (e: any) {
    console.error('PATCH /api/announcements', e);
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const a = actor(session);
    if (!a || !canManage(a.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = new URL(req.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const ann = await prisma.announcement.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        actorUid: a.id,
        actorName: a.name,
        action: 'announcement_deleted',
        entityType: 'announcement',
        entityId: id,
        details: ann.title,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('DELETE /api/announcements', e);
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}
