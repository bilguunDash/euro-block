// «Давхар баталгаажуулалт»: «Оператор» таб зөвхөн оператор станцын ээлж, «Мастер» таб мастер станцын
// ээлж + мастерын маягт харуулдаг эсэхийг бүх төлөв (хүлээгдэж буй / баталгаажсан / хийгдэж эхлээгүй)
// дээр шалгана. Өмнө нь мастер станцын ээлж (жишээ нь ҮЯ-099 «Ээлжийн мастер») Оператор табад гарч байсан.
//
//   node --test --test-isolation=none testing/approval-station-scope.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { actionLabels, approvalHistoryQuery, masterLog, masterStations, mount, nodes, scheduleRow, shiftRow, stationCell, stations, textOf } from './helpers/approvals-section.mjs';
import { loadSource } from './helpers/approval-routes.mjs';

const tick = () => new Promise(setImmediate);
const MASTER_CODES = [...masterStations.MASTER_STATION_CODES];
const OPERATOR_CODES = ['ҮЯ-110', 'ҮЯ-130', 'ҮЯ-190', 'ҮЯ-320'];
// Dashboard-ийн каталог ҮЯ-400-г `isMasterStation: false` гэж тэмдэглэсэн байдаг (lib/master-stations.ts-д
// мастер станц). Ангилал каталогийн тэмдэглэгээнээс биш `isMasterStationCode`-оос хамаарах ёстой.
const catalog = [
  ...stations,
  { code: 'ҮЯ-110', name: 'Цемент шахах төхөөрөмжийн оператор', isMasterStation: false },
  { code: 'ҮЯ-320', name: 'Цахилгаан автоматжуулалтын засварын бүртгэл', isMasterStation: false },
  { code: 'ҮЯ-400', name: 'Үйлдвэрийн процесст тавих хяналтын хуудас', isMasterStation: false },
];
const badges = (table) => table.rows.map((row) => stationCell(table, row).badge);
const subTab = (ui, label) => textOf(ui.render().find((node) => node.type === 'button' && textOf(node).trim().startsWith(label))).trim();

// ─────────────────────────────────────────────── Хүлээгдэж буй ───────────────────────────────────────────────

test('pending: the operator tab lists only operator stations; every master station shift goes to the master tab', () => {
  const pending = [...OPERATOR_CODES, ...MASTER_CODES].map((code, index) => shiftRow(`s${index}`, { stationCode: code }));
  const ui = mount({ pending, stations: catalog });
  assert.deepEqual(badges(ui.open('operator', 'pending')), OPERATOR_CODES);
  assert.deepEqual(badges(ui.open('master', 'pending')).sort(), [...MASTER_CODES].sort());
});

test('pending: the reported case — ҮЯ-099 «Ээлжийн мастер» is no longer an operator row', () => {
  const ui = mount({
    pending: [
      shiftRow('099', {
        stationCode: 'ҮЯ-099', shiftDate: '2026-10-08', shiftType: 'Шөнийн', operatorName: 'Туяа НЯМДОРЖ',
        masterApprovedBy: 'Давхарбаяр ЭНХБААТАР',
      }),
      shiftRow('130', { stationCode: 'ҮЯ-130', shiftDate: '2026-08-18', shiftType: 'Өдрийн', operatorName: 'Нямжав МӨНХЦООЖ' }),
    ],
  });
  const operator = ui.open('operator', 'pending');
  assert.deepEqual(badges(operator), ['ҮЯ-130']);
  assert.ok(!operator.rows.some((row) => textOf(operator.cell(row, 'Оператор')).includes('Туяа')));
  const master = ui.open('master', 'pending');
  assert.equal(master.rows.length, 1);
  const [row] = master.rows;
  assert.deepEqual(stationCell(master, row), { badge: 'ҮЯ-099', description: 'Ээлжийн мастер' });
  assert.equal(textOf(master.cell(row, 'Ээлж')), 'Шөнийн');
  assert.equal(textOf(master.cell(row, 'Хүлээлгэн өгсөн')), 'Туяа НЯМДОРЖ');
  assert.equal(textOf(master.cell(row, 'Хүлээн авсан')), 'Давхарбаяр ЭНХБААТАР');
});

