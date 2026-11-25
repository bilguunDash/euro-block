import { ADMIN_APPROVAL_LOG_TYPES, MASTER_STATION_CODES, MASTER_STATION_FORMS, isMasterStationCode } from './master-stations';

export const APPROVAL_HISTORY_PAGE_SIZE = 20;
export const MASTER_APPROVAL_STATION_BY_LOG_TYPE: Record<string, string> = Object.fromEntries(
  Object.values(MASTER_STATION_FORMS).filter((form) => form !== undefined)
    .map((form) => [`modal_${form.formKind}`, form.stationCode])
);

/**
 * «Давхар баталгаажуулалт»-ын таб станцын төрлөөр ялгагдана:
 * «Оператор» = оператор станцын ээлж; «Мастер» = мастер станцын ээлж + мастерын маягт.
 * Мастер станцыг `isMasterStationCode` тодорхойлно — сервер, клиент хоёр яг ижил дүрэм.
 */
export type ApprovalStationKind = 'operator' | 'master';

export function approvalStationKind(stationCode: unknown): ApprovalStationKind {
  return isMasterStationCode(stationCode) ? 'master' : 'operator';
}

/** `stationKind` query параметр. Заагаагүй бол '' — станцаар хязгаарлахгүй (Нүүрийн нийт тоо ингэж дууддаг). */
export function parseApprovalStationKind(params: URLSearchParams): ApprovalStationKind | '' {
  const value = (params.get('stationKind') || '').trim();
  if (value && value !== 'operator' && value !== 'master') throw new Error('Станцын төрөл буруу байна.');
  return value as ApprovalStationKind | '';
}

/**
 * «Хүлээгдэж буй» badge-ууд. Оператор = оператор станцын ээлж, Мастер = мастер станцын ээлж +
 * `needsAdminApproval` мастерын маягт. Давхар баталгаажуулалтын табын badge болон Нүүрийн карт
 * ИЖИЛ тоо харуулахын тулд хоёулаа энэ функцийг дууддаг.
 *
 * `shiftTotal` нь серверийн нийт тоо (жагсаалт 2000-аар хязгаарлагдсан) — ачаалагдаагүй үлдэгдлийн
 * станцыг мэдэх боломжгүй тул оператор талд тооцно.
 */
export function pendingApprovalCounts({ shifts, shiftTotal, formTotal }: {
  shifts: ReadonlyArray<{ stationCode?: unknown } | null | undefined>;
  shiftTotal?: number;
  formTotal: number;
}) {
  const masterShifts = shifts.filter((shift) => approvalStationKind(shift?.stationCode) === 'master').length;
  const unloaded = Math.max(0, (typeof shiftTotal === 'number' ? shiftTotal : shifts.length) - shifts.length);
  return { operator: shifts.length - masterShifts + unloaded, master: masterShifts + formTotal };
}

export type ApprovalHistoryQuery = {
  since: string;
  until: string;
  station: string;
  crew: string;
  query: string;
  shiftType: string;
  page: number;
  pageSize: number;
  skip: number;
};

function calendarDate(value: string, label: string) {
  if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)) {
    throw new Error(`${label}: YYYY-MM-DD хэлбэртэй зөв огноо оруулна уу.`);
  }
  return value;
}

export function parseApprovalHistoryQuery(params: URLSearchParams): ApprovalHistoryQuery {
  const since = calendarDate((params.get('since') || '').trim(), 'Эхлэх огноо');
  const until = calendarDate((params.get('until') || '').trim(), 'Дуусах огноо');
  if (since && until && since > until) throw new Error('Дуусах огноо эхлэх огнооноос өмнө байна.');
  const positiveInteger = (key: string, fallback: number, maximum: number) => {
    const value = params.get(key);
    if (value === null) return fallback;
    const number = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 1 || number > maximum) {
      throw new Error(`${key}: 1–${maximum} хооронд бүхэл тоо оруулна уу.`);
    }
    return number;
  };
  const pageSize = positiveInteger('pageSize', APPROVAL_HISTORY_PAGE_SIZE, 100);
  const page = positiveInteger('page', 1, Math.floor(2_147_483_647 / pageSize));
  const crew = (params.get('crew') || '').trim();
  if (crew && !['1', '2', '3'].includes(crew)) throw new Error('Ээлжийн баг буруу байна.');
  const shiftType = (params.get('shiftType') || '').trim();
  if (shiftType && !['Өдрийн', 'Шөнийн'].includes(shiftType)) throw new Error('Ээлжийн төрөл буруу байна.');
  return {
    since, until, crew, shiftType,
    station: (params.get('station') || params.get('stationCode') || '').trim(),
    query: (params.get('query') || '').trim(),
    page, pageSize, skip: (page - 1) * pageSize,
  };
}

export function approvalHistoryPagination(query: ApprovalHistoryQuery, total: number) {
  return { page: query.page, pageSize: query.pageSize, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) };
}

// PostgreSQL's C locale does not case-fold Cyrillic. Keep Mongolian names
// searchable regardless of the database locale, without requiring a collation.
function nameSearchSql(expression: string) {
  return `LOWER(TRANSLATE(${expression}, 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯӨҮ', 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяөү'))`;
}

