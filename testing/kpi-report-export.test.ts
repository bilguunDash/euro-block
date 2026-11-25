import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { buildKpiReportWorkbook } from '../lib/kpi-report-export';
import { LOG_TYPE_LABELS, type ExportableLog } from '../lib/kpi-log-export';
import { filters, logs, longNotes, shifts } from './fixtures/kpi-report';

const generatedAt = new Date('2026-09-15T02:35:00Z');

async function roundTrip(workbook: ExcelJS.Workbook) {
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await workbook.xlsx.writeBuffer());
  return restored;
}

function fixtureWorkbook() {
  return roundTrip(buildKpiReportWorkbook(shifts, logs, {
    ...filters, matchedCount: shifts.length, generatedAt,
  }));
}

function worksheet(workbook: ExcelJS.Workbook, name: string) {
  const sheet = workbook.getWorksheet(name);
  assert.ok(sheet, `Missing worksheet: ${name}`);
  return sheet;
}

function column(sheet: ExcelJS.Worksheet, header: string) {
  let found = 0;
  sheet.getRow(5).eachCell((cell, number) => {
    if (cell.value === header) found = number;
  });
  assert.ok(found, `Missing column ${header} on ${sheet.name}`);
  return found;
}

function dataCell(sheet: ExcelJS.Worksheet, header: string, offset = 0) {
  return sheet.getCell(6 + offset, column(sheet, header));
}

function metric(workbook: ExcelJS.Workbook, label: string) {
  const overview = worksheet(workbook, 'Тайлангийн тойм');
  let result: ExcelJS.CellValue | undefined;
  overview.eachRow((row) => {
    if (row.getCell(1).value === label) {
      const cell = row.getCell(4);
      result = cell.formula ? cell.result : cell.value;
    }
  });
  assert.notEqual(result, undefined, `Missing metric: ${label}`);
  return result;
}

test('serialized Excel preserves typed dates, measurements, zero, false and full multiline notes', async () => {
  const workbook = await fixtureWorkbook();
  const shiftSheet = worksheet(workbook, 'Ээлжүүд');
  const date = dataCell(shiftSheet, 'Огноо');
  assert.ok(date.value instanceof Date);
  assert.equal(date.value.toISOString(), '2026-09-15T00:00:00.000Z');
  assert.equal(date.numFmt, 'yyyy-mm-dd');
  assert.equal(dataCell(shiftSheet, 'Оператор дуусгасан', 2).value, 'Үгүй');
  assert.equal(dataCell(shiftSheet, 'Мастер баталгаажсан').value, 'Тийм');

  const mix = worksheet(workbook, LOG_TYPE_LABELS.modal_mix_logs);
  // UI-д (MixLogModal, ээлжийн дэлгэц) энэ талбар «Цутгалтын №» гэж харагддаг.
  assert.equal(dataCell(mix, 'Цутгалтын №').value, 0);
  assert.equal(dataCell(mix, 'Тархалт').value, 23.5);
  assert.equal(dataCell(mix, 'Темп (°С)').value, 38.75);
  assert.equal(dataCell(mix, 'Хоцорсон эсэх').value, 'Үгүй');
  assert.equal(dataCell(mix, 'Тэмдэглэл').value, longNotes);
  assert.equal(dataCell(mix, 'Тэмдэглэл').alignment.wrapText, true);
  // Өндрийг Excel autofit хийх ёстой: `customHeight` тавибал autofit унтарч,
  // тааруулсан өндөр урт тэмдэглэлийг таслах ХАТУУ ХЯЗГААР болно.
  assert.equal(mix.getRow(6).height, undefined, 'Data rows must not carry a custom height');
  const recorded = dataCell(mix, 'Бүртгэсэн цаг');
  assert.ok(recorded.value instanceof Date);
  assert.equal(recorded.value.toISOString(), '2026-09-15T09:30:00.000Z');
  assert.equal(recorded.numFmt, 'yyyy-mm-dd hh:mm');
  const offsetTime = dataCell(mix, 'Бүртгэсэн цаг', 1).value;
  assert.ok(offsetTime instanceof Date);
  assert.equal(offsetTime.toISOString(), '2026-09-15T15:15:00.000Z');
  const generated = worksheet(workbook, 'Тайлангийн тойм').getCell('B3').value;
  assert.ok(generated instanceof Date);
  assert.equal(generated.toISOString(), '2026-09-15T10:35:00.000Z');
});