test('pending: a master station shift keeps its final approval; a master form keeps approve/return', async () => {
  const finalApproved = [], decisions = [];
  const shift = shiftRow('s', { stationCode: 'ҮЯ-310', shiftDate: '2026-10-05' });
  const form = masterLog('f', 'modal_y310_repair_master_form', 'ҮЯ-310');
  const ui = mount({
    pending: [shift], masterPending: [form],
    handleAdminFinalApproveClick: async (row) => { finalApproved.push(row); },
    onY310Approve: async (...args) => { decisions.push(args); },
  });
  const table = ui.open('master', 'pending');
  // Хоёр төрлийн мөр нэг хүснэгтэд, ээлжийн огноогоор (шинэ нь эхэнд) эрэмбэлэгдэнэ.
  assert.equal(table.rows.length, 2);
  assert.deepEqual(table.rows.map((row) => textOf(table.cell(row, 'Огноо'))), ['2026-10-07', '2026-10-05']);
  const [formRow, shiftRowCells] = table.rows;
  assert.deepEqual(actionLabels(table, formRow), ['Нээх', 'Буцаах', 'Баталгаажуулах', 'Цуцлах', 'Устгах']);
  assert.deepEqual(actionLabels(table, shiftRowCells), ['Нээх', 'Эцсийн баталгаажуулах', 'Цуцлах', 'Устгах']);

  nodes(table.cell(shiftRowCells, 'Үйлдэл')).find((node) => node.type === 'button' && textOf(node).trim() === 'Эцсийн баталгаажуулах').props.onClick();
  await tick();
  assert.deepEqual(finalApproved, [shift], 'the shift itself is final-approved, exactly like an operator shift');
  assert.deepEqual(decisions, [], 'a shift row must never be sent to the master form decision API');
});

test('pending: the tab badges split by station kind and match the Home card (`pendingApprovalCounts`)', () => {
  const pending = [
    ...OPERATOR_CODES.slice(0, 3).map((code, index) => shiftRow(`o${index}`, { stationCode: code })),
    ...MASTER_CODES.slice(0, 2).map((code, index) => shiftRow(`m${index}`, { stationCode: code })),
  ];
  const masterPending = [masterLog('f', 'modal_y310_repair_master_form', 'ҮЯ-310')];
  const home = approvalHistoryQuery.pendingApprovalCounts({ shifts: pending, shiftTotal: 5, formTotal: 1 });
  assert.deepEqual(home, { operator: 3, master: 3 });
  const ui = mount({ pending, masterPending, adminPendingTotal: 5, y310PendingTotal: 1, stations: catalog });
  assert.equal(ui.badge('operator'), `Оператор${home.operator}`);
  assert.equal(ui.badge('master'), `Мастер${home.master}`);
  assert.equal(home.operator + home.master, 5 + 1, 'splitting never changes the overall pending total');
});

test('pending: shifts beyond the loaded list stay on the operator side; without totals the loaded rows are counted', () => {
  const pending = [shiftRow('o', { stationCode: 'ҮЯ-130' }), shiftRow('m', { stationCode: 'ҮЯ-099' })];
  assert.equal(mount({ pending, adminPendingTotal: 4, y310PendingTotal: 0 }).badge('operator'), 'Оператор3');
  assert.equal(mount({ pending, adminPendingTotal: 4, y310PendingTotal: 0 }).badge('master'), 'Мастер1');
  assert.equal(mount({ pending }).badge('operator'), 'Оператор1');
  assert.equal(mount({ pending }).badge('master'), 'Мастер1');
});

