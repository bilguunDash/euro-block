import ExcelJS from 'exceljs';
import { addLogSheets, latestFormVersions, type ExportableLog } from './kpi-log-export';
import {
  createReportSheet, finishReportSheet, reportBand, reportDate, sheetLink, styleReportHeader,
  REPORT_COLORS, REPORT_FIRST_DATA_ROW, REPORT_OVERVIEW,
} from './report-excel';

export type ReportShift = {
  id: string; shiftDate: string; shiftType: string; stationCode: string; operatorName: string;
  role: string; status: string; operatorShiftCompleted: boolean; masterApproved: boolean; masterName: string;
};

export type KpiReportOptions = {
  since: string; until?: string; stationCode?: string; employeeName?: string;
  matchedCount: number; logsTruncated?: boolean; generatedAt?: Date;
};

/** Pure workbook builder: the API owns authentication, filtering and database access. */
export function buildKpiReportWorkbook(shifts: ReportShift[], logs: ExportableLog[], options: KpiReportOptions) {
  // Ээлжийн нэг маягтыг хэд хадгалсан ч ээлжийн хуудастай адил сүүлийн хувилбар нь л орно.
  const formLogs = latestFormVersions(logs);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Евроблок';
  workbook.title = 'Ээлжийн бүртгэлийн тайлан';
  workbook.created = options.generatedAt ?? new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  const overview = workbook.addWorksheet(REPORT_OVERVIEW, { properties: { tabColor: { argb: REPORT_COLORS.navy } } });
  overview.columns = [{ width: 36 }, { width: 17 }, { width: 30 }, { width: 14 }];
  overview.views = [{ state: 'normal', showGridLines: false, zoomScale: 90 }];
  const period = `${options.since} — ${options.until || 'өнөөдрийг хүртэл'}`;
  const station = options.stationCode && options.stationCode !== 'all' ? options.stationCode : 'Бүх дамжлага';
  const subtitle = `Хугацаа: ${period}  |  ${station}  |  Ажилтан: ${options.employeeName || 'Бүгд'}`;
  reportBand(overview, 1, 4, 'ЕВРОБЛОК • ЭЭЛЖИЙН ТАЙЛАН');
  overview.getCell('A1').font = { name: 'Calibri', size: 20, bold: true, color: { argb: REPORT_COLORS.white } };
  overview.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: REPORT_COLORS.navy } };
  overview.getRow(1).height = 42;
  reportBand(overview, 2, 4, subtitle);
  overview.getCell('A3').value = 'Татсан цаг (Улаанбаатар)';
  overview.mergeCells('B3:D3');
  overview.getCell('B3').value = reportDate(workbook.created, true);
  overview.getCell('B3').numFmt = 'yyyy-mm-dd hh:mm';
  overview.getRow(3).height = 26;
  reportBand(overview, 4, 4, 'Үзүүлэлтүүд нь энэ файлд орсон ээлжүүдээс тооцогдоно. Хуудасны нэр дээр дарж дэлгэрэнгүйг нээнэ.');
  const warnings: string[] = [];
  if (options.matchedCount > shifts.length) warnings.push(`Нийт ${options.matchedCount} ээлжээс эхний ${shifts.length}-г татсан.`);
  if (options.logsTruncated) warnings.push(`Маягтын бүртгэл эхний ${logs.length}-ээр хязгаарлагдсан.`);
  reportBand(overview, 5, 4, warnings.length
    ? `АНХААР: ${warnings.join(' ')} Огнооны мужаа богиносгож дахин татна уу.`
    : 'Бүх цаг Улаанбаатарын цагаар. Хуудас бүрийн толгой дахь шүүлтүүрээр мөрүүдийг шүүж болно.', warnings.length > 0);

  const sheet = createReportSheet(workbook, 'Ээлжүүд', [
    { header: 'Огноо', key: 'shiftDate', width: 14, numFmt: 'yyyy-mm-dd' },
    { header: 'Ээлж', key: 'shiftType', width: 12 },
    { header: 'Дамжлага', key: 'stationCode', width: 14 },
    { header: 'Оператор', key: 'operatorName', width: 28 },
    { header: 'Оролцсон үүрэг', key: 'role', width: 26 },
    { header: 'Төлөв', key: 'status', width: 20 },
    { header: 'Оператор дуусгасан', key: 'operatorShiftCompleted', width: 19 },
    { header: 'Мастер баталгаажсан', key: 'masterApproved', width: 19 },
    { header: 'Мастерын нэр', key: 'masterName', width: 28 },
    { header: 'Ээлжийн ID', key: 'id', width: 38, hidden: true },
  ], { title: 'ЭЭЛЖИЙН БҮРТГЭЛ', subtitle, note: `${shifts.length} ээлж • Баталгаажсан болон дууссан төлөвийг ногооноор тэмдэглэв.` });
  for (const shift of shifts) sheet.addRow({
    ...shift, shiftDate: reportDate(shift.shiftDate),
    operatorShiftCompleted: shift.operatorShiftCompleted ? 'Тийм' : 'Үгүй',
    masterApproved: shift.masterApproved ? 'Тийм' : 'Үгүй',
  });
  finishReportSheet(sheet, 10, 9);
  if (shifts.length > 0) {
    for (const [range, text] of [[`F6:F${sheet.rowCount}`, 'Баталгаажсан'], [`G6:H${sheet.rowCount}`, 'Тийм']]) {
      sheet.addConditionalFormatting({ ref: range, rules: [{ type: 'cellIs', operator: 'equal', formulae: [`"${text}"`], priority: 1,
        style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFE2F0E8' } }, font: { color: { argb: 'FF20603D' } } },
      }] });
    }
  }

  const formSheets = addLogSheets(workbook, formLogs, { subtitle });
  overview.getRow(7).values = ['Үзүүлэлт', null, null, 'Утга'];
  overview.mergeCells('A7:C7');
  styleReportHeader(overview, 7);
  overview.getRow(7).height = 28;
  const last = Math.max(REPORT_FIRST_DATA_ROW, sheet.rowCount);
  const metrics: Array<[string, ExcelJS.CellValue, string?]> = [
    ['Шүүлтүүрт тохирсон нийт ээлж', options.matchedCount],
    ['Файлд орсон ээлж', { formula: `COUNTA('Ээлжүүд'!J6:J${last})`, result: shifts.length }],
    ['Баталгаажсан ээлж', { formula: `COUNTIF('Ээлжүүд'!F6:F${last},"Баталгаажсан")`, result: shifts.filter((s) => s.status === 'Баталгаажсан').length }],
    ['Бүртгэлийн гүйцэтгэл', { formula: 'IFERROR(D10/D9,0)', result: shifts.length ? shifts.filter((s) => s.status === 'Баталгаажсан').length / shifts.length : 0 }, '0.0%'],
    ['Оператор дуусгасан', { formula: `COUNTIF('Ээлжүүд'!G6:G${last},"Тийм")`, result: shifts.filter((s) => s.operatorShiftCompleted).length }],
    ['Мастер баталгаажсан', { formula: `COUNTIF('Ээлжүүд'!H6:H${last},"Тийм")`, result: shifts.filter((s) => s.masterApproved).length }],
    ['Файлд орсон маягтын бүртгэл', formLogs.length],
  ];
  metrics.forEach(([label, value, numFmt], i) => {
    const row = i + 8;
    overview.mergeCells(row, 1, row, 3);
    overview.getCell(row, 1).value = label;
    overview.getCell(row, 4).value = value;
    overview.getCell(row, 4).numFmt = numFmt || '#,##0';
    overview.getRow(row).height = 28;
  });
  reportBand(overview, 16, 4, 'ХУУДАСНЫ ЖАГСААЛТ • Нэг маягтын бүртгэл хэд хэдэн дэлгэрэнгүй мөртэй байж болно.');
  overview.getRow(17).values = ['Хуудас', 'Ээлж / маягт', 'Агуулга', 'Мөр'];
  styleReportHeader(overview, 17);
  overview.getRow(17).height = 32;
  const entries = [
    { sheetName: sheet.name, logCount: shifts.length, rowCount: shifts.length, description: 'Ээлжийн төлөв, оператор, мастер' },
    ...formSheets.map((s) => ({ ...s, description: 'Бөглөсөн маягтын дэлгэрэнгүй' })),
  ];
  entries.forEach((entry) => {
    const row = overview.addRow([
      { text: entry.sheetName, hyperlink: sheetLink(entry.sheetName) }, entry.logCount, entry.description, entry.rowCount,
    ]);
    row.height = 32;
  });
  if (!formLogs.length) reportBand(overview, overview.rowCount + 2, 4, 'Сонгосон шүүлтүүрээр бөглөсөн маягтын бүртгэл олдсонгүй.');
  overview.eachRow((row, rowNumber) => {
    if ([1, 7, 17].includes(rowNumber)) return;
    row.eachCell((cell) => {
      if (!cell.font) cell.font = { name: 'Calibri', size: 11, color: { argb: REPORT_COLORS.text } };
      cell.alignment = { vertical: 'middle', wrapText: true, horizontal: typeof cell.value === 'number' || cell.formula ? 'right' : 'left' };
      if (rowNumber >= 8 && rowNumber <= 14 || rowNumber >= 18) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNumber % 2 ? REPORT_COLORS.white : REPORT_COLORS.pale } };
      }
      if (cell.hyperlink) cell.font = { name: 'Calibri', size: 11, underline: true, color: { argb: REPORT_COLORS.blue } };
    });
  });
  overview.pageSetup = {
    paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    printArea: `A1:D${overview.rowCount}`,
    margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 },
  };
  overview.headerFooter.oddFooter = '&LЕвроблок — Ээлжийн тайлан&RХуудас &P / &N';
  return workbook;
}
