import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const shiftId = '11111111-1111-4111-8111-111111111111';
const logId = '22222222-2222-4222-8222-222222222222';
const scheduleId = '33333333-3333-4333-8333-333333333333';
const oldLogId = '44444444-4444-4444-8444-444444444444';
const otherLogId = '55555555-5555-4555-8555-555555555555';
const operatorShiftId = '66666666-6666-4666-8666-666666666666';
const logType = 'modal_y310_repair_master_form';

function load(relativePath, mocks = {}) {
  const filename = path.resolve(import.meta.dirname, '..', relativePath);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: filename,
  });
  const mod = { exports: {} };
  vm.runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod, mod.exports,
  );
  return mod.exports;
}

const definitions = load('lib/approval-maintenance.ts');
const service = load('lib/approval-maintenance-service.ts', {
  './master-stations': { ADMIN_APPROVAL_LOG_TYPES: [logType] },
});
const masterStations = load('lib/master-stations.ts');
const recordLabel = load('lib/approval-record-label.ts', { './master-stations': masterStations });
const approvalHistoryQuery = load('lib/approval-history-query.ts', { './master-stations': masterStations });

function fixture(options = {}) {
  let store = {
    shift: { id: shiftId, operatorUid: 'owner', operatorName: 'Owner', stationCode: 'ҮЯ-310', shiftDate: '2026-09-28', shiftType: 'Өдрийн',
      status: 'Баталгаажсан', adminApproved: true, masterApproved: true, operatorShiftCompleted: true,
      currentMasterApprovedAt: '2026-09-28T12:00:00Z', handoverStage: 'accepted', handoverFinalAcceptedAt: '2026-09-28T13:00:00Z',
      handoverAcceptedAt: '2026-09-28T13:00:00Z', handoverAwaitingAcceptance: false, adminApprovedBy: 'Admin', masterApprovedBy: 'Master',
      checkOut: '2026-09-28T12:00:00Z', notes: 'Keep this note', ...options.shift },
    logs: [
      { id: oldLogId, shiftId, logType, sortOrder: 0, createdAt: new Date('2026-09-28T10:00:00Z'), data: { adminApproved: true, needsAdminApproval: true, notes: 'old form' } },
      { id: logId, shiftId, logType, sortOrder: 1, createdAt: new Date('2026-09-28T11:00:00Z'), data: { adminApproved: true, adminApprovedBy: 'Admin', adminApprovedAt: '2026-09-28T12:00:00Z', needsAdminApproval: true, notes: 'current form' } },
      { id: otherLogId, shiftId, logType: 'modal_periodic_logs', sortOrder: 2, data: { notes: 'unrelated form' } },
    ],
    schedules: {
      operator_schedule: { id: scheduleId, operatorUid: 'scheduled-operator', operatorName: 'Operator', stationCode: 'ҮЯ-190', shiftDate: '2026-09-28', shiftType: 'Өдрийн' },
      master_schedule: { id: scheduleId, masterUid: 'scheduled-master', masterName: 'Master', operatorUid: 'different-operator', stationCode: 'ҮЯ-310', shiftDate: '2026-09-28', shiftType: 'Өдрийн' },
    },
    swaps: [{ requesterScheduleId: scheduleId, targetScheduleId: 'different', status: 'pending' }], audits: [], events: [], notifications: [],
    hseLogs: [{ id: 'own-hse', shiftId }, { id: 'other-hse', shiftId: 'other-shift' }],
  };
  if (options.pending) {
    Object.assign(store.shift, { adminApproved: false, status: 'Хадгалсан' });
  }
  if (options.masterPending) {
    Object.assign(store.shift, { adminApproved: false, masterApproved: false, currentMasterApprovedAt: null, status: 'Хадгалсан' });
    store.logs[1].data = { needsAdminApproval: true, notes: 'current form' };
  }
  const session = options.session === null ? null : { user: { id: 'admin-id', name: 'Admin', role: options.role || 'admin' } };
  const prisma = {
    $transaction: async (callback, opts) => {
      assert.equal(opts.isolationLevel, 'Serializable');
      if (options.serializationFailure) throw { code: 'P2034' };
      const draft = structuredClone(store);
      const model = kind => ({
        findUnique: async ({ where }) => draft.schedules[kind]?.id === where.id ? draft.schedules[kind] : null,
        delete: async () => { draft.schedules[kind] = null; },
      });
      const tx = {
        shift: {
          findUnique: async ({ where }) => draft.shift?.id === where.id ? draft.shift : null,
          findFirst: async ({ where }) => {
            if (options.started) return { id: shiftId };
            assert.equal(where.operatorUid, options.expectedAssignee || 'scheduled-operator');
            return null;
          },
          update: async ({ data }) => { Object.assign(draft.shift, data); },
          delete: async () => { draft.shift = null; draft.logs = []; },
        },
        productionLog: {
          findUnique: async ({ where }) => draft.logs.find(log => log.id === where.id) || null,
          findFirst: async ({ where }) => draft.logs.filter(log => log.shiftId === where.shiftId && log.logType === where.logType).sort((a, b) => b.sortOrder - a.sortOrder)[0],
          findMany: async ({ where }) => draft.logs.filter(log => log.shiftId === where.shiftId && (typeof where.logType === 'string' ? log.logType === where.logType : where.logType.in.includes(log.logType))),
          update: async ({ where, data }) => { Object.assign(draft.logs.find(log => log.id === where.id), data); },
          deleteMany: async ({ where }) => { draft.logs = draft.logs.filter(log => log.shiftId !== where.shiftId || log.logType !== where.logType); },
        },
        operatorSchedule: model('operator_schedule'), masterSchedule: model('master_schedule'),
        hseLog: { deleteMany: async ({ where }) => { draft.hseLogs = draft.hseLogs.filter(row => row.shiftId !== where.shiftId); } },
        shiftSwapRequest: { updateMany: async ({ data }) => { for (const swap of draft.swaps) Object.assign(swap, data); } },
        shiftHandoverApproval: { create: async ({ data }) => { draft.events.push(data); } },
        notification: { create: async ({ data }) => { if (options.notificationFailure) throw new service.ApprovalMaintenanceError(500, 'Notification failed'); draft.notifications.push(data); } },
        auditLog: { create: async ({ data }) => { if (options.auditFailure) throw new service.ApprovalMaintenanceError(500, 'Audit failed'); draft.audits.push(data); } },
      };
      await callback(tx);
      store = draft;
    },
  };
  const api = load('app/api/approvals/manage/route.ts', {
    'next/server': { NextResponse: { json: (data, options) => ({ status: options?.status || 200, json: async () => data }) } },
    'next-auth/next': { getServerSession: async () => session }, '@/lib/auth-options': { authOptions: {} },
    '@/lib/prisma': { prisma }, '@/lib/approval-maintenance': definitions, '@/lib/approval-maintenance-service': service,
  });
  return { api, state: () => store };
}