test('pending: the date, station, crew and name filters apply to master station shifts, and clear on the operator tab', () => {
  // `masterApprovedBy` — хүлээн авсан мастер; хайлт хүлээлгэн өгсөн ба хүлээн авсан хоёуланг нь хамарна.
  const receiver = { masterApprovedBy: 'Давхарбаяр ЭНХБААТАР' };
  const pending = [
    shiftRow('a', { stationCode: 'ҮЯ-099', operatorName: 'Туяа НЯМДОРЖ', shiftDate: '2026-10-08', ...receiver }),
    shiftRow('b', { stationCode: 'ҮЯ-310', operatorName: 'Бат БОЛД', shiftDate: '2026-10-03', ...receiver }),
    shiftRow('c', { stationCode: 'ҮЯ-130', operatorName: 'Нямжав МӨНХЦООЖ', ...receiver }),
  ];
  const localUsers = [{ id: 'operator-a', shiftGroup: '1' }, { id: 'operator-b', shiftGroup: '2' }];
  const ui = mount({ pending, localUsers });
  const control = (type, index = 0) => ui.render().filter((node) => node.type === type)[index]; // render() аль хэдийн хавтгай
  const typeInto = (element, value) => element.props.onChange({ target: { value } });

  ui.open('master', 'pending');
  typeInto(control('input', 2), 'ТУЯА'); // огноо, огноо, хайлт
  assert.deepEqual(badges(ui.open('master', 'pending')), ['ҮЯ-099']);
  typeInto(control('input', 2), '');
  typeInto(control('select', 1), '2'); // ээлжийн баг
  assert.deepEqual(badges(ui.open('master', 'pending')), ['ҮЯ-310']);
  typeInto(control('select', 1), '');
  typeInto(control('input', 0), '2026-10-05'); // эхлэх огноо
  assert.deepEqual(badges(ui.open('master', 'pending')), ['ҮЯ-099']);
  // Шүүлтүүр нь оператор таб руу мастер станцын мөр оруулахгүй.
  typeInto(control('input', 0), '');
  assert.deepEqual(badges(ui.open('operator', 'pending')), ['ҮЯ-130']);
});

// ─────────────────────────────────────────────── Баталгаажсан ───────────────────────────────────────────────

test('approved: operator history asks for operator stations; master shift history asks for master stations', () => {
  const ui = mount({
    approvedShifts: [shiftRow('o', { stationCode: 'ҮЯ-130' })],
    approvedMasterShifts: [shiftRow('m', { stationCode: 'ҮЯ-099' })],
    approvedMasterLogs: [masterLog('f', 'modal_y099_master_handover_v1', 'ҮЯ-099')],
  });
  ui.render();
  const shiftUrls = [...ui.urls].filter((url) => url.startsWith('/api/shifts?queryType=admin_approved'));
  assert.equal(shiftUrls.length, 2);
  assert.equal(shiftUrls.filter((url) => url.includes('stationKind=operator')).length, 1);
  assert.equal(shiftUrls.filter((url) => url.includes('stationKind=master')).length, 1);
  assert.ok(![...ui.urls].some((url) => url.startsWith('/api/y310-approvals') && url.includes('stationKind')), 'forms are always master');
  // Хоёр жагсаалт өөр өөр хуудаслалттай — шүүлтүүр хоёуланд нь адил дамжина.
  for (const url of shiftUrls) assert.match(url, /&page=1&pageSize=20/);
});

