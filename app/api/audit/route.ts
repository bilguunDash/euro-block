import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';

const ROLE_CHANGE_ACTIONS = new Set([
  'user_role_changed',
  'user_station_changed',
  'user_approved_changed',
]);

function parseIsoDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(String(s));
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const role = String((session?.user as any)?.role || '');
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'dispatcher', 'auditor', 'chief_engineer'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const onlyRoleChanges = searchParams.get('onlyRoleChanges') === 'true';
    const action = String(searchParams.get('action') || '').trim();
    const entityType = String(searchParams.get('entityType') || '').trim();
    const actorUid = String(searchParams.get('actorUid') || '').trim();
    const since = parseIsoDate(searchParams.get('since'));
    const until = parseIsoDate(searchParams.get('until'));

    const limitRaw = parseInt(String(searchParams.get('limit') || '100'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;

    const where: any = {};
    if (onlyRoleChanges) where.action = { in: Array.from(ROLE_CHANGE_ACTIONS) };
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (actorUid) where.actorUid = actorUid;
    if (since || until) {
      where.createdAt = {};
      if (since) where.createdAt.gte = since;
      if (until) where.createdAt.lte = until;
    }

    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      ok: true,
      logs: rows.map((a) => ({ ...a, id: a.id.toString(), timestamp: a.createdAt.toISOString() })),
    });
  } catch (error: any) {
    console.error('Error in GET /api/audit:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    await prisma.auditLog.create({
      data: {
        actorUid: session.user.id,
        actorName: session.user.name || '',
        action: body.action,
        entityType: body.entityType,
        entityId: body.entityId,
        details: body.details || '',
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error in POST /api/audit:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