test('payload context collisions, translated aliases, and duplicate indicator labels keep every value', async () => {
  const workbook = await fixtureWorkbook();
  const mix = worksheet(workbook, LOG_TYPE_LABELS.modal_mix_logs);
  assert.equal(dataCell(mix, 'Оператор', 1).value, shifts[0].operatorName);
  assert.equal(dataCell(mix, 'Ээлж', 1).value, shifts[0].shiftType);
  assert.equal(dataCell(mix, 'Маягт: Оператор', 1).value, 'Маягтад бичсэн өөр хариуцагч');
  assert.equal(dataCell(mix, 'Маягт: Ээлж', 1).value, 'Маягтын дотоод ээлж № 7');
  assert.equal(dataCell(mix, 'Маягт: Огноо', 1).value, 'Маягтын тусгай огноо');
  assert.equal(dataCell(mix, 'Маягт: Бүртгэсэн цаг', 1).value, 'Маягтын өөр цаг');

  const aliases = logs[0].data as Record<string, unknown>;
  const rowValues = Object.values(mix.getRow(6).values);
  for (const key of ['notes', 'remarks', 'comment', 'explanation']) {
    assert.ok(rowValues.includes(aliases[key] as ExcelJS.CellValue), `Lost field: ${key}`);
  }
  const indicators = worksheet(workbook, LOG_TYPE_LABELS.modal_y130_handover_form);
  const temperatures: ExcelJS.CellValue[] = [];
  indicators.getRow(5).eachCell((cell, index) => {
    if (cell.text.startsWith('Температур')) temperatures.push(indicators.getCell(6, index).value);
  });
  assert.deepEqual(temperatures, [38.5, 39.25]);
  assert.equal(dataCell(indicators, 'Зогсолт (мин)').value, 0);
  assert.equal(dataCell(indicators, 'Нэмэлт шалгалт шаардлагатай').value, 'Үгүй');
});

test('expanded rows retain shared notes, per-row notes, source grouping and nested array positions', async () => {
  const nested: ExportableLog = {
    logType: 'nested-autoclaves', createdAt: generatedAt, shift: shifts[0],
    data: {
      rows: [{
        autoclaves: [{ temperature: 0 }, {}, {}, {}, {}, { temperature: 184.5, enabled: false }],
      }],
    },
  };
  const workbook = await roundTrip(buildKpiReportWorkbook(shifts, [...logs, nested], {
    ...filters, matchedCount: shifts.length, generatedAt,
  }));
  const electrical = worksheet(workbook, LOG_TYPE_LABELS.modal_cah02_electrical_control_form);
  assert.equal(electrical.rowCount - 5, 2);
  for (let row = 0; row < 2; row += 1) {
    assert.equal(dataCell(electrical, 'Тэмдэглэл', row).value, 'Ээлжийн ерөнхий тэмдэглэл.');
    assert.equal(dataCell(electrical, 'Бүртгэл №', row).value, 1);
    assert.equal(dataCell(electrical, 'Мөр №', row).value, row + 1);
  }
  assert.equal(dataCell(electrical, 'Мөр: Тэмдэглэл').value, 'Эхний хэмжилтийн тэмдэглэл.');
  assert.equal(dataCell(electrical, 'Мөр: Тэмдэглэл', 1).value, 'Хоёр дахь хэмжилтийн тэмдэглэл.');
  assert.equal(dataCell(electrical, 'Хэмжилт авсан цаг').value, '2026-09-15 21:00');
  assert.equal(dataCell(electrical, 'Трансформаторын өндөр талын гүйдэл T1').value, 0);

  // Үүрлэсэн НЭРГҮЙ массив байрлалаараа БАГАНА болно. Өмнө нь нэг нүдэнд
  // "1. ...\n2. ..." хэлбэрээр шахагддаг байсан нь бодит ҮЯ-180 дээр 943 тэмдэгт
  // болж, Excel-ийн мөрийн өндрийн хязгаарт (409.6pt) 12/12 мөр таслагдаж байв.
  const nestedSheet = worksheet(workbook, nested.logType);
  for (let position = 1; position <= 6; position += 1) {
    assert.ok(column(nestedSheet, `Автоклавууд ${position}: Температур`), `Lost autoclave ${position}`);
  }
  assert.equal(dataCell(nestedSheet, 'Автоклавууд 1: Температур').value, 0);
  assert.equal(dataCell(nestedSheet, 'Автоклавууд 6: Температур').value, 184.5);
  assert.equal(dataCell(nestedSheet, 'Автоклавууд 6: enabled').value, 'Үгүй');
  const heat = worksheet(workbook, LOG_TYPE_LABELS.modal_y181_heat_master_handover_v1);
  const sectionText = dataCell(heat, 'Хэсгүүд').text;
  for (const retained of ['Зуух № 1', 'Зуух № 2', 'Насос № 1', 'Насос № 2', '12.75', 'Үгүй']) {
    assert.ok(sectionText.includes(retained), `Lost nested section value: ${retained}`);
  }
});