test('approved: the operator tab shows no master station; the master tab shows master shifts and forms in separate tables', () => {
  const ui = mount({
    approvedShifts: [shiftRow('o', { stationCode: 'ҮЯ-130' })],
    approvedMasterShifts: [shiftRow('m', { stationCode: 'ҮЯ-099', operatorName: 'Туяа НЯМДОРЖ' })],
    approvedMasterLogs: [masterLog('f', 'modal_y310_repair_master_form', 'ҮЯ-310')],
  });
  assert.deepEqual(badges(ui.open('operator', 'approved')), ['ҮЯ-130']);
  assert.equal(subTab(ui, 'Баталгаажсан'), 'Баталгаажсан (1)');

  const shifts = ui.open('master', 'approved', { count: 2, index: 0 });
  assert.deepEqual(shifts.headers, ['Огноо', 'Дамжлага', 'Ээлж', 'Хүлээлгэн өгсөн', 'Хүлээн авсан', 'Эцэслэн баталсан', 'Баталсан огноо', 'Үйлдэл']);
  assert.deepEqual(badges(shifts), ['ҮЯ-099']);
  assert.equal(textOf(shifts.cell(shifts.rows[0], 'Хүлээлгэн өгсөн')), 'Туяа НЯМДОРЖ');
  assert.equal(textOf(shifts.cell(shifts.rows[0], 'Эцэслэн баталсан')), 'Админ');
  assert.deepEqual(actionLabels(shifts, shifts.rows[0]), ['Нээх', 'Цуцлах', 'Устгах']);
  const forms = ui.open('master', 'approved', { count: 2, index: 1 });
  assert.deepEqual(badges(forms), ['ҮЯ-310']);
  assert.equal(subTab(ui, 'Баталгаажсан'), 'Баталгаажсан (2)', 'the master badge adds shifts and forms');
});

test('approved: an empty master shift list shows its own empty state without hiding the forms', () => {
  const ui = mount({ approvedMasterLogs: [masterLog('f', 'modal_y310_repair_master_form', 'ҮЯ-310')] });
  const shifts = ui.open('master', 'approved', { count: 2, index: 0 });
  assert.equal(shifts.rows.length, 1);
  assert.match(textOf(shifts.rows[0][0]), /Эцсийн баталгаажуулсан мастерын ээлж байхгүй/);
  assert.deepEqual(badges(ui.open('master', 'approved', { count: 2, index: 1 })), ['ҮЯ-310']);
});

// ─────────────────────────────────────────────── Хийгдэж эхлээгүй ───────────────────────────────────────────────

test('not started: schedules are placed by station kind, whichever schedule table they came from', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    requests.push({ url, ...options });
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  try {
    const ui = mount({
      notStartedOperator: [scheduleRow('o1', 'operator', 'ҮЯ-130'), scheduleRow('stray-operator', 'operator', 'ҮЯ-099')],
      notStartedMaster: [scheduleRow('m1', 'master', 'ҮЯ-310'), scheduleRow('stray-master', 'master', 'ҮЯ-190')],
    });
    const operator = ui.open('operator', 'not_started');
    assert.deepEqual(badges(operator).sort(), ['ҮЯ-130', 'ҮЯ-190']);
    const master = ui.open('master', 'not_started');
    assert.deepEqual(badges(master).sort(), ['ҮЯ-099', 'ҮЯ-310']);
    assert.equal(subTab(ui, 'Хийгдэж эхлээгүй'), 'Хийгдэж эхлээгүй (2)');

    // Буруу хүснэгтийн хуваарь ч өөрийн хүснэгтэд цуцлагдана (мөр `kind`-ээ хадгална).
    const stray = master.rows.find((row) => stationCell(master, row).badge === 'ҮЯ-099');
    nodes(master.cell(stray, 'Үйлдэл')).find((node) => node.type === 'button' && textOf(node).trim() === 'Цуцлах').props.onClick();
    await tick();
    assert.equal(requests.length, 1);
    assert.deepEqual(JSON.parse(requests[0].body), { kind: 'operator_schedule', id: 'stray-operator', state: 'not_started' });
  } finally { globalThis.fetch = originalFetch; }
});

// ─────────────────────────────────────────────── Шүүлтүүрийн станцын жагсаалт ───────────────────────────────────────────────

const stationGroups = (ui) => ui.render().filter((node) => node.type === 'optgroup').map((group) => ({
  label: group.props.label,
  codes: nodes(group.props.children).filter((node) => node.type === 'option').map((node) => node.props.value),
}));
const stationSelect = (ui) => ui.render().filter((node) => node.type === 'select')[0];
const activeTab = (ui) => textOf(ui.render().find((node) => node.type === 'button' &&
  /^(Оператор|Мастер)\d*$/.test(textOf(node).trim()) && node.props.className.includes('bg-gray-900'))).trim();

