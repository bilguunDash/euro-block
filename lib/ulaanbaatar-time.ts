/**
 * Улаанбаатарын цаг ↔ UTC хөрвүүлэлт.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ: `<input type="datetime-local">` нь ханын цагийг бүсгүйгээр
 * өгдөг/хүлээдэг. Үүнийг `new Date(...)`-аар шууд задлавал СЕРВЕРИЙН бүсээр
 * тайлагдана, `toISOString()`-оор буцаавал UTC харагдана — хоёр тал нь 8 цагаар
 * зөрж, зарлалын дуусах хугацаа нь үүсгэсэн цагаасаа ӨМНӨ болж байв.
 *
 * Улаанбаатар нь UTC+8, зуны цаггүй тул тогтмол шилжилт хангалттай.
 */

export const ULAANBAATAR_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * `<input type="datetime-local">`-ийн утга (Улаанбаатарын ханын цаг) → UTC `Date`.
 *
 * Бүсийн тэмдэгтэй ISO мөрийг (`...Z`, `+08:00`) шууд задална — хуучин клиент
 * эсвэл API-г шууд дуудсан тохиолдолд ч зөв ажиллана.
 * Таних боломжгүй эсвэл хоосон утгад `null` буцаана.
 */
export function parseUlaanbaatarLocal(raw: unknown): Date | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  // Бүс заасан бол тэр нь эргэлзээгүй — шууд задална.
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(text)) {
    const exact = new Date(text);
    return Number.isFinite(exact.getTime()) ? exact : null;
  }

  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1, 6).map(Number);
  const second = m[6] === undefined ? 0 : Number(m[6]);
  const wall = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  // Date.UTC нь хязгаараас хэтэрсэн утгыг чимээгүй өнхрүүлдэг (сар 13 → дараа он).
  const rolled =
    wall.getUTCFullYear() !== year ||
    wall.getUTCMonth() !== month - 1 ||
    wall.getUTCDate() !== day ||
    wall.getUTCHours() !== hour ||
    wall.getUTCMinutes() !== minute;
  if (rolled) return null;
  return new Date(wall.getTime() - ULAANBAATAR_OFFSET_MS);
}

/** UTC `Date` → `<input type="datetime-local">` уншиж чадах Улаанбаатарын ханын цаг. */
export function toUlaanbaatarLocalInput(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() + ULAANBAATAR_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}
