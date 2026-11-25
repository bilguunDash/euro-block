/**
 * Ээлжийн багийн архитектурт шилжихийн өмнөх READ-ONLY шалгалт.
 * docs/shift-crew-architecture.md §6 (станцын харьяалал) ба §8 (миграц)-д хэрэгтэй.
 *
 * Ажиллуулах (prod сервер дээр, C:\euroblock\ доторх):
 *   node scripts/inspect-control-assignments.js
 *
 * Зөвхөн SELECT хийнэ — юу ч өөрчлөхгүй.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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
  throw new Error('DATABASE_URL / DIRECT_URL олдсонгүй (.env.local шалгана уу)');
}

const QUERIES = [
  {
    title: '1. Станц → мастер станц харьяалал  (SUPERVISOR_STATION_BY_STATION-д хэрэгтэй)',
    sql: `SELECT "stationCode", "masterStationCode",
                 COUNT(*)::int AS rows,
                 COUNT(DISTINCT "masterUid")::int AS masters,
                 COUNT(DISTINCT "operatorUid")::int AS operators
          FROM control_assignments WHERE "isActive" = TRUE
          GROUP BY 1,2 ORDER BY 1,2`,
  },
  {
    title: '2. ⚠ Нэг станц ОЛОН мастер станцад харьяалагдаж байна уу?  (хоосон байх ЁСТОЙ)',
    sql: `SELECT "stationCode",
                 COUNT(DISTINCT "masterStationCode")::int AS distinct_master_stations,
                 string_agg(DISTINCT "masterStationCode", ', ') AS master_stations
          FROM control_assignments WHERE "isActive" = TRUE
          GROUP BY 1 HAVING COUNT(DISTINCT "masterStationCode") > 1 ORDER BY 1`,
    note: 'Мөр гарвал код доторх тогтмол ажиллахгүй → control_stations.supervisorStationCode багана руу шилжинэ.',
  },
  {
    title: '3. ⚠ Мастерууд: stationCode дутуу байна уу?  (миграцид backfill хийнэ)',
    sql: `SELECT u.id, u.name, u.email, u."stationCode",
                 string_agg(DISTINCT ca."masterStationCode", ', ') AS from_assignments
          FROM users u
          LEFT JOIN control_assignments ca ON ca."masterUid" = u.id AND ca."isActive" = TRUE
          WHERE u.role = 'master' AND u."isApproved" = TRUE
          GROUP BY u.id, u.name, u.email, u."stationCode"
          ORDER BY (u."stationCode" IS NULL) DESC, u.name`,
    note: 'stationCode хоосон бол from_assignments-аас backfill хийнэ. Хоёулаа хоосон бол ГАРААР тавина.',
  },
  {
    title: '4. ⚠ Операторууд: stationCode дутуу байна уу?  (эдгээр нь багийн оноолтод алгасагдана)',
    sql: `SELECT id, name, email, "stationCode"
          FROM users
          WHERE role = 'operator' AND "isApproved" = TRUE
            AND ("stationCode" IS NULL OR "stationCode" = '')
          ORDER BY name`,
  },
  {
    title: '5. Нэг оператор олон мастертай юу?  (хоосон байх ЁСТОЙ)',
    sql: `SELECT "operatorUid", COUNT(DISTINCT "masterUid")::int AS masters,
                 string_agg(DISTINCT "masterName", ', ') AS master_names
          FROM control_assignments
          WHERE "isActive" = TRUE AND "operatorUid" IS NOT NULL AND "operatorUid" <> ''
          GROUP BY 1 HAVING COUNT(DISTINCT "masterUid") > 1 ORDER BY 2 DESC`,
  },
  {
    title: '6. Ерөнхий тоо',
    sql: `SELECT
            (SELECT COUNT(*)::int FROM control_assignments WHERE "isActive")                     AS active_assignments,
            (SELECT COUNT(*)::int FROM control_assignments WHERE NOT "isActive")                 AS inactive_assignments,
            (SELECT COUNT(*)::int FROM users WHERE role='operator' AND "isApproved")             AS approved_operators,
            (SELECT COUNT(*)::int FROM users WHERE role='master'   AND "isApproved")             AS approved_masters,
            (SELECT COUNT(*)::int FROM control_stations WHERE "isActive")                        AS active_stations,
            (SELECT COUNT(*)::int FROM master_schedules)                                         AS master_schedule_rows,
            (SELECT COUNT(*)::int FROM operator_schedules)                                       AS operator_schedule_rows`,
  },
  {
    title: '7. Одоогийн мастерын харах эрхийн хүрээ  (шилжилтийн ӨМНӨХ суурь — дараа нь харьцуулна)',
    sql: `SELECT ca."masterName", ca."masterUid",
                 COUNT(DISTINCT ca."stationCode")::int AS visible_stations,
                 string_agg(DISTINCT ca."stationCode", ', ' ORDER BY ca."stationCode") AS stations
          FROM control_assignments ca
          WHERE ca."isActive" = TRUE
          GROUP BY 1,2 ORDER BY 3 DESC, 1`,
    note: 'Энэ хүснэгтийг ХАДГАЛ. Шинэ логик нэвтрүүлсний дараа мастер бүрийн хүрээ ижил хэвээр эсэхийг шалгана.',
  },
];

(async () => {
  const url = readEnvUrl();
  const safeHost = url.replace(/:\/\/[^@]*@/, '://***:***@');
  console.log('DB:', safeHost);
  console.log('Огноо:', new Date().toISOString());

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const q of QUERIES) {
      console.log('\n' + '='.repeat(78));
      console.log(q.title);
      if (q.note) console.log('   → ' + q.note);
      console.log('='.repeat(78));
      const result = await client.query(q.sql);
      if (result.rows.length === 0) console.log('(мөр байхгүй)');
      else console.table(result.rows);
    }
  } finally {
    await client.end();
  }
})().catch((error) => {
  console.error('АЛДАА:', error.message);
  process.exit(1);
});
