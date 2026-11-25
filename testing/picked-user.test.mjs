import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(import.meta.dirname, '..');

// Compile in memory so these route tests need no DB, generated client or child processes.
function load(relativePath, dependencies) {
  const filename = path.join(root, relativePath);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  });
  const mod = { exports: {} };
  vm.runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(
    name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), mod, mod.exports,
  );
  return mod.exports;
}

const people = [
  { id: 'owner', role: 'operator', isApproved: true, name: 'Owner', email: 'owner@test.invalid' },
  { id: 'operator-without-email', role: 'operator', isApproved: true, name: 'Same operator', email: null },
  { id: 'real-operator', role: 'operator', isApproved: true, name: 'Same operator', email: 'operator@test.invalid' },
  { id: 'master-without-email', role: 'master', isApproved: true, name: 'Same master', email: null },
  { id: 'real-master', role: 'master', isApproved: true, name: 'Same master', email: 'master@test.invalid' },
  { id: 'inactive-master', role: 'master', isApproved: false, name: 'Inactive', email: 'inactive@test.invalid' },
  { id: 'admin', role: 'admin', isApproved: true, name: 'Admin', email: 'admin@test.invalid' },
];
function userStore() {
  return {
    findUnique: async ({ where }) => people.find(person => person.id === where.id) || null,
    findMany: async ({ where, take }) => people.filter(person =>
      (typeof where.role === 'string' ? person.role === where.role : where.role.in.includes(person.role)) &&
      (where.isApproved === undefined || person.isApproved === where.isApproved) &&
      (!where.OR || where.OR.some(condition => Object.entries(condition).every(([key, value]) => person[key] === value)))
    ).slice(0, take || people.length),
  };
}
const helper = load('lib/picked-user.ts', { './prisma': { prisma: { user: userStore() } } });

test('an explicit ID selects the exact account even when names and legacy labels collide', async () => {
  for (const [uid, role] of [['real-operator', 'operator'], ['real-master', 'master']]) {
    const selected = await helper.resolvePickedUserSelection({ uid, label: 'A different legacy label', roles: [role] });
    assert.equal(selected.id, uid);
  }
});
test('legacy duplicate operator and master names fail instead of selecting an arbitrary account', async () => {
  for (const role of ['operator', 'master']) {
    await assert.rejects(helper.resolvePickedUserSelection({ label: `Same ${role}`, roles: [role] }), helper.PickedUserSelectionError);
  }
});
test('missing, unapproved and wrong-role IDs cannot fall back to another name match', async () => {
  for (const uid of ['missing', 'inactive-master', 'real-operator']) {
    assert.equal(await helper.resolvePickedUserSelection({ uid, label: 'Same master', roles: ['master'] }), null);
  }
});
test('a unique legacy email, name or ID is supported and blank selection remains optional', async () => {
  for (const label of ['real-master', 'master@test.invalid']) {
    assert.equal((await helper.resolvePickedUserSelection({ label, roles: ['master'] })).id, 'real-master');
  }
  assert.equal((await helper.resolvePickedUserSelection({ label: 'Admin', roles: ['admin', 'chief_engineer'] })).id, 'admin');
  assert.equal(await helper.resolvePickedUserSelection({ uid: '', label: '', roles: ['master'] }), null);
});

