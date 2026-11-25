import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { put } from '@vercel/blob';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { writeServerAuditLog } from '@/lib/server-audit';
import { canAppendShiftLog, canReadShift, type SessionActor } from '@/lib/shift-api-permissions';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OCTET_STREAM = 'application/octet-stream';

function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

function sessionActor(session: any): SessionActor | null {
  if (!session?.user?.id) return null;
  return {
    id: String(session.user.id),
    role: String((session.user as any).role || 'operator'),
    stationCode: (session.user as any).stationCode ?? null,
    name: session.user.name ?? null,
  };
}

function joinUrl(base: string, p: string) {
  const trimmed = String(base || '').trim();
  if (!trimmed) return p;
  const baseNoSlash = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  const pathWithSlash = p.startsWith('/') ? p : `/${p}`;
  return `${baseNoSlash}${pathWithSlash}`;
}

function contentTypeForUpload(fileName: string, fileType: string): string {
  const t = (fileType || '').trim();
  const lower = t.toLowerCase();
  if (t && lower !== OCTET_STREAM) return t;

  const ext = path.extname(fileName || '').toLowerCase();
  const byExt: Record<string, string> = {
    '.txt': 'text/plain; charset=utf-8',
    '.log': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.zip': 'application/zip',
  };
  return byExt[ext] || OCTET_STREAM;
}

function safeExtension(file: File) {
  const ext = path.extname(file.name || '').toLowerCase().slice(0, 12);
  return ext && /^[a-z0-9.]+$/i.test(ext) ? ext : '';
}

function isUploadedFile(value: FormDataEntryValue): value is File {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as File).arrayBuffer === 'function' &&
    typeof (value as File).size === 'number'
  );
}

function describeFormEntry(value: FormDataEntryValue) {
  if (typeof value === 'string') return { kind: 'string', length: value.length };
  const file = value as File;
  return {
    kind: 'file',
    name: file.name || '',
    type: file.type || '',
    size: typeof file.size === 'number' ? file.size : null,
    hasArrayBuffer: typeof file.arrayBuffer === 'function',
  };
}

async function findReadableShift(id: string, actor: SessionActor) {
  const shift = await prisma.shift.findUnique({
    where: { id },
    select: {
      id: true,
      operatorUid: true,
      stationCode: true,
      handoverToOperatorUid: true,
    },
  });
  if (!shift) return { shift: null, response: jsonError(404, 'Not found') };
  const allowed = canReadShift(
    {
      operatorUid: shift.operatorUid,
      stationCode: shift.stationCode,
      handoverToOperatorUid: shift.handoverToOperatorUid ?? null,
    },
    actor
  );
  if (!allowed) return { shift: null, response: jsonError(403, 'Forbidden') };
  return { shift, response: null };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const actor = sessionActor(session as any);
  if (!actor) return jsonError(401, 'Unauthorized');
  const deviceAccess = await getDeviceAccessForRequest(session, req);
  if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

  const rawParams = await params;
  const id = String(rawParams?.id || '').trim();
  if (!UUID_RE.test(id)) return jsonError(400, 'Invalid id');

  try {
    const { shift, response } = await findReadableShift(id, actor);
    if (response) return response;
    if (!shift) return jsonError(404, 'Not found');
    if (!canAppendShiftLog(actor, shift.operatorUid)) return jsonError(403, 'Forbidden');

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonError(400, 'Invalid multipart');
    }

    const entries = Array.from(form.entries());
    const files = entries
      .map(([, value]) => value)
      .filter(isUploadedFile)
      .filter((file) => file.size > 0 || Boolean(file.name));
    if (!files.length) {
      return jsonError(400, 'Missing files', {
        code: 'MISSING_FILES',
        fields: entries.map(([key, value]) => ({ key, ...describeFormEntry(value) })),
      });
    }
    if (files.length > 10) return jsonError(400, 'Too many files');

    const isVercel = !!process.env.VERCEL;
    const maxBytes = isVercel ? 4 * 1024 * 1024 : 20 * 1024 * 1024;
    for (const file of files) {
      if (file.size > maxBytes) {
        return jsonError(413, isVercel ? `${file.name}: file is larger than 4MB` : `${file.name}: file is larger than 20MB`);
      }
    }

    const blobToken = (process.env.BLOB_READ_WRITE_TOKEN || '').trim();
    const useBlob = !!process.env.VERCEL || blobToken.length > 0;
    if (useBlob && !blobToken) return jsonError(503, 'BLOB_READ_WRITE_TOKEN is not configured');

    const uploaded = [];
    for (const file of files) {
      const fileId = crypto.randomUUID();
      const ext = safeExtension(file);
      const storedName = `${fileId}${ext}`;
      const storagePath = `shift-files/${id}/${Date.now()}-${storedName}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = contentTypeForUpload(file.name || '', file.type || '');
      let publicUrl: string;

      if (useBlob) {
        const blob = await put(storagePath, buffer, {
          access: 'public',
          addRandomSuffix: false,
          contentType: mimeType,
          token: blobToken,
        });
        publicUrl = blob.url;
      } else {
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'shift-files', id);
        await mkdir(uploadsDir, { recursive: true });
        await writeFile(path.join(uploadsDir, storedName), buffer);
        // Use /api/files/<name> so the file is served via the API route,
        // which works in Next.js standalone builds on self-hosted servers.
        publicUrl = joinUrl(process.env.PUBLIC_UPLOAD_BASE_URL || '', `/api/files/${storedName}`);
      }

      uploaded.push({
        id: fileId,
        name: file.name || storedName,
        url: publicUrl,
        storagePath,
        mimeType,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
        uploadedByName: actor.name ?? null,
      });
    }

    await writeServerAuditLog({
      actorUid: actor.id,
      actorName: actor.name ?? null,
      action: 'shift_file_uploaded',
      entityType: 'shift',
      entityId: id,
      details: JSON.stringify({ count: uploaded.length }),
    });

    return NextResponse.json({ ok: true, files: uploaded });
  } catch (e) {
    console.error('POST /api/shifts/[id]/files', e);
    return jsonError(500, 'File upload failed');
  }
}
