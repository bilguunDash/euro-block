import assert from 'node:assert/strict';
import test from 'node:test';
import {
  expectedFormTitle, masterFormTypes, masterLog, mount, nodes, scheduleRow, shiftRow, stationCell, textOf,
} from './helpers/approvals-section.mjs';

test('operator pending rows show the station name under the code, like the shift page title', () => {
  const ui = mount({
    pending: [
      shiftRow('a'),
      shiftRow('b', { stationCode: 'ҮЯ-777', stationName: 'Шинэ дамжлагын оператор' }),
      shiftRow('c', { stationCode: 'ҮЯ-888' }),
    ],
  });
  const table = ui.open('operator', 'pending');
  assert.equal(table.rows.length, 3);
  assert.deepEqual(table.rows.map(row => stationCell(table, row)), [
    { badge: 'ҮЯ-130', description: 'Зуурах цамхагийн оператор' },
    { badge: 'ҮЯ-777', description: 'Шинэ дамжлагын оператор' },
    { badge: 'ҮЯ-888', description: undefined },
  ]);
});

test('a master station shift is not a form: it shows the station name, with the catalog beating the server name', () => {
  // Мастер станцын ЭЭЛЖ «Мастер» табад гарна. Маягт биш тул станцын нэр гарна; каталог серверийн нэрээс давуу.
  const table = mount({ pending: [shiftRow('d', { stationCode: 'ҮЯ-310', stationName: 'Хуучин нэр' })] }).open('master', 'pending');
  assert.equal(table.rows.length, 1);
  assert.deepEqual(stationCell(table, table.rows[0]), { badge: 'ҮЯ-310', description: 'Засварын мастер' });
});

test('operator pending rows keep every other column and all four actions', () => {
  const table = mount({ pending: [shiftRow('a')] }).open('operator', 'pending');
  assert.deepEqual(table.headers, ['Огноо', 'Дамжлага', 'Ээлж', 'Оператор', 'Мастер', 'Мастерын огноо', 'Үйлдэл']);
  const [row] = table.rows;
  assert.equal(row.length, table.headers.length);
  assert.equal(textOf(table.cell(row, 'Огноо')), '2026-10-07');
  assert.equal(textOf(table.cell(row, 'Ээлж')), 'Шөнийн');
  assert.equal(textOf(table.cell(row, 'Оператор')), 'Нямжав МӨНХЦООЖ');
  assert.equal(textOf(table.cell(row, 'Мастер')), 'Туяа НЯМДОРЖ');
  const actions = nodes(table.cell(row, 'Үйлдэл'));
  const labels = actions.filter(node => node.type === 'button' || node.type === 'a').map(node => textOf(node).trim());
  assert.deepEqual(labels, ['Нээх', 'Эцсийн баталгаажуулах', 'Цуцлах', 'Устгах']);
});

test('operator approved rows show the station name, with the catalog taking priority', () => {
  const table = mount({
    approvedShifts: [
      shiftRow('a', { stationCode: 'ҮЯ-190', stationName: 'Өөр нэр' }),
      shiftRow('b', { stationCode: 'ҮЯ-777', stationName: 'Шинэ дамжлагын оператор' }),
      shiftRow('c', { stationCode: 'ҮЯ-888' }),
    ],
  }).open('operator', 'approved');
  assert.deepEqual(table.headers, ['Огноо', 'Дамжлага', 'Ээлж', 'Оператор', 'Мастер', 'Эцэслэн баталсан', 'Баталсан огноо', 'Үйлдэл']);
  assert.deepEqual(table.rows.map(row => stationCell(table, row)), [
    { badge: 'ҮЯ-190', description: 'Чанар шалгагч' },
    { badge: 'ҮЯ-777', description: 'Шинэ дамжлагын оператор' },
    { badge: 'ҮЯ-888', description: undefined },
  ]);
  assert.ok(table.rows.every(row => row.length === table.headers.length));
});

test('master pending rows show which registration each form is, for every approvable form type', () => {
  const table = mount({
    masterPending: masterFormTypes.map(([logType, code], index) => masterLog(`m${index}`, logType, code)),
  }).open('master', 'pending');
  assert.deepEqual(table.headers, ['Огноо', 'Дамжлага', 'Ээлж', 'Хүлээлгэн өгсөн', 'Хүлээн авсан', 'Үйлдэл']);
  assert.deepEqual(table.rows.map(row => stationCell(table, row)),
    masterFormTypes.map(([, code]) => ({ badge: code, description: expectedFormTitle(code) })));
  assert.equal(stationCell(table, table.rows[2]).description, 'Засварын мастерын ээлж хүлээлцэх бүртгэл');
  assert.ok(table.rows.every(row => row.length === table.headers.length));
});

