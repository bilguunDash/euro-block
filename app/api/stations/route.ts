import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api/responses';

/**
 * Станцын каталог + багт харьяалагдах хэрэглэгчид.
 *
 * Хуучин `/api/control-structure`-ийг орлоно. Мастер × оператор уялдааны CRUD
 * устсан — уялдаа нь одоо `users.shiftGroup` + `supervisorStationFor()` -ээр
 * тодорхойлогдоно. docs/shift-crew-architecture.md
 */

const DEFAULT_CONTROL_STATIONS: Array<[string, string, boolean]> = [
  ['ҮЯ-099', 'Ээлжийн мастер', true],
  ['ҮЯ-110', 'Цемент шахах төхөөрөмжийн оператор', false],
  ['ҮЯ-120', 'Шохойн тээрмийн оператор', false],
  ['ҮЯ-121', 'Бөмбөлөгт тээрмийн оператор', false],
  ['ҮЯ-190', 'Чанар шалгагч', false],
  ['ҮЯ-140', 'Хэв эргэлтийн оператор', false],
  ['ҮЯ-130', 'Зуурах цамхагийн оператор', false],
  ['ҮЯ-150', 'Зүсэх дамжлагын оператор', false],
  ['ҮЯ-160', 'Рам эргэлтийн оператор', false],
  ['ҮЯ-161', 'Тэргэнцэр эргэлтийн оператор', false],
  ['ҮЯ-170', 'Савлах төхөөрөмжийн оператор', false],
  ['ҮЯ-210', 'Технологийн зуухны оператор', false],
  ['ҮЯ-180', 'Автоклавын оператор', false],
  ['ҮЯ-181', 'Дулааны мастер', true],
  ['ҮЯ-310', 'Засварын мастер', true],
  ['ҮЯ-320', 'Цахилгаан автоматжуулалтын засварын бүртгэл', false],
  ['ҮЯ-400', 'Үйлдвэрийн процесст тавих хяналтын хуудас', true],
  ['ҮЯ-410', 'Цахилгаан автоматжуулалтын мастер', true],
  ['ОНБ', 'Бүтээгдэхүүний орц найрлага өөрчилсөн бүртгэл', false],
  ['СОРТ', 'Сортын оператор', false],
];

function canRead(role: string) {
  return ['admin', 'chief_engineer', 'dispatcher', 'master'].includes(role);
}

async function ensureDefaultStations() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "control_stations"
     ADD COLUMN IF NOT EXISTS "isMasterStation" BOOLEAN NOT NULL DEFAULT FALSE`
  );
  for (const [code, name, isMasterStation] of DEFAULT_CONTROL_STATIONS) {
    // Гараар өөрчилсөн нэрийг хадгална; зөвхөн станцын төрлийг синк хийнэ.
    await prisma.$executeRawUnsafe(
      `INSERT INTO "control_stations" ("code", "name", "isActive", "isMasterStation", "updatedAt")
       VALUES ($1, $2, TRUE, $3, CURRENT_TIMESTAMP)
       ON CONFLICT ("code") DO UPDATE SET
         "isMasterStation" = EXCLUDED."isMasterStation",
         "updatedAt" = CURRENT_TIMESTAMP
       WHERE "control_stations"."isMasterStation" IS DISTINCT FROM EXCLUDED."isMasterStation"`,
      code,
      name,
      isMasterStation
    );
  }
}

export async function GET() {
  const session = (await getServerSession(authOptions)) as any;
  const role = String(session?.user?.role || '');
  if (!session?.user?.id || !canRead(role)) return jsonError(401, 'Unauthorized');

  try {
    await ensureDefaultStations();
    const [stations, users] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT "id"::text, "code", "name", "isActive", "isMasterStation"
         FROM "control_stations"
         ORDER BY "code" ASC`
      ),
      prisma.user.findMany({
        where: { role: { in: ['operator', 'master'] }, isApproved: true },
        select: { id: true, name: true, email: true, role: true, stationCode: true, shiftGroup: true },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      }),
    ]);
    return NextResponse.json({ ok: true, stations, users });
  } catch (error: any) {
    console.error('GET /api/stations', error);
    return jsonError(500, error?.message || 'Database error');
  }
}
