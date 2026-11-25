// Хүлээлцэх хүсэлт нь хэнд ч очоогүй ээлж: «Ээлж дуусгах» дарсан ч илгээгээгүй, эсвэл буцаагдаад дахин
// илгээгээгүй. Ээлжийн хуудсанд анхааруулга; операторын «Нүүр» ба «Миний ээлж», мастерын «Нүүр»-т улаан
// жагсаалт. Өгөгдөл нь PC-2-ийн ҮЯ-180-ын бодит мөрүүд (Батмягмар, 2026-11-06 … 11-10): маягттай бүртгэл
// илгээгдээгүй, хоосон давхар нь батлагдсан.
//
//   node --import tsx --test --test-isolation=none testing/handover-unsent.test.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  UNSENT_HANDOVER_LOOKBACK_DAYS,
  completedWithoutRequestWarning,
  isCompletedWithoutHandoverRequest,
  isReturnedAwaitingResend,
  unsentCompletedShifts,
  unsentHandoverKind,
  unsentHandoverNotice,
} from '../lib/handover-unsent';
import { load } from './helpers/approvals-section.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

// Зөвхөн «Ээлж дуусгах» дарсан, илгээгээгүй ээлж (pressed_end_shift = true, sent = false, none).
const endedOnly = (over: Record<string, unknown> = {}) => ({
  id: 'x', shiftDate: '2026-11-10', shiftType: 'Шөнийн', stationCode: 'ҮЯ-180', status: 'Хадгалсан',
  createdAt: '2026-11-10T11:44:12.142Z', checkOut: '2026-11-11T00:05:00.000Z', operatorShiftCompleted: true,
  handoverAwaitingAcceptance: false, handoverRequestedAt: null, handoverStage: 'none',
  handoverFinalAcceptedAt: null, handoverReturnReason: null, masterApproved: false, adminApproved: false,
  ...over,
});
// Мастерт очиж батлагдсан ээлж.
const accepted = (over: Record<string, unknown> = {}) => endedOnly({
  status: 'Баталгаажсан', handoverStage: 'accepted', handoverRequestedAt: '2026-11-09T12:48:03.936Z',
  handoverFinalAcceptedAt: '2026-11-09T13:00:00.000Z', masterApproved: true, ...over,
});
// Мастер буцаасан ээлж: PATCH нь `operatorShiftCompleted`-ыг false болгож, `checkOut` ба
// `handoverRequestedAt`-ыг хэвээр үлдээнэ (app/api/shifts/[id]/route.ts, wantsHandoverReturn).
const returnedByMaster = (over: Record<string, unknown> = {}) => endedOnly({
  handoverStage: 'returned', handoverRequestedAt: '2026-11-10T23:50:00.000Z', operatorShiftCompleted: false,
  handoverReturnReason: 'Автоклавын цаг дутуу', ...over,
});

test('only a finished shift whose request was never sent counts as «unsent»', () => {
  assert.equal(isCompletedWithoutHandoverRequest(endedOnly()), true);
  assert.equal(isCompletedWithoutHandoverRequest(endedOnly({ operatorShiftCompleted: false })), true, 'checkOut alone also means finished');
  assert.equal(isCompletedWithoutHandoverRequest(endedOnly({ status: 'Ноорог' })), true);

  const notUnsent: Array<[string, Record<string, unknown>]> = [
    ['still running', { operatorShiftCompleted: false, checkOut: null }],
    ['request sent, waiting for the master', { handoverAwaitingAcceptance: true, handoverRequestedAt: '2026-11-11T00:00:00Z', handoverStage: 'waiting_current_master' }],
    ['request sent (timestamp only)', { handoverRequestedAt: '2026-11-11T00:00:00Z' }],
    ['returned by the master', { handoverStage: 'returned' }],
    ['already approved', { status: 'Баталгаажсан', masterApproved: true, handoverStage: 'accepted' }],
    ['admin approved', { adminApproved: true }],
    ['cancelled', { status: 'Цуцлагдсан' }],
  ];
  for (const [label, over] of notUnsent) assert.equal(isCompletedWithoutHandoverRequest(endedOnly(over)), false, label);
  assert.equal(isCompletedWithoutHandoverRequest(null), false);
});

