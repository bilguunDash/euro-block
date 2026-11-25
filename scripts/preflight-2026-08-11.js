/**
 * 2026-08-11-ний гаргалтын өмнөх READ-ONLY шалгалт.
 *
 * Ажиллуулах (prod сервер дээр, C:\euroblock\ доторх — эсвэл DATABASE_URL зааж):
 *   node scripts/preflight-2026-08-11.js
 *
 * Зөвхөн SELECT хийнэ — юу ч өөрчлөхгүй. Гаргалтын дараа `--fix` тугтай
 * ажиллуулбал зөвхөн ГАЦСАН буцаагдсан ээлжийг сэргээнэ (доорх C хэсэг).
 *
 * Юуг шалгах вэ:
 *   A. ҮЯ-161 — энэ гаргалт ШИНЭ хориг нэмж байгаа (маягт нь одооноос заавал).
 *      Явж байгаа ээлж байвал маягтаа бөглөтөл дуусгаж чадахгүй болно.
 *   B. Ээлжийн баг (users.shiftGroup) — хоосон бол хариуцах мастер автоматаар
 *      олдохгүй тул оператор хүлээлцэх болгонд мастерыг гараар сонгоно.
 *   C. Гацсан буцаалт — 2026-08-11-ний өмнө буцаагдсан ээлж `operatorShiftCompleted`
 *      = true хэвээр үлддэг тул оператор маягтаа засаж чадахгүй. Засвар нь зөвхөн
 *      ШИНЭ буцаалтад үйлчилдэг учир хуучин мөрүүдийг гараар сэргээнэ.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const APPLY_FIX = process.argv.includes('--fix');

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

/** Гаргалтын дараа маягт нь ЗААВАЛ болох ҮЯ-161-ийн дуусаагүй ээлжүүд. */
const SQL_Y161_BLOCKED = `
  SELECT s.id, s."shiftDate", s."shiftType", s."operatorName", s."handoverStage"
  FROM shifts s
  WHERE s."stationCode" = 'ҮЯ-161'
    AND s."adminApproved" = FALSE
    AND NOT EXISTS (
      SELECT 1 FROM production_logs pl
      WHERE pl."shiftId" = s.id AND pl."logType" = 'modal_y161_handover_form'
    )
  ORDER BY s."shiftDate" DESC
  LIMIT 50`;

const SQL_CREW = `
  SELECT role,
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE "shiftGroup" IS NULL OR btrim("shiftGroup") = '')::int AS no_group
  FROM users
  WHERE "isApproved" = TRUE AND role IN ('operator','master')
  GROUP BY role ORDER BY role`;

/** Багт орсон ч тухайн багт мастергүй операторууд — хариуцагч олдохгүй. */
const SQL_CREW_NO_MASTER = `
  SELECT o."shiftGroup", COUNT(*)::int AS operators
  FROM users o
  WHERE o.role = 'operator' AND o."isApproved" = TRUE
    AND o."shiftGroup" IS NOT NULL AND btrim(o."shiftGroup") <> ''
    AND NOT EXISTS (
      SELECT 1 FROM users m
      WHERE m.role = 'master' AND m."isApproved" = TRUE AND m."shiftGroup" = o."shiftGroup"
    )
  GROUP BY 1 ORDER BY 1`;

const SQL_STUCK_RETURNS = `
  SELECT id, "shiftDate", "shiftType", "stationCode", "operatorName", "handoverReturnedAt"
  FROM shifts
  WHERE "handoverStage" = 'returned'
    AND "operatorShiftCompleted" = TRUE
    AND "adminApproved" = FALSE
  ORDER BY "handoverReturnedAt" DESC NULLS LAST
  LIMIT 50`;

const SQL_FIX_STUCK = `
  UPDATE shifts SET "operatorShiftCompleted" = FALSE
  WHERE "handoverStage" = 'returned'
    AND "operatorShiftCompleted" = TRUE
    AND "adminApproved" = FALSE`;

