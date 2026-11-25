/** Handover window display helpers (UI). Times interpreted in Asia/Ulaanbaatar. */

const DEFAULT_TZ = 'Asia/Ulaanbaatar';

/**
 * Хүлээлцэх цонхны АНХДАГЧ утга — ГАНЦ ЭХ СУРВАЛЖ.
 *
 * Цонх нь тухайн ээлж ДУУСАХ мөчид тулгуурлана:
 *   Өдрийн ээлж (08:00-20:00) → ОРОЙ хүлээлцэнэ  → 19:30-20:30
 *   Шөнийн ээлж (20:00-08:00) → ӨГЛӨӨ хүлээлцэнэ → 07:30-08:30
 *
 * Энэ утгууд өмнө нь 6 өөр файлд давхардаж бичигдсэн бөгөөд өдөр↔шөнө нь
 * СОЛИГДСОН байсан тул бодит бүртгэлийн ~92% нь худал «Хоцорч»/«Эрт» гэж
 * тэмдэглэгдэж байв. Энэ файл prisma импортлодоггүй тул сервер ба клиент
 * хоёулаа эндээс уншина — утгыг ЗӨВХӨН ЭНД өөрчилнө.
 */
export const HANDOVER_WINDOW_DEFAULTS = {
  day_handover_start: '19:30',
  day_handover_end: '20:30',
  night_handover_start: '07:30',
  night_handover_end: '08:30',
} as const;

/**
 * Ээлжийн төрөлд тохирох цонхыг сонгоно. `settings` нь DB-ээс уншсан утга
 * (хоосон бол анхдагчийг хэрэглэнэ).
 */
export function resolveHandoverWindow(
  shiftType: unknown,
  settings: Record<string, string | undefined | null> = {},
): { start: string; end: string; label: string } {
  const isNight = String(shiftType || '').trim() === 'Шөнийн';
  const startKey = isNight ? 'night_handover_start' : 'day_handover_start';
  const endKey = isNight ? 'night_handover_end' : 'day_handover_end';
  const start = String(settings[startKey] || '').trim() || HANDOVER_WINDOW_DEFAULTS[startKey];
  const end = String(settings[endKey] || '').trim() || HANDOVER_WINDOW_DEFAULTS[endKey];
  return { start, end, label: `${start}-${end}` };
}

export function isoDateInTimeZone(d = new Date(), timeZone = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function minutesOfDayInTimeZone(d = new Date(), timeZone = DEFAULT_TZ): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hh = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const mm = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  return hh * 60 + mm;
}

export function parseHmToMinutes(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || '').trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Inclusive window [start, end] in minutes-of-day; supports overnight if start > end. */
export function isMinuteInHmWindow(nowMins: number, startHm: string, endHm: string): boolean {
  const a = parseHmToMinutes(startHm);
  const b = parseHmToMinutes(endHm);
  if (a === null || b === null) return false;
  if (a <= b) return nowMins >= a && nowMins <= b;
  return nowMins >= a || nowMins <= b;
}

export type HandoverTimingKey = 'normal' | 'early' | 'late';

/**
 * Цонхтой харьцуулж «хугацаандаа / эрт / хоцорсон»-ыг тодорхойлно — сервер ба
 * клиент хоёрын ГАНЦ хэрэгжилт.
 *
 * Шөнө дундуур давсан цонхыг (ж: 23:30-00:30) зөв боловсруулна: цонхны гадна үед
 * «дууссанаас хойш өнгөрсөн» ба «дараагийн цонх эхлэх хүртэлх» хугацааг харьцуулж
 * ойрхныг нь сонгоно. Өмнө нь давсан цонх дээр ҮРГЭЛЖ «хоцорсон» гэж гардаг,
 * «эрт» гэсэн үр дүн ХЭЗЭЭ Ч гардаггүй алдаатай байв.
 */
export function classifyHandoverTiming(
  nowMins: number,
  startHm: string,
  endHm: string,
): HandoverTimingKey {
  const a = parseHmToMinutes(startHm);
  const b = parseHmToMinutes(endHm);
  if (a === null || b === null) return 'normal';
  if (isMinuteInHmWindow(nowMins, startHm, endHm)) return 'normal';
  const sinceEnd = (nowMins - b + 1440) % 1440;
  const untilStart = (a - nowMins + 1440) % 1440;
  // Тэнцүү зайтай үед (цонхноос 2 тал руу ижил хугацаа) «эрт» тал руу хазайна:
  // 12 цагийн зайд байгаа хүнийг «хоцорсон» гэж буруутгахаас илүү бодитой.
  return sinceEnd < untilStart ? 'late' : 'early';
}

export const HANDOVER_TIMING_LABELS: Record<HandoverTimingKey, string> = {
  normal: 'Хугацаандаа ээлж хүлээлцсэн',
  early: 'Эрт ээлж хүлээлцсэн',
  late: 'Хоцорч ээлж хүлээлцсэн',
};
