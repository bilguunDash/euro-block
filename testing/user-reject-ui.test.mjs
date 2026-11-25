import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const react = require('react');

// Production TS/TSX-ийг санах ойд compile хийж, зөвхөн гаднах хил (react hook, next/link, toast, fetch …)-ийг mock-лоно.
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

const dashboardHelpers = load('components/dashboard/dashboard-helpers.ts');
const handoverWindow = load('lib/handover-window.ts');
const registration = load('lib/user-registration.ts');

/** Hook-уудыг индексээр хадгалдаг stub: компонент/hook-ийг энгийн функц шиг дуудаж болно. */
function stubReact() {
  const states = [];
  let index = 0;
  return {
    reset: () => { index = 0; },
    api: {
      ...react,
      useState: initial => {
        const i = index++;
        if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
        return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
      },
      useMemo: factory => factory(),
      useCallback: callback => callback,
      useEffect: () => {},
    },
  };
}

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

const user = (id, overrides = {}) => ({ id, name: null, email: `${id}@mak.mn`, role: 'operator', isApproved: false, stationCode: null, shiftGroup: null, ...overrides });

// ── AdminTab: «Баталгаажуулах хүлээгдэж буй» жагсаалт ──────────────────────────────────────────

function mountAdminTab({ role = 'admin', section = 'users', users = [] } = {}) {
  const hooks = stubReact();
  const calls = { approve: [], reject: [], remove: [], edit: [] };
  const { AdminTab } = load('components/dashboard/tabs/AdminTab.tsx', {
    react: hooks.api,
    'next/link': { __esModule: true, default: props => react.createElement('a', props) },
    'lucide-react': new Proxy({}, { get: () => () => null }),
    '@/lib/handover-window': handoverWindow,
    '../AnnouncementCenter': { AnnouncementCenter: () => null },
    '../InstructionCenter': { InstructionCenter: () => null },
    '../admin/ScheduleManagementSection': { ScheduleManagementSection: () => null },
    '../admin/ApprovalsSection': { ApprovalsSection: () => null },
    '../HorizontalPagedList': { HorizontalPagedList: props => props.renderPage(props.items) },
    '../dashboard-helpers': dashboardHelpers,
  });
  const props = {
    adminSection: section, profile: { role, uid: 'admin-id' }, localUsers: users, stations: [],
    toast: { success() {}, error() {}, warning() {} }, confirmAsync: async () => true,
    handleApproveUser: (...args) => calls.approve.push(args),
    handleRejectUser: (...args) => calls.reject.push(args),
    handleDeleteUser: (...args) => calls.remove.push(args),
    setEditingUser: (...args) => calls.edit.push(args),
  };
  const render = () => { hooks.reset(); return nodes(AdminTab(props)); };
  const rowsOf = table => nodes(nodes(table).find(node => node.type === 'tbody'))
    .filter(node => node.type === 'tr').map(row => react.Children.toArray(row.props.children).filter(cell => cell.type === 'td'));
  const headersOf = table => nodes(table).filter(node => node.type === 'th').map(textOf);
  const buttons = scope => nodes(scope).filter(node => node.type === 'button');
  return {
    calls, render, buttons, rowsOf,
    /** Хүлээгдэж буй хүснэгт — 3 баганатай (Нэр / Төрөл / Үйлдэл); байхгүй бол undefined. */
    pendingTable: () => render().filter(node => node.type === 'table').find(table => headersOf(table).length === 3),
    mainTable: () => render().filter(node => node.type === 'table').find(table => headersOf(table).length === 6),
    pendingTitle: () => textOf(render().find(node => node.type === 'h5')),
    labels: scope => buttons(scope).map(button => textOf(button).trim()),
  };
}

test('every pending registration shows Татгалзах next to Зөвшөөрөх', () => {
  const ui = mountAdminTab({ users: [user('pending-1'), user('pending-2', { name: 'Бат' }), user('active-1', { isApproved: true })] });
  const table = ui.pendingTable();
  assert.ok(table, 'the pending card must be rendered');
  const rows = ui.rowsOf(table);
  assert.equal(rows.length, 2);
  for (const row of rows) assert.deepEqual(ui.labels(row.at(-1)), ['Татгалзах', 'Зөвшөөрөх']);
  assert.equal(ui.pendingTitle(), 'Баталгаажуулах хүлээгдэж буй (2)');
});