function nameSearchPattern(query: string) {
  return `%${query.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`;
}

/**
 * Эцэслэн баталгаажсан ЭЭЛЖҮҮД. `stationKind` өгвөл оператор/мастер станцад хязгаарлана
 * (Оператор таб = 'operator', Мастер табын ээлжийн жагсаалт = 'master'); өгөөгүй бол бүх станц.
 */
export function operatorApprovedWhere(query: ApprovalHistoryQuery, crewUids?: string[], stationKind: ApprovalStationKind | '' = '') {
  const where: any = { masterApproved: true, adminApproved: true };
  if (query.since || query.until) where.shiftDate = {
    ...(query.since ? { gte: query.since } : {}),
    ...(query.until ? { lte: query.until } : {}),
  };
  if (stationKind) {
    // Сонгосон станц ба станцын төрлийг ХОЁУЛАНГ нь хэрэглэнэ (нэг нь нөгөөгөө дарж бичихгүй):
    // Оператор табад мастер станц сонгосон бол хоосон үр дүн гарна.
    where.stationCode = {
      ...(query.station ? { equals: query.station } : {}),
      [stationKind === 'master' ? 'in' : 'notIn']: [...MASTER_STATION_CODES],
    };
  } else if (query.station) where.stationCode = query.station;
  if (query.shiftType) where.shiftType = query.shiftType;
  if (crewUids) where.operatorUid = { in: crewUids };
  return where;
}

/** `operatorApprovedWhere`-ийн нэрээр хайх (raw SQL) хувилбар — `stationKind`-ийн утга ижил. */
export function operatorApprovedSearchFilter(query: ApprovalHistoryQuery, stationKind: ApprovalStationKind | '' = '') {
  const params: unknown[] = [];
  const conditions = ['s."masterApproved" = true', 's."adminApproved" = true'];
  const bind = (value: unknown) => { params.push(value); return `$${params.length}`; };
  if (query.since) conditions.push(`s."shiftDate" >= ${bind(query.since)}`);
  if (query.until) conditions.push(`s."shiftDate" <= ${bind(query.until)}`);
  if (query.station) conditions.push(`s."stationCode" = ${bind(query.station)}`);
  if (stationKind) {
    conditions.push(`${stationKind === 'master' ? '' : 'NOT '}(s."stationCode" = ANY(${bind([...MASTER_STATION_CODES])}))`);
  }
  if (query.shiftType) conditions.push(`s."shiftType" = ${bind(query.shiftType)}`);
  if (query.crew) conditions.push(`u."shiftGroup" = ${bind(query.crew)}`);
  const names = `CONCAT_WS(' ', s."operatorName", COALESCE(NULLIF(s."masterApprovedBy", ''), s."currentMasterApprovedByName", ''), s."adminApprovedBy")`;
  conditions.push(`${nameSearchSql(names)} LIKE ${bind(nameSearchPattern(query.query))}`);
  return {
    fromSql: 'FROM "shifts" s LEFT JOIN "users" u ON u."id" = s."operatorUid"',
    whereSql: conditions.join(' AND '), params,
  };
}

/** Both the count and page use this SQL predicate, including JSON approval flags. */
export function masterApprovedFilter(query: ApprovalHistoryQuery) {
  const params: unknown[] = [[...ADMIN_APPROVAL_LOG_TYPES]];
  const conditions = ['l."logType" = ANY($1)', `l."data"->>'adminApproved' = 'true'`];
  const bind = (value: unknown) => { params.push(value); return `$${params.length}`; };
  if (query.since) conditions.push(`COALESCE(s."shiftDate", l."data"->>'shiftDate', '') >= ${bind(query.since)}`);
  if (query.until) conditions.push(`COALESCE(s."shiftDate", l."data"->>'shiftDate', '') <= ${bind(query.until)}`);
  if (query.station) {
    const logTypes = ADMIN_APPROVAL_LOG_TYPES.filter((type) => MASTER_APPROVAL_STATION_BY_LOG_TYPE[type] === query.station);
    conditions.push(`l."logType" = ANY(${bind(logTypes)})`);
  }
  if (query.crew) conditions.push(`u."shiftGroup" = ${bind(query.crew)}`);
  if (query.shiftType) conditions.push(`COALESCE(s."shiftType", l."data"->>'shiftType', '') = ${bind(query.shiftType)}`);
  if (query.query) {
    const names = `CONCAT_WS(' ',
      COALESCE(NULLIF(l."data"->>'sigHandingOver', ''), NULLIF(l."data"->>'handedOverBy', ''), s."operatorName", ''),
      COALESCE(NULLIF(l."data"->>'sigReceiving', ''), NULLIF(l."data"->>'receivedBy', ''), ''),
      COALESCE(l."data"->>'adminApprovedBy', '')
    )`;
    conditions.push(`${nameSearchSql(names)} LIKE ${bind(nameSearchPattern(query.query))}`);
  }
  return {
    fromSql: `FROM "production_logs" l LEFT JOIN "shifts" s ON s."id" = l."shiftId"
      LEFT JOIN "users" u ON u."id" = COALESCE(s."operatorUid", l."data"->>'operatorUid', '')`,
    whereSql: conditions.join(' AND '), params,
  };
}
