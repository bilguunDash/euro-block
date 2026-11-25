import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';

function actor(session: any) {
  const user = session?.user;
  if (!user?.id) return null;
  return {
    id: String(user.id),
    name: String(user.name || ''),
    role: String(user.role || 'operator'),
    stationCode: user.stationCode ? String(user.stationCode) : '',
  };
}

function canAcknowledge(role: string) {
  return role === 'operator' || role === 'master';
}

function docAppliesToActor(doc: any, a: ReturnType<typeof actor>) {
  if (!a) return false;
  const target = String(doc.roleTarget || 'operator');
  const roleOk = target === 'all' || target === a.role;
  const stationOk = !doc.stationCode || doc.stationCode === a.stationCode;
  return doc.isActive && roleOk && stationOk;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const a = actor(session);
    if (!a) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);
    if (!canAcknowledge(a.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const doc = await prisma.instructionDocument.findUnique({ where: { id } });
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!docAppliesToActor(doc, a)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const ack = await prisma.instructionAcknowledgement.upsert({
      where: {
        documentId_operatorUid: {
          documentId: id,
          operatorUid: a.id,
        },
      },
      create: {
        documentId: id,
        operatorUid: a.id,
        operatorName: a.name || null,
        stationCode: a.stationCode || null,
      },
      update: {
        operatorName: a.name || null,
        stationCode: a.stationCode || null,
        acknowledgedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorUid: a.id,
        actorName: a.name,
        action: 'instruction_acknowledged',
        entityType: 'instruction_document',
        entityId: id,
        details: doc.title,
      },
    });

    return NextResponse.json({ ok: true, acknowledgedAt: ack.acknowledgedAt.toISOString() });
  } catch (e: any) {
    console.error('POST /api/instructions/[id]/acknowledge', e);
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}
