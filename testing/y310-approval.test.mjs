import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const filename = path.resolve(import.meta.dirname, '../app/api/y310-approvals/route.ts');
const logId = '11111111-1111-4111-8111-111111111111';
const shiftId = '22222222-2222-4222-8222-222222222222';

function makePatch({ pending = true, mutateBeforeUpdate = false, missing = false } = {}) {
  let data = { needsAdminApproval: true, adminApproved: false, adminRejected: false };
  let updates = 0;
  let audits = 0;
  let pendingQuery = '';
  const productionLog = {
    findUnique: async () => missing ? null : { id: logId, shiftId, logType: 'test_master', data: { ...data } },
    updateMany: async ({ where, data: update }) => {
      updates++;
      if (mutateBeforeUpdate) data = { ...data, adminApproved: true };
      if (JSON.stringify(where.data.equals) !== JSON.stringify(data)) return { count: 0 };
      data = update.data;
      return { count: 1 };
    },
  };
  const tx = {
    productionLog,
    $queryRawUnsafe: async (query, types, id) => {
      pendingQuery = query;
      assert.deepEqual(types, ['test_master']);
      assert.equal(id, logId);
      return pending && !data.adminApproved && !data.adminRejected ? [{ id: logId }] : [];
    },
  };
  const prisma = {
    $transaction: async (callback, options) => {
      assert.equal(options.isolationLevel, 'Serializable');
      return callback(tx);
    },
    shift: { findUnique: async () => null },
  };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options) => ({ status: options?.status ?? 200, json: async () => body }) } },
    'next-auth/next': { getServerSession: async () => ({ user: { id: 'admin', name: 'Admin', role: 'admin' } }) },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/prisma': { prisma },
    '@/lib/server-audit': { writeServerAuditLog: async () => { audits++; } },
    '@/lib/server-notifications': { notifyManyDeduped: async () => {} },
    '@/lib/master-stations': { ADMIN_APPROVAL_LOG_TYPES: ['test_master'] },
    '@/lib/approval-history-query': {},
  };
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  const mod = { exports: {} };
  vm.runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod, mod.exports,
  );
  return {
    patch: mod.exports.PATCH,
    state: () => ({ data, updates, audits, pendingQuery }),
  };
}

function request(action = 'approve') {
  return new Request('http://localhost/api/y310-approvals', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logId, action }),
  });
}

test('stale master approvals return 409 before writing or auditing', async () => {
  const { patch, state } = makePatch({ pending: false });
  const response = await patch(request());
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /төлөв өөрчлөгдсөн/);
  assert.equal(state().updates, 0);
  assert.equal(state().audits, 0);
  assert.match(state().pendingQuery, /NOT EXISTS[\s\S]*newer/);
  assert.match(state().pendingQuery, /adminApproved/);
});

test('one decision succeeds and a second decision on the same log returns 409', async () => {
  const { patch, state } = makePatch();
  assert.equal((await patch(request('approve'))).status, 200);
  assert.equal(state().data.adminApproved, true);
  assert.equal((await patch(request('reject'))).status, 409);
  assert.equal(state().updates, 1);
  assert.equal(state().audits, 1);
});

test('compare-and-set prevents overwriting a log changed after the pending read', async () => {
  const { patch, state } = makePatch({ mutateBeforeUpdate: true });
  assert.equal((await patch(request('reject'))).status, 409);
  assert.equal(state().data.adminApproved, true);
  assert.equal(state().audits, 0);
});

test('unknown master log still returns 404', async () => {
  const { patch, state } = makePatch({ missing: true });
  assert.equal((await patch(request())).status, 404);
  assert.equal(state().updates, 0);
});