test('a returned shift needs resending until it is sent again, however it was returned', () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ['returned by the master', returnedByMaster()],
    ['returned, then «Ээлж дуусгах» pressed again instead of resending', returnedByMaster({ operatorShiftCompleted: true })],
    // lib/approval-maintenance-service.ts `reopenedShift`: админ баталгааг цуцлахад handoverRequestedAt = null.
    ['reopened by an admin', returnedByMaster({ handoverRequestedAt: null })],
  ];
  for (const [label, shift] of cases) {
    assert.equal(isReturnedAwaitingResend(shift), true, label);
    assert.equal(unsentHandoverKind(shift), 'returned', label);
    assert.equal(isCompletedWithoutHandoverRequest(shift), false, `${label}: not double-counted as «unsent»`);
  }
  const resent = returnedByMaster({ handoverStage: 'waiting_current_master', handoverAwaitingAcceptance: true });
  assert.equal(unsentHandoverKind(resent), null, 'resent → back in the master queue');
  assert.equal(unsentHandoverKind(returnedByMaster({ status: 'Цуцлагдсан' })), null);
  assert.equal(unsentHandoverKind(returnedByMaster({ status: 'Баталгаажсан', adminApproved: true })), null);
  assert.equal(unsentHandoverKind(endedOnly()), 'unsent');
  assert.equal(unsentHandoverKind(accepted()), null);
  assert.equal(unsentHandoverKind(null), null);
});

test('real ҮЯ-180 data: lists the 4 unsent shifts newest first and flags the duplicates', () => {
  const shifts = [
    endedOnly({ id: 'A', shiftDate: '2026-11-10', shiftType: 'Шөнийн', createdAt: '2026-11-10T11:44:12.142Z' }),
    endedOnly({ id: 'B', shiftDate: '2026-11-09', shiftType: 'Өдрийн', createdAt: '2026-11-09T13:04:54.952Z' }),
    accepted({ id: 'C', shiftDate: '2026-11-09', shiftType: 'Өдрийн', createdAt: '2026-11-09T00:59:36.733Z' }),
    accepted({ id: 'D', shiftDate: '2026-11-07', shiftType: 'Шөнийн', createdAt: '2026-11-07T02:15:10.748Z' }),
    endedOnly({ id: 'E', shiftDate: '2026-11-07', shiftType: 'Шөнийн', createdAt: '2026-11-07T00:01:27.467Z' }),
    endedOnly({ id: 'F', shiftDate: '2026-11-06', shiftType: 'Өдрийн', createdAt: '2026-11-06T11:56:04.912Z' }),
    accepted({ id: 'G', shiftDate: '2026-11-06', shiftType: 'Өдрийн', createdAt: '2026-11-06T01:10:54.621Z' }),
    endedOnly({ id: 'OLD', shiftDate: '2026-09-20', shiftType: 'Өдрийн', createdAt: '2026-09-20T01:00:00.000Z' }),
    endedOnly({ id: 'SENT', shiftDate: '2026-11-11', shiftType: 'Өдрийн', handoverAwaitingAcceptance: true, handoverRequestedAt: '2026-11-11T11:00:00Z', handoverStage: 'waiting_current_master' }),
    endedOnly({ id: 'RUNNING', shiftDate: '2026-11-11', shiftType: 'Шөнийн', operatorShiftCompleted: false, checkOut: null }),
  ];
  const items = unsentCompletedShifts(shifts, '2026-11-11');
  assert.deepEqual(items.map((i) => [i.shift.id, i.kind, i.duplicateOfSent]), [
    ['A', 'unsent', false],
    ['B', 'unsent', true],
    ['E', 'unsent', true],
    ['F', 'unsent', true],
  ]);
  assert.equal(UNSENT_HANDOVER_LOOKBACK_DAYS, 30, 'shifts older than 30 days are not nagged about');
  assert.deepEqual(unsentCompletedShifts(undefined, '2026-11-11'), []);
});

test('returned shifts are listed too; a returned shift is not its own «duplicate»', () => {
  const items = unsentCompletedShifts([
    returnedByMaster({ id: 'R1', shiftDate: '2026-11-10' }),
    returnedByMaster({ id: 'R2', shiftDate: '2026-11-08' }),
    accepted({ id: 'TWIN', shiftDate: '2026-11-08' }),
    endedOnly({ id: 'U', shiftDate: '2026-11-09' }),
  ], '2026-11-11');
  assert.deepEqual(items.map((i) => [i.shift.id, i.kind, i.duplicateOfSent]), [
    ['R1', 'returned', false],
    ['U', 'unsent', false],
    ['R2', 'returned', true],
  ]);
});

