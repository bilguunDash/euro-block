// Давхар ээлж: оператор ижил огноо + ээлж + дамжлага дээр хоёр дахь ээлж эхлүүлж чадахгүй (хуваарьгүй
// ч гэсэн), «Шинэ ээлж эхлүүлэх» хуудас өмнөх бүртгэл рүү нь шилжүүлнэ. Мөн хүлээлгэн өгөх цонхонд
// маягтад бичсэн мастер ≠ бүртгэл илгээгдэх мастер үед анхааруулна.
// Шалтгаан: ҮЯ-180-ын оператор (хуваарьгүй) нэг ээлжид хоёр бичлэг үүсгэж, автоклавын маягтыг нэгэнд
// нь бөглөөд мастерт нөгөө (хоосон) бичлэгээ илгээдэг байв.
//
//   node --test --test-isolation=none testing/shift-duplicate-start.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { loadSource, masterStations } from './helpers/approval-routes.mjs';
import { load, nodes } from './helpers/approvals-section.mjs';

const require = createRequire(import.meta.url);
const react = require('react');
const tick = () => new Promise(setImmediate);
const { confirmMasterWarning, shiftFormMasterName } = loadSource('lib/handover-master-check.ts');

const OPERATOR = { id: 'op-1', name: 'Лхагва БАТМЯГМАР', role: 'operator', stationCode: 'ҮЯ-180' };
const SLOT = { operatorUid: 'op-1', operatorName: 'Лхагва БАТМЯГМАР', stationCode: 'ҮЯ-180', shiftType: 'Өдрийн', shiftDate: '2026-11-09', status: 'Хадгалсан' };
const shiftRow = (id, overrides = {}) => ({ id, ...SLOT, createdAt: 1, ...overrides });

/** Prisma `where`-ийн энгийн хэсгийг (тэнцүү, `notIn`) хуурамч хүснэгт дээр шүүнэ. */
function matches(row, where = {}) {
  return Object.entries(where).every(([key, condition]) =>
    condition && typeof condition === 'object' && 'notIn' in condition
      ? !condition.notIn.includes(row[key])
      : row[key] === condition
  );
}

function shiftsPost({ actor = OPERATOR, shifts = [] } = {}) {
  const calls = { findFirst: [], create: [] };
  const prisma = {
    shift: {
      findFirst: async (args) => {
        calls.findFirst.push(args);
        return shifts.filter((row) => matches(row, args.where)).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
      },
      findMany: async (args) => shifts.filter((row) => matches(row, args.where)),
      create: async (args) => { calls.create.push(args); return { id: 'new-shift' }; },
    },
    operatorSchedule: { findMany: async () => [], findFirst: async () => null },
  };
  const route = loadSource('app/api/shifts/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, json: async () => body }) } },
    'next-auth/next': { getServerSession: async () => ({ user: actor }) },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/prisma': { prisma },
    '@/lib/shift-db': {
      STATION_NAME_BY_CODE: { 'ҮЯ-180': 'Автоклавын оператор' },
      FORM_KEY_BY_STATION: { 'ҮЯ-180': 'y180AutoclaveOperatorForm' },
      decomposePayload: () => ({}),
      toShiftClientPayload: (shift) => shift,
    },
    '@/lib/server-audit': { writeServerAuditLog: async () => {} },
    '@/lib/server-notifications': { notifyManyDeduped: async () => [] },
    '@/lib/handover-auto-accept': loadSource('lib/handover-auto-accept.ts'),
    '@/lib/shift-api-permissions': loadSource('lib/shift-api-permissions.ts'),
    '@/lib/device-access': { getDeviceAccessForRequest: async () => ({ allowed: true }), deviceForbiddenResponse: () => ({ status: 403 }) },
    '@/lib/dispatcher-compliance': { resolveDispatcherCompliance: async () => ({}) },
    '@/lib/master-stations': masterStations,
    '@/lib/master-pending': { masterApprovalPendingWhere: () => ({}) },
    '@/lib/handover-window': { isoDateInTimeZone: () => '2026-11-09' },
    '@/lib/crew-master': { crewOperatorUids: async () => null, resolveCrewMasterForShift: async () => null },
    '@/lib/approval-history-query': loadSource('lib/approval-history-query.ts', { './master-stations': masterStations }),
  });
  const post = async (body = SLOT) => {
    const response = await route.POST(new Request('http://localhost/api/shifts', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }));
    return { status: response.status, body: await response.json() };
  };
  return { calls, post };
}

// ─────────────────────────────────────────────── POST /api/shifts ───────────────────────────────────────────────

