import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const react = require('react');

// Production TS/TSX-ийг санах ойд compile хийж, зөвхөн гаднах хил (swr, next/link, toast, …)-ийг mock-лоно.
export function load(relativePath, mocks = {}) {
  const filename = path.resolve(import.meta.dirname, '..', '..', relativePath);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: filename,
  });
  const mod = { exports: {} };
  vm.runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod, mod.exports,
  );
  return mod.exports;
}

export const masterStations = load('lib/master-stations.ts');
export const approvalHistoryQuery = load('lib/approval-history-query.ts', { './master-stations': masterStations });
export const approvalMaintenance = load('lib/approval-maintenance.ts');
export const approvalRecordLabel = load('lib/approval-record-label.ts', { './master-stations': masterStations });

// Dashboard-ийн `stations` prop-той ижил хэлбэр (код + нэр).
export const stations = [
  { code: 'ҮЯ-099', name: 'Ээлжийн мастер', isMasterStation: true },
  { code: 'ҮЯ-130', name: 'Зуурах цамхагийн оператор', isMasterStation: false },
  { code: 'ҮЯ-181', name: 'Дулааны мастер', isMasterStation: true },
  { code: 'ҮЯ-190', name: 'Чанар шалгагч', isMasterStation: false },
  { code: 'ҮЯ-310', name: 'Засварын мастер', isMasterStation: true },
  { code: 'ҮЯ-410', name: 'Цахилгаан автоматжуулалтын мастер', isMasterStation: true },
];

// Админ approval хүлээдэг мастерын маягт бүр: logType → дамжлагын код.
export const masterFormTypes = [
  ['modal_y099_master_handover_v1', 'ҮЯ-099'],
  ['modal_y181_heat_master_handover_v1', 'ҮЯ-181'],
  ['modal_y310_repair_master_form', 'ҮЯ-310'],
  ['modal_cah02_electrical_control_form', 'ҮЯ-410'],
];

/** Тухайн станцын мастерын маягтын бүртгэлийн нэр (`ҮЯ-310:` угтваргүй) — маягтын тохиргооноос. */
export function expectedFormTitle(code) {
  const { title } = masterStations.masterStationFormConfig(code);
  return title.slice(`${code}:`.length).trim();
}

export const shiftRow = (id, overrides = {}) => ({
  id, shiftDate: '2026-10-07', shiftType: 'Шөнийн', stationCode: 'ҮЯ-130', operatorUid: `operator-${id}`,
  operatorName: 'Нямжав МӨНХЦООЖ', masterApprovedBy: 'Туяа НЯМДОРЖ', masterApprovedDate: '2026-10-08 09:53',
  adminApprovedBy: 'Админ', adminApprovedDate: '2026-10-08 11:00', ...overrides,
});

export const masterLog = (id, logType, stationCode, overrides = {}) => ({
  id, shiftId: `shift-${id}`, logType,
  data: { sigHandingOver: 'Хүлээлгэн өгөгч', sigReceiving: 'Хүлээн авагч', adminApprovedBy: 'Админ', ...overrides },
  shift: { shiftDate: '2026-10-07', shiftType: 'Өдрийн', stationCode, operatorName: 'Мастер', operatorUid: `master-${id}` },
});

export const scheduleRow = (id, kind, stationCode) => ({
  id, kind, shiftDate: '2026-10-07', shiftType: 'Өдрийн', stationCode, assigneeName: 'Хуваарьт ажилтан', assigneeUid: `assignee-${id}`,
});

