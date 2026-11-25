import type { Workbook, Worksheet } from 'exceljs';
import { STATION_NAME_BY_CODE } from '@/lib/shift-db';
import { isMasterStationCode } from '@/lib/master-stations';

// ── Вахтын хуваарийн Excel (жишээ: "2026-вахт" хуудас) уншиж, хуваарийн мөр болгон
// хөрвүүлэх цэвэр логик. Prisma/Next-ээс хамааралгүй тул дангаар нь тестлэх боломжтой.

export type ParsedPerson = {
  rowNumber: number;
  team: string;
  lastName: string;
  firstName: string;
  makId: string;
  position: string;
  days: Array<{ date: string; code: string }>;
};

export type ParseResult = {
  sheetName: string;
  monthLabel: string;
  dateColumns: Array<{ col: number; date: string }>;
  people: ParsedPerson[];
  warnings: string[];
};

export type MatchUser = { id: string; name: string | null; role: string };

export type PlannedRow = {
  shiftDate: string;
  shiftType: 'Өдрийн' | 'Шөнийн';
  stationCode: string;
  uid: string;
  name: string;
  kind: 'operator' | 'master';
};

export type ImportReport = {
  month: string;
  matched: Array<{
    name: string;
    makId: string;
    position: string;
    stationCode: string;
    uid: string;
    kind: 'operator' | 'master';
    dayShiftCount: number;
    nightShiftCount: number;
  }>;
  unmatchedNames: Array<{ name: string; makId: string; position: string; team: string }>;
  ambiguousNames: Array<{ name: string; makId: string; candidateCount: number }>;
  unmappedPositions: Array<{ position: string; people: string[] }>;
  wrongRole: Array<{ name: string; position: string; expectedRole: string; actualRole: string }>;
  conflicts: string[];
  warnings: string[];
};

const PERSON_START_ROW = 13;
const FIRST_DAY_COL = 7;
const COL_LAST_NAME = 3;
const COL_FIRST_NAME = 4;
const COL_MAK_ID = 5;
const COL_POSITION = 6;

// Кирилл/латин ижил харагдах үсгүүд — ээлжийн кодыг алдаагүй таних зорилгоор латин руу хөрвүүлнэ.
const HOMOGLYPHS: Record<string, string> = {
  А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', К: 'K', М: 'M', О: 'O', Р: 'R', Т: 'T', У: 'Y', Х: 'X',
};

const KNOWN_CODES = new Set(['DS', 'NS', 'DN', 'R', 'AL', 'IN', 'OUT', '']);

const MONTH_LABEL_RE = /(\d{4})\s*ОНЫ\s*0?(\d{1,2})\s*Д(?:УГААР|ҮГЭЭР)\s*САР/iu;

function cellText(ws: Worksheet, row: number, col: number): string {
  const cell = ws.getRow(row).getCell(col);
  return String(cell.text ?? '').replace(/ /g, ' ').trim();
}

function toLatinCode(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .map((ch) => HOMOGLYPHS[ch] || ch)
    .join('')
    .trim();
}

