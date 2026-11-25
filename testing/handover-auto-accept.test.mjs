// Автомат хүлээн авалт: дараагийн оператор «Хүлээн авах» товчийг дараагүй ч тухайн дамжлагад ӨӨРИЙН ээлжээ
// эхлүүлэхэд түүнд хүлээлгэн өгсөн өмнөх ээлжүүд хүлээн авсанд тооцогдож, админы баталгаажуулалтад очно.
// Шалтгаан: PC-2 дээр 60 хоногт 105 ээлж `waiting_next_operator` шатанд гацсан (2026-11); мастер бүгдийг
// баталсан, 59-д нь дараагийн оператор тэр дамжлагад өөрийн ээлжээ бүртгэсэн байв.
//
//   node --test --test-isolation=none testing/handover-auto-accept.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { loadSource, masterStations, projectRoot } from './helpers/approval-routes.mjs';

const lib = loadSource('lib/handover-auto-accept.ts');
const {
  AUTO_ACCEPT_COMMENT, AUTO_ACCEPT_NAME_SUFFIX, autoAcceptData, autoAcceptHandoversOnShiftStart,
  autoAcceptedMessage, compareShiftSlots, isAutoAcceptable,
} = lib;
const read = (file) => fs.readFileSync(path.join(projectRoot, file), 'utf8');

const NEXT = { id: 'op-next', name: 'Очирбат БИЛЭГСАЙХАН', role: 'operator', stationCode: 'ҮЯ-190' };
// Дараагийн операторын шинээр эхлүүлж буй ээлж.
const STARTED = { operatorUid: NEXT.id, operatorName: NEXT.name, stationCode: 'ҮЯ-190', shiftDate: '2026-11-11', shiftType: 'Өдрийн' };
// Мастер баталсан, дараагийн операторыг хүлээж буй өмнөх ээлж.
const pending = (id, over = {}) => ({
  id, operatorUid: 'op-prev', operatorName: 'Батбилэг НАМХАЙ', shiftMasterUid: 'master-1', stationCode: 'ҮЯ-190',
  shiftDate: '2026-11-10', shiftType: 'Шөнийн', status: 'Хадгалсан', adminApproved: false, masterApproved: false,
  handoverStage: 'waiting_next_operator', handoverAwaitingAcceptance: true, nextOperatorUid: NEXT.id,
  currentMasterApprovedAt: '2026-11-11T00:10:00.000Z', currentMasterApprovedByName: 'Давхарбаяр ЭНХБААТАР',
  currentMasterName: 'Давхарбаяр ЭНХБААТАР', createdAt: 1, ...over,
});

/** Prisma `where`-ийн энд хэрэглэгддэг хэсэг: тэнцүү, `not`, `in`, `notIn`. */
function matches(row, where = {}) {
  return Object.entries(where).every(([key, condition]) => {
    if (condition && typeof condition === 'object') {
      if ('notIn' in condition) return !condition.notIn.includes(row[key]);
      if ('in' in condition) return condition.in.includes(row[key]);
      if ('not' in condition) return row[key] !== condition.not;
    }
    return row[key] === condition;
  });
}

function fakeDb(rows, { ignoreWhere = false, beforeUpdate } = {}) {
  const calls = { findMany: [], updateMany: [] };
  const approvals = [];
  return {
    rows, calls, approvals,
    shift: {
      findMany: async (args) => {
        calls.findMany.push(args);
        return rows.filter((row) => ignoreWhere || matches(row, args.where)).map((row) => ({ ...row }));
      },
      updateMany: async (args) => {
        calls.updateMany.push(args);
        beforeUpdate?.(args);
        const row = rows.find((candidate) => matches(candidate, args.where));
        if (!row) return { count: 0 };
        Object.assign(row, args.data);
        return { count: 1 };
      },
    },
    shiftHandoverApproval: { create: async ({ data }) => { approvals.push(data); return data; } },
  };
}

// ─────────────────────────────────────────────── дүрэм ───────────────────────────────────────────────

test('slot order: by date, then Өдрийн before Шөнийн', () => {
  const slot = (shiftDate, shiftType) => ({ shiftDate, shiftType });
  assert.ok(compareShiftSlots(slot('2026-11-10', 'Шөнийн'), slot('2026-11-11', 'Өдрийн')) < 0);
  assert.ok(compareShiftSlots(slot('2026-11-11', 'Өдрийн'), slot('2026-11-11', 'Шөнийн')) < 0);
  assert.ok(compareShiftSlots(slot('2026-11-11', 'Шөнийн'), slot('2026-11-11', 'Өдрийн')) > 0);
  assert.equal(compareShiftSlots(slot('2026-11-11', 'Өдрийн'), slot('2026-11-11', ' өдрийн ')), 0);
  assert.ok(compareShiftSlots(slot('2026-09-28', 'Шөнийн'), slot('2026-11-11', 'Өдрийн')) < 0, 'old backlog is earlier too');
});

