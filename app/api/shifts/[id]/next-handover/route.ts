import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';
import { isMasterStationCode } from '@/lib/master-stations';
import { resolveNextMasterScheduleForShift } from '@/lib/master-handover';
import { resolveNextOperatorSchedule } from '@/lib/operator-schedule-resolver';
import { prisma } from '@/lib/prisma';
import { canReadShift, type SessionActor } from '@/lib/shift-api-permissions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function sessionActor(session: any): SessionActor | null {
  if (!session?.user?.id) return null;
  return {
    id: String(session.user.id),
    role: String((session.user as any).role || 'operator'),
    stationCode: (session.user as any).stationCode ?? null,
    name: session.user.name ?? null,
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const actor = sessionActor(session as any);
  if (!actor) return jsonError(401, 'Unauthorized');

  const deviceAccess = await getDeviceAccessForRequest(session, req);
  if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

  const { id } = await params;
  if (!UUID_RE.test(id)) return jsonError(400, 'Invalid id');

  try {
    const shift = await prisma.shift.findUnique({
      where: { id },
      select: {
        operatorUid: true,
        stationCode: true,
        shiftDate: true,
        shiftType: true,
        handoverToOperatorUid: true,
        nextOperatorUid: true,
      },
    });
    if (!shift) return jsonError(404, 'Not found');

    if (
      !canReadShift(
        {
          operatorUid: shift.operatorUid,
          stationCode: shift.stationCode,
          handoverToOperatorUid: shift.handoverToOperatorUid ?? null,
          nextOperatorUid: shift.nextOperatorUid ?? null,
        },
        actor
      )
    ) {
      return jsonError(403, 'Forbidden');
    }

    if (isMasterStationCode(shift.stationCode)) {
      const nextMaster = await resolveNextMasterScheduleForShift({
        shiftDate: shift.shiftDate,
        shiftType: shift.shiftType,
        stationCode: shift.stationCode,
      });
      const eligible =
        Boolean(nextMaster?.masterUid) && String(nextMaster?.masterUid || '') !== String(shift.operatorUid);
      return NextResponse.json({
        ok: true,
        handoverKind: 'master',
        eligible,
        error: eligible
          ? null
          : 'Ижил мастерын дамжлагын дараагийн мастерын хуваарь олдсонгүй. Admin хуваарийг шалгана уу.',
        schedule: nextMaster
          ? {
              masterUid: nextMaster.masterUid,
              masterName: nextMaster.masterName,
              shiftDate: nextMaster.shiftDate,
              shiftType: nextMaster.shiftType,
              stationCode: nextMaster.stationCode,
            }
          : null,
      });
    }

    const resolution = await resolveNextOperatorSchedule({
      shiftDate: shift.shiftDate,
      shiftType: shift.shiftType,
      stationCode: shift.stationCode,
      currentOperatorUid: shift.operatorUid,
    });

    return NextResponse.json({
      ok: true,
      handoverKind: 'operator',
      eligible: resolution.eligible,
      error: resolution.error,
      schedule: resolution.schedule
        ? {
            id: String(resolution.schedule.id),
            operatorUid: resolution.schedule.operatorUid,
            operatorName: resolution.schedule.operatorName,
            shiftDate: resolution.schedule.shiftDate,
            shiftType: resolution.schedule.shiftType,
            stationCode: resolution.schedule.stationCode,
          }
        : null,
    });
  } catch (error) {
    console.error('GET /api/shifts/[id]/next-handover', error);
    return jsonError(500, 'Дараагийн операторын хуваарийг шалгахад алдаа гарлаа.');
  }
}
