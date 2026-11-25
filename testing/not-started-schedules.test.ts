import assert from 'node:assert/strict';
import test from 'node:test';
import { startedScheduleCutoff } from '../lib/not-started-schedules';

test('today is not overdue before the day shift starts in Ulaanbaatar', () => {
  for (const time of ['2026-09-20T16:00:00Z', '2026-09-20T23:59:59.999Z']) {
    assert.deepEqual(startedScheduleCutoff(new Date(time)), { date: '2026-09-21', shiftTypes: [] });
  }
});

test('the day shift becomes due at 08:00, and tonight stays in the future until 20:00', () => {
  for (const time of ['2026-09-21T00:00:00Z', '2026-09-21T11:59:59.999Z']) {
    assert.deepEqual(startedScheduleCutoff(new Date(time)), { date: '2026-09-21', shiftTypes: ['Өдрийн'] });
  }
});

test('the night shift becomes due at 20:00 inclusive', () => {
  for (const time of ['2026-09-21T12:00:00Z', '2026-09-21T15:59:59.999Z']) {
    assert.deepEqual(startedScheduleCutoff(new Date(time)), { date: '2026-09-21', shiftTypes: ['Өдрийн', 'Шөнийн'] });
  }
});

test('midnight, month and year boundaries use the local schedule date', () => {
  for (const [time, date] of [
    ['2026-09-30T16:00:00Z', '2026-10-01'],
    ['2026-12-31T16:00:00Z', '2027-01-01'],
  ]) {
    assert.deepEqual(startedScheduleCutoff(new Date(time)), { date, shiftTypes: [] });
  }
});

test('the server timezone cannot change which schedules are due', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['UTC', 'America/Los_Angeles', 'Asia/Ulaanbaatar']) {
      process.env.TZ = zone;
      assert.deepEqual(startedScheduleCutoff(new Date('2026-09-21T00:00:00Z')), {
        date: '2026-09-21', shiftTypes: ['Өдрийн'],
      });
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
