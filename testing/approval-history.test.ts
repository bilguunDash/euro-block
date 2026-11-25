import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HorizontalPagedList } from '../components/dashboard/HorizontalPagedList';
import {
  MASTER_APPROVAL_STATION_BY_LOG_TYPE, approvalHistoryPagination, approvalStationKind, masterApprovedFilter,
  operatorApprovedSearchFilter, operatorApprovedWhere, parseApprovalHistoryQuery, parseApprovalStationKind,
  pendingApprovalCounts,
} from '../lib/approval-history-query';
import { ADMIN_APPROVAL_LOG_TYPES, MASTER_STATION_CODES } from '../lib/master-stations';

const query = (values: Record<string, string> = {}) => parseApprovalHistoryQuery(new URLSearchParams(values));

test('approval history has bounded pages and no implicit recent-date window', () => {
  assert.deepEqual(query(), { since: '', until: '', station: '', crew: '', query: '', shiftType: '', page: 1, pageSize: 20, skip: 0 });
  assert.equal(query({ page: '3', pageSize: '100' }).skip, 200);
  assert.deepEqual(approvalHistoryPagination(query({ page: '2' }), 181), { page: 2, pageSize: 20, totalPages: 10 });
  assert.equal(approvalHistoryPagination(query(), 0).totalPages, 1);
});

test('history validates calendar dates, inclusive bounds and pagination before querying', () => {
  const invalidQueries: Record<string, string>[] = [
    { since: '2026-02-30' }, { until: '2026-13-01' }, { since: '2026/01/01' },
    { since: '2026-08-02', until: '2026-08-01' }, { page: '0' }, { page: '-1' },
    { page: '1.5' }, { pageSize: '101' }, { pageSize: '' }, { page: '9007199254740993' },
    { crew: '4' }, { shiftType: 'bad' },
  ];
  for (const invalid of invalidQueries) assert.throws(() => query(invalid));
  assert.equal(query({ since: '2024-02-29', until: '2024-02-29' }).since, '2024-02-29');
});

test('operator history combines approval flags, date, station, shift and crew without overwriting filters', () => {
  const parsed = query({ since: '2026-06-22', until: '2026-06-22', stationCode: 'ҮЯ-110', shiftType: 'Өдрийн', crew: '2' });
  assert.deepEqual(operatorApprovedWhere(parsed, ['crew-member']), {
    masterApproved: true, adminApproved: true, shiftDate: { gte: '2026-06-22', lte: '2026-06-22' },
    stationCode: 'ҮЯ-110', shiftType: 'Өдрийн', operatorUid: { in: ['crew-member'] },
  });
  assert.deepEqual(operatorApprovedWhere(parsed, []).operatorUid, { in: [] });
});

test('master history selects approved status before paging and maps station to the form log type', () => {
  const filter = masterApprovedFilter(query({ station: 'ҮЯ-310', since: '2026-07-02', until: '2026-07-02' }));
  assert.match(filter.whereSql, /adminApproved/);
  assert.doesNotMatch(filter.whereSql, /needsAdminApproval/);
  assert.deepEqual(filter.params.at(-1), ['modal_y310_repair_master_form']);
  assert.ok(filter.params.includes('2026-07-02'));
  assert.doesNotMatch(filter.whereSql, /s\."stationCode"/);
  assert.deepEqual(masterApprovedFilter(query({ station: 'unknown' })).params.at(-1), []);
});

