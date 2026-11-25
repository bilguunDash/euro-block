import assert from 'node:assert/strict';
import test from 'node:test';
import { countDistinctAttentionByCategory, countDistinctAttentionShifts } from '../lib/dashboard-attention';
import { isMasterPendingOwner } from '../lib/master-pending';

test('current and next masters own their respective pending stages', () => {
  assert.equal(isMasterPendingOwner({ handoverStage: 'waiting_current_master', currentMasterUid: 'm1' }, 'm1'), true);
  // The stored shiftMasterUid can still point at the previous master here.
  assert.equal(isMasterPendingOwner({ handoverStage: 'waiting_next_master', nextMasterUid: 'm2' }, 'm2'), true);
  assert.equal(isMasterPendingOwner({ handoverStage: 'waiting_next_master', nextMasterUid: 'm2' }, 'm1'), false);
  assert.equal(isMasterPendingOwner({ handoverStage: 'waiting_next_master', nextMasterUid: 'm2', nextOperatorUid: 'op' }, 'm2'), false);
  assert.equal(isMasterPendingOwner({ handoverStage: 'accepted', currentMasterUid: 'm1' }, 'm1'), false);
});

test('the same shift in master, admin, handover and missing lists counts once', () => {
  const shift = { id: 'shift-1' };
  assert.equal(countDistinctAttentionShifts([
    [shift],
    [{ id: 'admin-log-1', shiftId: 'shift-1' }],
    [{ id: 'shift-1' }],
    [{ shift }],
    [shift],
  ]), 1);
});

test('master form IDs count by their shift ID, including repeated forms for one shift', () => {
  assert.equal(countDistinctAttentionShifts([
    [{ id: 'shift-1' }, { id: 'shift-2' }],
    [{ id: 'log-1', shiftId: 'shift-1' }, { id: 'log-2', shiftId: 'shift-1' }, { id: 'log-3', shiftId: 'shift-3' }],
    [{ shift: { id: 'shift-2' } }],
  ]), 3);
});

test('master home does not add a handover twice when it also awaits master approval', () => {
  assert.equal(countDistinctAttentionShifts([
    [{ shift: { id: 'active-incomplete' } }],
    [{ id: 'waiting-current-master' }, { id: 'waiting-next-master' }],
    [{ id: 'waiting-current-master' }, { id: 'waiting-next-master' }],
  ]), 3);
});

test('missing IDs cannot silently hide an attention item', () => {
  assert.equal(countDistinctAttentionShifts([[], [{}, { id: 'shift-1' }, null]]), 2);
});

test('admin attention breakdown assigns overlapping shifts to one visible row', () => {
  const groups = [
    [{ id: 'shift-1' }, { id: 'log-2', shiftId: 'shift-2' }], // admin
    [{ shift: { id: 'shift-2' } }, { shift: { id: 'shift-3' } }], // missing
    [{ id: 'shift-1' }, { id: 'shift-4' }], // master
    [{ id: 'shift-3' }, { id: 'shift-5' }], // handover
  ];
  const counts = countDistinctAttentionByCategory(groups);
  assert.deepEqual(counts, [2, 1, 1, 1]);
  const openMaintenance = 7; // Counted separately; maintenance has no shift ID.
  assert.equal(counts.reduce((sum, count) => sum + count, openMaintenance), 12);
  assert.equal(countDistinctAttentionShifts(groups) + openMaintenance, 12);
});