function request(kind = 'shift', state = 'approved', id = shiftId, method = 'PATCH') {
  return new Request('http://localhost/api/approvals/manage', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, state, id }) });
}

test('both actions require admin or chief engineer, before any write', async () => {
  for (const role of ['operator', 'master', 'dispatcher', 'auditor', 'hse_engineer', 'sort_operator']) {
    const { api, state } = fixture({ role });
    for (const method of ['PATCH', 'DELETE']) assert.equal((await api[method](request())).status, 403);
    assert.equal(state().audits.length, 0);
    assert.equal(state().shift.adminApproved, true);
  }
  assert.equal((await fixture({ session: null }).api.DELETE(request())).status, 401);
  assert.equal((await fixture({ role: 'chief_engineer' }).api.PATCH(request())).status, 200);
});

test('malformed IDs, kinds and state combinations cannot mutate records', async () => {
  const { api, state } = fixture();
  for (const req of [request('shift', 'approved', 'bad'), request('anything'), request('shift', 'not_started'), request('master_schedule', 'approved')]) {
    assert.equal((await api.PATCH(req)).status, 400);
  }
  assert.equal(state().audits.length, 0);
});

test('cancelling an approved shift opens it for owner corrections and a fresh handover', async () => {
  const { api, state } = fixture();
  assert.equal((await api.PATCH(request())).status, 200);
  const result = state();
  assert.equal(result.shift.status, 'Хадгалсан');
  assert.equal(result.shift.adminApproved, false);
  assert.equal(result.shift.masterApproved, false);
  assert.equal(result.shift.operatorShiftCompleted, false);
  assert.equal(result.shift.handoverAwaitingAcceptance, false);
  assert.equal(result.shift.handoverStage, 'returned');
  assert.equal(result.shift.currentMasterApprovedAt, null);
  assert.equal(result.shift.handoverFinalAcceptedAt, null);
  assert.equal(result.shift.handoverAcceptedAt, null);
  assert.equal(result.shift.checkOut, '2026-09-28T12:00:00Z');
  assert.equal(result.shift.notes, 'Keep this note');
  assert.equal(result.logs.find(log => log.id === logId).data.notes, 'current form');
  assert.equal(result.logs.find(log => log.id === logId).data.adminRejected, true);
  assert.equal(result.logs.find(log => log.id === logId).data.adminApproved, undefined);
  assert.deepEqual(result.logs.find(log => log.id === otherLogId).data, { notes: 'unrelated form' });
  assert.equal(result.audits[0].actorUid, 'admin-id');
  assert.equal(result.events[0].action, 'admin_reopened');
  assert.deepEqual(result.notifications.map(({ userId, link }) => ({ userId, link })), [{ userId: 'owner', link: `/shift/${shiftId}` }]);
  assert.equal((await api.PATCH(request())).status, 409);
  assert.equal(state().audits.length, 1);
});

