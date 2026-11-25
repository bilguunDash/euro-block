import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import {
  ENVIRONMENT_CHECK_DEFAULTS,
  createEmptyEnvironmentChecks,
  emptyEnvironmentCheckRow,
  environmentCheckHint,
  isStandardEnvironmentCheck,
  mergeEnvironmentChecks,
  normalizeEnvironmentChecks,
  type EnvironmentCheckRow,
} from '../lib/environment-check-form';
import { buildKpiReportWorkbook } from '../lib/kpi-report-export';
import { flattenLogData } from '../lib/kpi-log-export';

const keys = (rows: EnvironmentCheckRow[]) => rows.map((row) => row.key);

test('a shift saved before this section existed still opens with the three standard questions', () => {
  for (const legacy of [undefined, null, [], {}, 'nonsense', 0]) {
    const rows = mergeEnvironmentChecks(legacy);
    assert.deepEqual(keys(rows), ['env1', 'env2', 'env3'], `Lost defaults for ${JSON.stringify(legacy)}`);
    assert.deepEqual(rows.map((r) => r.label), ENVIRONMENT_CHECK_DEFAULTS.map((d) => d.label));
    assert.deepEqual(rows.map((r) => r.answer), ['', '', '']);
  }
  assert.deepEqual(keys(createEmptyEnvironmentChecks()), ['env1', 'env2', 'env3']);
});

test('a partially saved checklist keeps its answers and restores the missing standard rows in order', () => {
  const rows = mergeEnvironmentChecks([
    { key: 'env2', label: 'Хог ачсан уу?', answer: 'Тийм', comment: '3 тн' },
  ]);
  assert.deepEqual(keys(rows), ['env1', 'env2', 'env3']);
  const saved = rows.find((r) => r.key === 'env2')!;
  assert.equal(saved.label, 'Хог ачсан уу?', 'Operator-edited question text must survive');
  assert.equal(saved.answer, 'Тийм');
  assert.equal(saved.comment, '3 тн');
  // Нөхсөн мөрүүд анхны асуулттайгаа буцаж ирнэ.
  assert.equal(rows[0].label, ENVIRONMENT_CHECK_DEFAULTS[0].label);
  assert.equal(rows[2].label, ENVIRONMENT_CHECK_DEFAULTS[2].label);
});

test('operator-added rows survive a save/reload round trip and duplicate keys collapse', () => {
  const custom = { key: 'env_custom_1', label: 'Шугамын алдагдал?', answer: 'Үгүй', comment: '' };
  const rows = mergeEnvironmentChecks([...createEmptyEnvironmentChecks(), custom, { ...custom, answer: 'Тийм' }]);
  assert.equal(rows.length, 4, 'Duplicate keys must collapse to one row');
  assert.equal(rows[3].key, 'env_custom_1');
  assert.equal(rows[3].answer, 'Үгүй', 'First occurrence wins');
});

test('only Тийм/Үгүй survive as answers; anything else becomes blank', () => {
  const rows = mergeEnvironmentChecks([
    { key: 'env1', label: 'a', answer: 'Тийм', comment: '' },
    { key: 'env2', label: 'b', answer: 'yes', comment: '' },
    { key: 'env3', label: 'c', answer: 42, comment: '' },
  ]);
  assert.deepEqual(rows.map((r) => r.answer), ['Тийм', '', '']);
});

test('submitting drops blank added rows, keeps blank standard rows, and never leaves a question unnamed', () => {
  const rows: EnvironmentCheckRow[] = [
    ...createEmptyEnvironmentChecks(),
    emptyEnvironmentCheckRow(),                                              // огт хоосон — хаягдана
    { key: 'env_a', label: '', answer: 'Тийм', comment: '' },                 // нэргүй ч бөглөсөн
    { key: 'env_b', label: '  Тоос ихэссэн үү? ', answer: '', comment: 'үгүй' },
  ];
  const out = normalizeEnvironmentChecks(rows);

  assert.equal(out.length, 5, 'One blank added row must be dropped');
  assert.deepEqual(keys(out).slice(0, 3), ['env1', 'env2', 'env3'], 'Blank standard rows stay');
  assert.equal(out.find((r) => r.key === 'env_a')!.label, 'Нэмэлт асуулт 1');
  assert.equal(out.find((r) => r.key === 'env_b')!.label, 'Тоос ихэссэн үү?', 'Label is trimmed');
  assert.ok(out.every((r) => r.label.trim()), 'Excel cannot build a column from a blank question');
});

