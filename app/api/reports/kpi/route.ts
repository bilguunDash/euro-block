import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { PRIVILEGED_SHIFT_READ } from '@/lib/shift-api-permissions';
import { buildKpiReportWorkbook } from '@/lib/kpi-report-export';

export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const role = String((session?.user as any)?.role || '');
    if (!session?.user?.email || !PRIVILEGED_SHIFT_READ.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json';
    const since =
      searchParams.get('since') ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const until = searchParams.get('until') || '';
    const stationCode = searchParams.get('stationCode') || '';
    const employeeUid = searchParams.get('employeeUid') || '';

    const shiftDateFilter: { gte: string; lte?: string } = { gte: since };
    if (until) shiftDateFilter.lte = until;

    // Excel export нь бүтэн жилийн бүртгэл татахад ашиглагддаг тул дэлгэцийн
    // тойм (2000)-оос өндөр таг хэрэгтэй. 19 станц × 365 өдөр × 2 ээлж ≈ 13,900.
    const EXPORT_ROW_LIMIT = 20000;
    const VIEW_ROW_LIMIT = 2000;
    const isExport = format === 'csv' || format === 'excel';
    const rowLimit = isExport ? EXPORT_ROW_LIMIT : VIEW_ROW_LIMIT;

    const where = {
      shiftDate: shiftDateFilter,
      ...(stationCode && stationCode !== 'all' ? { stationCode } : {}),
      // Нэгдсэн "Ажилтан" шүүлтүүр: сонгосон хүн энэ мөрөнд ОПЕРАТОР эсвэл
      // ХҮЛЭЭН БАТАЛГААЖУУЛСАН ЭЭЛЖИЙН МАСТЕРААР орсон бол таарна.
      ...(employeeUid
        ? { OR: [{ operatorUid: employeeUid }, { currentMasterApprovedByUid: employeeUid }] }
        : {}),
    };

    const shifts = await prisma.shift.findMany({
      where,
      select: {
        id: true,
        shiftDate: true,
        shiftType: true,
        stationCode: true,
        operatorName: true,
        status: true,
        operatorShiftCompleted: true,
        masterApproved: true,
        masterApprovedBy: true,
        currentMasterApprovedByName: true,
      },
      orderBy: { shiftDate: 'desc' },
      take: rowLimit,
    });

    // Таг мөрдсөн эсэхийг мэдэж, хэрэглэгчид ЧИМЭЭГҮЙ дутуу өгөхөөс сэргийлнэ.
    const matchedCount = shifts.length < rowLimit ? shifts.length : await prisma.shift.count({ where });

    // Мөр бүрд "Role" (энэ мөр дээр ямар үүрэгтэй хүмүүс оролцсон) болон батлагдсан
    // мастерын НЭРИЙГ (өмнө нь зөвхөн Тийм/Үгүй харагддаг байсан) нэмж тооцно —
    // "Ажилтан" шүүлтүүрээс үл хамааран мөр бүрийн бодит баримт.
    const enrichedShifts = shifts.map((s) => {
      const masterName = s.currentMasterApprovedByName || s.masterApprovedBy || '';
      const roleParts = ['Оператор'];
      if (s.masterApproved && masterName) roleParts.push('Ээлжийн мастер');
      return { ...s, role: roleParts.join(', '), masterName };
    });

    if (format === 'csv' || format === 'excel') {
      // Бодитоор бөглөсөн маягтууд (production_logs) — ижил шүүлтүүрээр, маягтын
      // төрөл бүрд тусдаа sheet. Тойм sheet нь зөвхөн ээлжийн статус харуулдаг тул
      // "юу бүртгэсэн бэ" гэдгийг эндээс харна.
      const LOG_ROW_LIMIT = 50000;
      const logs = await prisma.productionLog.findMany({
        where: { shift: where },
        select: {
          logType: true,
          createdAt: true,
          data: true,
          // Ээлжийн маягтын зөвхөн сүүлийн хувилбарыг гаргахад (lib/kpi-log-export.ts latestFormVersions).
          shiftId: true,
          sortOrder: true,
          shift: { select: { shiftDate: true, shiftType: true, stationCode: true, operatorName: true } },
        },
        orderBy: [{ shift: { shiftDate: 'desc' } }, { createdAt: 'asc' }],
        take: LOG_ROW_LIMIT + 1,
      });
      const employee = employeeUid
        ? await prisma.user.findUnique({ where: { id: employeeUid }, select: { name: true, email: true } })
        : null;
      const workbook = buildKpiReportWorkbook(enrichedShifts, logs.slice(0, LOG_ROW_LIMIT), {
        since, until, stationCode,
        employeeName: employeeUid ? employee?.name || employee?.email || 'Сонгосон ажилтан' : undefined,
        matchedCount, logsTruncated: logs.length > LOG_ROW_LIMIT,
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const stationSuffix = stationCode && stationCode !== 'all' ? `-${stationCode}` : '';
      const filename = `kpi-shifts${stationSuffix}-${since}.xlsx`;

      return new NextResponse(buffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          // Кирилл (жишээ нь ҮЯ-110 дамжлагын код) агуулсан нэрийг HTTP header-т шууд
          // тавьж болохгүй (ByteString шаардлагыг зөрчинө) — RFC 5987 кодчилол ашиглана.
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
          'X-Total-Matched': String(matchedCount),
          'X-Rows-Returned': String(shifts.length),
        },
      });
    }

    const total = enrichedShifts.length;
    const approved = enrichedShifts.filter((s) => s.status === 'Баталгаажсан').length;
    const opDone = enrichedShifts.filter((s) => s.operatorShiftCompleted).length;

    return NextResponse.json({
      ok: true,
      since,
      summary: {
        totalShifts: total,
        approvedCount: approved,
        completionRatePct: total ? Math.round((approved / total) * 100) : 0,
        operatorCompletedCount: opDone,
      },
      shifts: enrichedShifts,
    });
  } catch (e: any) {
    console.error('GET /api/reports/kpi', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