test('a cancelled twin does not make an unsent shift a duplicate; Date createdAt sorts correctly', () => {
  const items = unsentCompletedShifts([
    endedOnly({ id: 'early', createdAt: new Date('2026-11-10T01:00:00Z') }),
    endedOnly({ id: 'late', createdAt: new Date('2026-11-10T09:00:00Z') }),
    accepted({ id: 'cancelled', status: 'Цуцлагдсан' }),
  ], '2026-11-11');
  assert.deepEqual(items.map((i) => [i.shift.id, i.duplicateOfSent]), [['late', false], ['early', false]]);
});

test('notice wording: operator → «мастерт», master station → «дараагийн мастерт», returned → resend', () => {
  const operator = unsentHandoverNotice('unsent', false);
  assert.equal(operator.title, 'Ээлж дууссан ч мастерт хүсэлт илгээгээгүй байна');
  assert.ok(operator.body.includes('Дээрээс мастераа сонгоод «Хүлээлцэх хүсэлт илгээх»'));

  const master = unsentHandoverNotice('unsent', true);
  assert.equal(master.title, 'Ээлж дууссан ч дараагийн мастерт хүсэлт илгээгээгүй байна');
  assert.ok(master.body.includes('хүлээн авах мастераа сонгоод «Хүлээлцэх хүсэлт илгээх»'));

  for (const isMasterStation of [false, true]) {
    const returned = unsentHandoverNotice('returned', isMasterStation);
    assert.equal(returned.title, 'Буцаагдсан ээлжийг дахин илгээгээгүй байна');
    assert.ok(returned.body.includes('«Хүлээлцэх хүсэлт илгээх» товчийг дахин дарна уу'));
  }
  assert.equal(completedWithoutRequestWarning(false), 'Мастерт хүсэлт хараахан илгээгээгүй байна — «Хүлээлцэх хүсэлт илгээх» товчийг дарна уу.');
  assert.equal(completedWithoutRequestWarning(true), 'Дараагийн мастерт хүсэлт хараахан илгээгээгүй байна — «Хүлээлцэх хүсэлт илгээх» товчийг дарна уу.');
});

// ───────────────────────────────────── улаан жагсаалт ─────────────────────────────────────

const req = createRequire(import.meta.url);
const { UnsentHandoverShifts } = load('components/dashboard/UnsentHandoverShifts.tsx', {
  'next/link': { default: ({ href, className, children }: any) => React.createElement('a', { href, className }, children) },
  'lucide-react': { AlertTriangle: () => null },
  '@/lib/handover-unsent': load('lib/handover-unsent.ts'),
  'react/jsx-runtime': req('react/jsx-runtime'),
}) as { UnsentHandoverShifts: (props: { shifts: unknown[]; today: string; ownMasterShift?: boolean }) => React.ReactElement | null };
const render = (shifts: unknown[], ownMasterShift = false) =>
  renderToStaticMarkup(React.createElement(UnsentHandoverShifts, { shifts, today: '2026-11-11', ownMasterShift }));

test('list: count, a link back to each shift, and the duplicate hint', () => {
  const html = render([
    endedOnly({ id: 'A', shiftDate: '2026-11-10' }),
    endedOnly({ id: 'B', shiftDate: '2026-11-09', shiftType: 'Өдрийн' }),
    accepted({ id: 'C', shiftDate: '2026-11-09', shiftType: 'Өдрийн' }),
  ]);
  assert.ok(html.includes('role="alert"'));
  assert.ok(html.includes('Мастерт хүсэлт илгээгээгүй ээлж (2)'));
  assert.ok(html.includes('«Ээлж дуусгах» нь мастерт юу ч илгээдэггүй'));
  assert.ok(html.includes('«Хүлээлцэх хүсэлт илгээх»'));
  assert.ok(html.includes('href="/shift/A"') && html.includes('href="/shift/B"'));
  assert.ok(!html.includes('href="/shift/C"'), 'the approved twin is not listed');
  assert.equal(html.split('давхар байж магадгүй').length - 1, 1, 'only B is flagged as a duplicate');
  assert.ok(!html.includes('Буцаагдсан'), 'no «returned» tag on never-sent shifts');
});