test('Татгалзах calls handleRejectUser with that account only', () => {
  const ui = mountAdminTab({ users: [user('pending-1', { email: 'soogii221@gmail' }), user('pending-2', { email: 'bat@mak.mn' })] });
  const [first, second] = ui.rowsOf(ui.pendingTable());
  const reject = row => ui.buttons(row.at(-1)).find(button => textOf(button).trim() === 'Татгалзах');

  reject(first).props.onClick();
  assert.deepEqual(ui.calls.reject, [['pending-1', 'soogii221@gmail']]);
  reject(second).props.onClick();
  assert.deepEqual(ui.calls.reject, [['pending-1', 'soogii221@gmail'], ['pending-2', 'bat@mak.mn']]);
  assert.deepEqual(ui.calls.approve, []);
  assert.deepEqual(ui.calls.remove, []);
  assert.deepEqual(ui.calls.edit, []);
});

test('Зөвшөөрөх still approves with the account id and role, and does not reject', () => {
  const ui = mountAdminTab({ users: [user('pending-1', { role: 'master' })] });
  const [row] = ui.rowsOf(ui.pendingTable());
  ui.buttons(row.at(-1)).find(button => textOf(button).trim() === 'Зөвшөөрөх').props.onClick();
  assert.deepEqual(ui.calls.approve, [['pending-1', 'master']]);
  assert.deepEqual(ui.calls.reject, []);
});

test('the reject button never submits a form and looks like a destructive secondary action', () => {
  const ui = mountAdminTab({ users: [user('pending-1')] });
  const [row] = ui.rowsOf(ui.pendingTable());
  const reject = ui.buttons(row.at(-1)).find(button => textOf(button).trim() === 'Татгалзах');
  assert.equal(reject.props.type, 'button');
  assert.match(reject.props.className, /text-red-600/);
  assert.doesNotMatch(reject.props.className, /bg-orange-600/);
});

test('approved accounts never get Татгалзах, and the card disappears when nobody is pending', () => {
  const ui = mountAdminTab({ users: [user('active-1', { isApproved: true }), user('active-2', { isApproved: true })] });
  assert.equal(ui.pendingTable(), undefined);
  assert.ok(ui.mainTable(), 'the main list is still rendered');
  const everyLabel = ui.buttons(ui.render()).map(button => textOf(button).trim());
  assert.ok(!everyLabel.includes('Татгалзах'));
  assert.ok(!everyLabel.includes('Зөвшөөрөх'));
});

test('only admins see the users section, so only they can reach the reject button', () => {
  for (const role of ['dispatcher', 'operator', 'master', 'chief_engineer', 'auditor']) {
    const ui = mountAdminTab({ role, users: [user('pending-1')] });
    assert.equal(ui.pendingTable(), undefined, role);
    assert.equal(ui.mainTable(), undefined, role);
    assert.ok(!ui.buttons(ui.render()).some(button => textOf(button).trim() === 'Татгалзах'), role);
  }
  const otherSection = mountAdminTab({ section: 'approvals', users: [user('pending-1')] });
  assert.equal(otherSection.pendingTable(), undefined);
});

test('the full users list keeps Засах and Устгах for pending accounts as before', () => {
  const ui = mountAdminTab({ users: [user('pending-1', { email: 'p@mak.mn' }), user('active-1', { isApproved: true, email: 'a@mak.mn' })] });
  const rows = ui.rowsOf(ui.mainTable());
  assert.equal(rows.length, 2);
  for (const row of rows) assert.deepEqual(ui.labels(row.at(-1)), ['Засах', 'Устгах']);
  ui.buttons(rows[0].at(-1)).find(button => textOf(button).trim() === 'Устгах').props.onClick();
  assert.deepEqual(ui.calls.remove, [['pending-1', 'p@mak.mn']]);
  assert.deepEqual(ui.calls.reject, []);
});

// AdminTab-ын props `any` төрөлтэй тул TypeScript дутуу дамжуулсан prop-ыг барьдаггүй — AST-аар шалгана.
test('DashboardContent passes the handleRejectUser of useDashboardAdmin on to AdminTab', () => {
  const filename = path.resolve(import.meta.dirname, '..', 'components/dashboard/DashboardContent.tsx');
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  let destructured = false;
  let passedOn = false;
  const walk = node => {
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer && ts.isCallExpression(node.initializer)
      && node.initializer.expression.getText() === 'useDashboardAdmin') {
      destructured = node.name.elements.some(element => element.name.getText() === 'handleRejectUser');
    }
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText() === 'AdminTab') {
      passedOn = node.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText() === 'handleRejectUser'
        && attribute.initializer && ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression?.getText() === 'handleRejectUser');
    }
    ts.forEachChild(node, walk);
  };
  walk(source);
  assert.ok(destructured, 'handleRejectUser must be taken from useDashboardAdmin(...)');
  assert.ok(passedOn, '<AdminTab handleRejectUser={handleRejectUser} /> is missing');
});

