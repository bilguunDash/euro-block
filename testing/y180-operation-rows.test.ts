// ҮЯ-180: цагийн хүснэгтийг MS Forms «Автоклавын операторын бүртгэл»-ийн мөрийн бүртгэлээр сольсон
// (мөр бүр = нэг ажилбар). Мөр нэмэх/бөглөх/устгах/хадгалах, хуучин (formVersion 1) бүртгэл хэвээр
// харагдаж хадгалагдах, Excel тайланд мөр бүр тусдаа гарахыг шалгана.
//
//   node --import tsx --test --test-isolation=none testing/y180-operation-rows.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Y180AutoclaveOperatorReadOnly } from '../components/shift/Y180AutoclaveOperatorReadOnly';
import { Y180AutoclaveOperatorForm as Y180FormForSsr } from '../components/shift/forms/Y180AutoclaveOperatorForm';
import { ToastProvider } from '../components/ui/ToastProvider';
import { flattenLogData } from '../lib/kpi-log-export';
import {
  createEmptyY180Payload,
  emptyY180OperationRow,
  mergeY180TimeRows,
  normalizeY180OperationRows,
  y180HasLegacyTimeData,
  y180OperationRowHasData,
  y180TimeRowHasData,
  type Y180AutoclaveOperatorPayload,
  type Y180OperationRow,
} from '../lib/y180-autoclave-operator-form';
import { load, nodes, textOf } from './helpers/approvals-section.mjs';

// The test runner uses classic JSX for TSX components; Next provides this at runtime.
(globalThis as any).React = React;

const base = { shiftDate: '2026-11-04', shiftType: 'Өдрийн', operatorUid: 'u1', operatorName: 'Д.Нямдорж' };
const row = (id: string, patch: Partial<Y180OperationRow> = {}): Y180OperationRow => ({ ...emptyY180OperationRow('Д.Нямдорж', id), ...patch });

function newPayload(): Y180AutoclaveOperatorPayload {
  return {
    ...createEmptyY180Payload(base),
    submittedAt: '2026-11-04T05:00:00.000Z',
    operationRows: [
      row('a', { blockSize: '250', autoclaveNum: '3', loadDirection: 'оруулсан', startedTime: '13:50' }),
      row('b', {
        blockSize: '200', autoclaveNum: '5', loadDirection: 'гаргасан', openedTime: '08:20',
        autoclaveCondition: 'Хаалганы мэдрэгч ажиллахгүй', extraWork: 'ак2 тос тосолгоо хийв',
      }),
    ],
  };
}

/** formVersion 1: 12 мөртэй цагийн хүснэгт, нэг мөр нь бөглөгдсөн. */
function legacyPayload(): Y180AutoclaveOperatorPayload {
  return {
    ...createEmptyY180Payload(base),
    formVersion: 1,
    submittedAt: '2026-10-01T05:00:00.000Z',
    timeRows: mergeY180TimeRows([{ time: '2026-10-01T08:00:00', furnacePressure: '12.5', autoclaves: [{ startTime: '08:10' }] }]),
  };
}

const renderReadOnly = (data: Y180AutoclaveOperatorPayload) =>
  renderToStaticMarkup(React.createElement(Y180AutoclaveOperatorReadOnly, { data }));

// ─────────────────────────────────────────────── Өгөгдлийн загвар ───────────────────────────────────────────────

test('a new row starts with the Excel defaults and does not count as data until something is filled', () => {
  const empty = emptyY180OperationRow('Д.Нямдорж', 'x');
  assert.deepEqual(
    { condition: empty.autoclaveCondition, factors: empty.otherFactors, by: empty.recordedBy, direction: empty.loadDirection },
    { condition: 'хэвийн', factors: 'байхгүй', by: 'Д.Нямдорж', direction: '' }
  );
  assert.equal(y180OperationRowHasData(empty), false);
  assert.equal(y180OperationRowHasData({ ...empty, recordedBy: 'Б.Төмөрбат', autoclaveCondition: ' хэвийн ' }), false);
  const filled: Partial<Y180OperationRow>[] = [
    { blockSize: '250' }, { autoclaveNum: '1' }, { loadDirection: 'гаргасан' }, { startedTime: '13:50' },
    { openedTime: '08:20' }, { extraWork: 'тосолгоо' }, { autoclaveCondition: 'Хаалга гацсан' }, { otherFactors: 'Уурын даралт унасан' },
  ];
  for (const patch of filled) assert.equal(y180OperationRowHasData({ ...empty, ...patch }), true, JSON.stringify(patch));
});

