import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import ExcelJS from 'exceljs';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api/responses';
import { canViewSortRecords, type SessionActor } from '@/lib/sort-api-permissions';
import { buildSortRecordsRawFilter, buildSortRecordsWhere } from '@/lib/sort-records-query';
import { sortStatusLabel } from '@/lib/sort-status-labels';
import { DUAL_100 } from '@/lib/sort-work-calc';

function sessionActor(session: any): SessionActor | null {
  if (!session?.user?.id) return null;
  return {
    id: String(session.user.id),
    role: String((session.user as any).role || 'operator'),
    stationCode: (session.user as any).stationCode ?? null,
    name: session.user.name ?? null,
    sortDualRole: Boolean((session.user as any).sortDualRole),
  };
}

// Багана бүтэц "2026.6.19shono eelj1.xlsx" маягтын дагуу (үйлдвэрийн уламжлалт хэвлэмэл
// маягттай ижил): I-р сортод шалтгаан код байхгүй, харин dual-mode 2 тоо (600x250x200 /
// 600x250x100) тусад нь харагдана. Рам №/Суурь хэмжээ/Сорт цаг/Төлөв нь энэ маягтад
// байдаггүй тул мэдээлэл алдахгүйн тулд төгсгөлд нэмэлт баганаар хавсаргасан.
// Захиалагчийн хүсэлтээр «Зүсэлтийн хэмжээ» (3 багана), «Ээлж №», «Сортлогч»-ийг
// хассан тул багана бүтэц нь хэвлэмэл маягтын 1:1 хуулбар БИШ болсон.
// Урт нь `HEADERS`-тэй ЯГ тэнцүү байх ёстой (28) — эс бөгөөс мерж хийгдээгүй
// баруун талын баганууд дээр 1-р мөрийн нүд огт үүсэхгүй, ирээдүйд бүлгийн
// гарчиг нэмэхэд байрлал нэгээр гулсана.
const GROUP_HEADER_ROW = [
  'д/д',
  '1-р сортын бүтээгдэхүүн', '', '',
  '2-р сортын бүтээгдэхүүн', '', '',
  '3-р сортын бүтээгдэхүүн', '', '',
  'Дутсан', '',
  '', '', '',
  '', '', '', '', '', '',
  '', '', '', '',
  '', '', '',
];

// Хуучин систем ("2026.6.19shono eelj1.xlsx" маягт) дээр "Тайлбар" гэсэн ганц багана л
// байдаг (sort3Desc). Харин одоогийн модель sort1Desc/sort2Desc/deficitDesc-г тусад нь
// хадгалдаг тул мэдээлэл алдахгүйн тулд Рам №/Суурь хэмжээ/Сорт цаг/Төлөвийн адилаар
// төгсгөлд нэмэлт баганаар хавсаргав.
const HEADERS = [
  'д/д',
  'Тоо', `Тоо (${DUAL_100})`, 'м³',
  'Шалтгаан код', 'Тоо', 'м³',
  'Шалтгаан код', 'Тоо', 'м³',
  'Тоо', 'м³',
  'Огноо', 'Автоклав №', 'Цутгалтын дугаар',
  'Цутгасан цаг', 'Цутгасан ээлж', 'Зүссэн цаг', 'Зүссэн Ээлж', 'Шалтгаан', 'Тайлбар (3-р сорт)',
  'Рам №', 'Суурь хэмжээ', 'Сорт цаг', 'Төлөв',
  'Тайлбар (Рам)', 'Тайлбар (2-р сорт)', 'Тайлбар (Дутсан)',
];

const GROUP_MERGES = ['A1:A2', 'B1:D1', 'E1:G1', 'H1:J1', 'K1:L1'];

const COLUMN_WIDTHS = [
  6,
  12, 12, 10,
  14, 10, 10,
  14, 10, 10,
  10, 10,
  19, 12, 16,
  14, 14, 14, 14, 14, 28,
  12, 16, 19, 14,
  28, 28, 28,
];

const WRAP_COLUMNS = new Set([21, 26, 27, 28]);

function localTimeString(date: Date | null): string {
  if (!date) return '';
  // Old system stored a local display string at UTC+8 (Ulaanbaatar, no DST).
  const local = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const actor = sessionActor(session as any);
  if (!actor) return jsonError(401, 'Unauthorized');
  if (!canViewSortRecords(actor)) return jsonError(403, 'Forbidden');

  const { searchParams } = new URL(req.url);
  let where: any;
  let shiftTimeOfDay: 'day' | 'night' | null;
  try {
    ({ where, shiftTimeOfDay } = buildSortRecordsWhere(searchParams));
  } catch (error: any) {
    return jsonError(400, error?.message || 'Invalid query parameters');
  }

  const records = shiftTimeOfDay
    ? await (async () => {
        const { whereSql, params } = buildSortRecordsRawFilter(searchParams, shiftTimeOfDay);
        return prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM "sort_work_records" WHERE ${whereSql} ORDER BY "createdAt" DESC, "id" DESC`,
          ...params
        );
      })()
    : await prisma.sortWorkRecord.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Бүртгэл');

  sheet.addRow(GROUP_HEADER_ROW);
  sheet.addRow(HEADERS);
  GROUP_MERGES.forEach((range) => sheet.mergeCells(range));
  for (const r of [1, 2]) {
    sheet.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
    });
  }

  let idx = 0;
  for (const rec of records) {
    idx += 1;
    sheet.addRow([
      idx,
      rec.sort1Qty, rec.sort1Qty100, rec.sort1M3,
      rec.sort2Code, rec.sort2Qty, rec.sort2M3,
      rec.sort3Code, rec.sort3Qty, rec.sort3M3,
      rec.deficitQty, rec.deficitM3,
      localTimeString(rec.createdAt), rec.autoclaveNo, rec.headerCNumber,
      // Raw SQL салбар нь `Date`, Prisma салбар нь `Date | null` буцаадаг — хоёуланг
      // нь аваад, бөглөөгүй хуучин бүртгэлд хоосон мөр үлдээнэ.
      localTimeString(rec.pouredAt ? new Date(rec.pouredAt) : null), rec.headerPoured,
      localTimeString(rec.cutAt ? new Date(rec.cutAt) : null), rec.headerCut,
      rec.ramDefectCode, rec.sort3Desc,
      rec.sort1FrameNo, rec.sort1SizeMm, localTimeString(rec.completedAt), sortStatusLabel(rec.status),
      rec.sort1Desc, rec.sort2Desc, rec.deficitDesc,
    ]);
  }

  const border = {
    top: { style: 'thin' as const }, bottom: { style: 'thin' as const },
    left: { style: 'thin' as const }, right: { style: 'thin' as const },
  };
  for (let r = 3; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = border;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: WRAP_COLUMNS.has(colNumber) };
    });
  }

  COLUMN_WIDTHS.forEach((width, colIdx) => {
    sheet.getColumn(colIdx + 1).width = width;
  });

  // Шүүлтүүрийг 2-р мөрд (жинхэнэ баганын нэрс) тавина — 1-р мөрийн бүлгийн
  // гарчиг хэвтээ мержтэй тул тэндээс эхлүүлбэл шүүлтүүр эвдэрнэ. Мөр 1-2-ыг
  // хөлдөөж, доош гүйлгэхэд гарчиг үргэлж харагдана.
  sheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: Math.max(2, sheet.rowCount), column: HEADERS.length },
  };
  sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 2 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `sorting-records-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
