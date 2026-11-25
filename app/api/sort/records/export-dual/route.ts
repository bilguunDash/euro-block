import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import ExcelJS from 'exceljs';
import { PassThrough } from 'node:stream';
import { setImmediate as yieldToEventLoop } from 'node:timers/promises';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api/responses';
import { canViewSortRecords, type SessionActor } from '@/lib/sort-api-permissions';
import { buildSortRecordsRawFilter, buildSortRecordsWhere } from '@/lib/sort-records-query';
import { sortStatusLabel } from '@/lib/sort-status-labels';
import { DUAL_100, DUAL_200 } from '@/lib/sort-work-calc';

/**
 * «200/100 задаргаа» Excel — үндсэн экспортоос ТУСДАА файл.
 *
 * ЯАГААД ТУСДАА ВЭ: `/api/sort/records/export` нь үйлдвэрийн уламжлалт хэвлэмэл
 * маягтын багана бүтцийг яг давтдаг бөгөөд хос горимд (600x250x200 + 600x250x100)
 * м³-г НИЙЛБЭРЭЭР нь гаргадаг. Тэр маягтыг өөрчилвөл хуучин Excel загвар, томьёо
 * эвдрэх тул задаргааг энэ тусдаа файлаар өгнө.
 *
 * Хос горимгүй бүртгэлийн тоо/м³ нь «Бусад хэмжээ» багананд орно — ингэснээр
 * доод талын НИЙТ мөр үндсэн экспортын нийт дүнтэй тулгагдана.
 */

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

const GRADES = [
  { key: 'sort1', label: '1-р сорт', hasCode: false },
  { key: 'sort2', label: '2-р сорт', hasCode: true },
  { key: 'sort3', label: '3-р сорт', hasCode: true },
  { key: 'deficit', label: 'Дутсан', hasCode: false },
] as const;

/**
 * Таних баганууд. Гурван баганыг ЗОРИУД хассан — эхний хоёрыг бодит 7504 бүртгэл
 * дээр шалгахад:
 *   • «Ээлж №» нь «Ц.дугаар»-тай 7504/7504 бүртгэлд ЯГ ИЖИЛ. Хуучин систем
 *     `shift_no`-г үргэлж Ц.дугаартай тэнцүү илгээдэг байсныг API давтдаг.
 *   • «Суурь хэмжээ» нь хос горимын 2046/2046 бүртгэлд 600x250x200, энгийн
 *     бүртгэлд «Хэмжээ» баганатай ижил — «Хос горим» + «Хэмжээ» хоёр нь
 *     үүнийг бүрэн орлоно.
 *   • «Сортлогч»-ийг давхцлын бус, ЗАХИАЛАГЧИЙН ХҮСЭЛТЭЭР хассан — өгөгдөл нь
 *     DB-д хэвээр, аппликейшн дээр «Сортолсон» талбараар харагдана.
 * Ингэснээр зүүн талын тогтмол хэсэг 163 → 82 тэмдэгт болж, сортын өгөгдөл
 * гүйлгэлгүйгээр дэлгэцэнд багтана.
 */
const IDENTITY_HEADERS = [
  'д/д', 'Огноо', 'Автоклав №', 'Рам №', 'Ц.дугаар', 'Хос горим', 'Төлөв',
];

/** Баганын өргөн — жинхэнэ агуулгын уртад тааруулав (DB-ээс хэмжсэн). */
const IDENTITY_WIDTHS = [5, 18, 13, 10, 11, 10, 16];
const SIZE_WIDTH = 14;
const QTY_WIDTH = 10;
const M3_WIDTH = 11;
/** Шалтгааны бичвэр 31-59 тэмдэгт байдаг тул эвхэж харуулна. */
const CODE_WIDTH = 34;

const SIZE_HEADER = 'Хэмжээ';
const ROW_TOTAL_HEADER = 'НИЙТ м³';
const OTHER_SIZE_LABEL = 'Бусад хэмжээ';
const MAX_EXPORT_RECORDS = 50_000;
const EXPORT_BATCH_SIZE = 100;

/**
 * Сорт бүр ижилхэн 2 багана — хэмжээ нь МӨР болсон тул тоо/м³-ээс өөр хэрэггүй.
 *
 * «Шалтгаан код» нь сортын блокт БИШ, хүснэгтийн ТӨГСГӨЛД очно: бодит өгөгдөлд
 * тэдгээр нь 31-59 тэмдэгтийн бүтэн тайлбар бөгөөд дунд нь байрлуулбал тоон
 * баганууд баруун тийш түлхэгдэж, дэлгэцэнд багтахаа болино.
 */
const GRADE_COLS = ['тоо, ширхэг', 'хэмжээ, м3'];