test('sheet names are valid and unique and every contents or back link resolves after serialization', async () => {
  const cornerNames = ['History', 'history', 'REPORT', 'report', "O'Brien", "'quoted'", 'Ээлжүүд', 'ТАЙЛАНГИЙН ТОЙМ'];
  const extras: ExportableLog[] = cornerNames.map((logType) => ({
    logType, createdAt: generatedAt, shift: null, data: { notes: logType },
  }));
  const workbook = await roundTrip(buildKpiReportWorkbook(shifts, [...logs, ...extras], {
    ...filters, matchedCount: shifts.length, generatedAt,
  }));
  const names = workbook.worksheets.map((sheet) => sheet.name);
  assert.equal(names.length, 2 + new Set([...logs, ...extras].map((log) => log.logType)).size);
  assert.equal(new Set(names.map((name) => name.toLowerCase())).size, names.length);
  names.forEach((name) => {
    assert.ok(name.length > 0 && name.length <= 31, `Invalid sheet name length: ${name}`);
    assert.doesNotMatch(name, /[\\/?*\[\]:]/);
    assert.doesNotMatch(name, /^'|'$/);
    assert.notEqual(name.toLowerCase(), 'history');
  });
  const linked = new Set<string>();
  workbook.eachSheet((sheet) => sheet.eachRow((row) => row.eachCell((cell) => {
    if (!cell.hyperlink) return;
    const match = /^#'((?:[^']|'')+)'!A1$/.exec(cell.hyperlink);
    assert.ok(match, `Invalid internal link: ${cell.hyperlink}`);
    const target = match[1].replace(/''/g, "'");
    assert.ok(names.includes(target), `Missing hyperlink target: ${target}`);
    linked.add(target);
  })));
  assert.deepEqual([...linked].sort(), [...names].sort());
});

test('downloaded sheets retain header filters, frozen context, print headings and hidden IDs', async () => {
  const workbook = await fixtureWorkbook();
  const shiftSheet = worksheet(workbook, 'Ээлжүүд');
  const idColumn = column(shiftSheet, 'Ээлжийн ID');
  assert.equal(shiftSheet.getColumn(idColumn).hidden, true);
  assert.equal(dataCell(shiftSheet, 'Ээлжийн ID').value, shifts[0].id);
  assert.equal(shiftSheet.pageSetup.printArea, 'A1:I10');
  for (const sheet of workbook.worksheets.slice(1)) {
    assert.equal(sheet.autoFilter, `A5:${sheet.getColumn(sheet.columnCount).letter}${sheet.rowCount}`);
    const view = sheet.views[0];
    assert.equal(view.state, 'frozen');
    if (view.state === 'frozen') {
      assert.equal(view.xSplit, 4);
      assert.equal(view.ySplit, 5);
    }
    assert.equal(sheet.pageSetup.printTitlesRow, '5:5');
    assert.equal(sheet.pageSetup.orientation, 'landscape');
    // Өгөгдлийн мөр бүр Excel-ийн autofit-д даалгагдсан байх ёстой (дээрхийг үз).
    for (let row = 6; row <= sheet.rowCount; row += 1) {
      assert.equal(sheet.getRow(row).height, undefined, `${sheet.name}!r${row} has a custom height`);
    }
    const headers: string[] = [];
    sheet.getRow(5).eachCell((cell) => {
      headers.push(cell.text);
      assert.equal(cell.font.bold, true);
      assert.equal(cell.alignment.wrapText, true);
    });
    assert.equal(new Set(headers).size, headers.length, `Ambiguous headers on ${sheet.name}`);
  }
});