test('list: a returned shift is tagged with its reason; a master sees the «дараагийн мастерт» wording', () => {
  const html = render([returnedByMaster({ id: 'R' }), returnedByMaster({ id: 'R0', shiftDate: '2026-11-08', handoverReturnReason: null })]);
  assert.ok(html.includes('href="/shift/R"') && html.includes('href="/shift/R0"'));
  assert.ok(html.includes('Буцаагдсан — засаад дахин илгээнэ үү (шалтгаан: Автоклавын цаг дутуу)'));
  assert.equal(html.split('Буцаагдсан — засаад дахин илгээнэ үү').length - 1, 2);
  assert.equal(html.split('шалтгаан:').length - 1, 1, 'no empty reason for R0');

  const master = render([endedOnly({ id: 'M', stationCode: 'ҮЯ-099' })], true);
  assert.ok(master.includes('Хүлээлцэх хүсэлт илгээгээгүй ээлж (1)'));
  assert.ok(master.includes('«Ээлж дуусгах» нь дараагийн мастерт юу ч илгээдэггүй'));
  assert.ok(!master.includes('Мастерт хүсэлт илгээгээгүй ээлж'));
});

test('list: hidden when nothing is unsent, capped at 5 rows with «+N бусад»', () => {
  assert.equal(render([accepted({ id: 'C' })]), '');
  const seven = Array.from({ length: 7 }, (_, i) => endedOnly({ id: `S${i}`, shiftDate: `2026-11-0${i + 1}` }));
  const html = render(seven);
  assert.equal(html.split('href="/shift/').length - 1, 5);
  assert.ok(html.includes('+2 бусад'));
});

// ───────────────────────────────────── холболт (wiring) ─────────────────────────────────────

test('the shift page warns after «Ээлж дуусгах» and shows the banner until the request is sent', () => {
  const page = read('app/shift/[id]/page.tsx');
  assert.ok(page.includes("import { completedWithoutRequestWarning, unsentHandoverKind, unsentHandoverNotice } from '@/lib/handover-unsent'"));
  assert.ok(page.includes('const unsentKind = unsentHandoverKind(shift);'));
  assert.ok(page.includes('unsentKind ? unsentHandoverNotice(unsentKind, isMasterStationShift) : null'), 'wording follows the station kind');
  const banner = page.indexOf('{unsentNotice ? (');
  assert.ok(banner >= 0, 'banner is driven by the shared rule');
  assert.ok(page.indexOf('{unsentNotice.title}') > banner && page.indexOf('{unsentNotice.body}') > banner);
  assert.ok(banner < page.indexOf('onClick={handleRequestHandover}'), 'banner sits right above the send button');
  assert.ok(page.includes('${completedWithoutRequestWarning(isMasterStationShift)}'), 'toast after «Ээлж дуусгах»');
});

test('the list is on the operator «Нүүр» and «Миний ээлж» tabs and on the master «Нүүр»', () => {
  const home = read('components/dashboard/tabs/DashboardHomeTab.tsx');
  assert.ok(home.includes("import { UnsentHandoverShifts } from '../UnsentHandoverShifts'"));
  const operatorUse = home.indexOf('<UnsentHandoverShifts shifts={shifts} today={isoDateInTimeZone()} />');
  const masterUse = home.indexOf('<UnsentHandoverShifts shifts={shifts} today={isoDateInTimeZone()} ownMasterShift />');
  const masterBranch = home.indexOf("{profile?.role === 'master' ? (");
  assert.ok(operatorUse >= 0 && masterUse >= 0);
  assert.ok(operatorUse < masterBranch && masterBranch < masterUse, 'one in the operator view, one in the master view');

  const myShifts = read('components/dashboard/tabs/MyShiftsTab.tsx');
  assert.ok(myShifts.includes("import { UnsentHandoverShifts } from '../UnsentHandoverShifts'"));
  assert.ok(myShifts.includes('<UnsentHandoverShifts shifts={shifts} today={isoDateInTimeZone()} />'));

  // Мастерын «Нүүр»-ийн `shifts` нь өөрийнх нь ээлжүүд: Dashboard.tsx оператор, мастер хоёуланд ачаална.
  const dashboard = read('components/dashboard/Dashboard.tsx');
  assert.ok(dashboard.includes("const isSelfShiftView = profile?.role === 'operator' || profile?.role === 'master';"));
  assert.ok(dashboard.includes('isSelfShiftView ? `/api/shifts?queryType=operator&operatorUid=${profile.uid}` : null'));
  assert.ok(dashboard.includes('shifts={opShifts}'));
});
