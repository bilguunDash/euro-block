import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { uploadedFileDisposition } from '@/lib/uploaded-file-disposition';

export const runtime = 'nodejs';

const BLOB_SUFFIX = '.public.blob.vercel-storage.com';
const MAX_BYTES = 5 * 1024 * 1024;

function isAllowedBlobUrl(href: string): boolean {
  try {
    const u = new URL(href);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    if (!h.endsWith(BLOB_SUFFIX)) return false;
    const prefix = h.slice(0, -BLOB_SUFFIX.length);
    if (!prefix || !/^[a-z0-9-]+$/i.test(prefix)) return false;
    if (!u.pathname.startsWith('/hse/')) return false;
    return true;
  } catch {
    return false;
  }
}

function extOf(pathname: string): string {
  const i = pathname.lastIndexOf('.');
  return i >= 0 ? pathname.slice(i).toLowerCase() : '';
}

/** Blob sometimes serves text without charset; browsers then mis-decode UTF-8 as Latin-1. */
function normalizeContentType(pathname: string, upstream: string | null): string {
  const raw = (upstream || '').trim();
  const full = raw || 'application/octet-stream';
  if (/;\s*charset=/i.test(full)) return full;

  const base = full.split(';')[0].trim().toLowerCase();
  const ext = extOf(pathname);

  if (base === 'text/plain' && !/;\s*charset=/i.test(full)) {
    return 'text/plain; charset=utf-8';
  }

  if (base === 'application/octet-stream' || base === 'text/plain') {
    if (['.txt', '.log'].includes(ext)) return 'text/plain; charset=utf-8';
    if (ext === '.md') return 'text/markdown; charset=utf-8';
    if (ext === '.csv') return 'text/csv; charset=utf-8';
    if (ext === '.tsv') return 'text/tab-separated-values; charset=utf-8';
    if (ext === '.json') return 'application/json; charset=utf-8';
    if (ext === '.xml') return 'application/xml; charset=utf-8';
    if (ext === '.html' || ext === '.htm') return 'text/html; charset=utf-8';
    if (ext === '.css') return 'text/css; charset=utf-8';
    if (['.js', '.mjs', '.cjs'].includes(ext)) return 'text/javascript; charset=utf-8';
    if (ext === '.pdf') return 'application/pdf';
    const img: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    const mime = img[ext];
    if (mime) return mime;
  }

  return full;
}

/** Resolve uploads directory — mirrors the logic in /api/upload/route.ts */
function resolveUploadsDir(): string {
  return process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(process.cwd(), 'public', 'uploads');
}

/** Serve a locally stored file directly from disk. */
async function serveLocalFile(filename: string): Promise<NextResponse> {
  const safe = path.basename(filename);
  if (!safe || safe !== filename || safe.includes('..')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const filePath = path.join(resolveUploadsDir(), safe);
  try {
    await stat(filePath);
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const buf = await readFile(filePath);
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'Too large' }, { status: 413 });
  }

  const ext = path.extname(safe);
  const contentType = normalizeContentType(safe, null);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': uploadedFileDisposition(contentType, safe),
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  // --- Local / self-hosted: /api/files/<filename> URL ---
  // When the URL is a relative path or points to this same server,
  // serve the file directly from disk (avoids loopback HTTP issues).
  const localMatch = raw.match(/^\/api\/files\/([^/?#]+)$/);
  if (localMatch) {
    return serveLocalFile(localMatch[1]);
  }

  // Also handle absolute URLs to the same server pointing at /api/files/
  try {
    const parsed = new URL(raw);
    const absLocalMatch = parsed.pathname.match(/^\/api\/files\/([^/?#]+)$/);
    if (absLocalMatch) {
      return serveLocalFile(absLocalMatch[1]);
    }
  } catch {
    // not a valid absolute URL — fall through to blob check
  }

  // --- Vercel Blob URL ---
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  if (!isAllowedBlobUrl(target.href)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const upstream = await fetch(target.href, { redirect: 'follow' });
  if (!upstream.ok) {
    return NextResponse.json({ error: 'Upstream failed' }, { status: 502 });
  }

  const buf = await upstream.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'Too large' }, { status: 413 });
  }

  const contentType = normalizeContentType(target.pathname, upstream.headers.get('content-type'));

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': uploadedFileDisposition(contentType, path.basename(target.pathname)),
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