function table(rows) {
  if (!rows.length) return '  (мөр алга)';
  return rows.map((r) => '  ' + JSON.stringify(r)).join('\n');
}

async function main() {
  const client = new Client({ connectionString: readEnvUrl() });
  await client.connect();
  let warnings = 0;

  try {
    console.log('='.repeat(72));
    console.log('A. ҮЯ-161 — маягт нь ЭНЭ ГАРГАЛТААС хойш заавал болно');
    console.log('='.repeat(72));
    const y161 = (await client.query(SQL_Y161_BLOCKED)).rows;
    if (y161.length) {
      warnings++;
      console.log(`  ⚠️  ${y161.length} ээлж маягтгүй байна — гаргалтын дараа ДУУСГАЖ ЧАДАХГҮЙ:`);
      console.log(table(y161));
      console.log('  → Ээлж солигдох цагт гаргах, эсвэл эдгээр операторт маягтаа');
      console.log('    урьдчилан бөглүүлэх. (Эсвэл гаргалтыг хойшлуулах.)');
    } else {
      console.log('  ✅ Нөлөөлөх дуусаагүй ҮЯ-161 ээлж алга — аюулгүй.');
    }

    console.log('');
    console.log('='.repeat(72));
    console.log('B. Ээлжийн баг (users.shiftGroup)');
    console.log('='.repeat(72));
    const crew = (await client.query(SQL_CREW)).rows;
    console.log(table(crew));
    const missing = crew.filter((r) => Number(r.no_group) > 0);
    if (missing.length) {
      warnings++;
      console.log('  ⚠️  Багт хуваарилагдаагүй хэрэглэгч байна. Тэдэнд:');
      console.log('     · хариуцах мастер автоматаар олдохгүй;');
      console.log('     · дамжлагын маягт нь АЖИЛЛАНА (гараар сонгох fallback нэмэгдсэн);');
      console.log('     · гэхдээ хүлээлцэх болгонд «Баталгаажуулах мастер»-ыг гараар сонгоно.');
      console.log('  → Хэрэглэгч удирдлагаас баг (1/2/3) оноох.');
    } else {
      console.log('  ✅ Бүгд багтай.');
    }
    const noMaster = (await client.query(SQL_CREW_NO_MASTER)).rows;
    if (noMaster.length) {
      warnings++;
      console.log('  ⚠️  Мастергүй баг:');
      console.log(table(noMaster));
    }

    console.log('');
    console.log('='.repeat(72));
    console.log('C. Гацсан буцаалт (2026-08-11-ний засвараас өмнөх)');
    console.log('='.repeat(72));
    const stuck = (await client.query(SQL_STUCK_RETURNS)).rows;
    if (stuck.length) {
      console.log(`  ⚠️  ${stuck.length} буцаагдсан ээлж — оператор нь маягтаа засаж чадахгүй:`);
      console.log(table(stuck));
      if (APPLY_FIX) {
        const res = await client.query(SQL_FIX_STUCK);
        console.log(`  ✅ Засав: ${res.rowCount} ээлжийг «дуусаагүй» болгож сэргээв.`);
      } else {
        warnings++;
        console.log('  → Сэргээхийн тулд: node scripts/preflight-2026-08-11.js --fix');
        console.log('    (ЗӨВХӨН `operatorShiftCompleted` = FALSE болгоно, өөр юу ч хөндөхгүй)');
      }
    } else {
      console.log('  ✅ Гацсан буцаалт алга.');
    }

    console.log('');
    console.log('='.repeat(72));
    console.log(warnings ? `ДҮГНЭЛТ: ${warnings} анхаарах зүйл — дээрхийг шийдээд гаргана уу.` : 'ДҮГНЭЛТ: ✅ Саадгүй.');
    console.log('='.repeat(72));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('Алдаа:', e.message);
  process.exit(1);
});
