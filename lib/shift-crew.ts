/**
 * Ээлжийн баг (crew) — тасралтгүй ээлжээр ажилладаг хүмүүсийн бүлэг.
 *
 * `control_assignments` (Хяналтын бүтэц) хүн × хүн матрицыг орлоно: мастер ↔ оператор
 * холбоо нь илэрхий мөр байхаа болиод "ижил баг + ижил ээлж" гэсэн далд холбоо болно.
 * Станцын харьяалал нь `lib/master-stations.ts`-ийн `supervisorStationFor()`-д байна.
 *
 * docs/shift-crew-architecture.md
 */

export const SHIFT_GROUPS = ['1', '2', '3'] as const;

export type ShiftGroup = (typeof SHIFT_GROUPS)[number];

export const SHIFT_GROUP_OPTIONS: Array<{ value: ShiftGroup; label: string }> = [
  { value: '1', label: '1-р ээлж' },
  { value: '2', label: '2-р ээлж' },
  { value: '3', label: '3-р ээлж' },
];

export function isShiftGroup(value: unknown): value is ShiftGroup {
  const normalized = String(value ?? '').trim();
  return (SHIFT_GROUPS as readonly string[]).includes(normalized);
}

/** Хадгалахад бэлэн утга буцаана — хоосон/буруу бол `null` (багт харьяалагдахгүй). */
export function normalizeShiftGroup(value: unknown): ShiftGroup | null {
  const normalized = String(value ?? '').trim();
  return isShiftGroup(normalized) ? normalized : null;
}

export function shiftGroupLabel(value: unknown): string {
  const group = normalizeShiftGroup(value);
  if (!group) return 'Баггүй';
  return SHIFT_GROUP_OPTIONS.find((o) => o.value === group)?.label ?? `${group}-р ээлж`;
}

/* ── Ээлжийн төрөл ─────────────────────────────────────────────────────── */

export const SHIFT_TYPES = ['Өдрийн', 'Шөнийн'] as const;

export type ShiftTypeName = (typeof SHIFT_TYPES)[number];

export function normalizeShiftType(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ');
}

export function isKnownShiftType(value: unknown): boolean {
  return (SHIFT_TYPES as readonly string[]).includes(normalizeShiftType(value));
}

/* ── Огнооны муж ───────────────────────────────────────────────────────── */

/** Нэг удаад оноох боломжтой хамгийн урт хугацаа (өдрөөр). */
export const CREW_RANGE_MAX_DAYS = 92;

export function normalizeDate(value: unknown): string {
  const s = String(value ?? '').trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : s.slice(0, 10);
}

export function isIsoDate(value: unknown): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '').trim());
}

/**
 * [start..end] хоорондох ISO огноонуудыг (хоёр захыг оруулаад) буцаана.
 * `CREW_RANGE_MAX_DAYS`-аас урт бол таслана.
 */
export function expandDateRange(start: unknown, end: unknown): string[] {
  const from = normalizeDate(start);
  const to = normalizeDate(end) || from;
  if (!isIsoDate(from) || !isIsoDate(to)) return [];

  const [sy, sm, sd] = from.split('-').map(Number);
  const [ey, em, ed] = to.split('-').map(Number);
  let cursor = Date.UTC(sy, sm - 1, sd);
  const last = Date.UTC(ey, em - 1, ed);
  if (last < cursor) return [];

  const dates: string[] = [];
  while (cursor <= last && dates.length < CREW_RANGE_MAX_DAYS) {
    dates.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += 24 * 60 * 60 * 1000;
  }
  return dates;
}

/* ── Багийн гишүүд ─────────────────────────────────────────────────────── */

export type CrewMember = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  stationCode: string | null;
  shiftGroup: string | null;
};

export type CrewSplit = {
  /** Станцтай — хуваарь авах хүмүүс. */
  operators: CrewMember[];
  masters: CrewMember[];
  /** `stationCode` дутуу тул алгасагдах хүмүүс (чимээгүй хаяхгүй, UI-д харуулна). */
  skipped: CrewMember[];
};

function hasStation(member: CrewMember): boolean {
  return Boolean(String(member.stationCode ?? '').trim());
}

/**
 * Багийн гишүүдийг оноох боломжтой (станцтай) оператор/мастер, болон алгасагдах
 * гэсэн гурав хуваана. Станцгүй хүнийг чимээгүй хаяхгүй — `skipped`-д буцаана.
 */
export function splitCrewMembers(members: readonly CrewMember[]): CrewSplit {
  const operators: CrewMember[] = [];
  const masters: CrewMember[] = [];
  const skipped: CrewMember[] = [];

  for (const member of members) {
    if (!hasStation(member)) {
      skipped.push(member);
      continue;
    }
    if (member.role === 'master') masters.push(member);
    else if (member.role === 'operator') operators.push(member);
  }

  return { operators, masters, skipped };
}

/** Урьдчилсан харагдацад хэдэн мөр үүсэхийг тооцно. */
export function countCrewScheduleRows(input: {
  split: CrewSplit;
  dates: readonly string[];
  shiftTypes: readonly string[];
}): { operatorRows: number; masterRows: number; total: number } {
  const slots = input.dates.length * input.shiftTypes.length;
  const operatorRows = input.split.operators.length * slots;
  const masterRows = input.split.masters.length * slots;
  return { operatorRows, masterRows, total: operatorRows + masterRows };
}