test('pending operator approval can be cancelled without losing filled content', async () => {
  const { api, state } = fixture({ pending: true });
  assert.equal((await api.PATCH(request('shift', 'pending'))).status, 200);
  assert.equal(state().shift.masterApproved, false);
  assert.equal(state().shift.notes, 'Keep this note');
});

test('master cancellation preserves all form versions but removes inherited approval flags', async () => {
  const { api, state } = fixture();
  assert.equal((await api.PATCH(request('master_form', 'approved', logId))).status, 200);
  for (const log of state().logs.filter(log => log.logType === logType)) {
    assert.equal(log.data.adminApproved, undefined);
    assert.equal(log.data.adminRejected, true);
    assert.equal(log.data.needsAdminApproval, true);
  }
  assert.equal(state().logs.length, 3);
  assert.equal(state().shift.operatorShiftCompleted, false);
});

test('pending master form can be cancelled and will await resubmission', async () => {
  const { api, state } = fixture({ masterPending: true });
  assert.equal((await api.PATCH(request('master_form', 'pending', logId))).status, 200);
  assert.equal(state().logs.find(log => log.id === logId).data.adminRejected, true);
  assert.equal((await api.PATCH(request('master_form', 'pending', logId))).status, 409);
});

test('master deletion removes all versions of the selected form, retains unrelated forms and reopens the shift', async () => {
  const { api, state } = fixture();
  assert.equal((await api.DELETE(request('master_form', 'approved', logId, 'DELETE'))).status, 200);
  assert.deepEqual(state().logs.map(log => log.id), [otherLogId]);
  assert.equal(state().shift.id, shiftId);
  assert.equal(state().shift.adminApproved, false);
  assert.equal(state().shift.operatorShiftCompleted, false);
  assert.equal(state().audits[0].entityType, 'production_log');
});

test('shift deletion removes the shift and related data without removing its schedule', async () => {
  const { api, state } = fixture();
  assert.equal((await api.DELETE(request())).status, 200);
  assert.equal(state().shift, null);
  assert.deepEqual(state().logs, []);
  assert.deepEqual(state().hseLogs, [{ id: 'other-hse', shiftId: 'other-shift' }]);
  assert.equal(state().schedules.operator_schedule.id, scheduleId);
  assert.equal(state().events.length, 0);
  assert.equal((await api.DELETE(request())).status, 404);
});

test('both actions remove only the selected unstarted assignment, recording the original assignment', async () => {
  for (const kind of ['operator_schedule', 'master_schedule']) for (const method of ['PATCH', 'DELETE']) {
    const { api, state } = fixture({ expectedAssignee: kind === 'master_schedule' ? 'scheduled-master' : 'scheduled-operator' });
    assert.equal((await api[method](request(kind, 'not_started', scheduleId, method))).status, 200);
    assert.equal(state().schedules[kind], null);
    assert.ok(state().schedules[kind === 'master_schedule' ? 'operator_schedule' : 'master_schedule']);
    assert.equal(JSON.parse(state().audits[0].details).snapshot.id, scheduleId);
    assert.equal(state().swaps[0].status, kind === 'operator_schedule' ? 'cancelled' : 'pending');
  }
});

