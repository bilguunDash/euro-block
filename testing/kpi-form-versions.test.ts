// Excel тайлан: ээлж тутамд нэг маягттай төрлөөс ээлж бүрийн ХАМГИЙН СҮҮЛИЙН хувилбар л гарна.
// Шалтгаан: маягтыг хадгалах бүрт production_logs-д шинэ мөр нэмэгддэг ч ээлжийн хуудас сүүлийнхийг л
// харуулдаг. Excel бүх хувилбарыг гаргадаг байсан тул нэг ээлж хадгалсан тоогоороо давтагдаж байв
// (ҮЯ-180, 2026-11-05 Өдрийн: «Бүртгэл №» 45–49, ижил тэмдэглэлтэй 5 бүртгэл).
//
//   node --import tsx --test --test-isolation=none testing/kpi-form-versions.test.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { buildKpiReportWorkbook } from '../lib/kpi-report-export';
import { SINGLE_FORM_LOG_TYPES, latestFormVersions, type ExportableLog } from '../lib/kpi-log-export';
import { createEmptyY180Payload, emptyY180OperationRow } from '../lib/y180-autoclave-operator-form';

const root = path.resolve(import.meta.dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const SHIFT_A = { shiftDate: '2026-11-05', shiftType: 'Өдрийн', stationCode: 'ҮЯ-180', operatorName: 'Лхагва БАТМЯГМАР' };
const SHIFT_B = { shiftDate: '2026-11-06', shiftType: 'Шөнийн', stationCode: 'ҮЯ-180', operatorName: 'Баянхангай ТӨМӨРБАТ' };
const NOTE = 'Ээлж авахад зуух 14,45 баар\nШугам 11.41 баар';

/** ҮЯ-180-ын маягт: хадгалах бүрт нэг ажилбарын мөр нэмэгддэг (жинхэнэ ажиллах хэв маяг). */
function y180Version(shiftId: string, sortOrder: number, rows: number, createdAt: string): ExportableLog {
  const operationRows = Array.from({ length: rows }, (_, i) => ({
    ...emptyY180OperationRow('Лхагва БАТМЯГМАР', `${shiftId}-r${i}`),
    blockSize: '250', autoclaveNum: String(i + 1), loadDirection: 'оруулсан' as const, startedTime: `1${i}:00`,
  }));
  return {
    logType: 'modal_y180_autoclave_operator_form',
    shiftId, sortOrder, createdAt,
    data: {
      ...createEmptyY180Payload({ shiftDate: '2026-11-05', shiftType: 'Өдрийн', operatorUid: 'op', operatorName: 'Лхагва БАТМЯГМАР' }),
      shiftNotes: NOTE, operationRows, submittedAt: createdAt,
    },
    shift: shiftId === 'shift-a' ? SHIFT_A : SHIFT_B,
  };
}

const mixLog = (shiftId: string, sortOrder: number, spread: number): ExportableLog => ({
  logType: 'modal_mix_logs', shiftId, sortOrder, createdAt: `2026-11-05T0${sortOrder + 1}:00:00Z`,
  data: { spread, pourTemp: 40 + sortOrder }, shift: { ...SHIFT_A, stationCode: 'ҮЯ-130' },
});

// ─────────────────────────────────────────────── latestFormVersions ───────────────────────────────────────────────

test('one form per shift: only the latest save is kept, per shift and per form type', () => {
  const versions = [0, 1, 2, 3, 4].map((n) => y180Version('shift-a', n, n + 1, `2026-11-05T0${2 + n}:42:00Z`));
  const other = y180Version('shift-b', 0, 1, '2026-11-06T13:00:00Z');
  const kept = latestFormVersions([...versions, other]);
  assert.deepEqual(kept.map((l) => [l.shiftId, l.sortOrder]), [['shift-a', 4], ['shift-b', 0]]);

  // A newer save that arrives first in the list still wins; order of the kept rows is preserved.
  assert.deepEqual(latestFormVersions([versions[4], versions[0], other]).map((l) => l.sortOrder), [4, 0]);
});

test('ties on sortOrder fall back to the newest createdAt; missing shiftId keeps the row', () => {
  const older = { ...y180Version('shift-a', 2, 1, '2026-11-05T02:00:00Z') };
  const newer = { ...y180Version('shift-a', 2, 2, '2026-11-05T03:00:00Z') };
  assert.deepEqual(latestFormVersions([older, newer]), [newer]);
  assert.deepEqual(latestFormVersions([newer, older]), [newer]);
  const noSortOrder = { ...y180Version('shift-a', 0, 1, '2026-11-05T05:00:00Z'), sortOrder: undefined };
  assert.deepEqual(latestFormVersions([older, noSortOrder]), [older], 'a real sortOrder beats a missing one');

  const legacy = { ...y180Version('shift-a', 0, 1, '2026-11-05T02:00:00Z'), shiftId: undefined };
  assert.deepEqual(latestFormVersions([legacy, { ...legacy }]).length, 2, 'without shiftId nothing is merged');
});

test('logs that legitimately repeat within a shift are all kept', () => {
  const logs = [mixLog('shift-a', 0, 610), mixLog('shift-a', 1, 620), mixLog('shift-a', 2, 630)];
  assert.deepEqual(latestFormVersions(logs), logs);
  for (const type of ['modal_mix_logs', 'modal_quality_logs', 'modal_periodic_logs', 'modal_production_logs', 'modal_autoclave_logs']) {
    assert.ok(!SINGLE_FORM_LOG_TYPES.has(type), `${type} is a multi-entry log`);
  }
});

// ─────────────────────────────────────────────── Excel ───────────────────────────────────────────────

async function workbookFor(logs: ExportableLog[]) {
  const built = buildKpiReportWorkbook([], logs, { since: '2026-09-01', until: '2026-11-18', stationCode: 'ҮЯ-180', matchedCount: 2 });
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await built.xlsx.writeBuffer());
  return restored;
}