function localTimeString(date: Date | null): string {
  if (!date) return '';
  // Хуучин систем UTC+8 (Улаанбаатар, зуны цаггүй) дээр харагдах мөр хадгалдаг байсан.
  const local = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round3 = (n: number) => Math.round(n * 1000) / 1000;

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
          `SELECT * FROM "sort_work_records" WHERE ${whereSql} ORDER BY "createdAt" DESC, "id" DESC LIMIT ${MAX_EXPORT_RECORDS + 1}`,
          ...params
        );
      })()
    : await prisma.sortWorkRecord.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MAX_EXPORT_RECORDS + 1,
      });

  if (records.length > MAX_EXPORT_RECORDS) {
    return jsonError(413, 'Тайланд 50,000-аас их бүртгэл байна. Огнооны шүүлтүүрээр хүрээгээ багасгана уу.');
  }

  // ── Баганын бүтэц ──
  // Хэмжээ нь БАГАНА биш МӨР. Нэг бүртгэлийн 200мм/100мм задаргаа нь дараалсан
  // хоёр мөр болж, сорт бүр ердөө «тоо, ширхэг» + «хэмжээ, м3» хоёр баганатай
  // болно. Өмнө нь сорт бүрд 200/100/бусад гэсэн 6 багана үүсч нийт 34 багана
  // болсноос мэдээ нэгтгэх, шүүх, pivot хийхэд хүндрэлтэй байв.
  const SIZE_COL = IDENTITY_HEADERS.length + 1;
  const groupRow: (string | number)[] = [...IDENTITY_HEADERS, SIZE_HEADER];
  const headerRow: (string | number)[] = [...IDENTITY_HEADERS, SIZE_HEADER];

  /** Сорт бүрийн баганын 1-based эхлэл. */
  const gradeSpans = GRADES.map((grade) => {
    const start = groupRow.length + 1;
    groupRow.push(grade.label, ...GRADE_COLS.slice(1).map(() => ''));
    headerRow.push(...GRADE_COLS);
    return { ...grade, start };
  });

  const TOTAL_COL = groupRow.length + 1;
  groupRow.push(ROW_TOTAL_HEADER);
  headerRow.push(ROW_TOTAL_HEADER);

  // Шалтгааны бичвэрүүд — хамгийн баруун талд, тоон хүснэгтийг эвдэхгүйгээр.
  const codeCols = GRADES.filter((g) => g.hasCode).map((grade) => {
    const col = groupRow.length + 1;
    groupRow.push(`Шалтгаан (${grade.label})`);
    headerRow.push(`Шалтгаан (${grade.label})`);
    return { key: grade.key, col };
  });
  const LAST_COL = headerRow.length;

  // Мөрийг шууд XML-д бичиж чөлөөлнө; ZIP нь async-аар үүснэ.
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  output.on('data', (chunk: Buffer) => chunks.push(chunk));
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: output,
    useStyles: true,
    useSharedStrings: false,
    zip: { zlib: { level: 3 } },
  });
  const sheet = workbook.addWorksheet('200-100 задаргаа', {
    views: [{ state: 'frozen', xSplit: SIZE_COL, ySplit: 2 }],
  });

  // Өргөнийг эхний мөр commit хийхээс өмнө тохируулна.
  const widthOf = (c: number) => {
    if (c <= IDENTITY_WIDTHS.length) return IDENTITY_WIDTHS[c - 1];
    if (c === SIZE_COL) return SIZE_WIDTH;
    if (c === TOTAL_COL) return M3_WIDTH;
    if (codeCols.some((x) => x.col === c)) return CODE_WIDTH;
    const grade = gradeSpans.find((g) => c >= g.start && c < g.start + GRADE_COLS.length);
    return grade && GRADE_COLS[c - grade.start] === 'тоо, ширхэг' ? QTY_WIDTH : M3_WIDTH;
  };
  for (let c = 1; c <= LAST_COL; c++) sheet.getColumn(c).width = widthOf(c);

  sheet.addRow(groupRow);
  sheet.addRow(headerRow);

  // ExcelJS нь нэгтгэсэн мужийн ЗҮҮН ДЭЭД нүдний утгыг үлдээдэг тул босоо
  // нэгтгэдэг баганын нэрийг 1-р мөрөнд бичсэн (дээрх `groupRow`).
  const mergeSafe = (r1: number, c1: number, r2: number, c2: number) => {
    try { sheet.mergeCells(r1, c1, r2, c2); } catch { /* давхцвал алгасна */ }
  };
  for (let c = 1; c <= SIZE_COL; c++) mergeSafe(1, c, 2, c);
  for (const g of gradeSpans) mergeSafe(1, g.start, 1, g.start + GRADE_COLS.length - 1);
  mergeSafe(1, TOTAL_COL, 2, TOTAL_COL);
  for (const c of codeCols) mergeSafe(1, c.col, 2, c.col);

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
  sheet.getRow(2).commit();

  const border = {
    top: { style: 'thin' as const }, bottom: { style: 'thin' as const },
    left: { style: 'thin' as const }, right: { style: 'thin' as const },
  };
  const isCodeCol = new Set(codeCols.map((c) => c.col));
  const formatRow = (row: ExcelJS.Row) => {
    for (let c = 1; c <= LAST_COL; c++) {
      const cell = row.getCell(c);
      cell.border = border;
      cell.alignment = isCodeCol.has(c)
        ? { horizontal: 'left', vertical: 'middle', wrapText: true }
        : { horizontal: 'center', vertical: 'middle' };
    }
  };

  // ── Мөрүүд: бүртгэл бүр 1 (энгийн) эсвэл 2 (хос горим) мөр ──
  const grand = { m200: 0, m100: 0, other: 0, total: 0 };
  const gradeTotals = GRADES.map(() => ({ qty: 0, m3: 0 }));
  let idx = 0;
  let lastDataRow = 2;

  for (const rec of records) {
    idx += 1;
    const dual = rec.specialDualMode === true;
    const sizes: Array<{ label: string; suffix: '200' | '100' | '' }> = dual
      ? [{ label: DUAL_200, suffix: '200' }, { label: DUAL_100, suffix: '100' }]
      : [{ label: String(rec.sort1SizeMm || '').trim() || OTHER_SIZE_LABEL, suffix: '' }];

    const identity = [
      idx,
      localTimeString(rec.createdAt),
      rec.autoclaveNo ?? '',
      rec.sort1FrameNo ?? '',
      rec.headerCNumber ?? '',
      dual ? 'Тийм' : 'Үгүй',
      sortStatusLabel(rec.status),
    ];
    sizes.forEach((size) => {
      // Таних утгыг хоёр мөрт давтана: мөр бүрээр merge хийх нь O(n²) байсан.
      const values: any[] = [...identity, size.label];

      let rowM3 = 0;
      gradeSpans.forEach((grade, gradeIndex) => {
        const qty = num(rec[`${grade.key}Qty${size.suffix}`]);
        const m3 = num(rec[`${grade.key}M3${size.suffix}`]);
        values.push(qty, m3);
        rowM3 += m3;
        gradeTotals[gradeIndex].qty += qty;
        gradeTotals[gradeIndex].m3 += m3;
      });

      values.push(round3(rowM3));
      for (const c of codeCols) values.push(rec[`${c.key}Code`] ?? '');
      const row = sheet.addRow(values);
      lastDataRow = row.number;
      formatRow(row);
      row.commit();

      if (size.suffix === '200') grand.m200 += rowM3;
      else if (size.suffix === '100') grand.m100 += rowM3;
      else grand.other += rowM3;
      grand.total += rowM3;
    });

    // Тайлан үүсгэх зуур health болон бусад API хүсэлтийг ажиллуулна.
    if (idx % EXPORT_BATCH_SIZE === 0) await yieldToEventLoop();
  }

  // Шүүлтүүрийн муж нь ЗӨВХӨН өгөгдлийн мөрүүдээр дуусах ёстой — НИЙТ ба
  // «үүнээс …» нийлбэр мөрүүд мужид орвол шүүх үед нийт дүн нуугдана.

  // Гэхдээ stored autoFilter.ref зөв байсан ч Excel дээр бодит filter
  // асаахад өгөгдлийн сүүлийн мөртэй ЗАЛГАА байгаа НИЙТ мөрийг Excel өөрөө
  // өргөтгөсөн мужид оруулдаг тул нийт дүн нуугддаг байв. Хоосон spacer мөр
  // нэмж энэ бүтцийн тасалдлыг үүсгэнэ.
  sheet.addRow([]).commit();

  // ── НИЙТ мөр ──
  const totalRow: any[] = ['НИЙТ', ...IDENTITY_HEADERS.slice(1).map(() => ''), ''];
  gradeSpans.forEach((_, i) => totalRow.push(gradeTotals[i].qty, round3(gradeTotals[i].m3)));
  totalRow.push(round3(grand.total));
  const added = sheet.addRow(totalRow);
  added.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  });
  formatRow(added);
  added.commit();

  // ── Хэмжээгээр задалсан нийлбэр ──
  // Өмнө нь энэ нь «Нийт м³ (200/100/бусад)» гэсэн баганууд байсан. Хэмжээ мөр
  // болсон тул доод талд гурван мөрөөр үлдээв — нийлбэр тулгах боломж хэвээр.
  const summary: Array<[string, number]> = [
    [`үүнээс ${DUAL_200}`, grand.m200],
    [`үүнээс ${DUAL_100}`, grand.m100],
    [`үүнээс ${OTHER_SIZE_LABEL}`, grand.other],
  ];
  for (const [label, value] of summary) {
    const row = sheet.addRow([]);
    row.getCell(1).value = label;
    row.getCell(TOTAL_COL).value = round3(value);
    mergeSafe(row.number, 1, row.number, SIZE_COL);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    });
    formatRow(row);
    row.commit();
  }

  // Шүүлтүүр 2-р мөрд (жинхэнэ баганын нэрс) — 1-р мөрийн бүлгийн гарчиг
  // хэвтээ мержтэй тул тэндээс эхлүүлэхгүй.
  sheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: Math.max(2, lastDataRow), column: LAST_COL },
  };

  await workbook.commit();
  const buffer = Buffer.concat(chunks);
  const filename = `sorting-200-100-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
