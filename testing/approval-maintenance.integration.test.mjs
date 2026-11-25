import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { Client } from 'pg';
import { parse } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';
import { approvalRoutes, invoke, maintenance, projectRoot } from './helpers/approval-routes.mjs';

const logType = 'modal_y310_repair_master_form';
const userIds = { owner: 'test-owner', other: 'test-other', master: 'test-master', admin: 'test-admin' };
const actor = { id: userIds.admin, name: 'Test admin', role: 'admin' };

async function expectStatus(response, status) {
  assert.equal(response.status, status, JSON.stringify(await response.clone().json()));
  return response.json();
}

async function seedShift(db, overrides = {}) {
  return db.shift.create({ data: {
    operatorUid: userIds.owner, operatorName: 'Original owner', stationCode: 'ҮЯ-310',
    shiftDate: '2026-09-28', shiftType: 'Өдрийн', status: 'Баталгаажсан',
    masterApproved: true, adminApproved: true, operatorShiftCompleted: true,
    shiftMasterUid: userIds.master, handoverStage: 'accepted', currentMasterApprovedAt: '2026-09-28T10:00:00Z',
    handoverFinalAcceptedAt: '2026-09-28T12:00:00Z', checkOut: '2026-09-28T12:00:00Z', notes: 'Preserve content',
    productionLogs: { create: [0, 1].map(sortOrder => ({ logType, sortOrder, data: { needsAdminApproval: true, adminApproved: true, notes: `Version ${sortOrder}` } })) },
    ...overrides,
  }, include: { productionLogs: { orderBy: { sortOrder: 'asc' } } } });
}

