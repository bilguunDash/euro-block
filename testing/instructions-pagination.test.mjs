import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');

function loadRoute(relativePath, prisma, user = { id: 'admin', role: 'admin', stationCode: '' }) {
  const filename = path.resolve(import.meta.dirname, relativePath);
  const mocks = {
    'next/server': {
      NextResponse: {
        json: (body, options) => ({ status: options?.status ?? 200, json: async () => body }),
      },
    },
    'next-auth/next': { getServerSession: async () => ({ user }) },
    '@/lib/auth-options': { authOptions: {} },
    '@/lib/prisma': { prisma },
    '@/lib/device-access': { getDeviceAccessForRequest: async () => ({ allowed: true }) },
  };
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  const mod = { exports: {} };
  vm.runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod, mod.exports,
  );
  return mod.exports;
}

test('instruction documents clamp the page after a title search and return the full totals', async () => {
  const calls = { counts: [], find: null };
  const prisma = {
    instructionDocument: {
      count: async ({ where }) => {
        calls.counts.push(where);
        return where.AND?.[1]?.title ? 2 : 3;
      },
      findMany: async (args) => {
        calls.find = args;
        return [{
          id: 'safety-2', title: 'Safety B', description: null, fileUrl: 'https://example.invalid/b.pdf',
          fileName: 'b.pdf', stationCode: null, roleTarget: 'all', isActive: true,
          uploadedByUid: 'admin', uploadedByName: 'Admin',
          createdAt: new Date('2026-09-02T00:00:00Z'), updatedAt: new Date('2026-09-02T00:00:00Z'),
          acknowledgements: [], _count: { acknowledgements: 0 },
        }];
      },
    },
  };
  const { GET } = loadRoute('../app/api/instructions/route.ts', prisma);
  const response = await GET(new Request('http://localhost/api/instructions?includeInactive=1&page=9&pageSize=1&q=%20SAFETY%20'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual({ total: body.total, page: body.page, pageSize: body.pageSize, totalPages: body.totalPages },
    { total: 2, page: 2, pageSize: 1, totalPages: 2 });
  assert.equal(body.documents[0].id, 'safety-2');
  assert.equal(body.userAcknowledgedTotal, 3);
  assert.equal(calls.find.skip, 1);
  assert.equal(calls.find.take, 1);
  assert.deepEqual(calls.find.orderBy, [{ isActive: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]);
  assert.deepEqual(calls.find.where, { AND: [{}, { title: { contains: 'SAFETY', mode: 'insensitive' } }] });
  assert.deepEqual(calls.counts[1], { AND: [{}, { acknowledgements: { some: { operatorUid: 'admin' } } }] });
});

test('instruction overview counts every document-user pair and returns clamped pages', async () => {
  const createdAt = new Date('2026-09-01T00:00:00Z');
  const acknowledgement = (operatorUid) => ({ operatorUid, stationCode: null, acknowledgedAt: createdAt });
  const docs = [
    { id: 'd1', title: 'First', stationCode: 'Y099', roleTarget: 'operator', createdAt, acknowledgements: [acknowledgement('op1')] },
    { id: 'd2', title: 'Second', stationCode: null, roleTarget: 'all', createdAt, acknowledgements: [acknowledgement('master1'), acknowledgement('op2')] },
    { id: 'd3', title: 'Third', stationCode: 'Y099', roleTarget: 'master', createdAt, acknowledgements: [] },
  ];
  const users = [
    { id: 'master1', name: 'Master', email: null, role: 'master', stationCode: 'Y099' },
    { id: 'op1', name: 'Operator A', email: null, role: 'operator', stationCode: 'Y099' },
    { id: 'op2', name: 'Operator B', email: null, role: 'operator', stationCode: 'Y099' },
    { id: 'op3', name: 'Operator C', email: null, role: 'operator', stationCode: 'Y210' },
  ];
  const calls = {};
  const prisma = {
    instructionDocument: {
      findMany: async (args) => { calls.docs = args; return docs; },
    },
    user: {
      findMany: async (args) => { calls.users = args; return users; },
    },
  };
  const { GET } = loadRoute('../app/api/instructions/overview/route.ts', prisma);
  const response = await GET(new Request('http://localhost/api/instructions/overview?missingPage=9&acknowledgedPage=9&pageSize=2'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual({ missingTotal: body.missingTotal, acknowledgedTotal: body.acknowledgedTotal,
    missingPage: body.missingPage, acknowledgedPage: body.acknowledgedPage, pageSize: body.pageSize },
    { missingTotal: 4, acknowledgedTotal: 3, missingPage: 2, acknowledgedPage: 2, pageSize: 2 });
  assert.deepEqual(body.missing.map(row => `${row.documentId}:${row.operatorUid}`), ['d2:op3', 'd3:master1']);
  assert.deepEqual(body.acknowledged.map(row => `${row.documentId}:${row.operatorUid}`), ['d2:op2']);
  assert.deepEqual(body.summaries.map(row => [row.id, row.totalTargets, row.acknowledged]),
    [['d1', 2, 1], ['d2', 4, 2], ['d3', 1, 0]]);
  assert.equal(calls.docs.take, undefined);
  assert.equal(calls.users.take, undefined);
  assert.deepEqual(calls.docs.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
  assert.deepEqual(calls.users.orderBy, [{ role: 'asc' }, { name: 'asc' }, { id: 'asc' }]);
});
