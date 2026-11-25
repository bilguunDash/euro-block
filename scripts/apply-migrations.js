/**
 * Дутуу үлдсэн Prisma migration-уудыг олж ажиллуулна.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ: Next.js-ийн standalone багц Prisma CLI-г агуулдаггүй тул
 * `deploy-server.ps1`-ийн автомат `prisma migrate deploy` алхам сервер дээр
 * ХЭЗЭЭ Ч ажиллаж чаддаггүй (CLI олдохгүй → WARN бичээд алгасдаг). Үүнээс болж
 * migration чимээгүй үлдэж, шинэ багана уншдаг код унах эрсдэлтэй.
 *
 * Энэ скрипт зөвхөн `pg` ашиглана (standalone-д багцлагдсан байдаг).
 *
 * Ашиглах (сервер дээр, C:\Apps\EuroblockShift дотор):
 *   $line = Get-Content .env.local | Where-Object { $_ -match '^DATABASE_URL=' }
 *   $env:DATABASE_URL = ($line -split '=', 2)[1].Trim('"')
 *   node scripts/apply-migrations.js
 *
 * Аюулгүй байдал: migration бүрийг НЭГ transaction дотор ажиллуулна — алдаа гарвал
 * бүрэн буцаана (rollback). Аль хэдийн орсон migration-г давхар ажиллуулахгүй.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const MIGRATIONS_DIR = path.join(process.cwd(), 'prisma', 'migrations');

function fail(msg) {
  console.error('АЛДАА: ' + msg);
  process.exit(1);
}

(async () => {
  const conn = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!conn) fail('DATABASE_URL тохируулаагүй байна.');
  if (!fs.existsSync(MIGRATIONS_DIR)) fail('prisma/migrations фолдер олдсонгүй: ' + MIGRATIONS_DIR);

  const all = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => fs.existsSync(path.join(MIGRATIONS_DIR, n, 'migration.sql')))
    .sort();

  const db = new Client({ connectionString: conn });
  await db.connect();

  try {
    // Прод дээр _prisma_migrations үргэлж байдаг; байхгүй бол баазыг хараахан
    // үүсгээгүй гэсэн үг тул зогсоож, гараар шийдүүлнэ.
    const t = await db.query(
      "SELECT to_regclass('public._prisma_migrations') AS t"
    );
    if (!t.rows[0]?.t) fail('_prisma_migrations хүснэгт олдсонгүй. Бааз бэлэн эсэхийг шалгана уу.');

    const applied = new Set(
      (await db.query('SELECT migration_name FROM _prisma_migrations')).rows.map((r) => r.migration_name)
    );

    const pending = all.filter((n) => !applied.has(n));
    console.log(`Нийт migration: ${all.length} | Орсон: ${applied.size} | Дутуу: ${pending.length}`);

    if (pending.length === 0) {
      console.log('✔ Бүх migration аль хэдийн орсон байна. Хийх зүйл алга.');
      return;
    }

    for (const name of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      process.stdout.write(`→ ${name} ... `);
      await db.query('BEGIN');
      try {
        await db.query(sql);
        await db.query(
          `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
           VALUES ($1, $2, now(), $3, now(), 1)`,
          [crypto.randomUUID(), checksum, name]
        );
        await db.query('COMMIT');
        console.log('OK');
      } catch (e) {
        await db.query('ROLLBACK');
        console.log('УНАСАН');
        fail(`${name} → ${e.message}\nӨөрчлөлт бүрэн буцаагдлаа (rollback). Service-ээ АСААХГҮЙ байж шалгана уу.`);
      }
    }

    console.log(`✔ ${pending.length} migration амжилттай орлоо.`);
  } finally {
    await db.end();
  }
})().catch((e) => fail(e.message));
