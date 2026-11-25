import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const filename = path.resolve(import.meta.dirname, '../app/api/erp-sync/route.ts');
const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: filename,
});

function loadRoute(env, session) {
  const calls = { fetch: 0, writes: 0, passwords: [], logs: [] };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options) => ({ status: options?.status ?? 200, body }) } },
    'next-auth/next': { getServerSession: async () => session },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/prisma': { prisma: {
      user: { findMany: async () => [], create: async () => { calls.writes++; } },
      auditLog: { create: async () => {} },
    } },
    bcryptjs: { default: { hash: async password => { calls.passwords.push(password); return 'test-only-hash'; } } },
  };
  const mod = { exports: {} };
  const context = vm.createContext({
    module: mod,
    exports: mod.exports,
    process: { env },
    require: name => {
      assert.ok(Object.hasOwn(mocks, name), `Unexpected import: ${name}`);
      return mocks[name];
    },
    console: {
      log: (...args) => calls.logs.push(args.join(' ')),
      error: (...args) => calls.logs.push(args.join(' ')),
    },
    fetch: async () => {
      calls.fetch++;
      if (calls.fetch === 1) return {
        ok: true,
        headers: { getSetCookie: () => ['session_id=TEST_ONLY_SESSION; Path=/'] },
        json: async () => ({ result: { session_id: 'TEST_ONLY_SESSION' } }),
      };
      return {
        ok: true, status: 200,
        json: async () => ({ result: [{
          name: 'TEST_ONLY_EMPLOYEE', last_name: 'Example', job_name: 'оператор',
          mail: 'operator@example.invalid', phone: false, department_name: 'test',
        }] }),
      };
    },
  });
  vm.runInContext(outputText, context, { filename });
  return { post: mod.exports.POST, calls };
}

test('ERP rejects unauthenticated requests before revealing missing configuration', async () => {
  const { post, calls } = loadRoute({}, null);
  const response = await post(new Request('http://localhost/api/erp-sync', { method: 'POST' }));
  assert.equal(response.status, 401);
  assert.equal(calls.fetch, 0);
  assert.equal(calls.writes, 0);
});

for (const missing of ['ERP_PASSWORD', 'ERP_SYNC_DEFAULT_PASSWORD']) {
  test(`ERP stops before network calls and user creation when ${missing} is absent`, async () => {
    const env = { ERP_PASSWORD: 'TEST_ONLY_ERP_PASSWORD', ERP_SYNC_DEFAULT_PASSWORD: 'TEST_ONLY_USER_PASSWORD' };
    delete env[missing];
    const { post, calls } = loadRoute(env, { user: { role: 'admin' } });
    const response = await post(new Request('http://localhost/api/erp-sync', { method: 'POST' }));
    assert.equal(response.status, 503);
    assert.deepEqual(Array.from(response.body.missing), [missing]);
    assert.equal(calls.fetch, 0);
    assert.equal(calls.writes, 0);
    assert.equal(calls.passwords.length, 0);
  });
}

test('configured ERP sync hashes the supplied password and keeps sessions and employee payloads out of logs', async () => {
  const env = {
    ERP_PASSWORD: 'TEST_ONLY_ERP_PASSWORD',
    ERP_SYNC_DEFAULT_PASSWORD: 'TEST_ONLY_USER_PASSWORD',
    ERP_SYNC_SECRET: 'TEST_ONLY_SYNC_SECRET',
  };
  const { post, calls } = loadRoute(env, null);
  const response = await post(new Request('http://localhost/api/erp-sync', {
    method: 'POST', headers: { authorization: `Bearer ${env.ERP_SYNC_SECRET}` },
  }));
  assert.equal(response.status, 200);
  assert.equal(response.body.created, 1);
  assert.equal(calls.fetch, 2);
  assert.equal(calls.writes, 1);
  assert.deepEqual(calls.passwords, [env.ERP_SYNC_DEFAULT_PASSWORD]);
  assert.doesNotMatch(calls.logs.join('\n'), /TEST_ONLY_/);
});