test('only an earlier shift handed over to THIS operator at THIS station is auto-accepted', () => {
  assert.equal(isAutoAcceptable(pending('p'), STARTED), true);
  assert.equal(isAutoAcceptable(pending('p', { shiftDate: '2026-09-28', shiftType: 'Өдрийн' }), STARTED), true, 'backlog');

  const no = [
    ['handed over to someone else', { nextOperatorUid: 'op-other' }],
    ['no next operator chosen', { nextOperatorUid: null }],
    ['another station', { stationCode: 'ҮЯ-160' }],
    ['same slot as the new shift', { shiftDate: '2026-11-11', shiftType: 'Өдрийн' }],
    ['a later slot', { shiftDate: '2026-11-11', shiftType: 'Шөнийн' }],
    ['master has not approved yet', { handoverStage: 'waiting_current_master' }],
    ['waiting for the next master', { handoverStage: 'waiting_next_master' }],
    ['already accepted', { handoverStage: 'accepted', handoverAwaitingAcceptance: false }],
    ['returned by the next operator', { handoverStage: 'returned', handoverAwaitingAcceptance: false }],
    ['admin approved', { adminApproved: true }],
    ['cancelled', { status: 'Цуцлагдсан' }],
    ['the operator\'s own shift', { operatorUid: NEXT.id }],
  ];
  for (const [label, over] of no) assert.equal(isAutoAcceptable(pending('p', over), STARTED), false, label);
  assert.equal(isAutoAcceptable(pending('p'), { ...STARTED, operatorUid: '' }), false);
});

test('accept data mirrors the manual «Хүлээн авах»: accepted, master approval locked, name marked automatic', () => {
  const now = '2026-11-11T00:30:00.000Z';
  assert.deepEqual(autoAcceptData(pending('p'), NEXT, now), {
    handoverStage: 'accepted',
    handoverAwaitingAcceptance: false,
    handoverAcceptedByUid: 'op-next',
    handoverAcceptedByName: 'Очирбат БИЛЭГСАЙХАН (автоматаар)',
    handoverAcceptedAt: now,
    handoverFinalAcceptedAt: now,
    masterApproved: true,
    masterApprovedBy: 'Давхарбаяр ЭНХБААТАР',
    masterApprovedDate: '2026-11-11T00:10:00.000Z',
  });
  assert.equal(AUTO_ACCEPT_NAME_SUFFIX, ' (автоматаар)');

  const alreadyApproved = autoAcceptData(pending('p', { masterApproved: true }), NEXT, now);
  assert.ok(!('masterApproved' in alreadyApproved) && !('masterApprovedBy' in alreadyApproved), 'existing approval is not rewritten');
  const noMasterStamp = autoAcceptData(pending('p', { currentMasterApprovedAt: null }), NEXT, now);
  assert.ok(!('masterApproved' in noMasterStamp), 'no approval is invented without the master\'s stamp');
  assert.equal(autoAcceptData(pending('p'), { id: 'op-next', name: null }, now).handoverAcceptedByName, 'op-next (автоматаар)');
  const byMasterName = autoAcceptData(pending('p', { currentMasterApprovedByName: null }), NEXT, now);
  assert.equal(byMasterName.masterApprovedBy, 'Давхарбаяр ЭНХБААТАР', 'falls back to the assigned master');

  // PATCH-ийн `waiting_next_operator` салбартай ижил талбарууд — нэг нь өөрчлөгдвөл нөгөөг нь мөн өөрчил.
  const patch = read('app/api/shifts/[id]/route.ts');
  // Сүүлийн тохиолдол нь хүлээн авах салбар (эхнийх нь мэдэгдлийн хүлээн авагчдыг сонгодог).
  const branch = patch.slice(patch.lastIndexOf("} else if (stage === 'waiting_next_operator') {"));
  const manual = branch.slice(0, branch.indexOf('} else {'));
  assert.ok(manual.includes('Дараагийн оператор хүлээн авах эрхгүй'), 'found the manual accept branch');
  for (const key of Object.keys(autoAcceptData(pending('p'), NEXT, now))) {
    assert.ok(manual.includes(`data.${key} =`), `manual accept also sets ${key}`);
  }
});

