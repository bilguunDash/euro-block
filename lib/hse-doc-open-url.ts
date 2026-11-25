const BLOB_HOST = /\.public\.blob\.vercel-storage\.com$/i;

/** Same-origin proxy so browsers get explicit charset=utf-8 for .txt (fixes mojibake on Vercel Blob). */
export function hseDocOpenUrl(storedUrl: string): string {
  const u = String(storedUrl || '').trim();
  if (!u) return u;
  try {
    const parsed = new URL(u);
    if (parsed.protocol === 'https:' && BLOB_HOST.test(parsed.hostname) && parsed.pathname.startsWith('/hse/')) {
      return `/api/hse-doc-open?url=${encodeURIComponent(u)}`;
    }
  } catch {
    /* ignore */
  }
  return u;
}