test('saved rows are normalised: unknown direction dropped, ISO times shortened, numbers kept as text, ids unique', () => {
  const rows = normalizeY180OperationRows([
    { id: 'a', blockSize: 250, autoclaveNum: 3, loadDirection: 'орсон', startedTime: '2026-11-04T13:50:00' },
    { id: 'a', loadDirection: 'гаргасан', openedTime: '08:20' },
    { blockSize: '125' },
    null,
  ]);
  assert.deepEqual(rows.map((r) => r.id), ['a', 'a_2', 'op_3', 'op_4']);
  assert.deepEqual([rows[0].blockSize, rows[0].autoclaveNum, rows[0].loadDirection, rows[0].startedTime], ['250', '3', '', '13:50']);
  assert.deepEqual([rows[1].loadDirection, rows[1].openedTime], ['гаргасан', '08:20']);
  assert.deepEqual(normalizeY180OperationRows(undefined), []);
});

test('a new payload is version 2 with no hourly rows; only filled hourly rows count as legacy data', () => {
  const empty = createEmptyY180Payload(base);
  assert.equal(empty.formVersion, 2);
  assert.deepEqual(empty.operationRows, []);
  assert.deepEqual(empty.timeRows, []);
  const keys = Object.keys(empty);
  assert.ok(keys.indexOf('operationRows') < keys.indexOf('timeRows'), 'Excel export expands the first row array');
  assert.equal(y180HasLegacyTimeData(mergeY180TimeRows(null)), false, '12 empty hourly rows are not data');
  assert.equal(y180HasLegacyTimeData(legacyPayload().timeRows), true);
});

// ─────────────────────────────────────────────── Харах горим ───────────────────────────────────────────────

test('read-only view lists the operation rows with the Excel columns and no empty hourly grid', () => {
  const html = renderReadOnly(newPayload());
  for (const text of [
    'Автоклавын ажилбарын бүртгэл</p>', 'Бүтээгдэхүүний хэмжээ', 'Автоклав №3', 'оруулсан', '13:50',
    'гаргасан', '08:20', 'ак2 тос тосолгоо хийв', 'Д.Нямдорж',
  ]) {
    assert.ok(html.includes(text), `missing: ${text}`);
  }
  assert.match(html, /class="font-bold text-red-700">Хаалганы мэдрэгч ажиллахгүй</, 'a reported problem stands out');
  assert.ok(!html.includes('Зуухны /бар/'), 'no hourly grid for a new record');
  assert.ok(html.includes('Технологийн мастер'), 'the autoclave record is checked by a technology master');
  assert.doesNotMatch(html, /ээлжийн мастер/i);
});

test('read-only view: an old hourly record keeps its hourly table; an empty new record says nothing was registered', () => {
  const legacyHtml = renderReadOnly(legacyPayload());
  assert.ok(legacyHtml.includes('Зуухны /бар/') && legacyHtml.includes('12.5'), 'old hourly data is still shown');
  assert.ok(!legacyHtml.includes('Автоклавын ажилбарын бүртгэл</p>'));

  const emptyHtml = renderReadOnly(createEmptyY180Payload(base) as Y180AutoclaveOperatorPayload);
  assert.ok(emptyHtml.includes('Автоклавын ажилбарын бүртгэл хийгдээгүй.'));
  assert.ok(!emptyHtml.includes('Зуухны /бар/'));
});

// ─────────────────────────────────────────────── Excel тайлан ───────────────────────────────────────────────

test('Excel export: each operation row is its own line under the Excel column names; old records still expand by hour', () => {
  const lines = flattenLogData(newPayload());
  assert.equal(lines.length, 2);
  assert.deepEqual(
    [lines[0]['Бүтээгдэхүүний хэмжээ'], lines[0]['Автоклав №'], lines[0]['Оруулсан/гаргасан'], lines[0]['Автоклавыг эхлүүлсэн цаг']],
    ['250', '3', 'оруулсан', '13:50']
  );
  assert.deepEqual(
    [lines[1]['Автоклавыг онгойлгосон цаг'], lines[1]['Тухайн автоклавын ажиллагаа'], lines[1]['Ажиллагаанд нөлөөлсөн бусад зүйл'], lines[1]['Бүртгэл хөтөлсөн']],
    ['08:20', 'Хаалганы мэдрэгч ажиллахгүй', 'байхгүй', 'Д.Нямдорж']
  );
  assert.equal(lines[1]['Нэмэлт ажил (засвар, цэвэрлэгээ, бусад)'], 'ак2 тос тосолгоо хийв');
  assert.ok(!Object.keys(lines[0]).some((key) => /(^|: )id$/.test(key)), 'row ids are not exported');
  assert.equal(flattenLogData(legacyPayload()).length, 12, 'old hourly records keep one line per hour');
});

