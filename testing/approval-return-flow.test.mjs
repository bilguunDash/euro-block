import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { approvalRoutes, invoke, masterStations } from './helpers/approval-routes.mjs';

const shiftId = '11111111-1111-4111-8111-111111111111';
const logId = '22222222-2222-4222-8222-222222222222';
const oldLogId = '33333333-3333-4333-8333-333333333333';
const logType = 'modal_y310_repair_master_form';
const users = [
  { id: 'owner', name: 'Same name', role: 'operator', stationCode: 'ҮЯ-110', isApproved: true },
  { id: 'other', name: 'Same name', role: 'operator', stationCode: 'ҮЯ-310', isApproved: true },
  { id: 'master-owner', name: 'Master owner', role: 'master', stationCode: 'ҮЯ-310', isApproved: true },
  { id: 'review-master', name: 'Review master', role: 'master', stationCode: 'ҮЯ-099', isApproved: true },
  { id: 'next-master', name: 'Next master', role: 'master', stationCode: 'ҮЯ-310', isApproved: true },
  { id: 'admin', name: 'Admin', role: 'admin', isApproved: true },
];

function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(condition => matches(row, condition));
    if (value && typeof value === 'object') {
      if ('not' in value) return row[key] !== value.not;
      if ('in' in value) return value.in.includes(row[key]);
      if ('equals' in value) return JSON.stringify(row[key]) === JSON.stringify(value.equals);
    }
    return (row[key] ?? null) === value;
  });
}

function fixture({ masterOwner = false, notificationFailure = false, formType = logType } = {}) {
  let actor = users.find(user => user.id === 'admin');
  const owner = users.find(user => user.id === (masterOwner ? 'master-owner' : 'owner'));
  let state = {
    shifts: [{ id: shiftId, operatorUid: owner.id, operatorName: owner.name, stationCode: 'ҮЯ-310',
      shiftDate: '2026-09-28', shiftType: 'Өдрийн', status: 'Баталгаажсан', createdAt: new Date(),
      adminApproved: true, masterApproved: true, operatorShiftCompleted: true,
      adminApprovedBy: 'Old admin', masterApprovedBy: 'Old master', shiftMasterUid: 'review-master',
      handoverStage: 'accepted', currentMasterApprovedAt: '2026-09-28T10:00:00Z',
      handoverFinalAcceptedAt: '2026-09-28T12:00:00Z', handoverAwaitingAcceptance: false,
      checkIn: '2026-09-28T00:00:00Z', checkOut: '2026-09-28T12:00:00Z', notes: 'Original note' }],
    logs: [oldLogId, logId].map((id, sortOrder) => ({ id, shiftId, logType: formType, sortOrder, createdAt: new Date('2026-09-28T10:00:00Z'),
      data: { needsAdminApproval: true, adminApproved: true, adminApprovedBy: 'Old admin', notes: `Original ${sortOrder}` } })),
    audits: [], notifications: [], events: [], hseLogs: [],
  };
  function database(getState) {
    const model = key => ({
      findUnique: async ({ where }) => structuredClone(getState()[key].find(row => matches(row, where)) || null),
      findFirst: async ({ where }) => structuredClone(getState()[key].filter(row => matches(row, where)).sort((a, b) => b.sortOrder - a.sortOrder)[0] || null),
      findMany: async ({ where }) => structuredClone(getState()[key].filter(row => matches(row, where))),
      create: async ({ data }) => {
        const row = { id: randomUUID(), createdAt: new Date(), ...structuredClone(data) };
        getState()[key].push(row); return structuredClone(row);
      },
      update: async ({ where, data }) => {
        const row = getState()[key].find(row => matches(row, where));
        assert.ok(row, 'cannot update a missing row'); Object.assign(row, structuredClone(data)); return structuredClone(row);
      },
      updateMany: async ({ where, data }) => {
        const rows = getState()[key].filter(row => matches(row, where));
        for (const row of rows) Object.assign(row, structuredClone(data));
        return { count: rows.length };
      },
      delete: async ({ where }) => {
        const row = getState()[key].find(row => matches(row, where));
        assert.ok(row); getState()[key] = getState()[key].filter(value => value !== row);
        if (key === 'shifts') { getState().logs = getState().logs.filter(log => log.shiftId !== row.id); getState().events = []; }
        return row;
      },
      deleteMany: async ({ where }) => {
        const remaining = getState()[key].filter(row => !matches(row, where));
        const count = getState()[key].length - remaining.length; getState()[key] = remaining; return { count };
      },
    });
    const shift = model('shifts');
    const originalFind = shift.findUnique;
    shift.findUnique = async args => {
      const row = await originalFind(args);
      return row && { ...row, productionLogs: structuredClone(getState().logs.filter(log => log.shiftId === row.id)) };
    };
    return {
      shift, productionLog: model('logs'), auditLog: model('audits'), shiftHandoverApproval: model('events'), hseLog: model('hseLogs'),
      notification: { create: async args => { if (notificationFailure) throw new Error('Notification failed'); return model('notifications').create(args); } },
      user: {
        findUnique: async ({ where }) => users.find(user => matches(user, where)) || null,
        findMany: async ({ where }) => users.filter(user => matches(user, where)),
      },
      // SQL itself is checked against PostgreSQL in the integration suite.
      $queryRawUnsafe: async (_sql, allowedTypes, id) => {
        const log = getState().logs.find(row => row.id === id);
        const shiftRow = getState().shifts.find(row => row.id === log?.shiftId);
        const latest = log && !getState().logs.some(row => row.shiftId === log.shiftId && row.logType === log.logType && row.sortOrder > log.sortOrder);
        return log && latest && allowedTypes.includes(log.logType) && log.data.needsAdminApproval && !log.data.adminApproved && !log.data.adminRejected &&
          shiftRow && !shiftRow.adminApproved && !shiftRow.masterApproved ? [{ id }] : [];
      },
    };
  }
  const prisma = database(() => state);
  prisma.$transaction = async callback => {
    const draft = structuredClone(state);
    const result = await callback(database(() => draft)); state = draft; return result;
  };
  return {
    api: approvalRoutes(prisma, () => actor), state: () => structuredClone(state),
    actAs: id => { actor = users.find(user => user.id === id); assert.ok(actor); }, owner,
  };
}