test('message for the operator who started the shift', () => {
  assert.equal(autoAcceptedMessage([]), '');
  assert.equal(autoAcceptedMessage(undefined), '');
  assert.equal(
    autoAcceptedMessage([{ shiftDate: '2026-11-10', shiftType: 'Шөнийн', operatorName: 'Батбилэг НАМХАЙ' }]),
    'Өмнөх ээлжийг (2026-11-10 Шөнийн, Батбилэг НАМХАЙ) хүлээн авсанд тооцлоо.',
  );
  assert.equal(
    autoAcceptedMessage([{ shiftDate: '2026-11-10', shiftType: 'Шөнийн' }, { shiftDate: '2026-10-21', shiftType: 'Өдрийн' }, { shiftDate: '2026-11-02', shiftType: 'Өдрийн' }]),
    'Танд хүлээлгэн өгсөн өмнөх 3 ээлжийг (2026-10-21 – 2026-11-10) хүлээн авсанд тооцлоо.',
  );
});

// ─────────────────────────────────────────────── DB алхмууд ───────────────────────────────────────────────

test('starting a shift accepts the pending handovers, backlog included, and records each one', async () => {
  const db = fakeDb([
    pending('p-new'),
    pending('p-old', { shiftDate: '2026-10-21', shiftType: 'Өдрийн', masterApproved: true }),
    pending('p-other-person', { nextOperatorUid: 'op-other' }),
    pending('p-other-station', { stationCode: 'ҮЯ-160' }),
    pending('p-later', { shiftDate: '2026-11-11', shiftType: 'Шөнийн' }),
    pending('p-master-pending', { handoverStage: 'waiting_current_master' }),
  ]);
  const now = '2026-11-11T00:30:00.000Z';
  const accepted = await autoAcceptHandoversOnShiftStart(db, STARTED, now);

  assert.deepEqual(accepted.map((row) => row.id).sort(), ['p-new', 'p-old']);
  assert.deepEqual(db.calls.findMany[0].where, {
    stationCode: 'ҮЯ-190', handoverStage: 'waiting_next_operator', handoverAwaitingAcceptance: true,
    nextOperatorUid: 'op-next', operatorUid: { not: 'op-next' }, status: { in: ['Хадгалсан', 'Ноорог'] }, adminApproved: false,
  });
  const byId = Object.fromEntries(db.rows.map((row) => [row.id, row]));
  for (const id of ['p-new', 'p-old']) {
    assert.equal(byId[id].handoverStage, 'accepted');
    assert.equal(byId[id].handoverAwaitingAcceptance, false);
    assert.equal(byId[id].handoverAcceptedByName, 'Очирбат БИЛЭГСАЙХАН (автоматаар)');
    assert.equal(byId[id].handoverFinalAcceptedAt, now);
    assert.equal(byId[id].masterApproved, true, 'now matches the admin_pending predicate');
  }
  for (const id of ['p-other-person', 'p-other-station', 'p-later', 'p-master-pending']) {
    assert.equal(byId[id].handoverAwaitingAcceptance, true, `${id} is untouched`);
    assert.notEqual(byId[id].handoverStage, 'accepted');
  }
  assert.deepEqual(db.approvals.map((a) => [a.shiftId, a.stage, a.action, a.actorUid, a.actorName, a.comment]).sort(), [
    ['p-new', 'waiting_next_operator', 'accepted', 'op-next', 'Очирбат БИЛЭГСАЙХАН', AUTO_ACCEPT_COMMENT],
    ['p-old', 'waiting_next_operator', 'accepted', 'op-next', 'Очирбат БИЛЭГСАЙХАН', AUTO_ACCEPT_COMMENT],
  ]);
  assert.ok(AUTO_ACCEPT_COMMENT.includes('Автоматаар хүлээн авсан'));
});