// ─────────────────────────────────────────────── Маягт (засварлах) ───────────────────────────────────────────────

test('editor renders the operation table instead of the hourly grid', () => {
  const html = renderToStaticMarkup(
    React.createElement(ToastProvider, null, React.createElement(Y180FormForSsr, {
      ...base, onBack() {}, onSubmit: async () => {}, submitting: false,
    }))
  );
  for (const text of ['Автоклавын ажилбарын бүртгэл', 'Мөр нэмэх', 'Автоклавыг эхлүүлсэн цаг', 'Автоклавыг онгойлгосон цаг', 'Бүртгэл хөтөлсөн', 'Ажилбарын бүртгэлийн зураг хавсаргах мөр']) {
    assert.ok(html.includes(text), `missing: ${text}`);
  }
  assert.ok(!html.includes('Даралтын бүртгэл + Автоклав'), 'hourly grid removed');
  assert.ok(!html.includes('Column сонгох'), 'hourly image column picker removed');
  assert.ok(html.includes('Хянасан: технологийн мастер'), 'the reviewer is labelled as a technology master');
  assert.doesNotMatch(html, /ээлжийн мастер/i, 'no «ээлжийн мастер» anywhere in the autoclave form');
});

/** Маягтыг hook-уудыг нь орлуулан шууд дуудаж, товч/талбарын handler-уудыг ажиллуулна. */
function mountForm(initialPayload?: Y180AutoclaveOperatorPayload) {
  const states: any[] = [];
  const refs: any[] = [];
  let stateIndex = 0;
  let refIndex = 0;
  const mockReact = {
    ...React,
    useMemo: (factory: () => unknown) => factory(),
    useEffect: () => {},
    useRef: (initial: unknown) => { const i = refIndex++; return (refs[i] ||= { current: initial }); },
    useState: (initial: unknown) => {
      const i = stateIndex++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      return [states[i], (value: unknown) => { states[i] = typeof value === 'function' ? (value as (v: unknown) => unknown)(states[i]) : value; }];
    },
  };
  const lib = load('lib/y180-autoclave-operator-form.ts', { './environment-check-form': load('lib/environment-check-form.ts') });
  const { Y180AutoclaveOperatorForm } = load('components/shift/forms/Y180AutoclaveOperatorForm.tsx', {
    react: mockReact,
    'next/image': { __esModule: true, default: (props: any) => React.createElement('img', props) },
    'lucide-react': Object.fromEntries(
      ['Camera', 'ChevronLeft', 'ClipboardList', 'ImagePlus', 'Save', 'Plus', 'Trash2', 'Upload', 'X'].map((name) => [name, () => null])
    ),
    '@/lib/y180-autoclave-operator-form': lib,
    '@/components/ui/ToastProvider': { useToast: () => ({ warning() {}, error() {}, success() {} }) },
    '@/components/shift/forms/useAssignedShiftMaster': { useAssignedShiftMaster: () => '' },
    '@/components/shift/forms/shared/ShiftMasterField': { ShiftMasterField: () => null },
    '@/components/shift/EnvironmentCheckSection': { EnvironmentCheckSection: () => null },
  }) as { Y180AutoclaveOperatorForm: (props: Record<string, unknown>) => unknown };
  const submitted: Y180AutoclaveOperatorPayload[] = [];
  const props = { ...base, initialPayload, shiftId: 's1', onBack() {}, onSubmit: async (p: Y180AutoclaveOperatorPayload) => { submitted.push(p); }, submitting: false };
  const render = () => { stateIndex = 0; refIndex = 0; return nodes(Y180AutoclaveOperatorForm(props)); };
  const field = (label: string) => {
    const element = render().find((node: any) => node.props?.['aria-label'] === label);
    assert.ok(element, `${label} not found`);
    return element;
  };
  const buttons = (text: string) => render().filter((node: any) => node.type === 'button' && textOf(node).trim() === text);
  const type = (label: string, value: string) => field(label).props.onChange({ target: { value } });
  const submit = async () => { await render().find((node: any) => node.type === 'form').props.onSubmit({ preventDefault() {} }); };
  return { render, field, buttons, type, submit, submitted };
}