test('station filter: both tabs list every station grouped by kind, own kind first — ҮЯ-400 is master although the catalog flags it non-master', () => {
  const ui = mount({
    stations: catalog,
    pending: [...OPERATOR_CODES, ...MASTER_CODES].map((code, index) => shiftRow(`s${index}`, { stationCode: code })),
    approvedShifts: [shiftRow('ao', { stationCode: 'ҮЯ-190' })],
    approvedMasterShifts: [shiftRow('am', { stationCode: 'ҮЯ-400' })],
    notStartedOperator: [scheduleRow('no', 'operator', 'ҮЯ-099')],
  });
  ui.click(/^Оператор\d*$/);
  const [operatorFirst, masterSecond, ...rest] = stationGroups(ui);
  assert.equal(rest.length, 0);
  assert.equal(operatorFirst.label, 'Операторын дамжлага');
  assert.ok(operatorFirst.codes.includes('ҮЯ-320'));
  assert.ok(operatorFirst.codes.every((code) => !MASTER_CODES.includes(code)), `master station in the operator group: ${operatorFirst.codes}`);
  assert.equal(masterSecond.label, 'Мастерын дамжлага — «Мастер» таб');
  assert.deepEqual([...masterSecond.codes].sort(), [...MASTER_CODES].sort(), 'ҮЯ-410 must be findable from the operator tab');

  ui.click(/^Мастер\d*$/);
  const [masterFirst, operatorSecond] = stationGroups(ui);
  assert.equal(masterFirst.label, 'Мастерын дамжлага');
  assert.deepEqual(masterFirst.codes, masterSecond.codes);
  assert.equal(operatorSecond.label, 'Операторын дамжлага — «Оператор» таб');
  assert.deepEqual(operatorSecond.codes, operatorFirst.codes);
});

test('station filter: the reported case — choosing ҮЯ-410 on the operator tab opens the master tab filtered to ҮЯ-410', () => {
  const ui = mount({
    stations: catalog,
    pending: [
      shiftRow('410', { stationCode: 'ҮЯ-410', operatorName: 'Мөнхбат ГАНСҮХ' }),
      shiftRow('099', { stationCode: 'ҮЯ-099' }),
      shiftRow('320', { stationCode: 'ҮЯ-320' }),
    ],
  });
  ui.click(/^Оператор\d*$/);
  stationSelect(ui).props.onChange({ target: { value: 'ҮЯ-410' } });
  assert.match(activeTab(ui), /^Мастер/);
  assert.equal(stationSelect(ui).props.value, 'ҮЯ-410', 'the filter survives the tab switch');
  // `open` нь Мастер табыг дахин дардаг ч аль хэдийн тэр таб дээр байгаа тул шүүлт арилахгүй.
  const master = ui.open('master', 'pending');
  assert.deepEqual(badges(master), ['ҮЯ-410']);
  assert.equal(textOf(master.cell(master.rows[0], 'Хүлээлгэн өгсөн')), 'Мөнхбат ГАНСҮХ');
  const encoded = `station=${encodeURIComponent('ҮЯ-410')}`;
  assert.ok([...ui.urls].some((url) => url.startsWith('/api/y310-approvals') && url.includes(encoded)), 'master form history is filtered too');
  assert.ok([...ui.urls].some((url) => url.includes('stationKind=master') && url.includes(encoded)), 'master shift history is filtered too');
});

