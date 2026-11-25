import type ExcelJS from 'exceljs';

export const REPORT_OVERVIEW = 'Тайлангийн тойм';
export const REPORT_HEADER_ROW = 5;
export const REPORT_FIRST_DATA_ROW = REPORT_HEADER_ROW + 1;
export const REPORT_COLORS = {
  navy: 'FF17365D',
  blue: 'FF245A81',
  pale: 'FFEAF1F7',
  stripe: 'FFF3F6FA',
  text: 'FF243746',
  muted: 'FF526579',
  white: 'FFFFFFFF',
};

export type ReportColumn = { header: string; key: string; width: number; numFmt?: string; hidden?: boolean };

const ulaanbaatarClock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function sheetLink(name: string): string {
  return `#'${name.replace(/'/g, "''")}'!A1`;
}

/** Excel dates have no timezone. Store the Ulaanbaatar wall clock explicitly. */
export function reportDate(value: Date | string, localTime = false): Date | string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  if (!localTime) return date;
  const parts = ulaanbaatarClock.formatToParts(date);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second')));
}

export function reportBand(sheet: ExcelJS.Worksheet, row: number, lastColumn: number, text: string, warning = false) {
  sheet.mergeCells(row, 1, row, lastColumn);
  const cell = sheet.getCell(row, 1);
  cell.value = text;
  cell.font = { name: 'Calibri', size: 11, color: { argb: warning ? 'FF9C2500' : REPORT_COLORS.muted }, bold: warning };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: warning ? 'FFFFE6CC' : REPORT_COLORS.white } };
  cell.alignment = { vertical: 'middle', wrapText: true };
  sheet.getRow(row).height = warning ? 42 : 30;
}

export function styleReportHeader(sheet: ExcelJS.Worksheet, rowNumber: number) {
  const row = sheet.getRow(rowNumber);
  row.height = 54;
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: REPORT_COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: REPORT_COLORS.blue } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 };
  });
}

export function createReportSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: ReportColumn[],
  options: { title: string; subtitle: string; note: string; frozenColumns?: number },
) {
  const sheet = workbook.addWorksheet(name, { properties: { defaultRowHeight: 24, tabColor: { argb: REPORT_COLORS.blue } } });
  sheet.columns = columns.map(({ header: _header, numFmt, ...column }) => ({ ...column, style: numFmt ? { numFmt } : {} }));
  const visibleCount = columns.filter((c) => !c.hidden).length;
  reportBand(sheet, 1, visibleCount, options.title);
  sheet.getCell('A1').font = { name: 'Calibri', size: 18, bold: true, color: { argb: REPORT_COLORS.white } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: REPORT_COLORS.navy } };
  sheet.getRow(1).height = 36;
  reportBand(sheet, 2, visibleCount, options.subtitle);
  reportBand(sheet, 3, visibleCount, '← Тайлангийн тойм / Хуудасны жагсаалт');
  sheet.getCell('A3').value = { text: '← Тайлангийн тойм / Хуудасны жагсаалт', hyperlink: sheetLink(REPORT_OVERVIEW) };
  sheet.getCell('A3').font = { name: 'Calibri', size: 11, color: { argb: REPORT_COLORS.blue }, underline: true };
  reportBand(sheet, 4, visibleCount, options.note);
  sheet.getRow(REPORT_HEADER_ROW).values = columns.map((c) => c.header);
  styleReportHeader(sheet, REPORT_HEADER_ROW);
  sheet.views = [{ state: 'frozen', xSplit: options.frozenColumns ?? 4, ySplit: REPORT_HEADER_ROW, showGridLines: false, zoomScale: 85 }];
  sheet.pageSetup = {
    paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    printTitlesRow: `${REPORT_HEADER_ROW}:${REPORT_HEADER_ROW}`,
    margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.15, footer: 0.15 },
  };
  // Wide form sheets print across pages at a readable size, repeating their context.
  if (columns.filter((c) => !c.hidden).reduce((sum, c) => sum + c.width, 0) > 220) {
    sheet.pageSetup.fitToPage = false;
    sheet.pageSetup.scale = 80;
    sheet.pageSetup.printTitlesColumn = 'A:D';
  }
  sheet.headerFooter.oddFooter = '&LЕвроблок — Ээлжийн тайлан&RХуудас &P / &N';
  return sheet;
}