test('the rule is re-checked on every row, and a handover decided meanwhile is not overwritten', async () => {
  // Query filter ignored on purpose: only the acceptable row may be touched.
  const loose = fakeDb([pending('ok'), pending('later', { shiftDate: '2026-11-12' }), pending('other', { nextOperatorUid: 'op-other' })], { ignoreWhere: true });
  assert.deepEqual((await autoAcceptHandoversOnShiftStart(loose, STARTED)).map((row) => row.id), ['ok']);
  assert.equal(loose.calls.updateMany.length, 1);

  // Between the read and the update the next operator pressed «Буцаах».
  const raced = fakeDb([pending('p-raced')], {
    beforeUpdate: () => Object.assign(raced.rows[0], { handoverStage: 'returned', handoverAwaitingAcceptance: false }),
  });
  assert.deepEqual(await autoAcceptHandoversOnShiftStart(raced, STARTED), []);
  assert.deepEqual(raced.calls.updateMany[0].where, { id: 'p-raced', handoverStage: 'waiting_next_operator', handoverAwaitingAcceptance: true });
  assert.equal(raced.rows[0].handoverStage, 'returned', 'the manual decision wins');
  assert.equal(raced.approvals.length, 0);

  assert.deepEqual(await autoAcceptHandoversOnShiftStart(fakeDb([pending('p')]), { ...STARTED, operatorUid: '' }), []);
});

// ─────────────────────────────────────────────── POST /api/shifts ───────────────────────────────────────────────

function shiftsPost({ actor = NEXT, shifts = [], failAutoAccept = false } = {}) {
  const audits = [];
  const notifications = [];
  const db = fakeDb(shifts);
  const autoAcceptFind = db.shift.findMany;
  const prisma = {
    shift: {
      ...db.shift,
      findMany: async (args) => {
        if (failAutoAccept && args?.where?.handoverStage === 'waiting_next_operator') throw new Error('db down');
        return autoAcceptFind(args);
      },
      findFirst: async (args) => shifts.filter((row) => matches(row, args.where)).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null,
      create: async ({ data }) => { const row = { id: 'new-shift', createdAt: 99, ...data }; shifts.push(row); return row; },
    },
    shiftHandoverApproval: db.shiftHandoverApproval,
    operatorSchedule: { findMany: async () => [], findFirst: async () => null },
  };
  const route = loadSource('app/api/shifts/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, json: async () => body }) } },
    'next-auth/next': { getServerSession: async () => ({ user: actor }) },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/prisma': { prisma },
    '@/lib/shift-db': {
      STATION_NAME_BY_CODE: { 'ҮЯ-190': 'Чанар шалгагч' },
      FORM_KEY_BY_STATION: { 'ҮЯ-190': 'y190HandoverForm' },
      decomposePayload: () => ({}),
      toShiftClientPayload: (shift) => shift,
    },
    '@/lib/server-audit': { writeServerAuditLog: async (entry) => { audits.push(entry); } },
    '@/lib/server-notifications': { notifyManyDeduped: async (userIds, input) => { notifications.push({ userIds, ...input }); return []; } },
    '@/lib/handover-auto-accept': lib,
    '@/lib/shift-api-permissions': loadSource('lib/shift-api-permissions.ts'),
    '@/lib/device-access': { getDeviceAccessForRequest: async () => ({ allowed: true }), deviceForbiddenResponse: () => ({ status: 403 }) },
    '@/lib/dispatcher-compliance': { resolveDispatcherCompliance: async () => ({}) },
    '@/lib/master-stations': masterStations,
    '@/lib/master-pending': { masterApprovalPendingWhere: () => ({}) },
    '@/lib/handover-window': { isoDateInTimeZone: () => '2026-11-11' },
    '@/lib/crew-master': { crewOperatorUids: async () => null, resolveCrewMasterForShift: async () => null },
    '@/lib/approval-history-query': loadSource('lib/approval-history-query.ts', { './master-stations': masterStations }),
  });
  const post = async (body = { ...STARTED, status: 'Хадгалсан' }) => {
    const response = await route.POST(new Request('http://localhost/api/shifts', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }));
    return { status: response.status, body: await response.json() };
  };
  return { post, db, audits, notifications, shifts };
}

