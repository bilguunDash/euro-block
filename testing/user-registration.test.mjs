import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');

// Production TS-ийг санах ойд compile хийж, зөвхөн гаднах хил (next/server, session, prisma)-ийг mock-лоно.
function load(relativePath, mocks = {}) {
  const filename = path.resolve(import.meta.dirname, '..', relativePath);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename,
  });
  const mod = { exports: {} };
  vm.runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod, mod.exports,
  );
  return mod.exports;
}

const nextServer = { NextResponse: { json: (data, options) => ({ status: options?.status || 200, json: async () => data }) } };
const responses = load('lib/api/responses.ts', { 'next/server': nextServer });
const registration = load('lib/user-registration.ts');

const pick = (row, select) => Object.fromEntries(Object.keys(select).filter(key => select[key]).map(key => [key, row[key]]));

/**
 * Prisma-ийн хуурамч хувилбар: `$transaction` нь хуулбар дээр ажиллаж, callback амжилттай дуусвал л commit хийнэ
 * (алдаа гарвал буцаана). `approveBeforeDelete` — «өөр админ уншсаны дараа, устгахын өмнө баталсан» race.
 */
function fixture({ auditFailure = false, approveBeforeDelete = null, transactionError = null } = {}) {
  let store = {
    users: [
      { id: 'pending-1', name: null, email: 'soogii221@gmail', role: 'operator', isApproved: false },
      { id: 'pending-2', name: 'Бат', email: 'bat@mak.mn', role: 'operator', isApproved: false },
      { id: 'pending-3', name: 'Имэйлгүй', email: null, role: 'operator', isApproved: false },
      { id: 'admin-id', name: 'Админ Нэр', email: 'admin@mak.mn', role: 'admin', isApproved: true },
      { id: 'active-1', name: 'Оператор', email: 'op@mak.mn', role: 'operator', isApproved: true },
    ],
    audits: [],
  };
  const calls = { transactions: 0, deleteMany: [] };
  const prisma = {
    $transaction: async callback => {
      calls.transactions++;
      if (transactionError) throw transactionError;
      const draft = structuredClone(store);
      const tx = {
        user: {
          findUnique: async ({ where, select }) => {
            const row = draft.users.find(user => user.id === where.id);
            return row ? pick(row, select) : null;
          },
          deleteMany: async ({ where }) => {
            calls.deleteMany.push(structuredClone({ where }));
            if (approveBeforeDelete === where.id) {
              // Өөр админ commit хийсэн өөрчлөлт: бодит хадгалалт болон энэ transaction-д харагдана.
              for (const rows of [store.users, draft.users]) rows.find(user => user.id === where.id).isApproved = true;
            }
            const before = draft.users.length;
            // Prisma шиг: нөхцөл өгөөгүй талбараар шүүхгүй.
            draft.users = draft.users.filter(user => !(user.id === where.id && (where.isApproved === undefined || user.isApproved === where.isApproved)));
            return { count: before - draft.users.length };
          },
        },
        auditLog: {
          create: async ({ data }) => {
            if (auditFailure) throw new Error('audit table is down');
            draft.audits.push(data);
          },
        },
      };
      const result = await callback(tx);
      store = draft;
      return result;
    },
  };
  return { prisma, state: () => store, calls };
}

const adminSession = (overrides = {}) => ({ user: { id: 'admin-id', name: 'Админ Нэр', email: 'admin@mak.mn', role: 'admin', ...overrides } });

function handler(prisma, session = adminSession()) {
  return load('app/api/users/reject/route.ts', {
    'next/server': nextServer,
    'next-auth/next': { getServerSession: async () => session },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/prisma': { prisma },
    '@/lib/api/responses': responses,
    '@/lib/user-registration': registration,
  });
}

const post = body => new Request('http://localhost/api/users/reject', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
});

async function withQuietConsole(run) {
  const original = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try { return await run(logged); } finally { console.error = original; }
}

test('the request must carry a non-blank string id, which is trimmed', () => {
  assert.deepEqual(registration.parseRejectUserRequest({ id: ' cl9abc ' }), { id: 'cl9abc' });
  for (const body of [undefined, null, [], 'pending-1', 7, {}, { id: '' }, { id: '   ' }, { id: 5 }, { id: ['pending-1'] }, { id: {} }, { id: null }]) {
    assert.throws(() => registration.parseRejectUserRequest(body), /ID шаардлагатай/, JSON.stringify(body));
  }
});

test('only an admin session can reject: everyone else is refused before any database access', async () => {
  const sessions = [
    [null, 401], [{}, 401], [{ user: { role: 'admin' } }, 401],
    ...['operator', 'master', 'dispatcher', 'auditor', 'hse_engineer', 'sort_operator', 'chief_engineer', '']
      .map(role => [adminSession({ role }), 403]),
  ];
  for (const [session, status] of sessions) {
    const { prisma, state, calls } = fixture();
    const before = structuredClone(state());
    const response = await handler(prisma, session).POST(post({ id: 'pending-1' }));
    assert.equal(response.status, status, JSON.stringify(session));
    assert.equal((await response.json()).ok, false);
    assert.equal(calls.transactions, 0, JSON.stringify(session));
    assert.deepEqual(state(), before);
  }
});