async function expectStatus(response, status) {
  assert.equal(response.status, status, JSON.stringify(await response.clone().json()));
  return response.json();
}
const maintain = (fixture, kind = 'shift', action = 'PATCH') => invoke(fixture.api.manage[action], {
  kind, id: kind === 'shift' ? shiftId : logId, state: 'approved',
}, undefined, action);
const patch = (fixture, body) => invoke(fixture.api.shift.PATCH, body, shiftId);
const save = (fixture, data, extra = {}) => invoke(fixture.api.logs.POST, { type: logType, mode: 'submit', data, ...extra }, shiftId, 'POST');

test('cancel returns to the original UID, preserving ownership/content even after station changes and duplicate names', async () => {
  const f = fixture();
  f.actAs('owner'); await expectStatus(await patch(f, { notes: 'Locked' }), 403);
  f.actAs('admin'); await expectStatus(await maintain(f), 200);
  const notification = f.state().notifications[0];
  assert.equal(notification.userId, 'owner'); assert.equal(notification.link, `/shift/${shiftId}`);
  f.actAs('owner');
  const { shift } = await expectStatus(await invoke(f.api.shift.GET, null, shiftId, 'GET'), 200);
  assert.equal(shift.operatorUid, 'owner'); assert.equal(shift.handoverStage, 'returned');
  assert.equal(shift.modalLogs.find(log => log.id === logId).data.notes, 'Original 1');
  await expectStatus(await patch(f, { notes: 'Corrected by original owner' }), 200);
  assert.equal(f.state().shifts[0].notes, 'Corrected by original owner');
  assert.equal(f.state().shifts[0].checkOut, '2026-09-28T12:00:00Z');
});