test('POST: the next operator starts a shift → earlier handovers are accepted, reported, audited and notified', async () => {
  const api = shiftsPost({ shifts: [
    pending('p-new'),
    pending('p-old', { shiftDate: '2026-10-21', shiftType: 'Өдрийн', operatorUid: 'op-prev-2', operatorName: 'Батсүх БАТБИЛЭГ', shiftMasterUid: null }),
    pending('p-other-person', { nextOperatorUid: 'op-other' }),
  ] });
  const { status, body } = await api.post();
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.id, 'new-shift');
  assert.deepEqual([...body.autoAcceptedHandovers].sort((a, b) => a.id.localeCompare(b.id)), [
    { id: 'p-new', shiftDate: '2026-11-10', shiftType: 'Шөнийн', operatorName: 'Батбилэг НАМХАЙ' },
    { id: 'p-old', shiftDate: '2026-10-21', shiftType: 'Өдрийн', operatorName: 'Батсүх БАТБИЛЭГ' },
  ]);
  const row = (id) => api.shifts.find((shift) => shift.id === id);
  assert.equal(row('p-new').handoverStage, 'accepted');
  assert.equal(row('p-old').handoverStage, 'accepted');
  assert.equal(row('p-other-person').handoverStage, 'waiting_next_operator');
  assert.equal(api.db.approvals.length, 2);

  const autoAudits = api.audits.filter((entry) => entry.action === 'shift_handover_auto_accepted');
  assert.deepEqual(autoAudits.map((entry) => entry.entityId).sort(), ['p-new', 'p-old']);
  assert.ok(autoAudits.every((entry) => entry.actorUid === 'op-next' && entry.details.includes('new-shift')));
  assert.ok(api.audits.some((entry) => entry.action === 'shift_created'), 'the normal creation audit is kept');

  const notice = (id) => api.notifications.find((n) => n.link === `/shift/${id}`);
  assert.deepEqual(notice('p-new').userIds, ['op-prev', 'master-1'], 'previous operator and the shift master');
  assert.deepEqual(notice('p-old').userIds, ['op-prev-2'], 'no master on the shift → operator only');
  assert.equal(notice('p-new').kind, 'handover_accepted');
  assert.equal(notice('p-new').dedupeKey, 'handover_accepted:p-new');
  assert.equal(notice('p-new').body, 'ҮЯ-190 (2026-11-10, Шөнийн) — Хүлээн авсан: Очирбат БИЛЭГСАЙХАН (автоматаар)');
});

test('POST: nothing pending → plain start; an admin creating the shift for the operator does not accept for them', async () => {
  const plain = shiftsPost({ shifts: [pending('p-other-person', { nextOperatorUid: 'op-other' })] });
  const started = await plain.post();
  assert.equal(started.status, 200);
  assert.deepEqual(started.body.autoAcceptedHandovers, []);
  assert.equal(plain.notifications.length, 0);

  const admin = shiftsPost({ actor: { id: 'admin-1', name: 'Админ', role: 'admin' }, shifts: [pending('p-new')] });
  const created = await admin.post();
  assert.equal(created.status, 200);
  assert.deepEqual(created.body.autoAcceptedHandovers, []);
  assert.equal(admin.shifts.find((shift) => shift.id === 'p-new').handoverStage, 'waiting_next_operator');
});

test('POST: a failure while accepting never blocks starting the shift', async () => {
  const api = shiftsPost({ shifts: [pending('p-new')], failAutoAccept: true });
  const originalError = console.error;
  console.error = () => {};
  try {
    const { status, body } = await api.post();
    assert.equal(status, 200);
    assert.equal(body.id, 'new-shift');
    assert.deepEqual(body.autoAcceptedHandovers, []);
  } finally {
    console.error = originalError;
  }
  assert.equal(api.shifts.find((shift) => shift.id === 'p-new').handoverStage, 'waiting_next_operator', 'still acceptable by hand');
});

// ─────────────────────────────────────────────── холболт (wiring) ───────────────────────────────────────────────

test('wiring: the route accepts only for a self-started operator shift; the start page tells the operator', () => {
  const route = read('app/api/shifts/route.ts');
  const created = route.indexOf('const shift = await prisma.shift.create({ data });');
  const call = route.indexOf("actor.role === 'operator' && actor.id === operatorUid\n        ? await autoAcceptPreviousHandovers(");
  assert.ok(created >= 0 && call > created, 'runs after the shift exists');
  assert.ok(route.includes('return NextResponse.json({ ok: true, id: shift.id, autoAcceptedHandovers });'));

  const page = read('app/shift/new/page.tsx');
  assert.ok(page.includes("import { autoAcceptedMessage } from '@/lib/handover-auto-accept'"));
  assert.ok(page.includes('const autoAccepted = autoAcceptedMessage(data.autoAcceptedHandovers);'));
  assert.ok(page.includes("if (autoAccepted) toast.show({ message: autoAccepted, title: 'Ээлж хүлээн авлаа', variant: 'info', durationMs: 9000 });"));

  const helpers = read('components/dashboard/dashboard-helpers.ts');
  assert.equal(helpers.split("shift_handover_auto_accepted").length - 1, 2, 'audit label in both tables');
});
