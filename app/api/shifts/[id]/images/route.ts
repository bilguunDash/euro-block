import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { del, put } from '@vercel/blob';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { writeServerAuditLog } from '@/lib/server-audit';
import { canAppendShiftLog, canReadShift, type SessionActor } from '@/lib/shift-api-permissions';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const IMAGE_REVIEW_STATUSES = new Set(['pending_review', 'approved', 'rejected']);

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
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

function serializeImage(image: any) {
  return {
    id: image.id,
    shiftId: image.shiftId,
    section: image.section,
    rowKey: image.rowKey,
    rowLabel: image.rowLabel,
    caption: image.caption,
    storagePath: image.storagePath,
    publicUrl: image.publicUrl,
    url: image.publicUrl,
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
    uploadedByUid: image.uploadedByUid,
    uploadedByName: image.uploadedByName,
    reviewStatus: image.reviewStatus ?? 'pending_review',
    reviewComment: image.reviewComment,
    reviewedByUid: image.reviewedByUid,
    reviewedByName: image.reviewedByName,
    reviewedAt: image.reviewedAt instanceof Date ? image.reviewedAt.toISOString() : image.reviewedAt,
    createdAt: image.createdAt instanceof Date ? image.createdAt.toISOString() : image.createdAt,
  };
}

function canReviewShiftImage(actor: SessionActor) {
  return actor.role === 'admin' || actor.role === 'master';
}

function joinUrl(base: string, p: string) {
  const trimmed = String(base || '').trim();
  if (!trimmed) return p;
  const baseNoSlash = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  const pathWithSlash = p.startsWith('/') ? p : `/${p}`;
  return `${baseNoSlash}${pathWithSlash}`;
}

function safeExtension(file: File) {
  const ext = path.extname(file.name || '').toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') return ext === '.jpeg' ? '.jpg' : ext;
  if (file.type === 'image/png') return '.png';
  return '.jpg';
}

function isAllowedImage(file: File) {
  const lowerName = (file.name || '').toLowerCase();
  const hasAllowedExt = lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.png');
  return ALLOWED_IMAGE_TYPES.has(file.type) || (!file.type && hasAllowedExt);
}

