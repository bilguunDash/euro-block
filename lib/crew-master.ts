/**
 * Ээлжийн багийн хариуцлага — сервер тал (prisma ашиглана).
 *
 * ЗАРЧИМ: багийн аль ч мастер тухайн багийн аль ч операторыг хариуцаж болно.
 * Станцын харьяалал (мастер станц → операторын станц) гэсэн ойлголт БАЙХГҮЙ —
 * холбоос нь зөвхөн «ижил баг» дээр тогтоно.
 *
 * docs/shift-crew-architecture.md
 */
import { prisma } from '@/lib/prisma';

/** Олон мастер өрсөлдвөл ээлжийн мастер (ҮЯ-099) тэргүүлнэ. */
const PRIMARY_MASTER_STATION = 'ҮЯ-099';

export type CrewMasterRef = {
  masterUid: string;
  masterName: string | null;
  masterStationCode: string | null;
};

type MasterRow = {
  id: string;
  name: string | null;
  email: string | null;
  stationCode: string | null;
};

/**
 * Нэрийн дараалал биш, эрэмбийн дүрмээр нэгийг сонгоно:
 * ҮЯ-099 мастер эхэнд, дараа нь нэрээр. Ингэснээр үр дүн давтагдана.
 */
function pickPrimary(masters: MasterRow[]): MasterRow | null {
  if (masters.length === 0) return null;
  const sorted = [...masters].sort((a, b) => {
    const aPrimary = String(a.stationCode || '').trim() === PRIMARY_MASTER_STATION ? 0 : 1;
    const bPrimary = String(b.stationCode || '').trim() === PRIMARY_MASTER_STATION ? 0 : 1;
    if (aPrimary !== bPrimary) return aPrimary - bPrimary;
    return String(a.name || a.email || '').localeCompare(String(b.name || b.email || ''), 'mn');
  });
  return sorted[0];
}

function toRef(row: MasterRow): CrewMasterRef {
  return {
    masterUid: row.id,
    masterName: row.name || row.email || null,
    masterStationCode: row.stationCode || null,
  };
}

/** Тухайн багийн бүх идэвхтэй мастер. */
export async function crewMasters(shiftGroup: string | null | undefined): Promise<MasterRow[]> {
  const group = String(shiftGroup ?? '').trim();
  if (!group) return [];
  return prisma.user.findMany({
    where: { role: 'master', isApproved: true, shiftGroup: group },
    select: { id: true, name: true, email: true, stationCode: true },
  });
}

/**
 * Ээлжийг хариуцах мастерыг тодорхойлно.
 *
 * 1. Операторын баг олно — баггүй бол хариуцагч байхгүй
 * 2. Өөрийгөө хассан багийн мастерууд — мастер станцын шинэ ээлжийн ОПЕРАТОР нь
 *    тухайн мастер өөрөө байдаг тул (жишээ нь ҮЯ-099/181/310/410 дээр ажил эхлүүлэх),
 *    өөрийгөө өөрийн хариуцагч болгож болохгүй (доорх duplicate-uid шалгалттай зөрчилдөнө)
 * 3. Тухайн slot-д хуваарьтай багийн мастерууд → тэдгээрээс сонгоно
 * 4. Хуваарьтай нь байхгүй бол багийн бусад мастераас сонгоно
 * 5. Сонголт: ҮЯ-099 мастер тэргүүлнэ, дараа нь нэрээр
 * 6. Багт өөрөөс өөр мастер байхгүй бол `null` — дуудагч тал өөрийг нь хариуцагч
 *    болгож fallback хийнэ (`app/api/shifts/route.ts` мөр ~715)
 */
export async function resolveCrewMasterForShift(input: {
  operatorUid: string;
  shiftDate: string;
  shiftType: string;
}): Promise<CrewMasterRef | null> {
  const operatorUid = String(input.operatorUid || '').trim();
  const shiftDate = String(input.shiftDate || '').trim();
  const shiftType = String(input.shiftType || '').trim();
  if (!operatorUid || !shiftDate || !shiftType) return null;

  const operator = await prisma.user.findUnique({
    where: { id: operatorUid },
    select: { shiftGroup: true },
  });
  const masters = (await crewMasters(operator?.shiftGroup)).filter((m) => m.id !== operatorUid);
  if (masters.length === 0) return null;

  const scheduled = await prisma.masterSchedule.findMany({
    where: { shiftDate, shiftType, masterUid: { in: masters.map((m) => m.id) } },
    select: { masterUid: true },
  });

  const scheduledIds = new Set(scheduled.map((s) => s.masterUid));
  const candidates = masters.filter((m) => scheduledIds.has(m.id));

  const chosen = pickPrimary(candidates.length > 0 ? candidates : masters);
  return chosen ? toRef(chosen) : null;
}

/**
 * Мастерын харах эрхийн хүрээ — өөрийн багийн операторуудын uid.
 *
 * `null` буцаавал хүрээ хязгаарлахгүй (мастер багт харьяалагдаагүй үед хуучин
 * зан төлөвийг хадгална — гэнэт бүх зүйл алга болохоос сэргийлнэ).
 */
export async function crewOperatorUids(masterUid: string): Promise<string[] | null> {
  const master = await prisma.user.findUnique({
    where: { id: String(masterUid || '').trim() },
    select: { shiftGroup: true },
  });
  const group = String(master?.shiftGroup ?? '').trim();
  if (!group) return null;

  const rows = await prisma.user.findMany({
    where: { role: 'operator', isApproved: true, shiftGroup: group },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