test('a cleared standard question is restored so its Excel column never disappears', () => {
  const out = normalizeEnvironmentChecks([
    { key: 'env1', label: '   ', answer: 'Үгүй', comment: '' },
  ]);
  assert.equal(out[0].label, ENVIRONMENT_CHECK_DEFAULTS[0].label);
  assert.equal(out[0].answer, 'Үгүй');
});

test('normalising is stable, so re-saving an untouched shift does not churn the data', () => {
  const once = normalizeEnvironmentChecks(createEmptyEnvironmentChecks());
  const twice = normalizeEnvironmentChecks(once);
  assert.deepEqual(twice, once);
});

test('hints belong to the standard keys only and follow an edited question', () => {
  assert.ok(environmentCheckHint('env1').startsWith('Илэрсэн бол'));
  assert.equal(environmentCheckHint('env_custom'), '');
  assert.equal(isStandardEnvironmentCheck('env3'), true);
  assert.equal(isStandardEnvironmentCheck('env_custom'), false);
});

test('every station form ships the checklist, so no shift can be saved without it', async () => {
  // Маягт бүр `createEmpty*`-аас эхэлдэг. Аль нэгд нь дутвал тэр станцын ээлж
  // хяналтын хуудасгүй хадгалагдаж, Excel тайланд багана нь алга болно.
  const factories: Array<[string, string]> = [
    ['cah02-electrical-control-form', 'createEmptyCAH02Payload'],
    ['factory-process-control-form', 'createEmptyFactoryProcessControlPayload'],
    ['ingredient-change-record-form', 'createEmptyIngredientChangeRecordPayload'],
    ['y099-shift-master-handover', 'createEmptyY099MasterHandoverPayload'],
    ['y110-cement-pump-form', 'createEmptyY110Payload'],
    ['y120-lime-mill-handover-form', 'createEmptyY120Payload'],
    ['y121-ball-mill-handover-form', 'createEmptyY121Payload'],
    ['y130-mixing-tower-handover-form', 'createEmptyY130Payload'],
    ['y140-mold-rotation-handover-form', 'createEmptyY140Payload'],
    ['y150-cutting-line-handover-form', 'createEmptyY150Payload'],
    ['y160-ram-rotation-handover-form', 'createEmptyY160Payload'],
    ['y170-packing-operator-form', 'createEmptyY170PackingPayload'],
    ['y170-trolley-rotation-handover-form', 'createEmptyY170Payload'],
    ['y180-autoclave-operator-form', 'createEmptyY180Payload'],
    ['y181-heat-master-form', 'createEmptyY181HeatMasterHandoverPayload'],
    ['y190-quality-inspector-handover-form', 'createEmptyY190Payload'],
    ['y210-technology-kiln-operator-form', 'createEmptyY210Payload'],
    ['y310-repair-master-handover-form', 'createEmptyY310Payload'],
    ['y320-electrical-automation-repair-form', 'createEmptyY320Payload'],
  ];

  for (const [file, name] of factories) {
    const mod: Record<string, any> = await import(`../lib/${file}`);
    assert.equal(typeof mod[name], 'function', `${file}: ${name} алга`);
    const payload = mod[name]({
      shiftDate: '2026-09-21', shiftType: 'Өдрийн',
      operatorUid: 'u', operatorName: 'О', masterUid: 'm', masterName: 'М',
    });
    assert.deepEqual(keys(payload.environmentChecks), ['env1', 'env2', 'env3'], `${file}: хяналтын хуудас дутуу`);
  }
});

/* ── Excel экспорт ─────────────────────────────────────────────────────────
   Энэ хэсэг нь хяналтын ЖАГСААЛТ учраас Excel-д БАГАНА болох ёстой. Мөр болж
   задарвал станц бүрийн хуудас 3 дахин үржиж, бусад талбар давхардана. */