test('master approved rows show which registration each form is, for every approvable form type', () => {
  // «Мастер» табын «Баталгаажсан» нь хоёр хүснэгттэй: 0 — мастер станцын ээлж, 1 — мастерын маягт.
  const table = mount({
    approvedMasterLogs: masterFormTypes.map(([logType, code], index) => masterLog(`m${index}`, logType, code)),
  }).open('master', 'approved', { count: 2, index: 1 });
  assert.deepEqual(table.headers, ['Огноо', 'Дамжлага', 'Ээлж', 'Хүлээлгэн өгсөн', 'Хүлээн авсан', 'Баталгаажуулсан', 'Үйлдэл']);
  assert.deepEqual(table.rows.map(row => stationCell(table, row)),
    masterFormTypes.map(([, code]) => ({ badge: code, description: expectedFormTitle(code) })));
  assert.ok(table.rows.every(row => row.length === table.headers.length));
});

test('a master form of an unknown station keeps only its code', () => {
  const unknown = masterLog('x', 'modal_unknown_form', 'ҮЯ-999', { stationCode: 'ҮЯ-999' });
  const table = mount({ masterPending: [unknown] }).open('master', 'pending');
  assert.deepEqual(stationCell(table, table.rows[0]), { badge: 'ҮЯ-999', description: undefined });
});

test('not started rows show the station name for operator and master schedules', () => {
  const ui = mount({
    notStartedOperator: [scheduleRow('o1', 'operator', 'ҮЯ-190'), scheduleRow('o2', 'operator', 'ҮЯ-777')],
    notStartedMaster: [scheduleRow('m1', 'master', 'ҮЯ-310')],
  });
  const operators = ui.open('operator', 'not_started');
  assert.deepEqual(operators.headers, ['Огноо', 'Дамжлага', 'Ээлж', 'Оператор', 'Төлөв', 'Үйлдэл']);
  assert.deepEqual(operators.rows.map(row => stationCell(operators, row)), [
    { badge: 'ҮЯ-190', description: 'Чанар шалгагч' },
    { badge: 'ҮЯ-777', description: undefined },
  ]);
  const masters = ui.open('master', 'not_started');
  assert.equal(masters.headers[3], 'Мастер');
  // Хуваарь нь маягт биш — маягтын нэр биш, станцын нэр гарна.
  assert.deepEqual(masters.rows.map(row => stationCell(masters, row)), [{ badge: 'ҮЯ-310', description: 'Засварын мастер' }]);
});

test('every list labels its rows: operator/master × pending/approved/not-started lists, master approved having shifts and forms', () => {
  const ui = mount({
    pending: [shiftRow('p')],
    approvedShifts: [shiftRow('a')],
    approvedMasterShifts: [shiftRow('ams', { stationCode: 'ҮЯ-181' })],
    masterPending: [masterLog('mp', 'modal_y310_repair_master_form', 'ҮЯ-310')],
    approvedMasterLogs: [masterLog('ma', 'modal_y099_master_handover_v1', 'ҮЯ-099')],
    notStartedOperator: [scheduleRow('no', 'operator', 'ҮЯ-130')],
    notStartedMaster: [scheduleRow('nm', 'master', 'ҮЯ-181')],
  });
  const expected = [
    ['operator', 'pending', 0, 'ҮЯ-130', 'Зуурах цамхагийн оператор'],
    ['operator', 'approved', 0, 'ҮЯ-130', 'Зуурах цамхагийн оператор'],
    ['operator', 'not_started', 0, 'ҮЯ-130', 'Зуурах цамхагийн оператор'],
    ['master', 'pending', 0, 'ҮЯ-310', 'Засварын мастерын ээлж хүлээлцэх бүртгэл'],
    // Мастер станцын ЭЭЛЖ — станцын нэр; мастерын МАЯГТ — бүртгэлийн нэр.
    ['master', 'approved', 0, 'ҮЯ-181', 'Дулааны мастер'],
    ['master', 'approved', 1, 'ҮЯ-099', expectedFormTitle('ҮЯ-099')],
    ['master', 'not_started', 0, 'ҮЯ-181', 'Дулааны мастер'],
  ];
  for (const [tab, state, index, badge, description] of expected) {
    const table = ui.open(tab, state, { count: tab === 'master' && state === 'approved' ? 2 : 1, index });
    assert.equal(table.rows.length, 1, `${tab}/${state}/${index}`);
    assert.deepEqual(stationCell(table, table.rows[0]), { badge, description }, `${tab}/${state}/${index}`);
  }
});

test('the station filter still lists every operator station as "code — name"', () => {
  const ui = mount({});
  const options = nodes(ui.render()).filter(node => node.type === 'option').map(node => [node.props.value, textOf(node)]);
  assert.ok(options.some(([value, label]) => value === 'ҮЯ-130' && label === 'ҮЯ-130 — Зуурах цамхагийн оператор'));
});
