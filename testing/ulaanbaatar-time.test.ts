import assert from 'node:assert/strict';
import test from 'node:test';
import { parseUlaanbaatarLocal, toUlaanbaatarLocalInput } from '../lib/ulaanbaatar-time';
import { isoDateInTimeZone } from '../lib/handover-window';

test('a wall-clock time typed by an operator round trips through storage unchanged', () => {
  for (const wall of ['2026-08-18T13:45', '2026-09-21T00:00', '2026-12-31T23:59', '2026-01-01T00:00']) {
    const utc = parseUlaanbaatarLocal(wall);
    assert.ok(utc, `Lost ${wall}`);
    assert.equal(toUlaanbaatarLocalInput(utc), wall, `${wall} shifted`);
  }
});

test('Ulaanbaatar is stored as UTC+8', () => {
  assert.equal(parseUlaanbaatarLocal('2026-08-18T13:45')!.toISOString(), '2026-08-18T05:45:00.000Z');
  // Шөнө дундын өмнөх цаг өмнөх өдрийн UTC болно.
  assert.equal(parseUlaanbaatarLocal('2026-01-01T07:00')!.toISOString(), '2025-12-31T23:00:00.000Z');
  assert.equal(toUlaanbaatarLocalInput('2026-08-18T05:45:00.000Z'), '2026-08-18T13:45');
});

test('an already zoned ISO string is trusted as-is, so older clients and direct API calls still work', () => {
  assert.equal(parseUlaanbaatarLocal('2026-08-18T05:45:00.000Z')!.toISOString(), '2026-08-18T05:45:00.000Z');
  assert.equal(parseUlaanbaatarLocal('2026-08-18T13:45:00+08:00')!.toISOString(), '2026-08-18T05:45:00.000Z');
  assert.equal(parseUlaanbaatarLocal('2026-08-18T13:45:00+0800')!.toISOString(), '2026-08-18T05:45:00.000Z');
});

test('nonsense never becomes a silently rolled-over date', () => {
  for (const bad of [
    '', '   ', 'өчигдөр', null, undefined, 0, {},
    '2026-13-01T10:00',   // сар 13
    '2026-09-32T10:00',   // өдөр 32
    '2026-09-15T25:00',   // цаг 25
    '2026-09-15T10:61',   // минут 61
    '18/08/2026 13:45',   // өөр формат
  ]) {
    assert.equal(parseUlaanbaatarLocal(bad), null, `Accepted ${JSON.stringify(bad)}`);
  }
  for (const bad of [null, undefined, '', 'nonsense', new Date('x')]) {
    assert.equal(toUlaanbaatarLocalInput(bad as any), '');
  }
});

test('the bug that made an announcement expire before it was published cannot recur', () => {
  // ӨМНӨ НЬ: засах формыг `toISOString().slice(0,16)`-аар дүүргэдэг байсан тул
  // 13:45 гэж хадгалсан хугацаа талбарт 05:45 болж харагдаж, дахин хадгалах бүрт
  // 8 цагаар ухарч байв. Бодит өгөгдөлд «13:46-д үүссэн, 13:45-д дуусах» гэсэн
  // зарлал ингэж үүссэн.
  const stored = new Date('2026-08-18T05:45:00.000Z'); // = УБ-аар 13:45
  const shownByOldCode = stored.toISOString().slice(0, 16);
  const shownNow = toUlaanbaatarLocalInput(stored);

  assert.equal(shownByOldCode, '2026-08-18T05:45', 'хуучин алдааг баримтжуулав');
  assert.equal(shownNow, '2026-08-18T13:45');

  // Засалгүй дахин хадгалахад хугацаа ХЭВЭЭР үлдэх ёстой.
  assert.equal(parseUlaanbaatarLocal(shownNow)!.getTime(), stored.getTime());
  // Хуучин кодоор бол 8 цагаар ухарна.
  assert.equal(
    stored.getTime() - parseUlaanbaatarLocal(shownByOldCode)!.getTime(),
    8 * 60 * 60 * 1000,
    'хуучин зан үйл нь 8 цагийн ухралт байсан'
  );
});

test('the bug that gave a shift started before 08:00 the previous (UTC) date cannot recur', () => {
  // ӨМНӨ НЬ: /shift/new анхдагч огноог `new Date().toISOString().split('T')[0]`-аар
  // (UTC) авдаг байсан тул УБ-аар 00:00-07:59 хооронд өчигдрийн огноо гарч, өглөөний
  // хүлээлцэлтийн (07:30-07:59) дараа эхлүүлсэн ээлж буруу огноотой үүсдэг байв.
  const at0745 = new Date('2026-09-27T23:45:00Z'); // = УБ-аар 2026-09-28 07:45
  const shownByOldCode = at0745.toISOString().split('T')[0];

  assert.equal(shownByOldCode, '2026-09-27', 'хуучин алдааг баримтжуулав');
  assert.equal(isoDateInTimeZone(at0745), '2026-09-28');

  // УБ-ын шөнө дунд = UTC 16:00 — огноо яг энэ мөчид солигдоно.
  assert.equal(isoDateInTimeZone(new Date('2026-09-27T15:59:59.999Z')), '2026-09-27');
  assert.equal(isoDateInTimeZone(new Date('2026-09-27T16:00:00Z')), '2026-09-28');
});
