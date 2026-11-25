import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { notifyManyDeduped } from '@/lib/server-notifications';
import { deviceForbiddenResponse, getDeviceAccessForRequest } from '@/lib/device-access';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeAttachmentPayload(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 20)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const url = String((item as any).url || '').trim();
      const name = String((item as any).name || (item as any).filename || '').trim();
      if (!url || !name) return null;
      return {
        id: String((item as any).id || crypto.randomUUID()).slice(0, 80),
        name: name.slice(0, 240),
        url,
        storagePath: String((item as any).storagePath || '').trim() || undefined,
        mimeType: String((item as any).mimeType || '').trim() || undefined,
        sizeBytes: Number.isFinite(Number((item as any).sizeBytes)) ? Number((item as any).sizeBytes) : undefined,
        uploadedAt: String((item as any).uploadedAt || new Date().toISOString()).trim(),
        uploadedByName: String((item as any).uploadedByName || '').trim() || undefined,
      };
    })
    .filter(Boolean);
}

function normalizeIncidentsPayload(raw: unknown): Array<Record<string, any>> {
  if (!Array.isArray(raw)) return [];
  const out: Array<Record<string, any>> = [];
  for (const item of raw.slice(0, 30)) {
    if (!item || typeof item !== 'object') continue;
    const description = String((item as any).description ?? '').trim();
    if (!description) continue;
    const severity = String((item as any).severity ?? 'Дунд').trim().slice(0, 64) || 'Дунд';
    const ra = (item as any).reportedAt;
    const reportedAt =
      typeof ra === 'string' && ra.trim() && Number.isFinite(Date.parse(ra)) ? ra.trim() : new Date().toISOString();
    const attachments = normalizeAttachmentPayload((item as any).attachments);
    const images = normalizeAttachmentPayload((item as any).images);
    const files = normalizeAttachmentPayload((item as any).files);
    out.push({
      description: description.slice(0, 8000),
      severity,
      reportedAt,
      violation: (item as any).violation === false ? false : true,
      attachments,
      images,
      files,
    });
    if (out.length >= 20) break;
  }
  return out;
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PATCH() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const deviceAccess = await getDeviceAccessForRequest(session, req);
    if (!deviceAccess.allowed) return deviceForbiddenResponse(deviceAccess);

    const role = String(session.user?.role || 'operator');
    if (role === 'hse_engineer') {
      return NextResponse.json({ error: 'ХАБ инженер осол бүртгэх эрхгүй' }, { status: 403 });
    }

    const body = await req.json();

    const incidents = normalizeIncidentsPayload(body?.incidents);
    const operatorUid = String(session.user?.id || '');
    const operatorName = String(session.user?.name || session.user?.email || '').trim() || null;

    let stationCode = String(session.user?.stationCode || '').trim();
    if (!stationCode && ['admin', 'dispatcher', 'chief_engineer', 'auditor', 'master'].includes(role)) {
      stationCode = String(body?.stationCode || '').trim();
    }

    const generalComment = String(body?.generalComment ?? '').trim().slice(0, 8000);
    if (incidents.length === 0 && !generalComment) {
      return NextResponse.json({ error: 'ХАБ тэмдэглэл эсвэл зөрчлийн тайлбар оруулна уу' }, { status: 400 });
    }
    const rawShift = body?.shiftId != null ? String(body.shiftId).trim() : '';
    const shiftId = rawShift && UUID_RE.test(rawShift) ? rawShift : null;

    const hseLog = await prisma.hseLog.create({
      data: {
        shiftId,
        stationCode,
        operatorUid,
        operatorName,
        incidents: JSON.stringify(incidents),
        generalComment,
        hseEngineerApproved: false,
      }
    });

    const hseRecipients = await prisma.user.findMany({
      where: { role: { in: ['hse_engineer', 'master', 'dispatcher', 'admin', 'chief_engineer'] } },
      select: { id: true },
      take: 200,
    });
    const managers = await prisma.user.findMany({
      where: { role: { in: ['chief_engineer', 'manager', 'admin'] } },
      select: { id: true },
      take: 50,
    });
    const hasCritical = incidents.some((i) => String(i.severity || '').includes('Өндөр') || String(i.severity || '').includes('Critical'));

    const link = '/dashboard';
    const title = 'ХАБ ослын мэдэгдэл';
    const bodyText = `${stationCode || '—'} — ${incidents.length} бүртгэл${generalComment ? ` | ${generalComment.slice(0, 120)}` : ''}`;
    const dedupeKey = `hse_incident:${hseLog.id}`;

    const recipients = new Set<string>();
    for (const u of hseRecipients) recipients.add(u.id);
    if (hasCritical) for (const u of managers) recipients.add(u.id);

    await notifyManyDeduped(
      Array.from(recipients),
      { kind: hasCritical ? 'hse_incident_critical' : 'hse_incident', title, body: bodyText, link, dedupeKey },
      { windowMinutes: 24 * 60 }
    );

    return NextResponse.json({ ok: true, id: hseLog.id.toString() });
  } catch (error: any) {
    console.error('Error POST /api/hse:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
