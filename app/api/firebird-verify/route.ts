import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  FirebirdConfigError,
  fbConnect,
  fbDetach,
  fbQuery,
  firebirdConfigErrorResponse,
  getFirebirdOptions,
  guardFirebirdRequest,
} from '@/lib/firebird';

function fbCount(db: unknown, table: string): Promise<number> {
  // table нь доорх TABLE_MAP-ийн тогтмол жагсаалтаас гаралтай (хэрэглэгчийн оролт биш).
  return fbQuery<Record<string, unknown>>(db, `SELECT COUNT(*) AS cnt FROM ${table}`)
    .then((rows) => Number(rows?.[0]?.cnt ?? 0));
}

// Firebird table нэр → Prisma model тохируулга
const TABLE_MAP = [
  { fb: 'BATCH',            pg: () => prisma.batch.count() },
  { fb: 'DESTINATION',      pg: () => prisma.destination.count() },
  { fb: 'MATERIAL',         pg: () => prisma.material.count() },
  { fb: 'MIXER',            pg: () => prisma.mixer.count() },
  { fb: 'PRODUCT_ORDER',    pg: () => prisma.productOrder.count() },
  { fb: 'RECIPE',           pg: () => prisma.recipe.count() },
  { fb: 'RECIPE_COMPONENT', pg: () => prisma.recipeComponent.count() },
  { fb: 'SCALE',            pg: () => prisma.scale.count() },
  { fb: 'SILO',             pg: () => prisma.silo.count() },
  { fb: 'TRANSPORT',        pg: () => prisma.transport.count() },
];

export async function GET(req: Request) {
  const denied = await guardFirebirdRequest(req);
  if (denied) return denied;

  let db: unknown;
  try {
    db = await fbConnect(getFirebirdOptions());
  } catch (err) {
    if (err instanceof FirebirdConfigError) return firebirdConfigErrorResponse(err);
    return NextResponse.json({ error: 'Firebird холболт амжилтгүй', detail: String(err) }, { status: 503 });
  }

  const results = [];
  let allMatch = true;

  for (const { fb, pg } of TABLE_MAP) {
    let fbCount_val = 0;
    let pgCount_val = 0;
    let fbError: string | undefined;

    try {
      fbCount_val = await fbCount(db, fb);
    } catch (err) {
      fbError = String(err);
    }

    try {
      pgCount_val = await pg();
    } catch {
      pgCount_val = -1;
    }

    const match = !fbError && fbCount_val === pgCount_val;
    if (!match) allMatch = false;

    results.push({
      table:   fb,
      firebird: fbError ? `АЛДАА: ${fbError}` : fbCount_val,
      postgres: pgCount_val,
      missing:  fbError ? '?' : fbCount_val - pgCount_val,
      status:   fbError ? '⚠️ FB алдаа' : match ? '✅ Таарч байна' : '❌ Дутуу',
    });
  }

  await fbDetach(db);

  return NextResponse.json({ allMatch, results });
}
