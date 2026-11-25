import assert from 'node:assert/strict';
import test from 'node:test';
import {
  currentDashboardSlot,
  initialDashboardClockState,
  refreshDashboardClockState,
  selectDashboardDate,
  selectDashboardShiftType,
} from '../lib/dashboard-clock';

test('dashboard date and shift follow Ulaanbaatar midnight, 08:00 and 20:00', () => {
  const cases = [
    ['2026-09-28T15:59:59Z', '2026-09-28', 'Шөнийн'],
    ['2026-09-28T16:00:00Z', '2026-09-29', 'Шөнийн'],
    ['2026-09-28T23:59:59Z', '2026-09-29', 'Шөнийн'],
    ['2026-09-29T00:00:00Z', '2026-09-29', 'Өдрийн'],
    ['2026-09-29T11:59:59Z', '2026-09-29', 'Өдрийн'],
    ['2026-09-29T12:00:00Z', '2026-09-29', 'Шөнийн'],
  ] as const;
  for (const [timestamp, date, shiftType] of cases) {
    assert.deepEqual(currentDashboardSlot(new Date(timestamp)), { date, shiftType });
  }
});

test('untouched dashboard selection rolls forward at each Ulaanbaatar boundary', () => {
  const beforeMidnight = initialDashboardClockState(new Date('2026-09-28T15:59:59Z'));
  const afterMidnight = refreshDashboardClockState(beforeMidnight, new Date('2026-09-28T16:00:00Z'));
  assert.deepEqual(afterMidnight.selected, { date: '2026-09-29', shiftType: 'Шөнийн' });
  const afterDayStarts = refreshDashboardClockState(afterMidnight, new Date('2026-09-29T00:00:00Z'));
  assert.deepEqual(afterDayStarts.selected, { date: '2026-09-29', shiftType: 'Өдрийн' });
  assert.equal(refreshDashboardClockState(afterDayStarts, new Date('2026-09-29T00:01:00Z')), afterDayStarts);
});

test('manual date or shift selection survives clock changes while the current date advances', () => {
  const initial = initialDashboardClockState(new Date('2026-09-28T11:00:00Z'));
  for (const manuallySelected of [
    selectDashboardDate(initial, '2026-09-01'),
    selectDashboardShiftType(initial, 'Өдрийн'),
  ]) {
    const later = refreshDashboardClockState(manuallySelected, new Date('2026-09-28T16:00:00Z'));
    assert.deepEqual(later.selected, manuallySelected.selected);
    assert.deepEqual(later.current, { date: '2026-09-29', shiftType: 'Шөнийн' });
    assert.equal(later.manuallySelected, true);
  }
});