test('editor: «Мөр нэмэх» adds rows that can be filled and removed; only filled rows are saved as version 2', async () => {
  const ui = mountForm();
  assert.ok(ui.field('1-р мөр: Автоклав'), 'a new form opens with one row');
  assert.equal(ui.buttons('Мөр нэмэх').length, 1);
  ui.buttons('Мөр нэмэх')[0].props.onClick();
  ui.buttons('Мөр нэмэх')[0].props.onClick();
  assert.ok(ui.field('3-р мөр: Автоклав'));

  // 1-р мөр: оруулсан. 2-р мөр хоосон үлдэнэ. 3-р мөр: гаргасан + асуудал.
  ui.type('1-р мөр: Бүтээгдэхүүний хэмжээ', '250');
  ui.type('1-р мөр: Автоклав', '3');
  ui.buttons('Оруулсан')[0].props.onClick();
  ui.type('1-р мөр: Автоклавыг эхлүүлсэн цаг', '13:50');
  ui.buttons('Гаргасан')[2].props.onClick();
  ui.type('3-р мөр: Автоклавыг онгойлгосон цаг', '08:20');
  ui.type('3-р мөр: Тухайн автоклавын ажиллагаа', 'Хаалга гацсан');
  assert.equal(ui.buttons('Оруулсан')[0].props['aria-pressed'], true);

  // Нэмээд бөглөсөн мөрийг устгавал хадгалагдахгүй.
  ui.buttons('Мөр нэмэх')[0].props.onClick();
  ui.type('4-р мөр: Нэмэлт ажил', 'устгах мөр');
  ui.field('4-р мөр устгах').props.onClick();
  assert.ok(!ui.render().some((node: any) => node.props?.['aria-label'] === '4-р мөр: Автоклав'));

  // Зураг хавсаргах мөрийн сонголт ажилбарын мөрүүдээс бүрдэнэ.
  const options = ui.render().filter((node: any) => node.type === 'option').map((node: any) => textOf(node));
  assert.ok(options.includes('1. Автоклав №3 · оруулсан · 13:50'), `image row options: ${options.join(' | ')}`);

  await ui.submit();
  assert.equal(ui.submitted.length, 1);
  const [payload] = ui.submitted;
  assert.equal(payload.formVersion, 2);
  assert.equal(payload.stationCode, 'ҮЯ-180');
  assert.deepEqual(
    payload.operationRows.map((r) => [r.blockSize, r.autoclaveNum, r.loadDirection, r.startedTime, r.openedTime, r.autoclaveCondition, r.otherFactors, r.recordedBy]),
    [
      ['250', '3', 'оруулсан', '13:50', '', 'хэвийн', 'байхгүй', 'Д.Нямдорж'],
      ['', '', 'гаргасан', '', '08:20', 'Хаалга гацсан', 'байхгүй', 'Д.Нямдорж'],
    ]
  );
  assert.deepEqual(payload.timeRows, []);
});

test('editor: an old hourly record shows a notice, keeps its hourly rows untouched, and reopens saved rows as they were', async () => {
  const legacy = legacyPayload();
  const ui = mountForm(legacy);
  const notice = ui.render().find((node: any) => node.type === 'p' && textOf(node).includes('хуучин загварын цагийн хүснэгтийн'));
  assert.ok(notice, 'legacy notice');
  assert.match(textOf(notice), /хүснэгтийн 1 мөр/);
  await ui.submit();
  assert.deepEqual(ui.submitted[0].timeRows, legacy.timeRows);
  assert.equal(ui.submitted[0].timeRows.filter(y180TimeRowHasData).length, 1);
  assert.deepEqual(ui.submitted[0].operationRows, [], 'the untouched empty row is not saved');

  const reopened = mountForm(newPayload());
  assert.ok(reopened.field('2-р мөр: Автоклав'));
  assert.ok(!reopened.render().some((node: any) => node.props?.['aria-label'] === '3-р мөр: Автоклав'), 'no extra empty row');
  assert.equal(reopened.field('2-р мөр: Автоклав').props.value, '5');
  assert.equal(reopened.field('1-р мөр: Автоклавыг эхлүүлсэн цаг').props.value, '13:50');
});