test('truncation warnings and summary metrics distinguish matching records, source logs and expanded rows', async () => {
  const workbook = await roundTrip(buildKpiReportWorkbook(shifts, logs, {
    ...filters, matchedCount: 20, logsTruncated: true, generatedAt,
  }));
  const overview = worksheet(workbook, 'Тайлангийн тойм');
  assert.match(overview.getCell('A5').text, /АНХААР/);
  assert.match(overview.getCell('A5').text, /20 ээлжээс эхний 5/);
  assert.match(overview.getCell('A5').text, /эхний 8/);
  assert.equal(metric(workbook, 'Шүүлтүүрт тохирсон нийт ээлж'), 20);
  assert.equal(metric(workbook, 'Файлд орсон ээлж'), 5);
  assert.equal(metric(workbook, 'Баталгаажсан ээлж'), 2);
  assert.equal(metric(workbook, 'Бүртгэлийн гүйцэтгэл'), 0.4);
  assert.equal(metric(workbook, 'Оператор дуусгасан'), 3);
  assert.equal(metric(workbook, 'Мастер баталгаажсан'), 2);
  assert.equal(metric(workbook, 'Файлд орсон маягтын бүртгэл'), 8);
  let electricalEntry: ExcelJS.Row | undefined;
  overview.eachRow((row) => {
    if (row.getCell(1).text === LOG_TYPE_LABELS.modal_cah02_electrical_control_form) electricalEntry = row;
  });
  assert.ok(electricalEntry);
  assert.equal(electricalEntry.getCell(2).value, 1, 'One source log');
  assert.equal(electricalEntry.getCell(4).value, 2, 'Two expanded measurement rows');
});

test('an empty result still produces a navigable workbook with zero metrics and valid formula/filter ranges', async () => {
  const workbook = await roundTrip(buildKpiReportWorkbook([], [], {
    ...filters, matchedCount: 0, generatedAt,
  }));
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['Тайлангийн тойм', 'Ээлжүүд']);
  assert.equal(worksheet(workbook, 'Ээлжүүд').autoFilter, 'A5:J5');
  assert.equal(worksheet(workbook, 'Ээлжүүд').rowCount, 5);
  for (const label of [
    'Шүүлтүүрт тохирсон нийт ээлж', 'Файлд орсон ээлж', 'Баталгаажсан ээлж',
    'Бүртгэлийн гүйцэтгэл', 'Оператор дуусгасан', 'Мастер баталгаажсан', 'Файлд орсон маягтын бүртгэл',
  ]) assert.equal(metric(workbook, label), 0);
  assert.doesNotMatch(worksheet(workbook, 'Тайлангийн тойм').getCell('A5').text, /АНХААР/);
  workbook.eachSheet((sheet) => sheet.eachRow((row) => row.eachCell((cell) => {
    assert.notEqual(cell.type, ExcelJS.ValueType.Error, `Excel error in ${sheet.name}!${cell.address}`);
    if (!cell.formula) return;
    assert.doesNotMatch(cell.formula, /#REF!|#VALUE!|#DIV\/0!/);
    for (const match of cell.formula.matchAll(/[A-Z]+(\d+):[A-Z]+(\d+)/g)) {
      assert.ok(Number(match[1]) <= Number(match[2]), `Reversed formula range: ${cell.formula}`);
    }
  })));
});