test('master filters use shift dates and actual assignee crew for both page and count', () => {
  const filter = masterApprovedFilter(query({ since: '2026-01-01', until: '2026-12-31', crew: '3', shiftType: 'Шөнийн' }));
  assert.match(filter.whereSql, /COALESCE\(s\."shiftDate"/);
  assert.match(filter.fromSql, /LEFT JOIN "users"/);
  assert.match(filter.whereSql, /u\."shiftGroup"/);
  assert.deepEqual(filter.params.slice(1), ['2026-01-01', '2026-12-31', '3', 'Шөнийн']);
});

test('names and wildcard characters remain literal bound values, with Mongolian case folding', () => {
  const parsed = query({ query: "ӨҮ Ё'_%\\" });
  for (const filter of [masterApprovedFilter(parsed), operatorApprovedSearchFilter(parsed)]) {
    assert.match(filter.whereSql, /TRANSLATE/);
    assert.match(filter.whereSql, /LOWER/);
    assert.equal(filter.params.at(-1), "%өү ё'\\_\\%\\\\%");
    assert.doesNotMatch(filter.whereSql, /ӨҮ Ё'/);
  }
});

test('untrusted station text is never interpolated into history SQL', () => {
  const station = "' OR true --";
  const master = masterApprovedFilter(query({ station }));
  const operator = operatorApprovedSearchFilter(query({ station, query: 'name' }));
  assert.doesNotMatch(master.whereSql, /OR true/);
  assert.doesNotMatch(operator.whereSql, /OR true/);
  assert.ok(operator.params.includes(station));
});

test('server pagination renders every returned row on later pages and reports the filtered total', () => {
  const items = Array.from({ length: 20 }, (_, index) => `record-${index + 41}`);
  const html = renderToStaticMarkup(createElement(HorizontalPagedList<string>, {
    items, pageSize: 20, pagination: { page: 3, total: 181, onPageChange: () => {} },
    renderPage: (rows) => createElement('div', {}, rows.map((row) => createElement('span', { key: row }, row))),
  }));
  for (const item of items) assert.ok(html.includes(`>${item}<`), item);
  assert.ok(html.includes('181'));
  assert.ok(html.includes('41–60'));
  assert.match(html, /aria-current="page"[^>]*>3<\/button>/);
});

test('existing local pagination still slices lists that do not request server pagination', () => {
  const html = renderToStaticMarkup(createElement(HorizontalPagedList<number>, {
    items: [1, 2, 3, 4, 5, 6], renderPage: (rows) => createElement('div', { id: 'rows' }, rows.join(',')),
  }));
  assert.ok(html.includes('id="rows">1,2,3,4,5</div>'));
});

// ── Станцын төрөл: «Оператор» таб = оператор станц, «Мастер» таб = мастер станц + мастерын маягт ──

const masterCodes = [...MASTER_STATION_CODES];

test('every master station is the master kind; every other station, unknown or empty code is the operator kind', () => {
  for (const code of MASTER_STATION_CODES) assert.equal(approvalStationKind(code), 'master', code);
  for (const code of ['ҮЯ-110', 'ҮЯ-130', 'ҮЯ-190', 'ҮЯ-320', 'ОНБ', 'СОРТ', 'ҮЯ-999', '', null, undefined]) {
    assert.equal(approvalStationKind(code), 'operator', String(code));
  }
  assert.equal(approvalStationKind(' ҮЯ-099 '), 'master');
  assert.equal(approvalStationKind('ҮЯ-0990'), 'operator', 'matched exactly, never by prefix');
});

test('every station that owns an approvable master form is a master station, so its forms never belong to the operator tab', () => {
  for (const [logType, code] of Object.entries(MASTER_APPROVAL_STATION_BY_LOG_TYPE)) {
    assert.equal(approvalStationKind(code), 'master', logType);
  }
  for (const logType of ADMIN_APPROVAL_LOG_TYPES) assert.ok(MASTER_APPROVAL_STATION_BY_LOG_TYPE[logType], logType);
});

test('stationKind query: empty means every station, operator and master are accepted, anything else is rejected', () => {
  const kind = (value?: string) => parseApprovalStationKind(new URLSearchParams(value === undefined ? {} : { stationKind: value }));
  assert.equal(kind(), '');
  assert.equal(kind(''), '');
  assert.equal(kind('operator'), 'operator');
  assert.equal(kind(' master '), 'master');
  for (const bad of ['all', 'Operator', 'MASTER', 'master,operator', '1']) assert.throws(() => kind(bad), /Станцын төрөл буруу/, bad);
});

test('approved shifts are restricted to the station kind and still honour the chosen station and every other filter', () => {
  assert.deepEqual(operatorApprovedWhere(query(), undefined, 'operator').stationCode, { notIn: masterCodes });
  assert.deepEqual(operatorApprovedWhere(query(), undefined, 'master').stationCode, { in: masterCodes });
  // Төрөл өгөөгүй бол өмнөх зан төлөв: Нүүрийн «баталгаажсан» тоо бүх станцыг тоолно.
  assert.equal('stationCode' in operatorApprovedWhere(query()), false);
  assert.equal('stationCode' in operatorApprovedWhere(query(), undefined, ''), false);

  const parsed = query({ since: '2026-10-01', stationCode: 'ҮЯ-099', shiftType: 'Шөнийн', crew: '1' });
  assert.deepEqual(operatorApprovedWhere(parsed, ['u1'], 'operator'), {
    masterApproved: true, adminApproved: true, shiftDate: { gte: '2026-10-01' },
    stationCode: { equals: 'ҮЯ-099', notIn: masterCodes }, shiftType: 'Шөнийн', operatorUid: { in: ['u1'] },
  });
  assert.deepEqual(operatorApprovedWhere(parsed, [], 'master').stationCode, { equals: 'ҮЯ-099', in: masterCodes });

  // Буцаасан жагсаалтыг өөрчилбөл мастер станцын нэгдсэн жагсаалт эвдрэх ёсгүй.
  (operatorApprovedWhere(query(), undefined, 'master').stationCode.in as string[]).push('ҮЯ-000');
  assert.equal(MASTER_STATION_CODES.length, 5);
});

test('the name search SQL restricts the station kind with a bound array and keeps the searched value last', () => {
  const parsed = query({ query: 'Туяа', stationCode: 'ҮЯ-310' });
  const patterns = {
    operator: /NOT \(s\."stationCode" = ANY\(\$(\d+)\)\)/,
    master: /(?<!NOT )\(s\."stationCode" = ANY\(\$(\d+)\)\)/,
  };
  for (const kind of ['operator', 'master'] as const) {
    const filter = operatorApprovedSearchFilter(parsed, kind);
    const match = patterns[kind].exec(filter.whereSql);
    assert.ok(match, `${kind}: ${filter.whereSql}`);
    assert.deepEqual(filter.params[Number(match[1]) - 1], masterCodes, `${kind}: $${match[1]} is the master station array`);
    assert.equal(filter.params.at(-1), '%туяа%');
    assert.doesNotMatch(filter.whereSql, /ҮЯ-|Туяа|туяа/);
  }
  const operator = operatorApprovedSearchFilter(parsed, 'operator').whereSql;
  assert.doesNotMatch(operatorApprovedSearchFilter(parsed, 'master').whereSql, /NOT \(s\."stationCode" = ANY/);
  assert.match(operator, /s\."stationCode" = \$\d+/, 'the chosen station is still filtered');
  // Төрөл өгөөгүй бол өмнөх SQL.
  assert.doesNotMatch(operatorApprovedSearchFilter(parsed).whereSql, /ANY/);
});

test('pending badges split the loaded shifts by station kind and add the master forms to the master side', () => {
  const shifts = [{ stationCode: 'ҮЯ-130' }, { stationCode: 'ҮЯ-190' }, { stationCode: 'ҮЯ-099' }, { stationCode: 'ҮЯ-400' }, null, {}];
  // null ба станцгүй мөр хуучин зан төлөвөөрөө оператор талд (Оператор табад харагддаг байсан).
  assert.deepEqual(pendingApprovalCounts({ shifts, shiftTotal: 6, formTotal: 3 }), { operator: 4, master: 5 });
  assert.deepEqual(pendingApprovalCounts({ shifts: [], shiftTotal: 0, formTotal: 0 }), { operator: 0, master: 0 });
  assert.deepEqual(pendingApprovalCounts({ shifts: [], formTotal: 2 }), { operator: 0, master: 2 });
});

test('pending badges put the not-yet-loaded remainder on the operator side and ignore a stale smaller total', () => {
  const shifts = [{ stationCode: 'ҮЯ-130' }, { stationCode: 'ҮЯ-099' }];
  assert.deepEqual(pendingApprovalCounts({ shifts, shiftTotal: 2002, formTotal: 0 }), { operator: 2001, master: 1 });
  assert.deepEqual(pendingApprovalCounts({ shifts, shiftTotal: 1, formTotal: 0 }), { operator: 1, master: 1 });
  assert.deepEqual(pendingApprovalCounts({ shifts, formTotal: 0 }), { operator: 1, master: 1 });
});

test('every pending shift lands on exactly one side, so the Home total is the same before and after the split', () => {
  const codes = [...MASTER_STATION_CODES, 'ҮЯ-110', 'ҮЯ-130', 'ҮЯ-190', '', 'ҮЯ-999'];
  for (let count = 0; count <= codes.length; count++) {
    const shifts = codes.slice(0, count).map((stationCode) => ({ stationCode }));
    for (const formTotal of [0, 4]) {
      const split = pendingApprovalCounts({ shifts, shiftTotal: count + 3, formTotal });
      assert.equal(split.operator + split.master, count + 3 + formTotal, `${count} shifts, ${formTotal} forms`);
    }
  }
});