test('station filter: an operator station picked on the master tab opens the operator tab; «Бүгд» and manual tab switches behave as before', () => {
  const ui = mount({
    stations: catalog,
    pending: [shiftRow('410', { stationCode: 'ҮЯ-410' }), shiftRow('320', { stationCode: 'ҮЯ-320' }), shiftRow('130', { stationCode: 'ҮЯ-130' })],
  });
  ui.click(/^Мастер\d*$/);
  stationSelect(ui).props.onChange({ target: { value: 'ҮЯ-320' } });
  assert.match(activeTab(ui), /^Оператор/);
  assert.deepEqual(badges(ui.open('operator', 'pending')), ['ҮЯ-320']);

  // «Бүгд» нь табыг солихгүй, зөвхөн шүүлтийг арилгана.
  stationSelect(ui).props.onChange({ target: { value: '' } });
  assert.match(activeTab(ui), /^Оператор/);
  assert.deepEqual(badges(ui.open('operator', 'pending')).sort(), ['ҮЯ-130', 'ҮЯ-320']);

  // Табыг гараар солиход сонгосон станц арилсаар (нөгөө табад хоосон жагсаалт үлдээхгүй).
  stationSelect(ui).props.onChange({ target: { value: 'ҮЯ-130' } });
  assert.deepEqual(badges(ui.open('master', 'pending')), ['ҮЯ-410']);
  assert.equal(stationSelect(ui).props.value, '');
});

// ─────────────────────────────────────────────── Сервер: GET /api/shifts ───────────────────────────────────────────────

function shiftsRoute({ role = 'admin', pendingTotal = 0 } = {}) {
  const calls = { findMany: [], count: [], raw: [], users: [] };
  const tx = {
    shift: { findMany: async (args) => { calls.findMany.push(args); return []; } },
    $queryRawUnsafe: async (sql, ...params) => { calls.raw.push({ sql, params }); return sql.includes('COUNT(*)') ? [{ count: 0 }] : []; },
  };
  const prisma = {
    shift: {
      findMany: async (args) => { calls.findMany.push(args); return []; },
      count: async (args) => { calls.count.push(args); return pendingTotal; },
    },
    user: { findMany: async (args) => { calls.users.push(args); return [{ id: 'crew-member' }]; } },
    $transaction: async (arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(tx)),
  };
  const route = loadSource('app/api/shifts/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, json: async () => body }) } },
    'next-auth/next': { getServerSession: async () => ({ user: { id: 'admin-1', name: 'Admin', role } }) },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/prisma': { prisma },
    '@/lib/shift-db': { STATION_NAME_BY_CODE: {}, FORM_KEY_BY_STATION: {}, decomposePayload: () => ({}), toShiftClientPayload: (shift) => shift },
    '@/lib/server-audit': { writeServerAuditLog: async () => {} },
    '@/lib/shift-api-permissions': loadSource('lib/shift-api-permissions.ts'),
    '@/lib/device-access': { getDeviceAccessForRequest: async () => ({ allowed: true }), deviceForbiddenResponse: () => ({ status: 403 }) },
    '@/lib/dispatcher-compliance': { resolveDispatcherCompliance: async () => ({}) },
    '@/lib/master-stations': masterStations,
    '@/lib/master-pending': { masterApprovalPendingWhere: () => ({}) },
    '@/lib/handover-window': { isoDateInTimeZone: () => '2026-10-09' },
    '@/lib/crew-master': { crewOperatorUids: async () => null, resolveCrewMasterForShift: async () => null },
    '@/lib/approval-history-query': approvalHistoryQuery,
  });
  return { calls, get: (query) => route.GET(new Request(`http://localhost/api/shifts?${query}`)) };
}

test('GET admin_approved&stationKind=operator excludes every master station, for the page and the count', async () => {
  const { calls, get } = shiftsRoute();
  const response = await get('queryType=admin_approved&stationKind=operator');
  assert.equal(response.status, 200);
  assert.equal(calls.findMany.length, 1);
  for (const where of [calls.findMany[0].where, calls.count[0].where]) {
    assert.deepEqual(where, { masterApproved: true, adminApproved: true, stationCode: { notIn: MASTER_CODES } });
  }
});