export function nodes(node) {
  if (node == null || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (typeof node.type === 'function') return nodes(node.type(node.props));
  return [node, ...nodes(node.props?.children)];
}

export function textOf(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  return node?.props ? textOf(node.props.children) : '';
}

/**
 * `ApprovalsSection`-ийг hook-уудыг нь stub хийж шууд дуудаад, element модыг нь унших harness.
 * `approvedShifts` — Оператор табын, `approvedMasterShifts` — Мастер табын ЭЭЛЖИЙН түүх (SWR-ийн
 * `stationKind` параметрээр ялгана), `approvedMasterLogs` — мастерын МАЯГТЫН түүх.
 */
export function mount({
  pending = [], approvedShifts = [], approvedMasterShifts = [], masterPending = [], approvedMasterLogs = [],
  notStartedOperator = [], notStartedMaster = [], adminPendingTotal, y310PendingTotal, localUsers,
  stations: stationCatalog = stations, handleAdminFinalApproveClick = async () => {}, onY310Approve,
} = {}) {
  const refs = [], states = [], urls = new Set();
  let stateIndex = 0, refIndex = 0;
  const mockReact = {
    ...react,
    useMemo: factory => factory(),
    useRef: initial => { const index = refIndex++; return refs[index] ||= { current: initial }; },
    useState: initial => {
      const index = stateIndex++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
  };
  const history = (rows, key) => ({ data: { [key]: rows, total: rows.length, totalPages: 1 }, isLoading: false, error: undefined });
  const { ApprovalsSection } = load('components/dashboard/admin/ApprovalsSection.tsx', {
    react: mockReact,
    swr: {
      __esModule: true,
      default: url => {
        urls.add(url);
        if (url.includes('stationKind=master')) return history(approvedMasterShifts, 'shifts');
        return url.startsWith('/api/shifts') ? history(approvedShifts, 'shifts') : history(approvedMasterLogs, 'approved');
      },
      useSWRConfig: () => ({ mutate: async () => {} }),
    },
    'next/link': { __esModule: true, default: props => react.createElement('a', props) },
    'lucide-react': Object.fromEntries(['CheckCircle2', 'RotateCcw', 'Search', 'Trash2', 'X'].map(name => [name, () => null])),
    '@/lib/approval-maintenance': approvalMaintenance,
    '@/lib/approval-record-label': approvalRecordLabel,
    '@/lib/approval-history-query': approvalHistoryQuery,
    '@/lib/shift-crew': { SHIFT_GROUP_OPTIONS: [] },
    '@/components/ui/ToastProvider': { useToast: () => ({ error() {}, success() {} }) },
    '../HorizontalPagedList': { HorizontalPagedList: props => props.renderPage(props.items) },
    '../dashboard-helpers': { mnDateTimeCompact: value => value },
  });
  const props = {
    adminPendingShifts: pending, y310PendingApprovals: masterPending, notStartedOperator, notStartedMaster,
    adminPendingTotal, y310PendingTotal, localUsers, onY310Approve,
    adminFinalApprovingId: '', stations: stationCatalog, confirmAsync: async () => true, handleAdminFinalApproveClick,
  };
  const render = () => { stateIndex = 0; refIndex = 0; return nodes(ApprovalsSection(props)); };
  const click = pattern => {
    const button = render().find(node => node.type === 'button' && pattern.test(textOf(node).trim()));
    assert.ok(button, `button ${pattern} not found`);
    button.props.onClick();
  };
  const tableView = (label, table) => {
    const headers = nodes(table).filter(node => node.type === 'th').map(textOf);
    const body = nodes(table).find(node => node.type === 'tbody');
    const rows = nodes(body).filter(node => node.type === 'tr')
      .map(row => react.Children.toArray(row.props.children).filter(cell => cell.type === 'td'));
    return {
      headers, rows,
      cell: (row, header) => {
        const column = headers.indexOf(header);
        assert.notEqual(column, -1, `${label}: "${header}" column is missing`);
        return row[column];
      },
    };
  };
  const tabs = { operator: /^Оператор\d*$/, master: /^Мастер\d*$/ };
  const subTabs = { pending: /^Хүлээгдэж буй/, approved: /^Баталгаажсан/, not_started: /^Хийгдэж эхлээгүй/ };
  return {
    render, click, urls, props,
    /** Таб (Оператор/Мастер) ба дэд табын (Хүлээгдэж буй/Баталгаажсан/Хийгдэж эхлээгүй) товчны текст, жишээ нь «Оператор2». */
    badge: tab => textOf(render().find(node => node.type === 'button' && tabs[tab].test(textOf(node).trim()))).trim(),
    /**
     * Таб + дэд табыг дарж, гарсан хүснэгтийг буцаана. Мастер табын «Баталгаажсан» нь хоёр хүснэгттэй
     * (ээлж, маягт) тул `count`-ээр тоог, `index`-ээр аль хүснэгтийг авахыг заана.
     */
    open(tab, state, { count = 1, index = 0 } = {}) {
      click(tabs[tab]);
      click(subTabs[state]);
      const tables = render().filter(node => node.type === 'table');
      assert.equal(tables.length, count, `${tab}/${state}: exactly ${count} table(s) must be shown`);
      return tableView(`${tab}/${state}`, tables[index]);
    },
  };
}

/** «Дамжлага» нүдийн badge болон нэрийн мөр (нэр байхгүй бол `description` нь undefined). */
export function stationCell(table, row) {
  const parts = nodes(table.cell(row, 'Дамжлага'));
  const badge = parts.find(node => node.type === 'span');
  const description = parts.find(node => node.type === 'p');
  return { badge: badge && textOf(badge), description: description && textOf(description) };
}

/** Мөрийн «Үйлдэл» нүдэн дэх товч/холбоосын шошгууд. */
export function actionLabels(table, row) {
  return nodes(table.cell(row, 'Үйлдэл')).filter(node => node.type === 'button' || node.type === 'a').map(node => textOf(node).trim());
}
