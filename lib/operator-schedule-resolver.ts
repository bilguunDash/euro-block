import { prisma } from '@/lib/prisma';
import { filterActiveUserIds } from '@/lib/active-users';

export const NEXT_OPERATOR_SCHEDULE_MISSING =
  'Ижил дамжлагын дараагийн операторын хуваарь олдсонгүй. Admin хуваарийг огноо, өдөр/шөнийн дарааллаар шалгана уу.';

export const NEXT_OPERATOR_MUST_DIFFER =
  'Дараагийн оператор одоогийн оператораас өөр байх ёстой.';

export const NEXT_OPERATOR_ALL_INACTIVE =
  'Дараагийн хуваарьт операторуудын бүртгэл идэвхгүй байна. Admin хэрэглэгчийн зөвшөөрөл эсвэл хуваарийг шалгана уу.';

function normalizeDate(value: unknown) {
  const text = String(value ?? '').trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match ? match[1] : text.slice(0, 10);
}

function normalizeShiftType(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ');
}

export function normalizeStationCode(value: unknown) {
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
  current: { shiftDate: unknown; shiftType: unknown }
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
  b: { shiftDate: unknown; shiftType: unknown; createdAt?: unknown }
) {
  const dateCompare = normalizeDate(a.shiftDate).localeCompare(normalizeDate(b.shiftDate));
  if (dateCompare !== 0) return dateCompare;
  const typeCompare = shiftTypeSortOrder(a.shiftType) - shiftTypeSortOrder(b.shiftType);
  if (typeCompare !== 0) return typeCompare;
  return new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime();
}

export async function resolveNextOperatorSchedule(input: {
  shiftDate: string;
  shiftType: string;
  stationCode: string;
  currentOperatorUid?: string | null;
}) {
  const shiftDate = normalizeDate(input.shiftDate);
  const shiftType = normalizeShiftType(input.shiftType);
  const stationCode = normalizeStationCode(input.stationCode);
  const currentOperatorUid = String(input.currentOperatorUid || '').trim();

  if (!shiftDate || !shiftType || !stationCode) {
    return { eligible: false as const, schedule: null, error: NEXT_OPERATOR_SCHEDULE_MISSING };
  }

  const rows = await prisma.operatorSchedule.findMany({
    where: {
      shiftDate: { gte: shiftDate },
      stationCode,
    },
    select: {
      id: true,
      operatorUid: true,
      operatorName: true,
      shiftDate: true,
      shiftType: true,
      stationCode: true,
      createdAt: true,
    },
    orderBy: [{ shiftDate: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });

  const candidates = rows
    .filter((row) => normalizeStationCode(row.stationCode) === stationCode)
    .filter((row) => isSlotAfter(row, { shiftDate, shiftType }))
    .sort(compareScheduledRows);

  if (!candidates.length) {
    return { eligible: false as const, schedule: null, error: NEXT_OPERATOR_SCHEDULE_MISSING };
  }

  // Идэвхгүй болгосон бүртгэл рүү заахаас сэргийлж, ХАМГИЙН ОЙРЫН ИДЭВХТЭЙ
  // операторыг олтол хуваарийн дарааллаар урагшаа алхана.
  const activeUids = await filterActiveUserIds(candidates.map((row) => row.operatorUid));
  const schedule = candidates.find((row) => activeUids.has(String(row.operatorUid).trim())) || null;

  if (!schedule) {
    return { eligible: false as const, schedule: null, error: NEXT_OPERATOR_ALL_INACTIVE };
  }

  if (currentOperatorUid && String(schedule.operatorUid).trim() === currentOperatorUid) {
    return { eligible: false as const, schedule, error: NEXT_OPERATOR_MUST_DIFFER };
  }

  return { eligible: true as const, schedule, error: null };
}
