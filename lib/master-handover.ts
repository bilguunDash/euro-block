import { prisma } from '@/lib/prisma';
import { filterActiveUserIds } from '@/lib/active-users';

function normalizeDate(value: unknown) {
  const s = String(value ?? '').trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return match ? match[1] : s.slice(0, 10);
}

function normalizeShiftType(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeStation(value: unknown) {
  return String(value ?? '').trim();
}

function shiftTypeSortOrder(value: unknown) {
  const type = normalizeShiftType(value).toLowerCase();
  if (type === 'өдрийн' || type.includes('өдр')) return 1;
  if (type === 'шөнийн' || type.includes('шөн')) return 2;
  return 99;
}

function isSlotAfter(
  candidate: { shiftDate: unknown; shiftType: unknown },
  current: { shiftDate: unknown; shiftType: unknown },
) {
  const candidateDate = normalizeDate(candidate.shiftDate);
  const currentDate = normalizeDate(current.shiftDate);
  if (!candidateDate || !currentDate) return false;
  const dateCompare = candidateDate.localeCompare(currentDate);
  if (dateCompare !== 0) return dateCompare > 0;
  return shiftTypeSortOrder(candidate.shiftType) > shiftTypeSortOrder(current.shiftType);
}

function compareScheduledRows(
  a: { shiftDate: unknown; shiftType: unknown; createdAt?: unknown },
  b: { shiftDate: unknown; shiftType: unknown; createdAt?: unknown },
) {
  const dateCompare = normalizeDate(a.shiftDate).localeCompare(normalizeDate(b.shiftDate));
  if (dateCompare !== 0) return dateCompare;
  const typeCompare = shiftTypeSortOrder(a.shiftType) - shiftTypeSortOrder(b.shiftType);
  if (typeCompare !== 0) return typeCompare;
  return new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime();
}

/** Энэ ээлжийн (одоогийн slot-ийн) мастерын хуваарь */
export async function resolveCurrentMasterScheduleForShift(shift: {
  shiftDate: string;
  shiftType: string;
  stationCode: string;
}) {
  const shiftDate = normalizeDate(shift.shiftDate);
  const shiftType = normalizeShiftType(shift.shiftType);
  const stationCode = normalizeStation(shift.stationCode);
  if (!shiftDate || !shiftType || !stationCode) return null;

  const rows = await prisma.masterSchedule.findMany({
    where: { shiftDate, stationCode },
    select: {
      masterUid: true,
      masterName: true,
      shiftDate: true,
      shiftType: true,
      stationCode: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const candidates = rows
    .filter(
      (row) =>
        normalizeStation(row.stationCode) === stationCode &&
        normalizeShiftType(row.shiftType) === shiftType,
    )
    .sort(compareScheduledRows);

  // Идэвхгүй болгосон мастерыг алгасна — нэвтэрч чадахгүй хүн ээлж баталгаажуулж
  // чадахгүй тул хүлээлцэх гинж түүн дээр гацна.
  const activeUids = await filterActiveUserIds(candidates.map((row) => row.masterUid));
  return candidates.find((row) => activeUids.has(String(row.masterUid).trim())) || null;
}

/** Дараагийн мастерын хуваарь (мастер → мастер хүлээлцэх) */
export async function resolveNextMasterScheduleForShift(shift: {
  shiftDate: string;
  shiftType: string;
  stationCode: string;
}) {
  const shiftDate = normalizeDate(shift.shiftDate);
  const shiftType = normalizeShiftType(shift.shiftType);
  const stationCode = normalizeStation(shift.stationCode);
  if (!shiftDate || !shiftType || !stationCode) return null;

  const rows = await prisma.masterSchedule.findMany({
    where: {
      shiftDate: { gte: shiftDate },
      stationCode,
    },
    select: {
      masterUid: true,
      masterName: true,
      shiftDate: true,
      shiftType: true,
      stationCode: true,
      createdAt: true,
    },
    orderBy: [{ shiftDate: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });
  const candidates = rows
    .filter((row) => normalizeStation(row.stationCode) === stationCode)
    .filter((row) => isSlotAfter(row, { shiftDate, shiftType }))
    .sort(compareScheduledRows);

  // Хамгийн ойрын ИДЭВХТЭЙ мастерыг олтол хуваарийн дарааллаар урагшаа алхана.
  const activeUids = await filterActiveUserIds(candidates.map((row) => row.masterUid));
  return candidates.find((row) => activeUids.has(String(row.masterUid).trim())) || null;
}