const directory = people.filter(person => person.role === 'operator');
let selectionMemory = '';
const selector = load('components/ui/RoleUserSelect.tsx', {
  react: { useMemo: fn => fn(), useState: () => [selectionMemory, value => { selectionMemory = value; }] },
  swr: { __esModule: true, default: () => ({ data: { users: directory } }) },
}).RoleUserSelect;
const optionElements = tree => tree.props.children.flat().filter(Boolean);
test('the selector emits the clicked ID and differentiates duplicate names by email', () => {
  let picked;
  const tree = selector({ roles: ['operator'], value: 'real-operator', onChange: (...args) => { picked = args; } });
  const options = optionElements(tree);
  assert.equal(tree.props.value, 'real-operator');
  const real = options.find(option => option.props.value === 'real-operator');
  const imported = options.find(option => option.props.value === 'operator-without-email');
  assert.ok(real.props.children.includes('operator@test.invalid'));
  assert.ok(imported.props.children.includes('Имэйлгүй'));
  tree.props.onChange({ target: { value: 'real-operator' } });
  assert.equal(picked[0], 'real-operator');
  assert.equal(picked[1].label, 'Same operator');
  tree.props.onChange({ target: { value: '' } });
  assert.deepEqual(picked, ['', null]);
});
test('an ambiguous old name stays a disabled legacy value and never preselects the first duplicate', () => {
  selectionMemory = '';
  const tree = selector({ roles: ['operator'], value: 'Same operator', onChange: () => {} });
  assert.equal(tree.props.value, 'Same operator');
  assert.equal(optionElements(tree).find(option => option.props.value === 'Same operator').props.disabled, true);
});
test('signature callers retain the chosen duplicate ID while storing its display name', () => {
  selectionMemory = '';
  let name = '';
  const tree = selector({ roles: ['operator'], value: name, onChange: (_id, user) => { name = user.label; } });
  tree.props.onChange({ target: { value: 'real-operator' } });
  const updated = selector({ roles: ['operator'], value: name, onChange: () => {} });
  assert.equal(name, 'Same operator');
  assert.equal(updated.props.value, 'real-operator');
});
test('a unique saved signature name remains displayed while the new choice value is an ID', () => {
  const tree = selector({ roles: ['operator'], value: 'Owner', onChange: () => {} });
  assert.equal(tree.props.value, 'owner');
});