test('the reported case: an operator without a schedule cannot start the same shift twice', async () => {
  const api = shiftsPost({ shifts: [shiftRow('s-old')] });
  const { status, body } = await api.post();
  assert.equal(status, 409);
  assert.equal(body.ok, false);
  assert.equal(body.existingShiftId, 's-old');
  assert.match(body.error, /аль хэдийн эхэлсэн/);
  assert.equal(api.calls.create.length, 0, 'no second record is created');
  assert.deepEqual(api.calls.findFirst[0].where, {
    operatorUid: 'op-1', shiftDate: '2026-11-09', shiftType: 'Өдрийн', stationCode: 'ҮЯ-180', status: { notIn: ['Цуцлагдсан'] },
  });
});

test('an already approved shift of the same slot blocks too; with old duplicates the newest is opened', async () => {
  const api = shiftsPost({
    shifts: [shiftRow('s-approved', { status: 'Баталгаажсан', createdAt: 1 }), shiftRow('s-newer', { createdAt: 2 })],
  });
  const { status, body } = await api.post();
  assert.equal(status, 409);
  assert.equal(body.existingShiftId, 's-newer');
});

test('a cancelled shift, another shift type, another date or another station does not block', async () => {
  const api = shiftsPost({
    shifts: [
      shiftRow('cancelled', { status: 'Цуцлагдсан' }),
      shiftRow('night', { shiftType: 'Шөнийн' }),
      shiftRow('yesterday', { shiftDate: '2026-11-08' }),
      shiftRow('other-station', { stationCode: 'ҮЯ-190' }),
      shiftRow('other-operator', { operatorUid: 'op-2' }),
    ],
  });
  const { status, body } = await api.post();
  assert.equal(status, 200);
  // `autoAcceptedHandovers`: энэ операторт хүлээлгэн өгсөн өмнөх ээлж байхгүй (testing/handover-auto-accept.test.mjs).
  assert.deepEqual(body, { ok: true, id: 'new-shift', autoAcceptedHandovers: [] });
  assert.equal(api.calls.create.length, 1);
});

test('the check is for operators only — an admin creating a shift for an operator is unchanged', async () => {
  const api = shiftsPost({ actor: { id: 'admin-1', name: 'Админ', role: 'admin' }, shifts: [shiftRow('s-old')] });
  const { status } = await api.post();
  assert.equal(status, 200);
  assert.equal(api.calls.create.length, 1);
});

// ─────────────────────────────────────────────── «Шинэ ээлж эхлүүлэх» хуудас ───────────────────────────────────────────────

/** Хуудсыг hook-уудыг нь орлуулан ажиллуулна; `useEffect` нь React шиг dependency өөрчлөгдөхөд л ажиллана. */
function mountNewShiftPage(postResponse) {
  const states = [], refs = [], effectDeps = [];
  let stateIndex = 0, refIndex = 0, effectIndex = 0, pending = [];
  const mockReact = {
    ...react,
    useState: (initial) => {
      const i = stateIndex++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], (value) => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
    },
    useRef: (initial) => { const i = refIndex++; return (refs[i] ||= { current: initial }); },
    useEffect: (effect, deps) => {
      const i = effectIndex++;
      const prev = effectDeps[i];
      if (!prev || !deps || deps.length !== prev.length || deps.some((d, k) => !Object.is(d, prev[k]))) {
        effectDeps[i] = deps;
        pending.push(effect);
      }
    },
  };
  const pushed = [], toasts = [], requests = [];
  const profile = { uid: 'op-1', displayName: 'Лхагва БАТМЯГМАР', email: 'op@example.mn', role: 'operator', stationCode: 'ҮЯ-180' };
  const auth = { profile, user: { uid: 'op-1' }, loading: false, loggingIn: false, authError: '', login() {}, clearError() {} };
  const { default: NewShiftPage } = load('app/shift/new/page.tsx', {
    react: mockReact,
    'next/navigation': { useRouter: () => ({ push: (url) => pushed.push(url) }) },
    '@/components/AuthProvider': { useAuth: () => auth },
    '@/lib/audit-log': { appendAuditLog: async () => { requests.push({ url: 'audit' }); } },
    '@/lib/handover-window': { isoDateInTimeZone: () => '2026-11-09' },
    'lucide-react': Object.fromEntries(['ChevronLeft', 'ChevronRight', 'Factory', 'Clock', 'AlertTriangle', 'LogIn'].map((n) => [n, () => null])),
    'next/link': { __esModule: true, default: (props) => react.createElement('a', props) },
    '@/components/ui/ToastProvider': {
      useToast: () => ({ warning: (m) => toasts.push(['warning', m]), error: (m) => toasts.push(['error', m]), success() {} }),
    },
    '@/lib/master-stations': masterStations,
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), method: options.method || 'GET' });
    if (String(url).startsWith('/api/shifts?')) return { ok: true, status: 200, json: async () => ({ ok: true, shift: null }) };
    return { ok: postResponse.status === 200, status: postResponse.status, json: async () => postResponse.body };
  };
  const render = async () => {
    stateIndex = 0; refIndex = 0; effectIndex = 0;
    const tree = nodes(NewShiftPage());
    const effects = pending; pending = [];
    for (const effect of effects) effect();
    await tick();
    return tree;
  };
  const start = async () => {
    await render(); // идэвхтэй ээлж шалгана
    let tree = await render();
    tree.find((node) => node.type === 'select').props.onChange({ target: { value: 'ҮЯ-180' } });
    tree = await render();
    await tree.find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} });
  };
  return { start, pushed, toasts, requests, restore: () => { globalThis.fetch = originalFetch; } };
}