function imageContentType(file: File) {
  if (ALLOWED_IMAGE_TYPES.has(file.type)) return file.type;
  return safeExtension(file) === '.png' ? 'image/png' : 'image/jpeg';
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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const actor = sessionActor(session as any);
  if (!actor) return jsonError(401, 'Unauthorized');
  const deviceAccess = await getDeviceAccessForRequest(session, req);
  if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

  const { id } = await params;
  if (!UUID_RE.test(id)) return jsonError(400, 'Invalid id');

  try {
    const { response } = await findReadableShift(id, actor);
    if (response) return response;

    const images = await prisma.shiftImage.findMany({
      where: { shiftId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ ok: true, images: images.map(serializeImage) });
  } catch (e) {
    console.error('GET /api/shifts/[id]/images', e);
    return jsonError(500, 'Database error');
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const actor = sessionActor(session as any);
  if (!actor) return jsonError(401, 'Unauthorized');
  const deviceAccess = await getDeviceAccessForRequest(session, req);
  if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

  const { id } = await params;
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

    const files = form.getAll('files').filter((file): file is File => file instanceof File);
    if (!files.length) return jsonError(400, 'Missing files');
    if (files.length > 20) return jsonError(400, 'Too many files');

    const section = String(form.get('section') || 'inspection').slice(0, 80);
    const rowKey = String(form.get('rowKey') || '').slice(0, 120) || null;
    const rowLabel = String(form.get('rowLabel') || '').slice(0, 500) || null;
    const captions = form.getAll('captions').map((value) => String(value || '').slice(0, 1000));

    for (const file of files) {
      if (!isAllowedImage(file)) return jsonError(400, `${file.name}: only JPG/PNG is allowed`);
      if (file.size > MAX_IMAGE_BYTES) return jsonError(413, `${file.name}: file is larger than 5MB`);
    }

    const blobToken = (process.env.BLOB_READ_WRITE_TOKEN || '').trim();
    const useBlob = !!process.env.VERCEL || blobToken.length > 0;
    if (useBlob && !blobToken) return jsonError(503, 'BLOB_READ_WRITE_TOKEN is not configured');

    const created = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const ext = safeExtension(file);
      const filename = `${crypto.randomUUID()}${ext}`;
      const storagePath = `shift-images/${id}/${Date.now()}-${filename}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      let publicUrl: string;

      if (useBlob) {
        const blob = await put(storagePath, buffer, {
          access: 'public',
          addRandomSuffix: false,
          contentType: imageContentType(file),
          token: blobToken,
        });
        publicUrl = blob.url;
      } else {
        const uploadsDir = process.env.UPLOADS_DIR
          ? path.resolve(process.env.UPLOADS_DIR)
          : path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadsDir, { recursive: true });
        await writeFile(path.join(uploadsDir, filename), buffer);
        publicUrl = joinUrl(process.env.PUBLIC_UPLOAD_BASE_URL || '', `/api/files/${filename}`);
      }

      const image = await prisma.shiftImage.create({
        data: {
          shiftId: id,
          section,
          rowKey,
          rowLabel,
          caption: captions[index] || null,
          storagePath,
          publicUrl,
          mimeType: imageContentType(file),
          sizeBytes: file.size,
          uploadedByUid: actor.id,
          uploadedByName: actor.name ?? null,
        },
      });
      created.push(image);
    }

    await writeServerAuditLog({
      actorUid: actor.id,
      actorName: actor.name ?? null,
      action: 'shift_image_uploaded',
      entityType: 'shift',
      entityId: id,
      details: JSON.stringify({ count: created.length, rowKey, rowLabel }),
    });

    return NextResponse.json({ ok: true, images: created.map(serializeImage) });
  } catch (e) {
    console.error('POST /api/shifts/[id]/images', e);
    return jsonError(500, 'Upload failed');
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const actor = sessionActor(session as any);
  if (!actor) return jsonError(401, 'Unauthorized');
  const deviceAccess = await getDeviceAccessForRequest(session, req);
  if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);
  if (!canReviewShiftImage(actor)) return jsonError(403, 'Forbidden');

  const { id } = await params;
  if (!UUID_RE.test(id)) return jsonError(400, 'Invalid id');

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON');
  }

  const imageId = String(body?.imageId || '');
  const reviewStatus = String(body?.reviewStatus || '');
  const reviewComment = String(body?.reviewComment || '').trim().slice(0, 1000);
  if (!UUID_RE.test(imageId)) return jsonError(400, 'Invalid image id');
  if (!IMAGE_REVIEW_STATUSES.has(reviewStatus)) return jsonError(400, 'Invalid review status');
  if (reviewStatus === 'rejected' && !reviewComment) return jsonError(400, 'Review comment is required');

  try {
    const { response } = await findReadableShift(id, actor);
    if (response) return response;

    const image = await prisma.shiftImage.findFirst({
      where: { id: imageId, shiftId: id },
    });
    if (!image) return jsonError(404, 'Image not found');

    const updated = await prisma.shiftImage.update({
      where: { id: image.id },
      data: {
        reviewStatus,
        reviewComment: reviewStatus === 'pending_review' ? null : reviewComment || null,
        reviewedByUid: reviewStatus === 'pending_review' ? null : actor.id,
        reviewedByName: reviewStatus === 'pending_review' ? null : actor.name ?? null,
        reviewedAt: reviewStatus === 'pending_review' ? null : new Date(),
      },
    });

    await writeServerAuditLog({
      actorUid: actor.id,
      actorName: actor.name ?? null,
      action: 'shift_image_reviewed',
      entityType: 'shift',
      entityId: id,
      details: JSON.stringify({ imageId, reviewStatus, rowKey: image.rowKey, rowLabel: image.rowLabel }),
    });

    return NextResponse.json({ ok: true, image: serializeImage(updated) });
  } catch (e) {
    console.error('PATCH /api/shifts/[id]/images', e);
    return jsonError(500, 'Review failed');
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const actor = sessionActor(session as any);
  if (!actor) return jsonError(401, 'Unauthorized');
  const deviceAccess = await getDeviceAccessForRequest(session, req);
  if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

  const { id } = await params;
  if (!UUID_RE.test(id)) return jsonError(400, 'Invalid id');

  try {
    const { shift, response } = await findReadableShift(id, actor);
    if (response) return response;
    if (!shift) return jsonError(404, 'Not found');
    if (!canAppendShiftLog(actor, shift.operatorUid)) return jsonError(403, 'Forbidden');

    const imageId = new URL(req.url).searchParams.get('imageId') || '';
    if (!UUID_RE.test(imageId)) return jsonError(400, 'Invalid image id');

    const image = await prisma.shiftImage.findFirst({
      where: { id: imageId, shiftId: id },
    });
    if (!image) return jsonError(404, 'Image not found');

    const blobToken = (process.env.BLOB_READ_WRITE_TOKEN || '').trim();
    const useBlob = !!process.env.VERCEL || blobToken.length > 0;

    try {
      if (useBlob && blobToken) {
        await del(image.storagePath || image.publicUrl, { token: blobToken });
      } else {
        const rawPath = image.publicUrl?.startsWith('http')
          ? new URL(image.publicUrl).pathname
          : image.publicUrl;
        const uploadsDir = process.env.UPLOADS_DIR
          ? path.resolve(process.env.UPLOADS_DIR)
          : path.join(process.cwd(), 'public', 'uploads');
        const uploadsRoot = path.resolve(uploadsDir);
        let localPath: string | null = null;
        if (rawPath?.startsWith('/api/files/')) {
          const filename = path.basename(rawPath);
          localPath = path.join(uploadsDir, filename);
        } else if (rawPath?.startsWith('/uploads/')) {
          const relative = rawPath.replace(/^\/+/, '').split('/').map(decodeURIComponent);
          localPath = path.join(process.cwd(), 'public', ...relative);
        }
        if (localPath && path.resolve(localPath).startsWith(uploadsRoot)) {
          await unlink(localPath).catch(() => undefined);
        }
      }
    } catch (e) {
      console.warn('Failed to delete shift image file', e);
    }

    await prisma.shiftImage.delete({ where: { id: image.id } });

    await writeServerAuditLog({
      actorUid: actor.id,
      actorName: actor.name ?? null,
      action: 'shift_image_deleted',
      entityType: 'shift',
      entityId: id,
      details: JSON.stringify({ imageId, rowKey: image.rowKey, rowLabel: image.rowLabel }),
    });

    return NextResponse.json({ ok: true, imageId });
  } catch (e) {
    console.error('DELETE /api/shifts/[id]/images', e);
    return jsonError(500, 'Delete failed');
  }
}