test('malformed bodies are refused with 400 before the database is touched', async () => {
  for (const body of ['{not json', '', 'null', '[]', JSON.stringify({}), JSON.stringify({ id: '' }), JSON.stringify({ id: '  ' }), JSON.stringify({ id: 12 })]) {
    const { prisma, state, calls } = fixture();
    const before = structuredClone(state());
    const response = await handler(prisma).POST(post(body));
    assert.equal(response.status, 400, body);
    assert.equal((await response.json()).ok, false);
    assert.equal(calls.transactions, 0, body);
    assert.deepEqual(state(), before);
  }
});

test('rejecting a pending request deletes only that account and records who did it', async () => {
  const { prisma, state } = fixture();
  const response = await handler(prisma).POST(post({ id: 'pending-1' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(state().users.map(user => user.id), ['pending-2', 'pending-3', 'admin-id', 'active-1']);
  assert.deepEqual(state().audits, [{
    actorUid: 'admin-id',
    actorName: 'Админ Нэр',
    action: 'user_registration_rejected',
    entityType: 'user',
    entityId: 'pending-1',
    details: 'Rejected registration request of soogii221@gmail (name=-, role=operator)',
  }]);
});

test('the audit entry survives missing names and emails, and the actor falls back to their email', async () => {
  const noEmail = fixture();
  await handler(noEmail.prisma).POST(post({ id: 'pending-3' }));
  assert.equal(noEmail.state().audits[0].details, 'Rejected registration request of - (name=Имэйлгүй, role=operator)');

  for (const [session, actorName] of [
    [adminSession({ name: '' }), 'admin@mak.mn'],
    [adminSession({ name: null, email: null }), null],
  ]) {
    const { prisma, state } = fixture();
    assert.equal((await handler(prisma, session).POST(post({ id: 'pending-2' }))).status, 200);
    assert.equal(state().audits[0].actorName, actorName);
    assert.equal(state().audits[0].actorUid, 'admin-id');
  }
});

test('an unknown id returns 404 and writes nothing', async () => {
  const { prisma, state } = fixture();
  const before = structuredClone(state());
  const response = await handler(prisma).POST(post({ id: 'no-such-user' }));
  assert.equal(response.status, 404);
  assert.match((await response.json()).error, /олдсонгүй/);
  assert.deepEqual(state(), before);
});

test('an already approved account is never deleted, not even an admin: 409 with nothing written', async () => {
  for (const id of ['active-1', 'admin-id']) {
    const { prisma, state } = fixture();
    const before = structuredClone(state());
    const response = await handler(prisma).POST(post({ id }));
    assert.equal(response.status, 409, id);
    assert.match((await response.json()).error, /баталгаажсан/);
    assert.deepEqual(state(), before);
  }
});

test('an account approved by another admin between the read and the delete is kept', async () => {
  const { prisma, state, calls } = fixture({ approveBeforeDelete: 'pending-2' });
  const response = await handler(prisma).POST(post({ id: 'pending-2' }));
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /төлөв өөрчлөгдсөн/);
  assert.equal(calls.deleteMany.length, 1);
  const survivor = state().users.find(user => user.id === 'pending-2');
  assert.ok(survivor, 'the account must still exist');
  assert.equal(survivor.isApproved, true);
  assert.deepEqual(state().audits, []);
});

test('the delete itself only matches accounts that are still pending', async () => {
  const { prisma, calls } = fixture();
  await handler(prisma).POST(post({ id: 'pending-1' }));
  assert.deepEqual(calls.deleteMany, [{ where: { id: 'pending-1', isApproved: false } }]);
});

test('a failing audit write rolls the deletion back and does not leak the cause', async () => {
  const { prisma, state } = fixture({ auditFailure: true });
  const before = structuredClone(state());
  const logged = await withQuietConsole(async logged => {
    const response = await handler(prisma).POST(post({ id: 'pending-1' }));
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.doesNotMatch(JSON.stringify(body), /audit table/);
    return logged;
  });
  assert.equal(logged.length, 1);
  assert.deepEqual(state(), before);
});

test('an unexpected database error becomes a generic 500', async () => {
  const { prisma } = fixture({ transactionError: new Error('connection refused 10.0.0.5:5432') });
  const logged = await withQuietConsole(async logged => {
    const response = await handler(prisma).POST(post({ id: 'pending-1' }));
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.doesNotMatch(JSON.stringify(body), /10\.0\.0\.5|connection/);
    return logged;
  });
  assert.equal(logged.length, 1, 'the real cause is logged server-side');
});

test('rejecting the same request twice succeeds once, then reports it as already handled', async () => {
  const { prisma, state } = fixture();
  const route = handler(prisma);
  assert.equal((await route.POST(post({ id: 'pending-1' }))).status, 200);
  assert.equal((await route.POST(post({ id: 'pending-1' }))).status, 404);
  assert.equal(state().audits.length, 1);
  assert.deepEqual(state().users.map(user => user.id), ['pending-2', 'pending-3', 'admin-id', 'active-1']);
});

test('rejecting several pending requests one after another leaves approved accounts untouched', async () => {
  const { prisma, state } = fixture();
  const route = handler(prisma);
  for (const id of ['pending-1', 'pending-2', 'pending-3']) assert.equal((await route.POST(post({ id }))).status, 200);
  assert.deepEqual(state().users.map(user => user.id), ['admin-id', 'active-1']);
  assert.deepEqual(state().audits.map(audit => audit.entityId), ['pending-1', 'pending-2', 'pending-3']);
  assert.ok(state().users.every(user => user.isApproved));
});
