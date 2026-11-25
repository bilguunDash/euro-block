import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import ExcelJS from 'exceljs';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { createNotificationDeduped } from '@/lib/server-notifications';
import { writeServerAuditLog } from '@/lib/server-audit';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';
import { buildImportPlan, parseRosterWorkbook, type PlannedRow } from '@/lib/schedule-excel-import';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const CREATE_CHUNK = 500;

function rowKey(r: { shiftDate: string; shiftType: string; stationCode: string; uid: string }) {
  return `${r.shiftDate}|${r.shiftType}|${r.stationCode}|${r.uid}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);
    // Хуваарь бичих эрх — operator-schedules API-ийн canWriteSchedules-тэй ижил: зөвхөн admin.
    if (String(session.user.role || '') !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get('file');
    const month = String(form.get('month') || '').trim();
    const mode = String(form.get('mode') || 'preview').trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Excel файл сонгоно уу.' }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Сар буруу байна (YYYY-MM хэлбэртэй байх ёстой).' }, { status: 400 });
    }
    if (mode !== 'preview' && mode !== 'commit') {
      return NextResponse.json({ error: 'mode буруу байна.' }, { status: 400 });
    }
    if (!/\.xlsx$/i.test(file.name || '')) {
      return NextResponse.json({ error: 'Зөвхөн .xlsx өргөтгөлтэй файл дэмжинэ.' }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Файл хэт том байна (дээд тал нь 10MB).' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as any);
    } catch {
      return NextResponse.json({ error: 'Excel файл уншигдсангүй. Гэмтэлгүй .xlsx файл эсэхийг шалгана уу.' }, { status: 400 });
    }

    let parsed;
    try {
      parsed = parseRosterWorkbook(wb, month);
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Файлын бүтэц танигдсангүй.' }, { status: 400 });
    }

    const users = await prisma.user.findMany({ select: { id: true, name: true, role: true } });
    const { rows, report } = buildImportPlan(parsed, users);
    report.month = month;

    // Preview/commit хоёуланд нь DB-тэй тулгаж давхардлыг бодитоор тоолно.
    const operatorRows = rows.filter((r) => r.kind === 'operator');
    const masterRows = rows.filter((r) => r.kind === 'master');
    let opToCreate: PlannedRow[] = [];
    let masterToCreate: PlannedRow[] = [];
    let opDuplicates = 0;
    let masterDuplicates = 0;

    if (rows.length > 0) {
      const dates = rows.map((r) => r.shiftDate).sort();
      const dateRange = { gte: dates[0], lte: dates[dates.length - 1] };

      const [existingOps, existingMasters] = await Promise.all([
        prisma.operatorSchedule.findMany({
          where: { shiftDate: dateRange },
          select: { shiftDate: true, shiftType: true, stationCode: true, operatorUid: true },
        }),
        prisma.masterSchedule.findMany({
          where: { shiftDate: dateRange },
          select: { shiftDate: true, shiftType: true, stationCode: true, masterUid: true },
        }),
      ]);
      const existingOpKeys = new Set(existingOps.map((s) => rowKey({ ...s, uid: s.operatorUid })));
      const existingMasterKeys = new Set(existingMasters.map((s) => rowKey({ ...s, uid: s.masterUid })));

      opToCreate = operatorRows.filter((r) => !existingOpKeys.has(rowKey(r)));
      masterToCreate = masterRows.filter((r) => !existingMasterKeys.has(rowKey(r)));
      opDuplicates = operatorRows.length - opToCreate.length;
      masterDuplicates = masterRows.length - masterToCreate.length;
    }

    const base = {
      ok: true,
      mode,
      month,
      report,
      toCreate: { operator: opToCreate.length, master: masterToCreate.length },
      duplicates: { operator: opDuplicates, master: masterDuplicates },
    };

    if (mode === 'preview') {
      return NextResponse.json(base);
    }

    // ── commit ──
    for (let i = 0; i < opToCreate.length; i += CREATE_CHUNK) {
      await prisma.operatorSchedule.createMany({
        data: opToCreate.slice(i, i + CREATE_CHUNK).map((r) => ({
          shiftDate: r.shiftDate,
          shiftType: r.shiftType,
          stationCode: r.stationCode,
          operatorUid: r.uid,
          operatorName: r.name,
        })),
      });
    }
    // Мастерын мөрийг POST /api/schedules-аар биш шууд бичнэ — тэр handler нь
    // ControlAssignment-той бүх операторт хуваарь үүсгэдэг side effect-тэй бөгөөд
    // Excel-д заагаагүй мөр үүсгэчихнэ.
    for (let i = 0; i < masterToCreate.length; i += CREATE_CHUNK) {
      await prisma.masterSchedule.createMany({
        data: masterToCreate.slice(i, i + CREATE_CHUNK).map((r) => ({
          shiftDate: r.shiftDate,
          shiftType: r.shiftType,
          stationCode: r.stationCode,
          masterUid: r.uid,
          masterName: r.name,
          operatorUid: null,
        })),
      });
    }

    // Хэрэглэгч бүрт нэгтгэсэн нэг мэдэгдэл.
    const createdByUid = new Map<string, PlannedRow[]>();
    for (const r of [...opToCreate, ...masterToCreate]) {
      const list = createdByUid.get(r.uid) || [];
      list.push(r);
      createdByUid.set(r.uid, list);
    }
    for (const [uid, list] of createdByUid) {
      const sorted = list.map((r) => r.shiftDate).sort();
      const dayCount = list.filter((r) => r.shiftType === 'Өдрийн').length;
      const nightCount = list.length - dayCount;
      await createNotificationDeduped(
        {
          userId: uid,
          kind: 'shift_assigned',
          dedupeKey: `shift_import:${month}:${uid}`,
          title: 'Ээлж оноолт',
          body: `${sorted[0]}–${sorted[sorted.length - 1]}: нийт ${list.length} ээлж оноогдлоо (Өдрийн ${dayCount}, Шөнийн ${nightCount}).`,
          link: '/dashboard',
        },
        { windowMinutes: 24 * 60 }
      );
    }

    await writeServerAuditLog({
      actorUid: String(session.user.id),
      actorName: session.user?.name || null,
      action: 'schedule_excel_import',
      entityType: 'schedule_import',
      entityId: month,
      details: JSON.stringify({
        fileName: file.name,
        sheetName: parsed.sheetName,
        createdOperator: opToCreate.length,
        createdMaster: masterToCreate.length,
        duplicateOperator: opDuplicates,
        duplicateMaster: masterDuplicates,
        matchedPeople: report.matched.length,
        skippedPeople:
          report.unmatchedNames.length +
          report.ambiguousNames.length +
          report.wrongRole.length +
          report.unmappedPositions.reduce((n, x) => n + x.people.length, 0),
      }),
    });

    return NextResponse.json({
      ...base,
      created: { operator: opToCreate.length, master: masterToCreate.length },
    });
  } catch (e: any) {
    console.error('POST /api/schedules/import', e);
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