// ── useDashboardAdmin.handleRejectUser ─────────────────────────────────────────────────────────

const jsonResponse = (status, body, { badJson = false } = {}) => ({
  ok: status >= 200 && status < 300, status,
  json: async () => { if (badJson) throw new SyntaxError('Unexpected token <'); return body; },
});

/** Hook-ийг бодитоор дуудаж, `fetch`, confirm, toast-ыг бүртгэнэ. Дууссан даруйд fetch/console-г сэргээнэ. */
async function scenario({ role = 'admin', confirmed = true, reject = jsonResponse(200, { ok: true }), networkError = null } = {}, run) {
  const calls = { fetch: [], confirm: [], toast: [], audits: [], logged: [] };
  const hooks = stubReact();
  const { useDashboardAdmin } = load('components/dashboard/hooks/useDashboardAdmin.ts', {
    react: hooks.api,
    '@/lib/audit-log': { appendAuditLog: async entry => { calls.audits.push(entry); } },
    '@/lib/handover-window': handoverWindow,
  });
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  globalThis.fetch = async (url, options = {}) => {
    calls.fetch.push({
      url, method: options.method || 'GET', credentials: options.credentials, headers: options.headers,
      body: options.body ? JSON.parse(options.body) : undefined,
    });
    if (url === '/api/users/reject') {
      if (networkError) throw networkError;
      return reject;
    }
    if (url === '/api/users') return jsonResponse(200, { ok: true, users: [] });
    throw new Error(`unexpected request ${url}`);
  };
  console.error = (...args) => calls.logged.push(args);
  try {
    const profile = role === null ? null : { role, uid: 'admin-id', displayName: 'Админ' };
    const hook = useDashboardAdmin({
      profile, activeTab: 'admin', adminSection: 'users', stations: [],
      toast: Object.fromEntries(['success', 'error', 'warning', 'info'].map(kind => [kind, message => calls.toast.push([kind, message])])),
      confirmAsync: async options => { calls.confirm.push(options); return confirmed; },
    });
    return await run(hook, calls);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
}

const requests = calls => calls.fetch.map(call => `${call.method} ${call.url}`);

test('the admin hook exposes handleRejectUser next to approve and delete', async () => {
  await scenario({}, hook => {
    for (const name of ['handleApproveUser', 'handleRejectUser', 'handleDeleteUser']) assert.equal(typeof hook[name], 'function', name);
  });
});

test('only an admin profile can reject: nobody else is asked to confirm or sends a request', async () => {
  for (const role of [null, 'operator', 'master', 'dispatcher', 'chief_engineer', 'auditor']) {
    await scenario({ role }, async (hook, calls) => {
      await hook.handleRejectUser('pending-1', 'a@mak.mn');
      assert.deepEqual(calls.confirm, [], String(role));
      assert.deepEqual(calls.fetch, [], String(role));
      assert.deepEqual(calls.toast, [], String(role));
    });
  }
});

test('declining the confirmation sends nothing', async () => {
  await scenario({ confirmed: false }, async (hook, calls) => {
    await hook.handleRejectUser('pending-1', 'a@mak.mn');
    assert.equal(calls.confirm.length, 1);
    assert.deepEqual(calls.fetch, []);
    assert.deepEqual(calls.toast, []);
  });
});

test('the confirmation names the account and warns that the registration is deleted', async () => {
  await scenario({}, async (hook, calls) => {
    await hook.handleRejectUser('pending-1', 'soogii221@gmail');
    const [confirmation] = calls.confirm;
    assert.equal(confirmation.title, 'Бүртгэлийн хүсэлтийг татгалзах уу?');
    assert.match(confirmation.message, /soogii221@gmail/);
    assert.match(confirmation.message, /устгана/);
    assert.match(confirmation.message, /дахин бүртгүүлж болно/);
    assert.equal(confirmation.confirmText, 'Татгалзах');
    assert.equal(confirmation.danger, true);
  });
  await scenario({}, async (hook, calls) => {
    await hook.handleRejectUser('pending-1', '');
    assert.doesNotMatch(calls.confirm[0].message, /undefined|null/);
  });
});

test('confirming posts the account id once, refreshes the list and reports success', async () => {
  await scenario({}, async (hook, calls) => {
    await hook.handleRejectUser('pending-1', 'a@mak.mn');
    assert.deepEqual(requests(calls), ['POST /api/users/reject', 'GET /api/users']);
    const [post] = calls.fetch;
    assert.deepEqual(post.body, { id: 'pending-1' });
    assert.equal(post.credentials, 'include');
    assert.deepEqual(post.headers, { 'Content-Type': 'application/json' });
    assert.deepEqual(calls.toast, [['success', 'Бүртгэлийн хүсэлтийг татгалзлаа.']]);
    // Аудитыг сервер transaction дотор бичдэг — клиент давхар бичихгүй.
    assert.deepEqual(calls.audits, []);
    assert.ok(!requests(calls).some(request => request.includes('/api/audit')));
  });
});

test('each rejection sends the id of the account that was clicked', async () => {
  await scenario({}, async (hook, calls) => {
    await hook.handleRejectUser('pending-1', 'a@mak.mn');
    await hook.handleRejectUser('pending-2', 'b@mak.mn');
    assert.deepEqual(calls.fetch.filter(call => call.method === 'POST').map(call => call.body), [{ id: 'pending-1' }, { id: 'pending-2' }]);
  });
});

test('a stale list (409 or 404) shows the server message and still refreshes the list', async () => {
  for (const [status, error] of [[409, 'Хэрэглэгч аль хэдийн баталгаажсан байна. Жагсаалтыг шинэчилнэ үү.'], [404, 'Бүртгэлийн хүсэлт олдсонгүй. Өөр админ боловсруулсан байж болно.']]) {
    await scenario({ reject: jsonResponse(status, { ok: false, error }) }, async (hook, calls) => {
      await hook.handleRejectUser('pending-1', 'a@mak.mn');
      assert.deepEqual(requests(calls), ['POST /api/users/reject', 'GET /api/users'], String(status));
      assert.deepEqual(calls.toast, [['error', error]], String(status));
    });
  }
});

test('a server error is reported without claiming success or reloading the list', async () => {
  await scenario({ reject: jsonResponse(500, { ok: false, error: 'Хүсэлтийг татгалзаж чадсангүй. Дахин оролдоно уу.' }) }, async (hook, calls) => {
    await hook.handleRejectUser('pending-1', 'a@mak.mn');
    assert.deepEqual(requests(calls), ['POST /api/users/reject']);
    assert.deepEqual(calls.toast, [['error', 'Хүсэлтийг татгалзаж чадсангүй. Дахин оролдоно уу.']]);
  });
});

test('a response that is not JSON, or that says ok:false, still ends in a readable error', async () => {
  const generic = 'Хүсэлтийг татгалзахад алдаа гарлаа.';
  for (const reject of [jsonResponse(502, null, { badJson: true }), jsonResponse(200, { ok: false }), jsonResponse(403, { ok: false, error: '' })]) {
    await scenario({ reject }, async (hook, calls) => {
      await hook.handleRejectUser('pending-1', 'a@mak.mn');
      assert.deepEqual(calls.toast, [['error', generic]], String(reject.status));
    });
  }
  await scenario({ reject: jsonResponse(200, { ok: false, error: 'Өөр шалтгаан' }) }, async (hook, calls) => {
    await hook.handleRejectUser('pending-1', 'a@mak.mn');
    assert.deepEqual(calls.toast, [['error', 'Өөр шалтгаан']]);
  });
});

test('a network failure shows a Mongolian message, never the raw browser error, and no success', async () => {
  await scenario({ networkError: new TypeError('Failed to fetch') }, async (hook, calls) => {
    await hook.handleRejectUser('pending-1', 'a@mak.mn');
    assert.deepEqual(requests(calls), ['POST /api/users/reject']);
    assert.deepEqual(calls.toast, [['error', 'Хүсэлтийг татгалзахад алдаа гарлаа.']]);
    assert.equal(calls.logged.length, 1, 'the cause is logged for debugging');
  });
});

// ── Аудит ───────────────────────────────────────────────────────────────────────────────────────

test('the rejection audit action has a Mongolian label and a filter entry', () => {
  const action = registration.USER_REGISTRATION_REJECTED_ACTION;
  assert.equal(action, 'user_registration_rejected');
  assert.equal(dashboardHelpers.mnAction(action), 'Бүртгэлийн хүсэлт татгалзсан');
  assert.notEqual(dashboardHelpers.mnAction(action), dashboardHelpers.mnAction('some_unknown_action'));
  assert.ok(dashboardHelpers.AUDIT_FILTER_ACTIONS.some(entry => entry.value === action && entry.label === 'Бүртгэлийн хүсэлт татгалзсан'));
});
