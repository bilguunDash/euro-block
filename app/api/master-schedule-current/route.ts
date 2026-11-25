import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';
import { isMasterStationCode } from '@/lib/master-stations';
import { resolveCurrentMasterScheduleForShift } from '@/lib/master-handover';

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
    const current = await resolveCurrentMasterScheduleForShift({ stationCode, shiftDate, shiftType });
    if (!current?.masterUid) {
      return NextResponse.json({ ok: true, found: false, schedule: null });
    }
    return NextResponse.json({
      ok: true,
      found: true,
      schedule: {
        masterUid: current.masterUid,
        masterName: current.masterName,
        shiftDate: current.shiftDate,
        shiftType: current.shiftType,
        stationCode: current.stationCode,
      },
    });
  } catch (e) {
    console.error('GET /api/master-schedule-current', e);
    return jsonError(500, 'Энэ ээлжийн мастерын хуваарийг шалгахад алдаа гарлаа.');
  }
}
