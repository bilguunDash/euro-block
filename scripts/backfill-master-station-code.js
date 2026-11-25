/**
 * Мастеруудын `users.stationCode`-ыг хуучин `control_assignments.masterStationCode`-оос
 * нөхөж бичнэ. Шинэ багийн хуваарь мастерыг ӨӨРИЙН stationCode-оор оноодог тул
 * энэ дутуу бол тухайн мастер огт хуваарь авахгүй.
 *
 * docs/shift-crew-architecture.md §8, 2-р алхам
 *
 * Ажиллуулах:
 *   node scripts/backfill-master-station-code.js          # зөвхөн харуулна (dry run)
 *   node scripts/backfill-master-station-code.js --apply  # бодитоор бичнэ
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
    const match =
      text.match(/^DIRECT_URL\s*=\s*"?([^"\r\n]+)"?/m) ||
      text.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
    if (match) return match[1];
  }
  throw new Error('DATABASE_URL / DIRECT_URL олдсонгүй');
}

/** stationCode нь NULL эсвэл хоосон мөр аль аль нь "дутуу" гэж тооцогдоно. */
const CANDIDATE_SQL = `
  SELECT u.id, u.name, u.email, u."stationCode" AS current_station,
         (ARRAY_AGG(DISTINCT ca."masterStationCode")
            FILTER (WHERE ca."masterStationCode" IS NOT NULL))[1] AS derived_station,
         COUNT(DISTINCT ca."masterStationCode") AS distinct_sources
  FROM users u
  LEFT JOIN control_assignments ca
         ON ca."masterUid" = u.id AND ca."isActive" = TRUE
  WHERE u.role = 'master'
    AND u."isApproved" = TRUE
    AND (u."stationCode" IS NULL OR u."stationCode" = '')
  GROUP BY u.id, u.name, u.email, u."stationCode"
  ORDER BY u.name`;

(async () => {
  const url = readEnvUrl();
  console.log('DB:', url.replace(/:\/\/[^@]*@/, '://***:***@'));
  console.log('Горим:', APPLY ? 'БОДИТООР БИЧНЭ (--apply)' : 'зөвхөн харуулна (dry run)');

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query(CANDIDATE_SQL);
    if (rows.length === 0) {
      console.log('\n✔ stationCode дутуу мастер алга — хийх зүйл байхгүй.');
      return;
    }

    console.log(`\nstationCode дутуу ${rows.length} мастер олдлоо:`);
    console.table(rows);

    const fixable = rows.filter((r) => r.derived_station);
    const manual = rows.filter((r) => !r.derived_station);
    const ambiguous = rows.filter((r) => Number(r.distinct_sources) > 1);

    if (ambiguous.length > 0) {
      console.log('\n⚠ Олон эх сурвалжтай (эхнийхийг нь авна) — гараар шалгана уу:');
      console.table(ambiguous);
    }
    if (manual.length > 0) {
      console.log('\n⚠ Уялдаанаас нөхөх боломжгүй — ГАРААР тавина:');
      console.table(manual.map((r) => ({ id: r.id, name: r.name, email: r.email })));
    }

    if (!APPLY) {
      console.log(`\n${fixable.length} мөрийг нөхөх боломжтой. Бодитоор бичих бол --apply нэмнэ үү.`);
      return;
    }
    if (fixable.length === 0) {
      console.log('\nНөхөх боломжтой мөр алга.');
      return;
    }

    await client.query('BEGIN');
    let updated = 0;
    for (const row of fixable) {
      const result = await client.query(
        `UPDATE users SET "stationCode" = $1, "updatedAt" = NOW()
         WHERE id = $2 AND ("stationCode" IS NULL OR "stationCode" = '')`,
        [row.derived_station, row.id]
      );
      updated += result.rowCount;
      console.log(`  ✔ ${row.name || row.email} → ${row.derived_station}`);
    }
    await client.query('COMMIT');
    console.log(`\n✔ ${updated} мөр шинэчлэгдлээ.`);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    await client.end();
  }
})().catch((error) => {
  console.error('АЛДАА:', error.message);
  process.exit(1);
});
