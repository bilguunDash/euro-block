import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';

function canView(role: string) {
  return role === 'master' || role === 'admin' || role === 'dispatcher' || role === 'hse_engineer';
}

function userAppliesToDoc(user: any, doc: any) {
  const target = String(doc.roleTarget || 'operator');
  const roleOk = target === 'all' || target === user.role;
  const stationOk = !doc.stationCode || doc.stationCode === user.stationCode;
  return roleOk && stationOk;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function positiveInteger(value: string | null, fallback: number, maximum: number) {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function lastPageFromRing<T>(ring: T[], total: number, pageSize: number): T[] {
  const length = total % pageSize || Math.min(total, pageSize);
  const start = total - length;
  return Array.from({ length }, (_, index) => ring[(start + index) % pageSize]);
}

export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const role = String((session?.user as any)?.role || '');
    if (!session?.user?.id || !canView(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

    const params = new URL(req.url).searchParams;
    const paginated = params.has('missingPage') || params.has('acknowledgedPage') || params.has('pageSize');
    const pageSize = positiveInteger(params.get('pageSize'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const requestedMissingPage = positiveInteger(params.get('missingPage'), 1, 100_000);
    const requestedAcknowledgedPage = positiveInteger(params.get('acknowledgedPage'), 1, 100_000);
    const missingOffset = (requestedMissingPage - 1) * pageSize;
    const acknowledgedOffset = (requestedAcknowledgedPage - 1) * pageSize;

    const docs = await prisma.instructionDocument.findMany({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        stationCode: true,
        roleTarget: true,
        createdAt: true,
        acknowledgements: {
          select: { operatorUid: true, stationCode: true, acknowledgedAt: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const users = await prisma.user.findMany({
      where: {
        isApproved: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        stationCode: true,
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });

    const missing: any[] = [];
    const acknowledged: any[] = [];
    const missingRing: any[] = [];
    const acknowledgedRing: any[] = [];
    let missingTotal = 0;
    let acknowledgedTotal = 0;
    
    const summaries = docs.map((doc) => {
      const targetUsers = users.filter((user) => userAppliesToDoc(user, doc));
      const ackByUser = new Map(doc.acknowledgements.map((ack) => [ack.operatorUid, ack]));
      let docAcknowledged = 0;

      for (const user of targetUsers) {
        const ack = ackByUser.get(user.id);
        if (!ack) {
          const row = {
            documentId: doc.id,
            documentTitle: doc.title,
            stationCode: doc.stationCode,
            roleTarget: doc.roleTarget,
            operatorUid: user.id,
            operatorName: user.name || user.email || 'Нэргүй',
            operatorRole: user.role,
            operatorStationCode: user.stationCode,
          };
          if (!paginated || (missingTotal >= missingOffset && missingTotal < missingOffset + pageSize)) {
            missing.push(row);
          }
          if (paginated) missingRing[missingTotal % pageSize] = row;
          missingTotal += 1;
        } else {
          const row = {
            documentId: doc.id,
            documentTitle: doc.title,
            stationCode: doc.stationCode,
            roleTarget: doc.roleTarget,
            operatorUid: user.id,
            operatorName: user.name || user.email || 'Нэргүй',
            operatorRole: user.role,
            operatorStationCode: ack.stationCode || user.stationCode,
            acknowledgedAt: ack.acknowledgedAt.toISOString(),
          };
          if (!paginated || (acknowledgedTotal >= acknowledgedOffset && acknowledgedTotal < acknowledgedOffset + pageSize)) {
            acknowledged.push(row);
          }
          if (paginated) acknowledgedRing[acknowledgedTotal % pageSize] = row;
          acknowledgedTotal += 1;
          docAcknowledged += 1;
        }
      }

      return {
        id: doc.id,
        title: doc.title,
        stationCode: doc.stationCode,
        roleTarget: doc.roleTarget,
        createdAt: doc.createdAt.toISOString(),
        totalTargets: targetUsers.length,
        acknowledged: docAcknowledged,
      };
    });

    const missingPage = Math.min(requestedMissingPage, Math.max(1, Math.ceil(missingTotal / pageSize)));
    const acknowledgedPage = Math.min(requestedAcknowledgedPage, Math.max(1, Math.ceil(acknowledgedTotal / pageSize)));
    return NextResponse.json({
      ok: true,
      summaries,
      missing: paginated && missingPage !== requestedMissingPage
        ? lastPageFromRing(missingRing, missingTotal, pageSize)
        : missing,
      acknowledged: paginated && acknowledgedPage !== requestedAcknowledgedPage
        ? lastPageFromRing(acknowledgedRing, acknowledgedTotal, pageSize)
        : acknowledged,
      missingTotal,
      acknowledgedTotal,
      missingPage,
      acknowledgedPage,
      pageSize: paginated ? pageSize : null,
    });
  } catch (e: any) {
    console.error('GET /api/instructions/overview', e);
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}
