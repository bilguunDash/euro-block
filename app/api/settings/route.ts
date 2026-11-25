import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { SYSTEM_SETTING_DEFAULTS } from '@/lib/system-settings';

const KEYS = new Set([
  'periodic_interval_hours',
  'shift_handover_window_strict',
  'day_handover_start',
  'day_handover_end',
  'night_handover_start',
  'night_handover_end',
]);

function isValidHm(s: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
  if (!m) return false;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  return Number.isFinite(h) && Number.isFinite(min) && h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

function isValidBoolString(s: string): boolean {
  const v = String(s || '').trim().toLowerCase();
  return v === 'true' || v === 'false';
}

function normalizeBoolString(s: string): string {
  return String(s || '').trim().toLowerCase() === 'true' ? 'true' : 'false';
}

export async function GET() {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await prisma.systemSetting.findMany();
    const settings: Record<string, string> = { ...SYSTEM_SETTING_DEFAULTS };
    for (const r of rows) settings[r.key] = r.value;

    return NextResponse.json({ ok: true, settings });
  } catch (e: any) {
    console.error('GET /api/settings', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    const role = String((session?.user as any)?.role || '');
    if (!session?.user?.email || role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const updates = body?.settings as Record<string, string> | undefined;
    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    // Validate and normalize (avoid storing invalid formats)
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (!KEYS.has(key)) continue;
      const raw = String(value ?? '').trim();

      if (key === 'periodic_interval_hours') {
        const n = parseFloat(raw);
        if (!Number.isFinite(n) || n <= 0 || n > 24) {
          return NextResponse.json(
            { error: 'Давтамжит бүртгэлийн хугацаа 0-ээс их, 24 цагаас ихгүй байна.' },
            { status: 400 }
          );
        }
        normalized[key] = String(n);
        continue;
      }

      if (key === 'shift_handover_window_strict') {
        if (!isValidBoolString(raw)) {
          return NextResponse.json({ error: 'Хатуу горимын утга буруу байна.' }, { status: 400 });
        }
        normalized[key] = normalizeBoolString(raw);
        continue;
      }

      if (key.endsWith('_handover_start') || key.endsWith('_handover_end')) {
        if (!isValidHm(raw)) {
          return NextResponse.json({ error: `${key} цагийн утга буруу байна.` }, { status: 400 });
        }
        normalized[key] = raw;
        continue;
      }

      normalized[key] = raw;
    }

    if (Object.keys(normalized).length === 0) {
      return NextResponse.json({ error: 'Хадгалах тохиргоо олдсонгүй.' }, { status: 400 });
    }
    if (
      normalized.day_handover_start &&
      normalized.day_handover_end &&
      normalized.day_handover_start === normalized.day_handover_end
    ) {
      return NextResponse.json({ error: 'Өдрийн ээлжийн эхлэх, дуусах цаг ижил байж болохгүй.' }, { status: 400 });
    }
    if (
      normalized.night_handover_start &&
      normalized.night_handover_end &&
      normalized.night_handover_start === normalized.night_handover_end
    ) {
      return NextResponse.json({ error: 'Шөнийн ээлжийн эхлэх, дуусах цаг ижил байж болохгүй.' }, { status: 400 });
    }

    const writes = Object.entries(normalized).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    );
    await prisma.$transaction([
      ...writes,
      prisma.auditLog.create({
        data: {
          actorUid: String(session.user.id || session.user.email),
          actorName: session.user.name || '',
          action: 'system_settings_updated',
          entityType: 'system_setting',
          entityId: 'batch',
          details: JSON.stringify(normalized),
        },
      }),
    ]);

    return NextResponse.json({ ok: true, settings: normalized });
  } catch (e: any) {
    console.error('PATCH /api/settings', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
