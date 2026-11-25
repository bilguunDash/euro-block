/**
 * Давхардсан хуваарийг олж, сонголтоор цэвэрлэнэ.
 *
 * Давхардал гэж: ижил (огноо + ээлж + дамжлага + хүн) дээр 2+ мөр.
 * Хамгийн ЭРТ үүссэн мөрийг үлдээж, бусдыг устгана.
 *
 *   node scripts/find-duplicate-schedules.js          # зөвхөн харуулна (аюулгүй)
 *   node scripts/find-duplicate-schedules.js --apply  # илүүдлийг устгана
 *
 * Ээлж солилцох хүсэлт (pending) холбогдсон мөрийг ХЭЗЭЭ Ч устгахгүй — алгасаад
 * тайланд гаргана, эс бөгөөс хүсэлт эзэнгүй үлдэнэ.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');

function readEnvUrl() {
  if (process.env.DIRECT_URL) return process.env.DIRECT_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const candidates = [
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env'),
    path.join(__dirname, '..', '.env.local'),
    path.join(__dirname, '..', '.env'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const m =
      text.match(/^DIRECT_URL\s*=\s*"?([^"\r\n]+)"?/m) ||
      text.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
    if (m) return m[1];
  }
  throw new Error('DATABASE_URL / DIRECT_URL олдсонгүй');
}

/** Давхардсан бүлгүүд — үлдээх id (эрт үүссэн) ба устгах id-ууд. */
const DUP_SQL = (table, uidCol) => `
  WITH ranked AS (
    SELECT id, "shiftDate", "shiftType", "stationCode", "${uidCol}" AS uid, "createdAt",
           ROW_NUMBER() OVER (
             PARTITION BY "shiftDate", "shiftType", "stationCode", "${uidCol}"
             ORDER BY "createdAt" ASC, id ASC
           ) AS rn,
           COUNT(*) OVER (
             PARTITION BY "shiftDate", "shiftType", "stationCode", "${uidCol}"
           ) AS total
    FROM ${table}
  )
  SELECT id, "shiftDate", "shiftType", "stationCode", uid, rn, total
  FROM ranked WHERE total > 1
  ORDER BY "shiftDate" DESC, "stationCode", uid, rn`;

(async () => {
  const url = readEnvUrl();
  console.log('DB:', url.replace(/:\/\/[^@]*@/, '://***:***@'));
  console.log('Горим:', APPLY ? 'УСТГАНА (--apply)' : 'зөвхөн харуулна (dry run)');

  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    // Pending swap-д холбогдсон хуваарийг хамгаална.
    const locked = new Set(
      (await c.query(
        `SELECT "requesterScheduleId" AS id FROM shift_swap_requests WHERE status = 'pending'
         UNION
         SELECT "targetScheduleId" FROM shift_swap_requests WHERE status = 'pending'`
      )).rows.map((r) => String(r.id))
    );
    if (locked.size > 0) console.log(`Хамгаалагдсан (pending swap): ${locked.size} мөр`);

    let grandTotal = 0;
    for (const [table, uidCol, label] of [
      ['operator_schedules', 'operatorUid', 'Операторын хуваарь'],
      ['master_schedules', 'masterUid', 'Мастерын хуваарь'],
    ]) {
      const { rows } = await c.query(DUP_SQL(table, uidCol));
      console.log(`\n${'='.repeat(70)}\n${label} (${table})\n${'='.repeat(70)}`);

      if (rows.length === 0) {
        console.log('✔ Давхардал алга.');
        continue;
      }

      const groups = new Map();
      for (const r of rows) {
        const key = `${r.shiftDate}|${r.shiftType}|${r.stationCode}|${r.uid}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      }

      const toDelete = [];
      const skipped = [];
      for (const [key, list] of groups) {
        for (const r of list) {
          if (Number(r.rn) === 1) continue;       // эртний мөрийг үлдээнэ
          if (locked.has(String(r.id))) skipped.push({ key, id: r.id });
          else toDelete.push(r.id);
        }
      }

      console.log(`Давхардсан бүлэг: ${groups.size}   ·   Илүүдэл мөр: ${toDelete.length + skipped.length}`);
      console.table(
        Array.from(groups.entries()).slice(0, 20).map(([key, list]) => {
          const [d, t, s] = key.split('|');
          return { Огноо: d, Ээлж: t, Дамжлага: s, 'Мөрийн тоо': list.length };
        })
      );
      if (groups.size > 20) console.log(`… бас ${groups.size - 20} бүлэг`);

      if (skipped.length > 0) {
        console.log(`\n⚠ Pending swap-тай тул алгасав: ${skipped.length} мөр`);
      }

      if (!APPLY) {
        console.log(`\n${toDelete.length} мөр устгах боломжтой. Бодитоор устгах бол --apply нэмнэ үү.`);
        grandTotal += toDelete.length;
        continue;
      }
      if (toDelete.length === 0) continue;

      await c.query('BEGIN');
      const res = await c.query(`DELETE FROM ${table} WHERE id = ANY($1::uuid[])`, [toDelete]);
      await c.query('COMMIT');
      console.log(`\n✔ ${res.rowCount} мөр устгав (бүлэг бүрийн эртний мөрийг үлдээв).`);
      grandTotal += res.rowCount;
    }

    console.log(`\n${'─'.repeat(70)}`);
    console.log(APPLY ? `НИЙТ УСТГАСАН: ${grandTotal}` : `НИЙТ УСТГАХ БОЛОМЖТОЙ: ${grandTotal}`);
  } catch (e) {
    try { await c.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    await c.end();
  }
})().catch((e) => {
  console.error('АЛДАА:', e.message);
  process.exit(1);
});