test('start page: when the shift was already started it opens that record instead of showing an error', async () => {
  const page = mountNewShiftPage({
    status: 409,
    body: { ok: false, error: 'Энэ ээлж (2026-11-09 Өдрийн, ҮЯ-180) аль хэдийн эхэлсэн байна. Өмнөх бүртгэлээ үргэлжлүүлнэ үү.', existingShiftId: 's-old' },
  });
  try {
    await page.start();
    assert.deepEqual(page.pushed, ['/shift/s-old']);
    assert.deepEqual(page.toasts.map(([kind]) => kind), ['warning']);
    assert.match(page.toasts[0][1], /аль хэдийн эхэлсэн/);
    assert.ok(!page.requests.some((r) => r.url === 'audit'), 'no «shift_started» audit for a shift that was not started');
  } finally { page.restore(); }
});

test('start page: a new shift still opens as before; other errors are still shown as errors', async () => {
  const ok = mountNewShiftPage({ status: 200, body: { ok: true, id: 'new-shift' } });
  try {
    await ok.start();
    assert.deepEqual(ok.pushed, ['/shift/new-shift']);
    assert.ok(ok.requests.some((r) => r.url === '/api/shifts' && r.method === 'POST'));
  } finally { ok.restore(); }

  const failed = mountNewShiftPage({ status: 403, body: { ok: false, error: 'Оноогдсон хуваарийн дагуу ээлж эхлүүлнэ үү' } });
  try {
    await failed.start();
    assert.deepEqual(failed.pushed, []);
    assert.deepEqual(failed.toasts, [['error', 'Оноогдсон хуваарийн дагуу ээлж эхлүүлнэ үү']]);
  } finally { failed.restore(); }
});

// ─────────────────────────────────────────────── Хүлээлгэн өгөх цонх: мастерын анхааруулга ───────────────────────────────────────────────

test('the form master is the first filled «Хянасан: ээлжийн мастер» of the shift forms', () => {
  assert.equal(shiftFormMasterName([null, {}, { sigShiftMaster: '   ' }, { sigShiftMaster: 'Давхарбаяр ЭНХБААТАР' }, { sigShiftMaster: 'Өөр' }]), 'Давхарбаяр ЭНХБААТАР');
  assert.equal(shiftFormMasterName([]), '');
});

test('warning: shown when the record would go to another master or to the automatic crew master', () => {
  // 11/06 Өдрийн: маягтад Давхарбаяр, бүртгэл АДЪЯАЖАВ руу очсон.
  const mismatch = confirmMasterWarning('Давхарбаяр ЭНХБААТАР', { uid: 'm-2', name: 'АДЪЯАЖАВ Магнайбаяр' });
  assert.match(mismatch, /«Давхарбаяр ЭНХБААТАР»/);
  assert.match(mismatch, /«АДЪЯАЖАВ Магнайбаяр» руу илгээгдэнэ/);
  assert.match(confirmMasterWarning('Давхарбаяр ЭНХБААТАР', { uid: '', name: '' }), /доороос түүнийг сонгоно уу/);
});

test('warning: silent when the masters match (case/spacing aside), the form has no master, or the selected name is unknown', () => {
  assert.equal(confirmMasterWarning('Давхарбаяр ЭНХБААТАР', { uid: 'm-1', name: '  давхарбаяр   энхбаатар ' }), '');
  assert.equal(confirmMasterWarning('', { uid: 'm-2', name: 'АДЪЯАЖАВ Магнайбаяр' }), '');
  assert.equal(confirmMasterWarning('Давхарбаяр ЭНХБААТАР', { uid: 'm-2', name: '' }), '');
});