test('GET admin_approved&stationKind=master keeps only master stations, for the page and the count', async () => {
  const { calls, get } = shiftsRoute();
  await get('queryType=admin_approved&stationKind=master');
  for (const where of [calls.findMany[0].where, calls.count[0].where]) {
    assert.deepEqual(where, { masterApproved: true, adminApproved: true, stationCode: { in: MASTER_CODES } });
  }
});

test('GET admin_approved without stationKind is unchanged: every station (the Home «approved» count)', async () => {
  const { calls, get } = shiftsRoute();
  await get('queryType=admin_approved&pageSize=1&since=2026-10-08&until=2026-10-08&shiftType=Өдрийн');
  assert.deepEqual(calls.findMany[0].where, {
    masterApproved: true, adminApproved: true, shiftDate: { gte: '2026-10-08', lte: '2026-10-08' }, shiftType: 'Өдрийн',
  });
  assert.equal('stationCode' in calls.findMany[0].where, false);
});

test('GET admin_approved combines stationKind with the selected station, crew, dates and shift without overwriting', async () => {
  const { calls, get } = shiftsRoute();
  await get('queryType=admin_approved&stationKind=operator&station=ҮЯ-099&crew=2&since=2026-10-01&shiftType=Шөнийн');
  assert.deepEqual(calls.findMany[0].where, {
    masterApproved: true, adminApproved: true, shiftDate: { gte: '2026-10-01' }, shiftType: 'Шөнийн',
    // Оператор талд мастер станц сонгосон бол «equals» ба «notIn» зөрчилдөж ХООСОН үр дүн гарна.
    stationCode: { equals: 'ҮЯ-099', notIn: MASTER_CODES }, operatorUid: { in: ['crew-member'] },
  });
  await get('queryType=admin_approved&stationKind=master&station=ҮЯ-310');
  assert.deepEqual(calls.findMany[1].where.stationCode, { equals: 'ҮЯ-310', in: MASTER_CODES });
});

test('GET admin_approved name search restricts the station kind with a bound array', async () => {
  for (const [kind, negation] of [['operator', 'NOT '], ['master', '']]) {
    const { calls, get } = shiftsRoute();
    const response = await get(`queryType=admin_approved&stationKind=${kind}&query=Туяа`);
    assert.equal(response.status, 200);
    assert.equal(calls.raw.length, 2, 'page and count are both restricted');
    for (const { sql, params } of calls.raw) {
      assert.ok(sql.includes(`${negation}(s."stationCode" = ANY($`), `${kind}: ${sql}`);
      assert.ok(params.some((param) => Array.isArray(param) && JSON.stringify(param) === JSON.stringify(MASTER_CODES)), kind);
      assert.ok(!sql.includes('Туяа') && !sql.includes('туяа'), 'the searched name is a bound value, never SQL text');
    }
  }
});

test('GET admin_approved rejects an unknown stationKind before touching the database', async () => {
  for (const bad of ['all', 'Operator', 'master;drop', '1']) {
    const { calls, get } = shiftsRoute();
    const response = await get(`queryType=admin_approved&stationKind=${encodeURIComponent(bad)}`);
    assert.equal(response.status, 400, bad);
    assert.equal(calls.findMany.length + calls.count.length + calls.raw.length, 0, bad);
  }
});

test('GET admin_pending stays whole (both kinds): the tabs and the Home card split it on the client', async () => {
  const { calls, get } = shiftsRoute({ pendingTotal: 7 });
  const response = await get('queryType=admin_pending');
  assert.equal((await response.json()).total, 7);
  for (const where of [calls.findMany[0].where, calls.count[0].where]) {
    assert.equal(where.adminApproved, false);
    assert.equal('stationCode' in where, false, 'a station filter here would shrink the Home total');
  }
});

test('GET admin_approved is still admin/privileged only', async () => {
  const { calls, get } = shiftsRoute({ role: 'operator' });
  assert.equal((await get('queryType=admin_approved&stationKind=master')).status, 403);
  assert.equal(calls.findMany.length, 0);
});