test('a started schedule and stale approval states return conflict without deleting data', async () => {
  const started = fixture({ started: true });
  assert.equal((await started.api.DELETE(request('operator_schedule', 'not_started', scheduleId))).status, 409);
  assert.ok(started.state().schedules.operator_schedule);
  const stale = fixture({ pending: true });
  assert.equal((await stale.api.DELETE(request('shift', 'approved'))).status, 409);
  assert.equal(stale.state().audits.length, 0);
  const old = fixture({ masterPending: true });
  assert.equal((await old.api.DELETE(request('master_form', 'pending', oldLogId))).status, 409);
  assert.equal(old.state().logs.length, 3);
});

test('audit failures roll back deletion and cancellation', async () => {
  for (const method of ['PATCH', 'DELETE']) {
    const { api, state } = fixture({ auditFailure: true });
    const before = structuredClone(state());
    assert.equal((await api[method](request())).status, 500);
    assert.deepEqual(state(), before);
  }
});

test('transaction write conflicts become a retryable 409', async () => {
  assert.equal((await fixture({ serializationFailure: true }).api.PATCH(request())).status, 409);
});

test('confirmation text explains the selected scope and distinguishes cancellation from deletion', () => {
  const cancel = definitions.approvalMaintenanceConfirmation('shift', 'cancel', 'ҮЯ-190 • 2026-09-28');
  assert.match(cancel.message, /Бөглөсөн мэдээлэл хадгалагдана/);
  assert.equal(cancel.confirmText, 'Цуцлах');
  assert.match(definitions.approvalMaintenanceConfirmation('master_form', 'delete', 'form').message, /бүх хувилбартай/);
  assert.match(definitions.approvalMaintenanceConfirmation('shift', 'delete', 'shift').message, /бүх маягт, хэмжилт/);
});