test('a different operator cannot edit, submit or start handover for the returned record', async () => {
  const f = fixture(); await expectStatus(await maintain(f), 200); f.actAs('other');
  const before = f.state();
  await expectStatus(await patch(f, { notes: 'Wrong owner' }), 403);
  await expectStatus(await save(f, { notes: 'Wrong owner', needsAdminApproval: true }), 403);
  await expectStatus(await patch(f, { handoverAwaitingAcceptance: true, confirmMasterUid: 'review-master' }), 403);
  assert.deepEqual(f.state(), before);
});

test('operator cancel → edit → resubmit → assigned master → next operator → final admin approval', async () => {
  const f = fixture(); await expectStatus(await maintain(f), 200); f.actAs('owner');
  const previousData = f.state().logs.find(log => log.id === logId).data;
  const saved = await expectStatus(await save(f, { ...previousData, notes: 'Corrected form', adminApproved: true }), 200);
  assert.equal(saved.id, logId); assert.equal(saved.updated, true); assert.equal(f.state().logs.length, 2);
  assert.equal(f.state().logs.find(log => log.id === logId).data.adminApproved, undefined);
  assert.equal(f.state().logs.find(log => log.id === logId).data.adminRejected, undefined);
  await expectStatus(await patch(f, { handoverAwaitingAcceptance: true, operatorShiftCompleted: true, confirmMasterUid: 'review-master', nextOperatorUid: 'other' }), 200);
  assert.equal(f.state().shifts[0].handoverStage, 'waiting_current_master');
  f.actAs('admin'); await expectStatus(await patch(f, { adminApproved: true, status: 'Баталгаажсан' }), 403);
  f.actAs('next-master'); await expectStatus(await patch(f, { handoverAwaitingAcceptance: false, handoverAcceptedAt: new Date().toISOString() }), 403);
  f.actAs('review-master'); await expectStatus(await patch(f, { handoverAwaitingAcceptance: false, handoverAcceptedAt: new Date().toISOString() }), 200);
  assert.equal(f.state().shifts[0].handoverStage, 'waiting_next_operator'); assert.equal(f.state().shifts[0].masterApproved, false);
  f.actAs('admin'); await expectStatus(await patch(f, { adminApproved: true, status: 'Баталгаажсан' }), 403);
  f.actAs('other'); await expectStatus(await patch(f, { handoverAwaitingAcceptance: false, handoverAcceptedAt: new Date().toISOString() }), 200);
  assert.equal(f.state().shifts[0].handoverStage, 'accepted'); assert.equal(f.state().shifts[0].masterApproved, true);
  f.actAs('admin'); await expectStatus(await patch(f, { adminApproved: true, status: 'Баталгаажсан' }), 200);
  f.actAs('owner'); await expectStatus(await patch(f, { notes: 'Edit after approval' }), 403);
  assert.equal(f.state().shifts[0].operatorUid, 'owner'); assert.equal(f.state().shifts[0].adminApproved, true);
});

test('returned records cannot bypass resubmission with a direct master/admin approval', async () => {
  const f = fixture(); await expectStatus(await maintain(f), 200);
  const before = f.state();
  await expectStatus(await patch(f, { adminApproved: true, status: 'Баталгаажсан' }), 403);
  f.actAs('review-master'); await expectStatus(await patch(f, { masterApproved: true }), 403);
  assert.deepEqual(f.state(), before);
});

test('master-owned shift returns to that master and repeats the next-master and admin approval steps', async () => {
  const f = fixture({ masterOwner: true }); await expectStatus(await maintain(f), 200);
  assert.equal(f.state().notifications[0].userId, 'master-owner'); f.actAs('master-owner');
  await expectStatus(await save(f, { needsAdminApproval: true, notes: 'Master corrected form' }), 200);
  await expectStatus(await patch(f, { handoverAwaitingAcceptance: true, operatorShiftCompleted: true, nextMasterUid: 'next-master', approvalAdminUid: 'admin' }), 200);
  assert.equal(f.state().shifts[0].handoverStage, 'waiting_next_master');
  f.actAs('admin'); await expectStatus(await patch(f, { adminApproved: true, status: 'Баталгаажсан' }), 403);
  f.actAs('next-master'); await expectStatus(await patch(f, { handoverAwaitingAcceptance: false, handoverAcceptedAt: new Date().toISOString() }), 200);
  f.actAs('admin'); await expectStatus(await patch(f, { adminApproved: true, status: 'Баталгаажсан' }), 200);
  assert.equal(f.state().shifts[0].operatorUid, 'master-owner'); assert.equal(f.state().shifts[0].adminApproved, true);
});

