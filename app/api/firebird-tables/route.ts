import { NextResponse } from 'next/server';
import {
  FirebirdConfigError,
  fbConnect,
  fbDetach,
  fbQuery,
  firebirdConfigErrorResponse,
  getFirebirdOptions,
  guardFirebirdRequest,
} from '@/lib/firebird';

// Firebird-ийн бүх table болон тэдгээрийн column нэрийг буцаана
export async function GET(req: Request) {
  const denied = await guardFirebirdRequest(req);
  if (denied) return denied;

  let db: unknown;
  try {
    db = await fbConnect(getFirebirdOptions());
  } catch (err) {
    if (err instanceof FirebirdConfigError) return firebirdConfigErrorResponse(err);
    return NextResponse.json({ error: 'Холболт амжилтгүй', detail: String(err) }, { status: 503 });
  }

  try {
    // Бүх user table-уудыг татна
    const tables = await fbQuery<Record<string, unknown>>(db,
      `SELECT TRIM(r.RDB$RELATION_NAME) AS name
       FROM RDB$RELATIONS r
       WHERE r.RDB$SYSTEM_FLAG = 0
         AND r.RDB$VIEW_SOURCE IS NULL
       ORDER BY r.RDB$RELATION_NAME`
    );

    const tableNames = tables.map(t => t.name as string);

    // Манай хэрэгтэй table-уудын column нэрийг шалгана
    const targets = ['RECIPE', 'SILO', 'PRODUCT_ORDER', 'PRODUCTORDER', 'RECIPE_COMPONENT', 'RECIPECOMPONENT'];
    const columns: Record<string, string[]> = {};

    for (const tbl of targets) {
      if (!tableNames.includes(tbl)) continue;
      const cols = await fbQuery<Record<string, unknown>>(db,
        `SELECT TRIM(rf.RDB$FIELD_NAME) AS col
         FROM RDB$RELATION_FIELDS rf
         WHERE rf.RDB$RELATION_NAME = ?
         ORDER BY rf.RDB$FIELD_POSITION`,
        [tbl]
      );
      columns[tbl] = cols.map(c => c.col as string);
    }

    await fbDetach(db);
    return NextResponse.json({ tables: tableNames, columns });
  } catch (err) {
    await fbDetach(db);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
