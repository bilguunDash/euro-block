/**
 * Хэрэглэгчийн байршуулсан файлыг апп-ын origin дээр INLINE нээхэд зөвхөн скрипт
 * ажиллуулж чадахгүй төрлүүд аюулгүй. HTML/SVG/XML зэрэг бусад бүх төрлийг татаж авах
 * (attachment) болгоно — эс бөгөөс оператор HSE хавсралтаар admin/hse_engineer-ийн
 * session дотор JS ажиллуулах (stored XSS) боломжтой болно.
 */
const INLINE_SAFE_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'text/plain',
  'text/csv',
  'text/tab-separated-values',
]);

export function uploadedFileDisposition(contentType: string, filename: string): string {
  const base = contentType.split(';')[0].trim().toLowerCase();
  if (INLINE_SAFE_TYPES.has(base)) return 'inline';
  const safeName = filename.replace(/[^A-Za-z0-9._-]/g, '');
  return safeName ? `attachment; filename="${safeName}"` : 'attachment';
}
