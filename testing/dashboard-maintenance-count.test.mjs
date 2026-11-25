import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const filename = path.resolve(import.meta.dirname, '../app/api/dashboard/route.ts');

test('dashboard keeps a 20-item maintenance preview but returns the full open count', async () => {
  let countWhere;
  const prisma = {
    maintenanceRequest: {
      findMany: async ({ take }) => {
        assert.equal(take, 20);
        return Array.from({ length: 20 }, (_, index) => ({
          id: `maintenance-${index}`,
          status: 'Open',
          createdAt: new Date('2026-09-01T00:00:00Z'),
          updatedAt: new Date('2026-09-01T00:00:00Z'),
        }));
      },
      count: async ({ where }) => { countWhere = where; return 25; },
    },
    hseLog: { findMany: async () => [] },
    notification: { findMany: async () => [] },
    auditLog: { count: async () => 0, findMany: async () => [] },
  };
  const mocks = {
    'next/server': { NextResponse: { json: (body, options) => ({ status: options?.status ?? 200, json: async () => body }) } },
    'next-auth/next': { getServerSession: async () => ({ user: { id: 'admin', email: 'admin@test.invalid', role: 'admin' } }) },
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
  const response = await mod.exports.GET(new Request('http://localhost/api/dashboard'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.maintenanceRequests.length, 20);
  assert.equal(body.openMaintenanceCount, 25);
  assert.deepEqual(countWhere, { status: { in: ['Open', 'In Progress'] } });
});
