import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';

const ROLE_TARGETS = new Set(['operator', 'master', 'all']);
const LEGACY_DOCUMENT_LIMIT = 200;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function positiveInteger(value: string | null, fallback: number, maximum: number) {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

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

function canManage(role: string) {
  return role === 'admin' || role === 'hse_engineer';
}

function documentWhereForUser(a: ReturnType<typeof actor>, includeInactive: boolean) {
  if (!a) return {};
  if (canManage(a.role) && includeInactive) return {};
  if (canManage(a.role)) return { isActive: true };

  const roleTargets = a.role === 'master' ? ['master', 'all'] : ['operator', 'all'];
  return {
    isActive: true,
    roleTarget: { in: roleTargets },
    OR: [{ stationCode: null }, { stationCode: '' }, { stationCode: a.stationCode }],
  };
}

function serializeDocument(doc: any, acknowledgedAt?: string | null) {
  return {
    id: doc.id,
    title: doc.title,
    description: doc.description,
    fileUrl: doc.fileUrl,
    url: doc.fileUrl,
    fileName: doc.fileName,
    stationCode: doc.stationCode,
    roleTarget: doc.roleTarget,
    isActive: doc.isActive,
    uploadedByUid: doc.uploadedByUid,
    uploadedByName: doc.uploadedByName,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
    acknowledgedAt,
    acknowledged: Boolean(acknowledgedAt),
    ackCount: doc._count?.acknowledgements || 0,
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const a = actor(session);
    if (!a) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

    const params = new URL(req.url).searchParams;
    const includeInactive = params.get('includeInactive') === '1';
    const paginated = params.has('page') || params.has('pageSize');
    const pageSize = paginated
      ? positiveInteger(params.get('pageSize'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
      : LEGACY_DOCUMENT_LIMIT;
    const page = paginated ? positiveInteger(params.get('page'), 1, 100_000) : 1;
    const query = (params.get('q') || '').trim();
    const scopedWhere = documentWhereForUser(a, includeInactive);
    const where = query
      ? { AND: [scopedWhere, { title: { contains: query, mode: 'insensitive' as const } }] }
      : scopedWhere;

    // Existing callers without page parameters still receive the first 200 documents.
    const [total, userAcknowledgedTotal] = await Promise.all([
      prisma.instructionDocument.count({ where }),
      prisma.instructionDocument.count({
        where: { AND: [scopedWhere, { acknowledgements: { some: { operatorUid: a.id } } }] },
      }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const docs = await prisma.instructionDocument.findMany({
      where,
      include: {
        _count: {
          select: { acknowledgements: true },
        },
        acknowledgements: {
          where: { operatorUid: a.id },
          take: 1,
        },
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      skip: paginated ? (currentPage - 1) * pageSize : 0,
      take: pageSize,
    });

    return NextResponse.json({
      ok: true,
      documents: docs.map((doc) =>
        serializeDocument(
          doc,
          doc.acknowledgements[0]?.acknowledgedAt
            ? doc.acknowledgements[0].acknowledgedAt.toISOString()
            : null
        )
      ),
      total,
      userAcknowledgedTotal,
      page: currentPage,
      pageSize,
      totalPages,
    });
  } catch (e: any) {
    console.error('GET /api/instructions', e);
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
    const fileUrl = String(body?.fileUrl || '').trim();
    const description = String(body?.description || '').trim();
    const fileName = String(body?.fileName || title || '').trim();
    const stationCode = String(body?.stationCode || '').trim();
    const roleTarget = String(body?.roleTarget || 'operator').trim().toLowerCase();

    if (!title || !fileUrl) return NextResponse.json({ error: 'Missing title or fileUrl' }, { status: 400 });
    if (!ROLE_TARGETS.has(roleTarget)) return NextResponse.json({ error: 'Invalid roleTarget' }, { status: 400 });

    const doc = await prisma.instructionDocument.create({
      data: {
        title,
        description: description || null,
        fileUrl,
        fileName: fileName || null,
        stationCode: stationCode || null,
        roleTarget,
        uploadedByUid: a.id,
        uploadedByName: a.name || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorUid: a.id,
        actorName: a.name,
        action: 'instruction_document_created',
        entityType: 'instruction_document',
        entityId: doc.id,
        details: `${title}${stationCode ? ` (${stationCode})` : ''}`,
      },
    });

    return NextResponse.json({ ok: true, document: serializeDocument(doc, null) });
  } catch (e: any) {
    console.error('POST /api/instructions', e);
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

    const doc = await prisma.instructionDocument.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        actorUid: a.id,
        actorName: a.name,
        action: 'instruction_document_deleted',
        entityType: 'instruction_document',
        entityId: id,
        details: doc.title,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('DELETE /api/instructions', e);
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}