/**
 * Мөрийн өндрийг ЗОРИУДААР тохируулахгүй.
 *
 * OOXML-д `customHeight` тавиагүй мөрийг Excel нээх/хэвлэх үедээ өөрөө autofit
 * хийдэг. Харин тавибал Excel «хэрэглэгч гараар тохирууллаа» гэж үзэн autofit-ээ
 * болино — өөрөөр хэлбэл тааруулсан өндөр маань ХАТУУ ХЯЗГААР болно.
 *
 * Өмнө нь энд тэмдэгт тоолж өндөр тооцдог байсан нь Excel-ийн пропорциональ
 * фонтны үг-таслалтыг таамаглаж чадалгүй 19 хуудсанд 8 мөрийн текстийг тасалсан
 * (кирилл Calibri-д нэг өргөний нэгж ≈1.15–1.3 тэмдэгт, текстээс хамаарч хэлбэлзэнэ).
 * Excel-ийн autofit-д даалгасны дараа хэмжилт: тасарсан 0, илүүдэл зай 0.
 *
 * (1–4-р мөр болон толгойн мөрөнд өндөр тавьсан хэвээр — нэгтгэсэн (merged)
 * нүдэнд Excel-ийн autofit ажилладаггүй тул тэнд гараар өгөх ёстой.)
 */

// Бүтэн жилийн тайлан ≈ 90,000 мөр × ~20 багана ≈ 1.8 сая нүд. Нүд бүрт ШИНЭ
// style объект үүсгэвэл зөвхөн тэдгээр нь хэдэн зуун МБ идэж, prod дээр экспорт
// Node процессыг бүхэлд нь OOM-д хүргэж мэднэ. Тиймээс цөөн тогтмолыг ДАВТАН
// ашиглана (ExcelJS бичихдээ style-уудыг хэдийнээ дедупликац хийдэг).
const BODY_FONT: Partial<ExcelJS.Font> = { name: 'Calibri', size: 11, color: { argb: REPORT_COLORS.text } };
const FILL_PLAIN: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: REPORT_COLORS.white } };
const FILL_STRIPE: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: REPORT_COLORS.stripe } };
const ALIGN_TEXT: Partial<ExcelJS.Alignment> = { vertical: 'top', wrapText: true, horizontal: 'left' };
const ALIGN_NUMBER: Partial<ExcelJS.Alignment> = { vertical: 'top', wrapText: true, horizontal: 'right' };
export function finishReportSheet(sheet: ExcelJS.Worksheet, columnCount: number, visibleCount = columnCount) {
  const last = sheet.rowCount;
  for (let rowNumber = REPORT_FIRST_DATA_ROW; rowNumber <= last; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const fill = rowNumber % 2 === 0 ? FILL_PLAIN : FILL_STRIPE;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > columnCount) return;
      cell.font = BODY_FONT;
      cell.fill = fill;
      cell.alignment = typeof cell.value === 'number' ? ALIGN_NUMBER : ALIGN_TEXT;
      // `#,##0.###`-ийн цэг нь бүхэл тоон дээр ч ҮРГЭЛЖ хэвлэгддэг тул 1510 → "1,510."
      // болж харагдана. Тиймээс бүхэл ба бутархайд өөр формат өгнө.
      if (typeof cell.value === 'number' && (!cell.numFmt || cell.numFmt === 'General')) {
        cell.numFmt = Number.isInteger(cell.value) ? '#,##0' : '#,##0.###';
      }
    });
  }
  sheet.autoFilter = { from: { row: REPORT_HEADER_ROW, column: 1 }, to: { row: Math.max(REPORT_HEADER_ROW, last), column: columnCount } };
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(visibleCount).letter}${Math.max(last, REPORT_HEADER_ROW)}`;
}
