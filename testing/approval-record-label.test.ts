import assert from 'node:assert/strict';
import test from 'node:test';
import { MASTER_APPROVAL_STATION_BY_LOG_TYPE } from '../lib/approval-history-query';
import { approvalRecordLabel, type StationCatalogEntry } from '../lib/approval-record-label';
import { ADMIN_APPROVAL_LOG_TYPES, MASTER_STATION_CODES, masterStationFormConfig } from '../lib/master-stations';
import { STATION_NAME_BY_CODE } from '../lib/shift-db';

const catalog: StationCatalogEntry[] = Object.entries(STATION_NAME_BY_CODE).map(([code, name]) => ({ code, name }));

test('a station code resolves to its catalog name and keeps the code for the badge', () => {
  assert.deepEqual(
    approvalRecordLabel({ code: 'ҮЯ-130', stations: [{ code: 'ҮЯ-130', name: 'Зуурах цамхагийн оператор' }] }),
    { code: 'ҮЯ-130', name: 'Зуурах цамхагийн оператор', recordTitle: '', description: 'Зуурах цамхагийн оператор' }
  );
});

test('every catalogued station shows its own name and no master form title', () => {
  for (const [code, name] of Object.entries(STATION_NAME_BY_CODE)) {
    const label = approvalRecordLabel({ code, stations: catalog });
    assert.equal(label.code, code);
    assert.equal(label.name, name, code);
    assert.equal(label.recordTitle, '', code);
    assert.equal(label.description, name, code);
  }
});

test('the catalog wins over the row name, which only fills in for unknown codes', () => {
  assert.equal(
    approvalRecordLabel({ code: 'ҮЯ-130', stations: catalog, fallbackName: 'Хуучин нэр' }).name,
    STATION_NAME_BY_CODE['ҮЯ-130']
  );
  assert.equal(approvalRecordLabel({ code: 'ҮЯ-777', stations: catalog, fallbackName: ' Шинэ дамжлага ' }).name, 'Шинэ дамжлага');
  assert.equal(approvalRecordLabel({ code: 'ҮЯ-777', fallbackName: 'Шинэ дамжлага' }).description, 'Шинэ дамжлага');
});

test('an unknown station without any name keeps only the code', () => {
  for (const stations of [catalog, [], null, undefined]) {
    assert.deepEqual(approvalRecordLabel({ code: 'ҮЯ-777', stations }), {
      code: 'ҮЯ-777', name: '', recordTitle: '', description: '',
    });
  }
});

test('codes are trimmed and matched exactly, never by prefix', () => {
  assert.equal(approvalRecordLabel({ code: '  ҮЯ-130 ', stations: catalog }).code, 'ҮЯ-130');
  assert.equal(approvalRecordLabel({ code: '  ҮЯ-130 ', stations: catalog }).name, STATION_NAME_BY_CODE['ҮЯ-130']);
  assert.equal(approvalRecordLabel({ code: 'ҮЯ-13', stations: catalog }).name, '');
  assert.equal(approvalRecordLabel({ code: 'ҮЯ-1300', stations: catalog }).name, '');
});

test('a missing code gives an empty label and never matches a nameless catalog entry', () => {
  const stations = [{ code: '', name: 'Кодгүй дамжлага' }];
  for (const code of [undefined, null, '', '   ']) {
    assert.deepEqual(approvalRecordLabel({ code, stations }), { code: '', name: '', recordTitle: '', description: '' });
    assert.equal(approvalRecordLabel({ code, stations, masterForm: true }).description, '');
  }
});

test('a name identical to the code is not repeated and does not hide a better name', () => {
  assert.equal(approvalRecordLabel({ code: 'ҮЯ-130', stations: [{ code: 'ҮЯ-130', name: 'ҮЯ-130' }] }).description, '');
  assert.equal(approvalRecordLabel({ code: 'ҮЯ-130', fallbackName: 'ҮЯ-130' }).description, '');
  assert.equal(
    approvalRecordLabel({ code: 'ҮЯ-130', stations: [{ code: 'ҮЯ-130', name: 'ҮЯ-130' }], fallbackName: 'Зуурах цамхаг' }).name,
    'Зуурах цамхаг'
  );
});

test('catalog entries without a name are skipped in favour of a later entry', () => {
  const stations = [{ code: 'ҮЯ-130', name: '' }, { code: 'ҮЯ-130', name: '  ' }, { code: 'ҮЯ-130', name: 'Зуурах цамхаг' }];
  assert.equal(approvalRecordLabel({ code: 'ҮЯ-130', stations }).name, 'Зуурах цамхаг');
});

test('the dashboard catalog shape, which has extra fields, is accepted unchanged', () => {
  const dashboardStations = [{ code: 'ҮЯ-310', name: 'Засварын мастер', isMasterStation: true }];
  assert.equal(approvalRecordLabel({ code: 'ҮЯ-310', stations: dashboardStations }).name, 'Засварын мастер');
});

test('a master form row shows the registration title instead of the station name', () => {
  assert.deepEqual(approvalRecordLabel({ code: 'ҮЯ-310', stations: catalog, masterForm: true }), {
    code: 'ҮЯ-310',
    name: 'Засварын мастер',
    recordTitle: 'Засварын мастерын ээлж хүлээлцэх бүртгэл',
    description: 'Засварын мастерын ээлж хүлээлцэх бүртгэл',
  });
});

test('every master form title omits the station code that the badge already shows', () => {
  for (const code of MASTER_STATION_CODES) {
    const config = masterStationFormConfig(code);
    const label = approvalRecordLabel({ code, stations: catalog, masterForm: true });
    if (!config) {
      assert.equal(label.recordTitle, '', code);
      continue;
    }
    assert.ok(label.recordTitle, code);
    assert.ok(!label.recordTitle.startsWith(code), code);
    assert.ok(config.title.endsWith(label.recordTitle), code);
    assert.equal(label.description, label.recordTitle, code);
  }
});

test('every log type that needs admin approval can be labelled as a master form', () => {
  for (const logType of ADMIN_APPROVAL_LOG_TYPES) {
    const code = MASTER_APPROVAL_STATION_BY_LOG_TYPE[logType];
    assert.ok(code, `${logType} has no station`);
    const label = approvalRecordLabel({ code, stations: catalog, masterForm: true });
    assert.ok(label.recordTitle, `${logType} (${code}) has no registration title`);
    assert.ok(label.name, `${logType} (${code}) has no station name`);
  }
});

test('shift and schedule rows of a master station keep the station name, not the form title', () => {
  const label = approvalRecordLabel({ code: 'ҮЯ-310', stations: catalog });
  assert.equal(label.recordTitle, '');
  assert.equal(label.description, 'Засварын мастер');
  assert.equal(approvalRecordLabel({ code: 'ҮЯ-310', stations: catalog, masterForm: false }).description, 'Засварын мастер');
});

test('a master form row of a station without a form falls back to the station name', () => {
  const label = approvalRecordLabel({ code: 'ҮЯ-130', stations: catalog, masterForm: true });
  assert.equal(label.recordTitle, '');
  assert.equal(label.description, STATION_NAME_BY_CODE['ҮЯ-130']);
});

test('labelling does not modify the catalog it reads', () => {
  const stations = Object.freeze(catalog.map((station) => Object.freeze({ ...station })));
  assert.doesNotThrow(() => approvalRecordLabel({ code: 'ҮЯ-310', stations, masterForm: true }));
  assert.equal(stations.length, catalog.length);
});
