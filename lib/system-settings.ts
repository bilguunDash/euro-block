import { prisma } from '@/lib/prisma';
import {
  classifyHandoverTiming,
  HANDOVER_TIMING_LABELS,
  HANDOVER_WINDOW_DEFAULTS,
  isMinuteInHmWindow,
  minutesOfDayInTimeZone,
  resolveHandoverWindow,
} from '@/lib/handover-window';

export const SYSTEM_SETTING_DEFAULTS: Record<string, string> = {
  periodic_interval_hours: '2',
  /** "true" | "false" — Хүлээлцэх хүсэлтийг зөвхөн тохируулсан цонхонд илгээх эсэх */
  shift_handover_window_strict: 'false',
  // Хүлээлцэх цонхны анхдагч — `lib/handover-window.ts` дахь ГАНЦ эх сурвалжаас.
  ...HANDOVER_WINDOW_DEFAULTS,
};

export async function getSystemSetting(key: string): Promise<string> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row?.value ?? SYSTEM_SETTING_DEFAULTS[key] ?? '';
}

export async function getPeriodicIntervalHours(): Promise<number> {
  const v = await getSystemSetting('periodic_interval_hours');
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 2;
}

export async function isHandoverWindowStrict(): Promise<boolean> {
  return (await getSystemSetting('shift_handover_window_strict')).trim().toLowerCase() === 'true';
}

/** Цонх сонгох логик нь `resolveHandoverWindow`-д — энд зөвхөн DB-ээс уншина. */
export async function getHandoverWindowForShift(shiftType: string) {
  const [dayStart, dayEnd, nightStart, nightEnd] = await Promise.all([
    getSystemSetting('day_handover_start'),
    getSystemSetting('day_handover_end'),
    getSystemSetting('night_handover_start'),
    getSystemSetting('night_handover_end'),
  ]);
  return resolveHandoverWindow(shiftType, {
    day_handover_start: dayStart,
    day_handover_end: dayEnd,
    night_handover_start: nightStart,
    night_handover_end: nightEnd,
  });
}

/** Ангиллын логик нь `classifyHandoverTiming`-д — клиенттэй ижил хэрэгжилт. */
export async function getHandoverTimingStatus(shiftType: string, now = new Date()) {
  const window = await getHandoverWindowForShift(shiftType);
  const key = classifyHandoverTiming(minutesOfDayInTimeZone(now), window.start, window.end);
  return { key, label: HANDOVER_TIMING_LABELS[key], window };
}

/** Өдрийн ээлж = shiftType "Өдрийн" гэж үзнэ */
export async function isWithinHandoverWindow(shiftType: string, now = new Date()): Promise<boolean> {
  const strict = await isHandoverWindowStrict();
  if (!strict) return true;

  const window = await getHandoverWindowForShift(shiftType);
  return isMinuteInHmWindow(minutesOfDayInTimeZone(now), window.start, window.end);
}