function uiFixture(tab, state, { confirmed = true, status = 200 } = {}) {
  const react = require('react');
  const requests = [], errors = [], successes = [], confirmations = [], invalidations = [];
  const refs = [], states = [];
  let stateIndex = 0, refIndex = 0;
  // `shift` — мастер станцын (ҮЯ-310) ээлж: «Мастер» табад гарна. `operatorShift` — «Оператор» табын ээлж.
  const { shift, logs, schedules } = fixture().state();
  const operatorShift = { ...shift, id: operatorShiftId, stationCode: 'ҮЯ-190' };
  const log = { ...logs[1], shift };
  const mockReact = { ...react,
    useMemo: fn => fn(),
    useRef: initial => { const index = refIndex++; return refs[index] ||= { current: initial }; },
    useState: initial => {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial === 'operator' ? tab : initial === 'pending' ? state : initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
  };
  const { ApprovalsSection } = load('components/dashboard/admin/ApprovalsSection.tsx', {
    react: mockReact,
    swr: { __esModule: true,
      default: url => ({ data: url.includes('stationKind=operator') ? { shifts: [operatorShift], total: 1 }
        : url.includes('stationKind=master') ? { shifts: [shift], total: 1 } : { approved: [log], total: 1 } }),
      useSWRConfig: () => ({ mutate: async filter => { invalidations.push(filter); } }) },
    'next/link': { __esModule: true, default: props => react.createElement('a', props) },
    'lucide-react': Object.fromEntries(['CheckCircle2', 'RotateCcw', 'Search', 'Trash2', 'X'].map(name => [name, () => null])),
    '@/lib/approval-maintenance': definitions,
    '@/lib/approval-record-label': recordLabel,
    '@/lib/approval-history-query': approvalHistoryQuery,
    '@/lib/shift-crew': { SHIFT_GROUP_OPTIONS: [] },
    '@/components/ui/ToastProvider': { useToast: () => ({ error: message => errors.push(message), success: message => successes.push(message) }) },
    '../HorizontalPagedList': { HorizontalPagedList: props => props.renderPage(props.items) },
    '../dashboard-helpers': { mnDateTimeCompact: value => value },
  });
  const props = {
    adminPendingShifts: [operatorShift, shift], y310PendingApprovals: [log], adminFinalApprovingId: '',
    stations: [{ code: 'ҮЯ-190', name: 'Operator' }, { code: 'ҮЯ-310', name: 'Master' }],
    notStartedOperator: [{ ...schedules.operator_schedule, kind: 'operator', assigneeName: 'Operator', assigneeUid: 'scheduled-operator' }],
    notStartedMaster: [{ ...schedules.master_schedule, kind: 'master', assigneeName: 'Master', assigneeUid: 'scheduled-master' }],
    confirmAsync: async value => { confirmations.push(value); return confirmed; }, handleAdminFinalApproveClick: async () => {},
  };
  function nodes(node) {
    if (node == null || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (typeof node.type === 'function') return nodes(node.type(node.props));
    return [node, ...nodes(node.props?.children)];
  }
  function textOf(node) {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textOf).join('');
    return node?.props ? textOf(node.props.children) : '';
  }
  const render = () => { stateIndex = 0; refIndex = 0; return nodes(ApprovalsSection(props)); };
  return {
    button: label => render().find(node => node.type === 'button' && textOf(node).trim() === label),
    buttons: label => render().filter(node => node.type === 'button' && textOf(node).trim() === label),
    requests, errors, successes, confirmations, invalidations,
    fetch: async (url, options) => { requests.push({ url, ...options }); return { ok: status === 200, status, json: async () => ({ ok: status === 200, error: status === 409 ? 'Stale record' : 'Failed' }) }; },
  };
}

// Жагсаалт бүрийн мөрүүд (дарааллаар) ба тэдний мөр бүрийн үйлдэл хүрэх бүртгэл. Мастер таб нь мастер
// станцын ЭЭЛЖ (kind 'shift') болон мастерын МАЯГТ (kind 'master_form') гэсэн хоёр төрлийн мөртэй.
const expectedRows = {
  'operator/pending': [['shift', operatorShiftId]],
  'operator/approved': [['shift', operatorShiftId]],
  'operator/not_started': [['operator_schedule', scheduleId]],
  'master/pending': [['shift', shiftId], ['master_form', logId]],
  'master/approved': [['shift', shiftId], ['master_form', logId]],
  'master/not_started': [['master_schedule', scheduleId]],
};

test('every operator/master list wires both actions to the correct record ID and scope', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const [key, rows] of Object.entries(expectedRows)) {
      const [tab, state] = key.split('/');
      for (const label of ['Цуцлах', 'Устгах']) {
        assert.equal(uiFixture(tab, state).buttons(label).length, rows.length, `${key}/${label}: one button per row`);
        for (const [index, [kind, id]] of rows.entries()) {
          const ui = uiFixture(tab, state);
          globalThis.fetch = ui.fetch;
          ui.buttons(label)[index].props.onClick();
          await new Promise(setImmediate);
          assert.equal(ui.requests.length, 1, `${key}/${label}/${index}`);
          assert.equal(ui.requests[0].method, label === 'Цуцлах' ? 'PATCH' : 'DELETE');
          assert.deepEqual(JSON.parse(ui.requests[0].body), { kind, state, id }, `${key}/${label}/${index}`);
          assert.equal(ui.successes.length, 1);
          for (const refreshKey of ['/api/shifts?queryType=admin_pending', '/api/y310-approvals?state=approved&page=2', '/api/approvals/not-started', '/api/audit']) {
            assert.equal(ui.invalidations[0](refreshKey), true);
          }
        }
      }
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('declining confirmation sends no mutation; repeated clicks send only one mutation', async () => {
  const originalFetch = globalThis.fetch;
  try {
    const declined = uiFixture('operator', 'approved', { confirmed: false });
    globalThis.fetch = declined.fetch;
    declined.button('Устгах').props.onClick();
    await new Promise(setImmediate);
    assert.equal(declined.requests.length, 0);
    assert.equal(declined.successes.length, 0);
    const repeated = uiFixture('operator', 'approved');
    globalThis.fetch = repeated.fetch;
    const button = repeated.button('Цуцлах');
    button.props.onClick();
    button.props.onClick();
    assert.equal(repeated.button('Устгах').props.disabled, true);
    await new Promise(setImmediate);
    assert.equal(repeated.requests.length, 1);
    assert.equal(repeated.button('Устгах').props.disabled, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('stale-row conflicts refresh the UI and show an error without claiming success', async () => {
  const originalFetch = globalThis.fetch;
  try {
    const ui = uiFixture('master', 'approved', { status: 409 });
    globalThis.fetch = ui.fetch;
    ui.button('Устгах').props.onClick();
    await new Promise(setImmediate);
    assert.deepEqual(ui.errors, ['Stale record']);
    assert.equal(ui.successes.length, 0);
    assert.equal(ui.invalidations.length, 1);
    assert.equal(ui.button('Устгах').props.disabled, false);
  } finally { globalThis.fetch = originalFetch; }
});