test('the checklist becomes columns, never extra rows, even on a form with no other row array', () => {
  const data = {
    stationCode: 'ҮЯ-160',
    shiftNotes: 'Хэвийн',
    equipmentInspections: [{ key: 'e1', label: 'Буулгах манипулятор', status: 'normal', comment: '' }],
    environmentChecks: normalizeEnvironmentChecks([
      { key: 'env1', label: ENVIRONMENT_CHECK_DEFAULTS[0].label, answer: 'Тийм', comment: 'Насосны доор 2л' },
      { key: 'env2', label: ENVIRONMENT_CHECK_DEFAULTS[1].label, answer: 'Үгүй', comment: '' },
      { key: 'env3', label: ENVIRONMENT_CHECK_DEFAULTS[2].label, answer: '', comment: '' },
    ]),
  };

  const flat = flattenLogData(data);
  assert.equal(flat.length, 1, 'The checklist must not expand the sheet into one row per question');
  const row = flat[0] as Record<string, unknown>;
  assert.equal(row[`${ENVIRONMENT_CHECK_DEFAULTS[0].label}: Хариулт`], 'Тийм');
  assert.equal(row[`${ENVIRONMENT_CHECK_DEFAULTS[0].label}: Тайлбар`], 'Насосны доор 2л');
  assert.equal(row[`${ENVIRONMENT_CHECK_DEFAULTS[1].label}: Хариулт`], 'Үгүй');
  assert.equal(row[`${ENVIRONMENT_CHECK_DEFAULTS[2].label}: Хариулт`], '');
});

test('the checklist does not steal the expanded row array from a station that logs measurements', () => {
  const data = {
    stationCode: 'ҮЯ-140',
    equipmentInspections: [{ key: 'e1', label: 'Хийн даралт', status: 'normal', comment: '' }],
    castingLog: [
      { id: 'c1', moldNumber: '12', castingNumber: '101', temperature: '42' },
      { id: 'c2', moldNumber: '13', castingNumber: '102', temperature: '41' },
    ],
    environmentChecks: createEmptyEnvironmentChecks(),
  };
  const flat = flattenLogData(data);
  assert.equal(flat.length, 2, 'castingLog must still be the expanded array');
  assert.equal((flat[0] as Record<string, unknown>)['Цутгалтын дугаар'], '101');
  assert.equal((flat[1] as Record<string, unknown>)['Цутгалтын дугаар'], '102');
});

test('the checklist reaches a downloaded workbook as filterable columns', async () => {
  const shift = {
    id: 's1', shiftDate: '2026-09-21', shiftType: 'Өдрийн', stationCode: 'ҮЯ-160',
    operatorName: 'Тест Оператор', role: 'Оператор', status: 'Баталгаажсан',
    operatorShiftCompleted: true, masterApproved: true, masterName: 'Тест Мастер',
  };
  const workbook = buildKpiReportWorkbook(
    [shift],
    [{
      logType: 'modal_y160_handover_form',
      createdAt: new Date('2026-09-21T02:00:00Z'),
      shift,
      data: {
        environmentChecks: normalizeEnvironmentChecks([
          { key: 'env1', label: ENVIRONMENT_CHECK_DEFAULTS[0].label, answer: 'Тийм', comment: 'Тос асгарсан' },
          { key: 'env_x', label: 'Нэмэлт шалгалт?', answer: 'Үгүй', comment: '' },
        ]),
      },
    }],
    { since: '2026-09-01', matchedCount: 1 },
  );
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await workbook.xlsx.writeBuffer());
  const sheet = restored.getWorksheet('ҮЯ-160 үндсэн бүртгэл');
  assert.ok(sheet);

  const headers: string[] = [];
  sheet.getRow(5).eachCell((cell) => headers.push(cell.text));
  assert.ok(headers.includes(`${ENVIRONMENT_CHECK_DEFAULTS[0].label}: Хариулт`), headers.join(' | '));
  assert.ok(headers.includes('Нэмэлт шалгалт?: Хариулт'), 'Operator-added questions must export too');
  assert.equal(sheet.rowCount - 5, 1, 'One form stays one row');

  const answer = sheet.getRow(6).getCell(headers.indexOf(`${ENVIRONMENT_CHECK_DEFAULTS[0].label}: Хариулт`) + 1);
  assert.equal(answer.value, 'Тийм');
});