test('cancelled master form must be corrected before it can receive a fresh form approval', async () => {
  const f = fixture({ masterOwner: true }); await expectStatus(await maintain(f, 'master_form'), 200);
  await expectStatus(await invoke(f.api.forms.PATCH, { logId, action: 'approve' }), 409);
  f.actAs('master-owner');
  const data = f.state().logs.find(log => log.id === logId).data;
  await expectStatus(await save(f, { ...data, notes: 'Revised master form' }), 200);
  f.actAs('admin'); await expectStatus(await invoke(f.api.forms.PATCH, { logId, action: 'approve' }), 200);
  assert.equal(f.state().logs.find(log => log.id === logId).data.adminApproved, true);
  assert.equal(f.state().logs.find(log => log.id === oldLogId).data.adminRejected, true);
  assert.equal(f.state().logs.find(log => log.id === logId).data.notes, 'Revised master form');
});

test('deleted shift returns 404 for owner read, edit and form save; repeated deletion cannot revive it', async () => {
  const f = fixture(); await expectStatus(await maintain(f, 'shift', 'DELETE'), 200);
  await expectStatus(await maintain(f, 'shift', 'DELETE'), 404); f.actAs('owner');
  await expectStatus(await invoke(f.api.shift.GET, null, shiftId, 'GET'), 404);
  await expectStatus(await patch(f, { notes: 'Restore' }), 404);
  await expectStatus(await save(f, { notes: 'Restore' }), 404);
  assert.equal(f.state().shifts.length, 0); assert.equal(f.state().logs.length, 0);
  assert.equal(f.state().audits.length, 1); assert.equal(f.state().notifications.length, 0);
});

test('deleted master form removes every version; stale edit fails, and a new form gets a new unapproved ID', async () => {
  const f = fixture({ masterOwner: true }); await expectStatus(await maintain(f, 'master_form', 'DELETE'), 200);
  assert.equal(f.state().logs.length, 0); assert.equal(f.state().shifts.length, 1); f.actAs('master-owner');
  await expectStatus(await save(f, { notes: 'Stale edit' }, { editId: logId }), 404);
  const created = await expectStatus(await save(f, { needsAdminApproval: true, notes: 'New form' }), 200);
  assert.notEqual(created.id, logId); assert.notEqual(created.id, oldLogId);
  assert.equal(f.state().logs.length, 1); assert.equal(f.state().logs[0].data.adminApproved, undefined);
});

test('notification failure rolls back return, approval flags, event and audit together', async () => {
  const f = fixture({ notificationFailure: true }); const before = f.state();
  const originalError = console.error; console.error = () => {};
  try { await expectStatus(await maintain(f), 500); } finally { console.error = originalError; }
  assert.deepEqual(f.state(), before);
});

test('every configured master form supports cancel → owner correction and deletion of all versions', async () => {
  for (const formType of masterStations.ADMIN_APPROVAL_LOG_TYPES) {
    const f = fixture({ masterOwner: true, formType });
    await expectStatus(await maintain(f, 'master_form'), 200); f.actAs('master-owner');
    await expectStatus(await invoke(f.api.logs.POST, { type: formType, data: { needsAdminApproval: true, notes: 'Corrected' } }, shiftId, 'POST'), 200);
    assert.equal(f.state().logs.find(log => log.id === logId).data.adminRejected, undefined, formType);
    assert.equal(f.state().logs.length, 2, formType);
    const deleting = fixture({ masterOwner: true, formType });
    await expectStatus(await maintain(deleting, 'master_form', 'DELETE'), 200);
    assert.equal(deleting.state().logs.length, 0, formType);
    assert.equal(deleting.state().shifts[0].operatorUid, 'master-owner', formType);
  }
});
