import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { put } from '@vercel/blob';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';

export const runtime = 'nodejs';

function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

function blobNotConfiguredResponse() {
  const vercelEnv = process.env.VERCEL_ENV || '';
  const previewNote =
    vercelEnv === 'preview'
      ? ' Одоогийнх шиг preview домэйн дээр турших бол токеныг заавал Preview орчинд (эсвэл All Environments) нээнэ үү.'
      : '';
  return jsonError(
    503,
    'Файлын агуулах тохируулаагүй: BLOB_READ_WRITE_TOKEN байхгүй байна.',
    {
      code: 'BLOB_NOT_CONFIGURED',
      hint:
        'Vercel Dashboard → Төсөл → Storage → Vercel Blob store үүсгэнэ. Дараа нь Settings → Environment Variables дээр BLOB_READ_WRITE_TOKEN нэмээд Preview болон Production-д идэвхжүүлж, redeploy хийнэ үү.' +
        previewNote,
    },
  );
}

function joinUrl(base: string, p: string) {
  const b = String(base || '').trim();
  if (!b) return p;
  const baseNoSlash = b.endsWith('/') ? b.slice(0, -1) : b;
  const pathWithSlash = p.startsWith('/') ? p : `/${p}`;
  return `${baseNoSlash}${pathWithSlash}`;
}

function isUploadedFile(value: FormDataEntryValue): value is File {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as File).arrayBuffer === 'function' &&
    typeof (value as File).size === 'number'
  );
}

/**
 * Байршуулж болох өргөтгөлүүд (цагаан жагсаалт) ба тэдгээрийн Content-Type.
 * HTML/SVG/XML/JS/CSS зэрэг хөтөч дээр скрипт ажиллуулж чадах төрлийг зориуд оруулаагүй —
 * эс бөгөөс оператор HSE хавсралтаар stored XSS үүсгэж чадна.
 * Content-Type-ийг клиентийн `file.type`-аас биш өргөтгөлөөс авна: клиент .png файлыг
 * text/html гэж зарлаж болно, мөн Notepad .txt-д хоосон type илгээдэг.
 */
const UPLOAD_CONTENT_TYPES: Record<string, string> = {
  '.txt': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.tsv': 'text/tab-separated-values; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
  '.7z': 'application/x-7z-compressed',
  '.rar': 'application/vnd.rar',
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = String((session?.user as any)?.role || '');
    if (!session?.user?.email) {
      return jsonError(401, 'Unauthorized');
    }
    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonError(400, 'Invalid multipart');
    }

    const context = String(form.get('context') || '').trim();
    if (role !== 'admin' && role !== 'hse_engineer') {
      if (context !== 'shift_hse_attachment') return jsonError(401, 'Unauthorized');
    }

    const file = form.get('file');
    if (!file || typeof file === 'string' || !isUploadedFile(file)) return jsonError(400, 'Missing file');

    const isVercel = !!process.env.VERCEL;
    // Vercel serverless has a practical request body limit; keep uploads conservative.
    const maxBytes = isVercel ? 4 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      return jsonError(413, isVercel ? 'File too large (4MB on Vercel)' : 'File too large (20MB)');
    }

    const ext = path.extname(file.name || '').toLowerCase();
    const contentType = UPLOAD_CONTENT_TYPES[ext];
    if (!contentType) {
      return jsonError(400, 'Энэ төрлийн файл байршуулах боломжгүй. Зураг, PDF, Office, текст эсвэл архив файл сонгоно уу.');
    }
    const name = `${crypto.randomUUID()}${ext}`;

    // Storage model:
    // - Production (Vercel): upload to Vercel Blob (filesystem is not writable).
    // - Local dev: optionally write to disk (public/uploads) for convenience.
    const blobToken = (process.env.BLOB_READ_WRITE_TOKEN || '').trim();
    const hasBlobToken = blobToken.length > 0;

    const buf = Buffer.from(await file.arrayBuffer());

    if (isVercel || hasBlobToken) {
      if (!hasBlobToken) return blobNotConfiguredResponse();
      const blob = await put(`hse/${name}`, buf, {
        access: 'public',
        contentType,
        addRandomSuffix: false,
        token: blobToken,
      });
      return NextResponse.json({ ok: true, url: blob.url, filename: name, size: file.size });
    }

    // Local filesystem fallback (dev / self-hosted server)
    // Files are stored in UPLOADS_DIR (or public/uploads) and served via
    // the /api/files/[filename] route so they work in Next.js standalone builds
    // where the public/ directory is NOT served at runtime.
    const uploadsDir = process.env.UPLOADS_DIR
      ? path.resolve(process.env.UPLOADS_DIR)
      : path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(path.join(uploadsDir, name), buf);

    // Use /api/files/<name> instead of /uploads/<name> so the file is accessible
    // through the API route (which works in standalone builds on self-hosted servers).
    const rel = `/api/files/${name}`;
    const url = joinUrl(process.env.PUBLIC_UPLOAD_BASE_URL || '', rel);
    return NextResponse.json({ ok: true, url, filename: name, size: file.size });
  } catch (e: any) {
    console.error('POST /api/upload', e);
    return jsonError(500, e?.message || 'Upload failed');
  }
}