function columnValues(sheet: ExcelJS.Worksheet, header: string) {
  let col = 0;
  sheet.getRow(5).eachCell((cell, n) => { if (cell.value === header) col = n; });
  assert.ok(col, `missing column ${header}`);
  const values: unknown[] = [];
  for (let r = 6; r <= sheet.rowCount; r++) values.push(sheet.getCell(r, col).value);
  return values;
}

test('the reported case: a shift saved 5 times appears once, with only its final rows', async () => {
  const logs = [
    ...[0, 1, 2, 3, 4].map((n) => y180Version('shift-a', n, n + 1, `2026-11-05T0${2 + n}:42:00Z`)),
    y180Version('shift-b', 0, 2, '2026-11-06T13:00:00Z'),
    mixLog('shift-a', 0, 610), mixLog('shift-a', 1, 620),
  ];
  const workbook = await workbookFor(logs);
  const sheet = workbook.getWorksheet('ҮЯ-180 автоклав бүртгэл');
  assert.ok(sheet);

  // Before: 6 forms and 1+2+3+4+5+2 = 17 rows. After: 2 forms, 5 + 2 = 7 rows.
  assert.deepEqual(columnValues(sheet, 'Бүртгэл №'), [1, 1, 1, 1, 1, 2, 2]);
  assert.deepEqual(columnValues(sheet, 'Автоклав №'), ['1', '2', '3', '4', '5', '1', '2']);
  const noteRow = [1, 2, 3, 4].map((r) => String(sheet.getRow(r).getCell(1).value ?? '')).join(' ');
  assert.match(noteRow, /2 маягтын бүртгэл • 7 дэлгэрэнгүй мөр/);
  assert.match(noteRow, /Ээлж бүрээс маягтын хамгийн сүүлд хадгалсан хувилбар орсон/);

  const mix = workbook.getWorksheet('Зуурмагийн бүртгэл');
  assert.ok(mix);
  assert.deepEqual(columnValues(mix, 'Бүртгэл №'), [1, 2], 'both mix logs of the shift are kept');
  const mixNote = [1, 2, 3, 4].map((r) => String(mix.getRow(r).getCell(1).value ?? '')).join(' ');
  assert.doesNotMatch(mixNote, /хамгийн сүүлд хадгалсан/);

  const overview = workbook.getWorksheet('Тайлангийн тойм');
  assert.ok(overview);
  let formCount: unknown;
  overview.eachRow((row) => { if (row.getCell(1).value === 'Файлд орсон маягтын бүртгэл') formCount = row.getCell(4).value; });
  assert.equal(formCount, 4, '2 autoclave forms + 2 mix logs');
});

// ─────────────────────────────────────────────── холболт ───────────────────────────────────────────────

test('the single-form list is exactly what the shift page reads as «latest only»', () => {
  const page = read('app/shift/[id]/page.tsx');
  const fromPage = new Set([...page.matchAll(/byType\('([a-z0-9_]+)'\)\.slice\(-1\)\[0\]/g)].map((m) => `modal_${m[1]}`));
  // These two are also read as the last element, written differently on the page.
  assert.ok(page.includes("const hse = byType('hse_checklist');") && page.includes('hse.length ? hse[hse.length - 1] : null'));
  assert.ok(page.includes("const y110Logs = byType('y110_start_form');") && page.includes('y110Logs[y110Logs.length - 1]'));
  fromPage.add('modal_hse_checklist');
  fromPage.add('modal_y110_start_form');
  assert.deepEqual([...SINGLE_FORM_LOG_TYPES].sort(), [...fromPage].sort());
});

test('the report route loads shiftId and sortOrder, and the workbook builder applies the rule', () => {
  const route = read('app/api/reports/kpi/route.ts');
  const select = route.slice(route.indexOf('prisma.productionLog.findMany'), route.indexOf('take: LOG_ROW_LIMIT + 1'));
  assert.ok(select.includes('shiftId: true') && select.includes('sortOrder: true'));
  const builder = read('lib/kpi-report-export.ts');
  assert.ok(builder.includes('const formLogs = latestFormVersions(logs);'));
  assert.ok(builder.includes('addLogSheets(workbook, formLogs, { subtitle })'));
});
