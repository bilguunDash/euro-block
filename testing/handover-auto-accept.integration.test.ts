// Автомат хүлээн авалтыг ЖИНХЭНЭ схем дээр шалгана: Prisma-ийн талбарын нэрс, `where`, `updateMany`,
// мөн хүлээн авсан ээлж админы жагсаалтын (admin_pending) нөхцөлд таарч буй эсэх.
// Локал PostgreSQL (`euroblock_local`) дээр НЭГ transaction дотор ажиллаад БҮГДИЙГ буцаана (rollback) —
// ямар ч мөр үлдэхгүй. DB асаагүй бол тест алгасагдана.
//
//   node --import tsx --test --test-isolation=none testing/handover-auto-accept.integration.test.ts
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { AUTO_ACCEPT_COMMENT, autoAcceptHandoversOnShiftStart } from '../lib/handover-auto-accept';

class Rollback extends Error {}

test('auto-accept against the real schema; every change is rolled back', { timeout: 60_000 }, async (t) => {
  const root = path.resolve(import.meta.dirname, '..');
  const envFile = ['.env.local', '.env'].map((file) => path.join(root, file)).find((file) => fs.existsSync(file));
  if (!envFile) return t.skip('no local database configuration');
  const url = new URL(parse(fs.readFileSync(envFile)).DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'only a loopback PostgreSQL server may be used');
  assert.equal(url.pathname, '/euroblock_local', 'only the known local database may be used');

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) });
  try {
    try {
      await db.$queryRaw`SELECT 1`;
    } catch {
      return t.skip('local PostgreSQL is not running');
    }

    // Санамсаргүй uid — жинхэнэ өгөгдөлтэй хэзээ ч давхцахгүй.
    const next = `test-next-${randomUUID()}`;
    const prev = `test-prev-${randomUUID()}`;
    const pending = (over: Record<string, unknown> = {}) => ({
      operatorUid: prev, operatorName: 'Test previous operator', stationCode: 'ҮЯ-190',
      shiftDate: '2026-11-10', shiftType: 'Шөнийн', status: 'Хадгалсан', operatorShiftCompleted: true,
      handoverStage: 'waiting_next_operator', handoverAwaitingAcceptance: true,
      handoverRequestedAt: '2026-11-10T23:50:00.000Z', nextOperatorUid: next, handoverToOperatorUid: next,
      currentMasterUid: 'test-master', currentMasterName: 'Test master',
      currentMasterApprovedAt: '2026-11-11T00:10:00.000Z', currentMasterApprovedByName: 'Test master',
      ...over,
    });
    // Админы «баталгаажуулах» жагсаалтын нөхцөл (app/api/shifts/route.ts, queryType=admin_pending).
    const adminPending = (ids: string[]) => ({
      id: { in: ids },
      adminApproved: false,
      OR: [
        { masterApproved: true },
        { currentMasterApprovedAt: { not: null }, OR: [{ handoverStage: 'accepted' }, { handoverFinalAcceptedAt: { not: null } }] },
      ],
    });

    await db.$transaction(async (tx) => {
      const recent = await tx.shift.create({ data: pending() });
      const backlog = await tx.shift.create({ data: pending({ shiftDate: '2026-09-28', shiftType: 'Өдрийн' }) });
      const otherStation = await tx.shift.create({ data: pending({ stationCode: 'ҮЯ-160' }) });
      const later = await tx.shift.create({ data: pending({ shiftDate: '2026-11-11', shiftType: 'Шөнийн' }) });
      const otherPerson = await tx.shift.create({ data: pending({ nextOperatorUid: `${next}-x`, handoverToOperatorUid: `${next}-x` }) });
      const masterPending = await tx.shift.create({ data: pending({ handoverStage: 'waiting_current_master', currentMasterApprovedAt: null }) });
      const all = [recent, backlog, otherStation, later, otherPerson, masterPending].map((row) => row.id);
      assert.equal(await tx.shift.count({ where: adminPending(all) }), 0, 'none is visible to the admin before');

      const now = '2026-11-11T00:30:00.000Z';
      const accepted = await autoAcceptHandoversOnShiftStart(
        tx,
        { operatorUid: next, operatorName: 'Test next operator', stationCode: 'ҮЯ-190', shiftDate: '2026-11-11', shiftType: 'Өдрийн' },
        now,
      );
      assert.deepEqual(accepted.map((row) => row.id), [backlog.id, recent.id], 'oldest first');

      for (const id of [recent.id, backlog.id]) {
        const row = await tx.shift.findUniqueOrThrow({ where: { id } });
        assert.equal(row.handoverStage, 'accepted');
        assert.equal(row.handoverAwaitingAcceptance, false);
        assert.equal(row.handoverAcceptedByUid, next);
        assert.equal(row.handoverAcceptedByName, 'Test next operator (автоматаар)');
        assert.equal(row.handoverAcceptedAt, now);
        assert.equal(row.handoverFinalAcceptedAt, now);
        assert.equal(row.masterApproved, true);
        assert.equal(row.masterApprovedBy, 'Test master');
        assert.equal(row.masterApprovedDate, '2026-11-11T00:10:00.000Z');
        assert.equal(row.status, 'Хадгалсан', 'admin approval is still to come');
        const approvals = await tx.shiftHandoverApproval.findMany({ where: { shiftId: id } });
        assert.deepEqual(
          approvals.map((a) => [a.stage, a.action, a.actorUid, a.actorName, a.comment]),
          [['waiting_next_operator', 'accepted', next, 'Test next operator', AUTO_ACCEPT_COMMENT]],
        );
      }
      assert.equal(await tx.shift.count({ where: adminPending(all) }), 2, 'both now reach the admin approval list');

      for (const id of [otherStation.id, later.id, otherPerson.id, masterPending.id]) {
        const row = await tx.shift.findUniqueOrThrow({ where: { id } });
        assert.equal(row.handoverAwaitingAcceptance, true, 'unrelated handovers are untouched');
        assert.equal(row.handoverAcceptedByUid, null);
        assert.equal(await tx.shiftHandoverApproval.count({ where: { shiftId: id } }), 0);
      }

      // Дахин дуудахад юу ч өөрчлөгдөхгүй (аль хэдийн хүлээн авсан).
      assert.deepEqual(await autoAcceptHandoversOnShiftStart(
        tx, { operatorUid: next, operatorName: 'Test next operator', stationCode: 'ҮЯ-190', shiftDate: '2026-11-11', shiftType: 'Өдрийн' }, now,
      ), []);

      throw new Rollback();
    }, { timeout: 30_000 }).catch((error) => {
      if (!(error instanceof Rollback)) throw error;
    });

    assert.equal(await db.shift.count({ where: { OR: [{ operatorUid: prev }, { nextOperatorUid: { startsWith: next } }] } }), 0, 'nothing was left behind');
  } finally {
    await db.$disconnect();
  }
});