const shiftId = '11111111-1111-4111-8111-111111111111';
const logId = '22222222-2222-4222-8222-222222222222';
const permissions = load('lib/shift-api-permissions.ts', {});
function routes(role = 'operator', shiftOverrides = {}) {
  const writes = [], notifications = [];
  const actor = { id: 'owner', role, name: 'Owner', stationCode: 'ҮЯ-110' };
  let shift = {
    id: shiftId, operatorUid: actor.id, operatorName: actor.name, stationCode: actor.stationCode,
    shiftDate: '2026-09-28', shiftType: 'Өдрийн', status: 'Хадгалсан',
    handoverStage: 'none', handoverAwaitingAcceptance: false, shiftMasterUid: 'real-master',
    currentMasterUid: 'real-master', productionLogs: [],
    ...shiftOverrides,
  };
  const prisma = {
    user: userStore(),
    shift: {
      findUnique: async () => shift,
      updateMany: async ({ data }) => { writes.push({ kind: 'shift', data }); shift = { ...shift, ...data }; return { count: 1 }; },
      update: async ({ data }) => { writes.push({ kind: 'shift', data }); shift = { ...shift, ...data }; return shift; },
    },
    shiftHandoverApproval: { create: async () => {} },
    productionLog: {
      findFirst: async () => null,
      create: async ({ data }) => { writes.push({ kind: 'log', data }); return { id: logId, createdAt: new Date() }; },
      updateMany: async ({ data }) => { writes.push({ kind: 'log', data }); return { count: 1 }; },
    },
  };
  const dependencies = {
    'next-auth/next': { getServerSession: async () => ({ user: actor }) },
    '@/lib/auth-options': { authOptions: {} }, '@/lib/prisma': { prisma },
    '@/lib/picked-user': load('lib/picked-user.ts', { './prisma': { prisma } }),
    '@/lib/shift-api-permissions': permissions,
    '@/lib/device-access': { getDeviceAccessForRequest: async () => ({ allowed: true }) },
    '@/lib/server-audit': { writeServerAuditLog: async () => {} },
    '@/lib/server-notifications': { notifyManyDeduped: async (ids) => { notifications.push(...ids); }, createNotificationDeduped: async () => {} },
    '@/lib/system-settings': { getHandoverTimingStatus: async () => ({ key: 'normal', label: 'normal' }) },
    '@/lib/shift-completeness': {}, '@/lib/shift-db': {},
    '@/lib/crew-master': { resolveCrewMasterForShift: async () => null },
    '@/lib/master-handover': { resolveNextMasterScheduleForShift: async () => null },
    '@/lib/operator-schedule-resolver': { resolveNextOperatorSchedule: async () => ({ eligible: false }), normalizeStationCode: value => value },
    '@/lib/master-stations': { ADMIN_APPROVAL_LOG_TYPES: [] },
    '@/lib/environment-check-form': {},
  };
  return { patch: load('app/api/shifts/[id]/route.ts', dependencies).PATCH,
    post: load('app/api/shifts/[id]/logs/route.ts', dependencies).POST, writes, notifications };
}
const invoke = (handler, body) => handler(new Request(`http://localhost/api/shifts/${shiftId}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}), { params: Promise.resolve({ id: shiftId }) });

test('the handover PATCH saves exact operator/master IDs and canonical names despite duplicate names', async () => {
  const route = routes();
  const response = await invoke(route.patch, { handoverAwaitingAcceptance: true, nextOperatorUid: 'real-operator', nextOperatorName: 'Wrong legacy name', confirmMasterUid: 'real-master' });
  assert.equal(response.status, 200, JSON.stringify(await response.json()));
  assert.equal(route.writes[0].data.nextOperatorUid, 'real-operator');
  assert.equal(route.writes[0].data.nextOperatorName, 'Same operator');
  assert.equal(route.writes[0].data.currentMasterUid, 'real-master');
});
test('ambiguous handover names return 400 with no writes or notifications', async () => {
  for (const selection of [{ nextOperatorName: 'Same operator' }, { confirmMasterName: 'Same master' }]) {
    const route = routes();
    const response = await invoke(route.patch, { handoverAwaitingAcceptance: true, ...selection });
    assert.equal(response.status, 400);
    assert.equal(route.writes.length, 0);
    assert.equal(route.notifications.length, 0);
  }
});
test('master self-handover uses the selected next master and approval admin IDs', async () => {
  const route = routes('master');
  const response = await invoke(route.patch, { handoverAwaitingAcceptance: true, nextMasterUid: 'real-master', approvalAdminUid: 'admin' });
  assert.equal(response.status, 200, JSON.stringify(await response.json()));
  assert.equal(route.writes[0].data.nextMasterUid, 'real-master');
  assert.equal(route.writes[0].data.approvalAdminUid, 'admin');
});
test('current-master acceptance uses the exact manually selected operator ID', async () => {
  const route = routes('master', { operatorUid: 'previous-owner', handoverStage: 'waiting_current_master', handoverAwaitingAcceptance: true, currentMasterUid: 'owner' });
  const response = await invoke(route.patch, { handoverAwaitingAcceptance: false, handoverAcceptedAt: new Date().toISOString(), nextOperatorUid: 'real-operator', nextOperatorName: 'Wrong name' });
  assert.equal(response.status, 200, JSON.stringify(await response.json()));
  assert.equal(route.writes[0].data.handoverStage, 'waiting_next_operator');
  assert.equal(route.writes[0].data.nextOperatorUid, 'real-operator');
  assert.ok(route.notifications.includes('real-operator'));
});
test('Y099 submit and edit notify only the selected master ID and save the canonical name', async () => {
  for (const editId of [undefined, logId]) {
    const route = routes('master');
    const response = await invoke(route.post, { type: 'y099_master_handover_v1', editId, data: { receivedByUid: 'real-master', receivedBy: 'Wrong name' } });
    assert.equal(response.status, 200, JSON.stringify(await response.json()));
    assert.deepEqual(route.notifications, ['real-master']);
    assert.equal(route.writes[0].data.data.receivedByUid, 'real-master');
    assert.equal(route.writes[0].data.data.receivedBy, 'Same master');
  }
});
test('ambiguous Y099 submit, draft and edit fail before any data or notification is written', async () => {
  for (const extra of [{}, { mode: 'draft' }, { editId: logId }]) {
    const route = routes('master');
    const response = await invoke(route.post, { type: 'y099_master_handover_v1', ...extra, data: { receivedBy: 'Same master' } });
    assert.equal(response.status, 400);
    assert.equal(route.writes.length, 0);
    assert.equal(route.notifications.length, 0);
  }
});
test('Y099 rejects unapproved or wrong-role recipient IDs without writing a log', async () => {
  for (const uid of ['inactive-master', 'real-operator', 'missing']) {
    const route = routes('master');
    const response = await invoke(route.post, { type: 'y099_master_handover_v1', data: { receivedByUid: uid, receivedBy: 'Same master' } });
    assert.equal(response.status, 400);
    assert.equal(route.writes.length, 0);
  }
});