export function normalizeName(s: string): string {
  return String(s || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeMakId(raw: string): boolean {
  return /^(MAK|МАК)\s*\d{2,}$/iu.test(raw.trim());
}

function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function isoDate(year: number, month1: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseMonthLabel(text: string): { year: number; month: number } | null {
  const m = MONTH_LABEL_RE.exec(text);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

/** targetMonth ("YYYY-MM")-д тохирох хуудас + сарын блокийн баганын мужийг олно. */
function findMonthBlock(
  wb: Workbook,
  targetMonth: string
): { ws: Worksheet; monthLabel: string; colStart: number; colEnd: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(targetMonth);
  if (!m) return null;
  const targetYear = parseInt(m[1], 10);
  const targetMon = parseInt(m[2], 10);

  // "вахт" нэртэй хуудсыг эхэлж үзээд, олдохгүй бол бүх хуудсын 9-р мөрийг шалгана.
  const ordered = [
    ...wb.worksheets.filter((w) => /вахт/iu.test(w.name)),
    ...wb.worksheets.filter((w) => !/вахт/iu.test(w.name)),
  ];

  for (const ws of ordered) {
    const labelRow = ws.getRow(9);
    const lastCol = Math.max(ws.columnCount, labelRow.cellCount);
    let colStart = 0;
    let colEnd = 0;
    let monthLabel = '';
    for (let c = FIRST_DAY_COL; c <= lastCol; c++) {
      // Merge-лэгдсэн label бүх багананд давхардан уншигддаг тул багана бүрээр шалгаж мужийг тогтооно.
      const parsed = parseMonthLabel(cellText(ws, 9, c));
      const hit = parsed !== null && parsed.year === targetYear && parsed.month === targetMon;
      if (hit) {
        if (!colStart) {
          colStart = c;
          monthLabel = cellText(ws, 9, c);
        }
        colEnd = c;
      } else if (colStart) {
        break; // блок дууссан
      }
    }
    if (!colStart) continue;

    // Label-ийн merge муж блокийн бүх баганыг хамардаггүй тохиолдол бий:
    // label хоосон ч 10-р мөрөнд өдрийн дугаартай залгаа багануудыг блокт оруулна.
    for (let c = colEnd + 1; c <= lastCol; c++) {
      const parsed = parseMonthLabel(cellText(ws, 9, c));
      if (parsed && (parsed.year !== targetYear || parsed.month !== targetMon)) break;
      if (!parsed && !/^\d{1,2}$/.test(cellText(ws, 10, c))) break;
      colEnd = c;
    }
    for (let c = colStart - 1; c >= FIRST_DAY_COL; c--) {
      if (parseMonthLabel(cellText(ws, 9, c))) break;
      const day = parseInt(cellText(ws, 10, c), 10);
      // Хугацааны блок үргэлж "өмнөх сарын 29-нөөс — тухайн сарын 28 хүртэл" байдаг
      // (бодит роостер файл дээр 4 шилжилтийг шалгаж баталгаажуулсан — 22-27 хооронд
      // ямар ч lead day байдаггүй). 29-өөс доош бол өөр сарын өдөр гэж үзэж зогсооно.
      if (!Number.isFinite(day) || day < 29) break;
      colStart = c;
    }
    return { ws, monthLabel, colStart, colEnd };
  }
  return null;
}

export function parseRosterWorkbook(wb: Workbook, targetMonth: string): ParseResult {
  const block = findMonthBlock(wb, targetMonth);
  if (!block) {
    throw new Error(`${targetMonth} сарын блок Excel файлаас олдсонгүй. 9-р мөрөнд "YYYY ОНЫ MM ДУГААР САР" гэсэн гарчигтай хуудас байх ёстой.`);
  }
  const { ws, monthLabel, colStart, colEnd } = block;
  const warnings: string[] = [];

  const [, ty, tm] = /^(\d{4})-(\d{2})$/.exec(targetMonth)!;
  const targetYear = parseInt(ty, 10);
  const targetMon = parseInt(tm, 10);
  const prevYear = targetMon === 1 ? targetYear - 1 : targetYear;
  const prevMon = targetMon === 1 ? 12 : targetMon - 1;

  // 10-р мөрийн өдрийн дугааруудыг огноо болгоно: эхний "1"-ээс өмнөх томоохон
  // тоонууд (29,30,31) өмнөх сарын өдрүүд.
  const dateColumns: Array<{ col: number; date: string }> = [];
  let phase: 'lead' | 'main' = 'lead';
  let prevDayNum = 0;
  for (let c = colStart; c <= colEnd; c++) {
    const raw = cellText(ws, 10, c);
    const dayNum = parseInt(raw, 10);
    if (!Number.isFinite(dayNum) || String(dayNum) !== raw.trim()) {
      if (raw) warnings.push(`10-р мөр, ${c}-р багана: "${raw}" өдрийн дугаар биш тул алгаслаа.`);
      continue;
    }
    if (dayNum === 1) phase = 'main';
    if (phase === 'lead') {
      // "Өмнөх сарын 29 — тухайн сарын 28" хугацааны блок гэдгийг бодит роостер
      // файлаас баталгаажуулсан (4 сарын шилжилт бүр яг 29-өөс эхэлдэг, 22-28
      // хооронд lead day хэзээ ч байдаггүй) — иймд lead day заавал >=29 байна.
      if (dayNum < 29 || dayNum > daysInMonth(prevYear, prevMon)) {
        warnings.push(`10-р мөр, ${c}-р багана: өмнөх сарын өдөр "${dayNum}" буруу тул алгаслаа.`);
        continue;
      }
      dateColumns.push({ col: c, date: isoDate(prevYear, prevMon, dayNum) });
    } else {
      if (dayNum < prevDayNum) {
        warnings.push(`10-р мөр, ${c}-р баганаас өдрийн дугаар буурсан тул блокийг зогсоолоо.`);
        break;
      }
      // Тухайн сарын өөрийн хэсэг үргэлж 28-аар хязгаарлагддаг (29-с хойшхи өдрүүд
      // дараагийн сарын lead day байдаг) — бодит файлаар баталгаажуулсан.
      if (dayNum > 28) {
        warnings.push(`10-р мөр, ${c}-р багана: "${dayNum}" ${targetMonth} сарын блокт хамаарахгүй (28-аас хойш) тул алгаслаа.`);
        continue;
      }
      dateColumns.push({ col: c, date: isoDate(targetYear, targetMon, dayNum) });
      prevDayNum = dayNum;
    }
  }
  if (dateColumns.length === 0) {
    throw new Error(`${targetMonth} сарын блокоос өдрийн багана олдсонгүй (10-р мөрийг шалгана уу).`);
  }

  const people: ParsedPerson[] = [];
  const unknownCodes = new Map<string, number>();
  let team = '';
  const lastRow = Math.max(ws.actualRowCount, ws.rowCount);
  for (let r = PERSON_START_ROW; r <= lastRow; r++) {
    const lastName = cellText(ws, r, COL_LAST_NAME);
    const firstName = cellText(ws, r, COL_FIRST_NAME);
    const makIdRaw = cellText(ws, r, COL_MAK_ID);
    const position = cellText(ws, r, COL_POSITION);

    // Багийн гарчгийн merge-лэгдсэн мөрөнд бүх багана ижил утгатай уншигддаг —
    // МАК ID хэлбэрийн шалгалт нь хүний мөрийг гарчгаас найдвартай ялгана.
    if (!looksLikeMakId(makIdRaw)) {
      const headerText = cellText(ws, r, 1) || lastName || firstName;
      if (headerText && headerText.length > 3) {
        team = headerText;
      } else if (firstName && lastName && firstName !== lastName && position) {
        warnings.push(`${r}-р мөр: "${firstName} ${lastName}" — МАК ID буруу ("${makIdRaw}") тул алгаслаа.`);
      }
      continue;
    }
    if (!firstName) {
      warnings.push(`${r}-р мөр: нэр хоосон тул алгаслаа (МАК ID: ${makIdRaw}).`);
      continue;
    }

    const days: Array<{ date: string; code: string }> = [];
    for (const dc of dateColumns) {
      const code = toLatinCode(cellText(ws, r, dc.col));
      if (!KNOWN_CODES.has(code)) {
        unknownCodes.set(code, (unknownCodes.get(code) || 0) + 1);
        continue;
      }
      if (code) days.push({ date: dc.date, code });
    }
    people.push({ rowNumber: r, team, lastName, firstName, makId: makIdRaw, position, days });
  }

  for (const [code, count] of unknownCodes) {
    warnings.push(`Танигдаагүй ээлжийн код "${code}" ${count} нүдэнд тааралдаж алгаслаа.`);
  }

  return { sheetName: ws.name, monthLabel, dateColumns, people, warnings };
}

// ── Албан тушаал → дамжлагын код ──

// Excel дээрх нэршил системийн станцын нэрээс зөрдөг тохиолдлын тодорхой хөрвүүлэг.
const POSITION_ALIASES: Record<string, string> = {
  'блок зүсэх дамжлагын оператор': 'ҮЯ-150',
  'бүтээгдэхүүний чанар шалгагч': 'ҮЯ-190',
  'ээлжийн мастер': 'ҮЯ-099',
};

const STATION_BY_NORMALIZED_NAME: Map<string, string> = new Map(
  Object.entries(STATION_NAME_BY_CODE).map(([code, name]) => [normalizeName(name), code])
);

export function resolveStation(position: string): { stationCode: string; kind: 'operator' | 'master' } | null {
  const norm = normalizeName(position);
  if (!norm) return null;
  let stationCode = POSITION_ALIASES[norm] || STATION_BY_NORMALIZED_NAME.get(norm) || '';
  if (!stationCode) {
    // Сүүлийн боломж: системийн станцын нэр Excel-ийн албан тушаалын дотор бүхлээрээ орсон эсэх.
    let bestLen = 0;
    for (const [name, code] of STATION_BY_NORMALIZED_NAME) {
      if (name.length > bestLen && norm.includes(name)) {
        stationCode = code;
        bestLen = name.length;
      }
    }
  }
  if (!stationCode) return null;
  return { stationCode, kind: isMasterStationCode(stationCode) ? 'master' : 'operator' };
}

// ── Хүн ↔ хэрэглэгч тааруулж, үүсгэх мөрүүдийг төлөвлөх ──

export function buildImportPlan(
  parsed: ParseResult,
  users: MatchUser[]
): { rows: PlannedRow[]; report: ImportReport } {
  const usersByName = new Map<string, MatchUser[]>();
  for (const u of users) {
    const key = normalizeName(u.name || '');
    if (!key) continue;
    const list = usersByName.get(key) || [];
    list.push(u);
    usersByName.set(key, list);
  }

  const report: ImportReport = {
    month: '',
    matched: [],
    unmatchedNames: [],
    ambiguousNames: [],
    unmappedPositions: [],
    wrongRole: [],
    conflicts: [],
    warnings: [...parsed.warnings],
  };

  const unmappedByPosition = new Map<string, string[]>();
  const rows: PlannedRow[] = [];
  const seenRowKeys = new Set<string>();
  const typesByPersonDate = new Map<string, Set<string>>();
  const matchedUidBy = new Map<string, string>(); // uid → эхний таарсан Excel хүний нэр

  for (const p of parsed.people) {
    const displayName = `${p.firstName} ${p.lastName}`.trim();

    const station = resolveStation(p.position);
    if (!station) {
      // Том/жижиг үсгээр ялгаатай бичигдсэн ижил албан тушаалыг нэг бүлэгт нэгтгэнэ.
      const posKey = normalizeName(p.position);
      let entry: string[] | undefined;
      for (const [existing, list] of unmappedByPosition) {
        if (normalizeName(existing) === posKey) {
          entry = list;
          break;
        }
      }
      if (entry) entry.push(displayName);
      else unmappedByPosition.set(p.position, [displayName]);
      continue;
    }

    // Нэрээр тааруулах — ERP sync "нэр овог" дарааллаар хадгалдаг ч аль аль дарааллыг үзнэ.
    const keys = [normalizeName(`${p.firstName} ${p.lastName}`), normalizeName(`${p.lastName} ${p.firstName}`)];
    const candidates = new Map<string, MatchUser>();
    for (const key of keys) {
      for (const u of usersByName.get(key) || []) candidates.set(u.id, u);
    }
    if (candidates.size === 0) {
      report.unmatchedNames.push({ name: displayName, makId: p.makId, position: p.position, team: p.team });
      continue;
    }
    if (candidates.size > 1) {
      report.ambiguousNames.push({ name: displayName, makId: p.makId, candidateCount: candidates.size });
      continue;
    }
    const user = [...candidates.values()][0];

    const expectedRole = station.kind === 'master' ? 'master' : 'operator';
    if (user.role !== expectedRole) {
      report.wrongRole.push({ name: displayName, position: p.position, expectedRole, actualRole: user.role });
      continue;
    }

    const priorMatch = matchedUidBy.get(user.id);
    if (priorMatch && priorMatch !== displayName) {
      report.warnings.push(`"${displayName}" болон "${priorMatch}" нэг хэрэглэгчид таарсан — мөрүүд нэгтгэгдэнэ.`);
    }
    matchedUidBy.set(user.id, priorMatch || displayName);

    let dayCount = 0;
    let nightCount = 0;
    for (const d of p.days) {
      const shiftType = d.code === 'DS' ? 'Өдрийн' : d.code === 'NS' ? 'Шөнийн' : null;
      if (!shiftType) continue;
      const rowKey = `${d.date}|${shiftType}|${station.stationCode}|${user.id}`;
      if (seenRowKeys.has(rowKey)) continue;
      seenRowKeys.add(rowKey);

      const pdKey = `${user.id}|${d.date}`;
      const types = typesByPersonDate.get(pdKey) || new Set<string>();
      if (types.size > 0 && !types.has(shiftType)) {
        report.conflicts.push(`${displayName}: ${d.date} өдөр Өдрийн ба Шөнийн ээлж давхар оноогдож байна.`);
      }
      types.add(shiftType);
      typesByPersonDate.set(pdKey, types);

      if (shiftType === 'Өдрийн') dayCount++;
      else nightCount++;
      rows.push({
        shiftDate: d.date,
        shiftType,
        stationCode: station.stationCode,
        uid: user.id,
        name: user.name || displayName,
        kind: station.kind,
      });
    }

    report.matched.push({
      name: displayName,
      makId: p.makId,
      position: p.position,
      stationCode: station.stationCode,
      uid: user.id,
      kind: station.kind,
      dayShiftCount: dayCount,
      nightShiftCount: nightCount,
    });
  }

  for (const [position, ppl] of unmappedByPosition) {
    report.unmappedPositions.push({ position, people: ppl });
  }

  return { rows, report };
}