test('approval maintenance against an isolated PostgreSQL database with the local schema', { timeout: 120_000 }, async t => {
  const envFile = ['.env.local', '.env'].map(file => path.join(projectRoot, file)).find(file => fs.existsSync(file));
  assert.ok(envFile, 'local database configuration is required');
  const url = new URL(parse(fs.readFileSync(envFile)).DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'integration tests require a loopback PostgreSQL server');
  assert.equal(url.port, '5432');
  assert.equal(url.pathname, '/euroblock_local', 'only the known local connection may be used to create the test database');
  const databaseName = `euroblock_approval_test_${randomUUID().replaceAll('-', '')}`;
  const validFixtureName = /^euroblock_approval_test_[0-9a-f]{32}$/;
  assert.match(databaseName, validFixtureName);
  const adminUrl = new URL(url); adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.href });
  const testUrl = new URL(url); testUrl.pathname = `/${databaseName}`;
  let db, created = false;
  await admin.connect();
  try {
    // No application data is copied. Only this random, empty fixture DB is mutated.
    await admin.query(`CREATE DATABASE "${databaseName}"`); created = true;
    const portableDump = path.resolve(projectRoot, '../.local-postgresql/18/pgsql/bin/pg_dump.exe');
    const schemaDump = spawnSync(fs.existsSync(portableDump) ? portableDump : 'pg_dump', ['--schema-only', '--no-owner', '--no-privileges'], {
      cwd: projectRoot, encoding: 'utf8', timeout: 60_000, windowsHide: true,
      env: { ...process.env, PGHOST: url.hostname, PGPORT: url.port, PGDATABASE: 'euroblock_local', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password) },
    });
    assert.equal(schemaDump.status, 0, 'read-only schema snapshot failed; pg_dump must match the local PostgreSQL version');
    // Use the deployed constraints, including any local schema drift, rather than
    // assuming the Prisma schema exactly represents the local database. No rows,
    // users, passwords or migration history are copied from the application DB.
    const schemaSql = schemaDump.stdout.replace(/^\\(?:un)?restrict\b.*\r?\n/gm, '');
    const fixtureClient = new Client({ connectionString: testUrl.href });
    await fixtureClient.connect();
    try { await fixtureClient.query(schemaSql); } finally { await fixtureClient.end(); }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl.href }) });
    await db.user.createMany({ data: [
      { id: userIds.owner, name: 'Original owner', role: 'operator', isApproved: true },
      { id: userIds.other, name: 'Original owner', role: 'operator', isApproved: true },
      { id: userIds.master, name: 'Test master', role: 'master', isApproved: true },
      { id: userIds.admin, name: 'Test admin', role: 'admin', isApproved: true },
    ] });

    await t.test('cancel persists exact owner notification and corrected form becomes pending under the real SQL predicate', async () => {
      const shift = await seedShift(db); const log = shift.productionLogs[1];
      let sessionUser = actor; const routes = approvalRoutes(db, () => sessionUser);
      await expectStatus(await invoke(routes.manage.PATCH, { kind: 'master_form', state: 'approved', id: log.id }), 200);
      const returned = await db.shift.findUniqueOrThrow({ where: { id: shift.id } });
      assert.equal(returned.operatorUid, userIds.owner); assert.equal(returned.handoverStage, 'returned');
      assert.equal(returned.masterApproved, false); assert.equal(returned.adminApproved, false);
      assert.equal(returned.checkOut, shift.checkOut); assert.equal(returned.notes, shift.notes);
      const notifications = await db.notification.findMany({ where: { link: `/shift/${shift.id}`, kind: 'approval_returned' } });
      assert.deepEqual(notifications.map(row => row.userId), [userIds.owner]);
      await expectStatus(await invoke(routes.forms.PATCH, { logId: log.id, action: 'approve' }), 409);
      sessionUser = { id: userIds.owner, name: 'Original owner', role: 'operator', stationCode: 'ҮЯ-110' };
      await expectStatus(await invoke(routes.logs.POST, { type: logType, data: { needsAdminApproval: true, notes: 'Corrected', adminApproved: true, adminRejected: true } }, shift.id, 'POST'), 200);
      sessionUser = actor;
      await expectStatus(await invoke(routes.forms.PATCH, { logId: log.id, action: 'approve' }), 200);
      const approved = await db.productionLog.findUniqueOrThrow({ where: { id: log.id } });
      assert.equal(approved.data.adminApproved, true); assert.equal(approved.data.notes, 'Corrected');
      assert.equal(await db.productionLog.count({ where: { shiftId: shift.id, logType } }), 2);
    });

    await t.test('shift deletion cascades through all child tables and excludes another shift and schedule', async () => {
      const shift = await seedShift(db, {
        equipmentInspections: { create: { tableType: 'inspection', comment: 'Fixture' } },
        measurementRows: { create: { autoclaveEntries: { create: { autoclaveNumber: 1 } } } },
        repairEntries: { create: { entryType: 'repair_work' } }, ingredientRecords: { create: { label: 'Fixture' } },
        flowMetricsTotal: { create: {} },
        shiftImages: { create: { storagePath: `fixture/${randomUUID()}`, publicUrl: '/fixture/no-file-created', mimeType: 'image/png', sizeBytes: 1, uploadedByUid: userIds.owner } },
        handoverApprovals: { create: { stage: 'accepted', action: 'approved', actorUid: userIds.master } },
      });
      const other = await seedShift(db);
      const hse = await db.hseLog.create({ data: { shiftId: shift.id, stationCode: shift.stationCode, operatorUid: userIds.owner, incidents: '[]' } });
      const otherHse = await db.hseLog.create({ data: { shiftId: other.id, stationCode: other.stationCode, operatorUid: userIds.other, incidents: '[]' } });
      const schedule = await db.operatorSchedule.create({ data: { operatorUid: userIds.owner, operatorName: 'Original owner', stationCode: shift.stationCode, shiftDate: shift.shiftDate, shiftType: shift.shiftType } });
      const rows = await db.measurementRow.findMany({ where: { shiftId: shift.id } });
      await db.$transaction(tx => maintenance.maintainApprovalRecord(tx, { kind: 'shift', state: 'approved', id: shift.id }, 'delete', actor), { isolationLevel: 'Serializable' });
      assert.equal(await db.shift.findUnique({ where: { id: shift.id } }), null);
      for (const model of ['equipmentInspection', 'measurementRow', 'productionLog', 'repairEntry', 'ingredientRecord', 'flowMetricsTotal', 'shiftImage', 'shiftHandoverApproval', 'hseLog']) {
        assert.equal(await db[model].count({ where: { shiftId: shift.id } }), 0, `${model} must not leave orphaned records`);
      }
      assert.equal(await db.autoclaveEntry.count({ where: { measurementRowId: { in: rows.map(row => row.id) } } }), 0);
      assert.equal(await db.hseLog.findUnique({ where: { id: hse.id } }), null);
      assert.ok(await db.hseLog.findUnique({ where: { id: otherHse.id } }));
      assert.ok(await db.shift.findUnique({ where: { id: other.id } }));
      assert.ok(await db.operatorSchedule.findUnique({ where: { id: schedule.id } }));
      assert.equal(await db.auditLog.count({ where: { entityId: shift.id, action: 'approval_shift_deleted' } }), 1);
    });

    await t.test('master form deletion removes all historical versions while preserving unrelated forms and shifts', async () => {
      const shift = await seedShift(db); const other = await seedShift(db);
      const unrelated = await db.productionLog.create({ data: { shiftId: shift.id, logType: 'modal_periodic_logs', data: { notes: 'Keep' } } });
      await db.$transaction(tx => maintenance.maintainApprovalRecord(tx, { kind: 'master_form', state: 'approved', id: shift.productionLogs[1].id }, 'delete', actor), { isolationLevel: 'Serializable' });
      assert.equal(await db.productionLog.count({ where: { shiftId: shift.id, logType } }), 0);
      assert.ok(await db.productionLog.findUnique({ where: { id: unrelated.id } }));
      assert.equal(await db.productionLog.count({ where: { shiftId: other.id, logType } }), 2);
      assert.equal((await db.shift.findUniqueOrThrow({ where: { id: shift.id } })).handoverStage, 'returned');
    });

    await t.test('actual database persists cancel → owner edit → resubmit → master acceptance → admin approval', async () => {
      const shift = await seedShift(db);
      let sessionUser = actor; const routes = approvalRoutes(db, () => sessionUser);
      await expectStatus(await invoke(routes.manage.PATCH, { kind: 'shift', state: 'approved', id: shift.id }), 200);
      sessionUser = { id: userIds.master, name: 'Test master', role: 'master' };
      await expectStatus(await invoke(routes.shift.PATCH, { masterApproved: true }, shift.id), 403);
      sessionUser = { id: userIds.other, name: 'Original owner', role: 'operator', stationCode: 'ҮЯ-310' };
      await expectStatus(await invoke(routes.shift.PATCH, { notes: 'Wrong owner' }, shift.id), 403);
      sessionUser = { id: userIds.owner, name: 'Original owner', role: 'operator', stationCode: 'ҮЯ-110' };
      await expectStatus(await invoke(routes.shift.PATCH, { notes: 'Corrected by owner' }, shift.id), 200);
      await expectStatus(await invoke(routes.shift.PATCH, { handoverAwaitingAcceptance: true, operatorShiftCompleted: true, confirmMasterUid: userIds.master }, shift.id), 200);
      assert.equal((await db.shift.findUniqueOrThrow({ where: { id: shift.id } })).handoverStage, 'waiting_current_master');
      sessionUser = actor;
      await expectStatus(await invoke(routes.shift.PATCH, { adminApproved: true, status: 'Баталгаажсан' }, shift.id), 403);
      sessionUser = { id: userIds.master, name: 'Test master', role: 'master' };
      await expectStatus(await invoke(routes.shift.PATCH, { handoverAwaitingAcceptance: false, handoverAcceptedAt: new Date().toISOString() }, shift.id), 200);
      sessionUser = actor;
      await expectStatus(await invoke(routes.shift.PATCH, { adminApproved: true, status: 'Баталгаажсан' }, shift.id), 200);
      const approved = await db.shift.findUniqueOrThrow({ where: { id: shift.id } });
      assert.equal(approved.operatorUid, userIds.owner); assert.equal(approved.notes, 'Corrected by owner');
      assert.equal(approved.masterApproved, true); assert.equal(approved.adminApproved, true); assert.equal(approved.status, 'Баталгаажсан');
    });

    await t.test('PostgreSQL rollback restores real cascaded child records when auditing fails', async () => {
      for (const action of ['cancel', 'delete']) {
        const shift = await seedShift(db);
        await assert.rejects(db.$transaction(async tx => {
          const failingTx = new Proxy(tx, { get(target, property) {
            if (property === 'auditLog') return { create: async () => { throw new Error('Injected audit failure'); } };
            return Reflect.get(target, property);
          } });
          await maintenance.maintainApprovalRecord(failingTx, { kind: 'shift', state: 'approved', id: shift.id }, action, actor);
        }, { isolationLevel: 'Serializable' }), /Injected audit failure/);
        const unchanged = await db.shift.findUniqueOrThrow({ where: { id: shift.id } });
        assert.equal(unchanged.adminApproved, true); assert.equal(unchanged.masterApproved, true);
        assert.equal(await db.productionLog.count({ where: { shiftId: shift.id } }), 2);
        assert.equal(await db.notification.count({ where: { link: `/shift/${shift.id}` } }), 0);
        assert.equal(await db.shiftHandoverApproval.count({ where: { shiftId: shift.id } }), 0);
      }
    });
  } finally {
    await db?.$disconnect();
    try {
      if (created) {
        // Never drop an externally supplied database name or the application DB.
        assert.match(databaseName, validFixtureName); assert.notEqual(databaseName, 'euroblock_local');
        await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      }
    } finally { await admin.end(); }
  }
});
