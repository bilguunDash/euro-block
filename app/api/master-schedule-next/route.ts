import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';
import { isMasterStationCode } from '@/lib/master-stations';
import { resolveNextMasterScheduleForShift } from '@/lib/master-handover';

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return jsonError(401, 'Unauthorized');

  const deviceAccess = await getDeviceAccessForRequest(session, req);
  if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

  const { searchParams } = new URL(req.url);
  const stationCode = (searchParams.get('stationCode') || '').trim();
  const shiftDate = (searchParams.get('shiftDate') || '').trim();
  const shiftType = (searchParams.get('shiftType') || '').trim();

  if (!stationCode || !shiftDate || !shiftType) {
    return jsonError(400, 'stationCode, shiftDate, shiftType шаардлагатай.');
  }
  if (!isMasterStationCode(stationCode)) {
    return jsonError(400, 'Мастерын дамжлагын код биш байна.');
  }

  try {
    const nextMaster = await resolveNextMasterScheduleForShift({ stationCode, shiftDate, shiftType });
    if (!nextMaster?.masterUid) {
      return NextResponse.json({ ok: true, found: false, schedule: null });
    }
    return NextResponse.json({
      ok: true,
      found: true,
      schedule: {
        masterUid: nextMaster.masterUid,
        masterName: nextMaster.masterName,
        shiftDate: nextMaster.shiftDate,
        shiftType: nextMaster.shiftType,
        stationCode: nextMaster.stationCode,
      },
    });
  } catch (e) {
    console.error('GET /api/master-schedule-next', e);
    return jsonError(500, 'Дараагийн мастерын хуваарийг шалгахад алдаа гарлаа.');
  }
}
