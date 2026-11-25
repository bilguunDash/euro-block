import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { AllowedRole } from '@/lib/roles';

const ERP_BASE_URL = process.env.ERP_BASE_URL ?? 'https://erp.mak.mn';
const ERP_LOGIN = process.env.ERP_LOGIN ?? 'aac_euroblock';
const ERP_PASSWORD = process.env.ERP_PASSWORD ?? '';
const SYNC_SECRET = process.env.ERP_SYNC_SECRET ?? '';
const DEFAULT_USER_PASSWORD = process.env.ERP_SYNC_DEFAULT_PASSWORD ?? '';

type ErpEmployee = {
  last_name: string;
  name: string;
  job_name: string;
  mail: string | false;
  phone: string | false;
  department_name: string;
};

function resolveRole(jobName: string): AllowedRole | null {
  const j = jobName.toLowerCase();
  if (j.includes('хабэа') || j.includes('хаэа')) return 'hse_engineer';
  if (j.includes('ерөнхий инженер')) return 'chief_engineer';
  if (j.includes('инженер')) return 'admin';
  if (j.includes('мастер')) return 'master';
  if (j.includes('диспетчер')) return 'dispatcher';
  if (j.includes('оператор')) return 'operator';
  return null;
}

// Login хийж Set-Cookie header-ийг бүтнээр нь буцаана
async function erpLogin(): Promise<string | null> {
  const res = await fetch(`${ERP_BASE_URL}/app/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: { db: 'mak', login: ERP_LOGIN, password: ERP_PASSWORD },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();

  // Set-Cookie header-ийг бүтнээр нь авна (session_id, tz, lang гэх мэт)
  const setCookies = res.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    // "name=value; Path=/" → "name=value" хэлбэрт хувиргана
    const cookieStr = setCookies
      .map((c) => c.split(';')[0].trim())
      .join('; ');
    return cookieStr;
  }

  // Fallback: JSON-аас session_id авах
  const sessionId =
    (data?.result?.response?.session_id as string) ||
    (data?.result?.session_id as string) ||
    null;
  console.log('[erp-sync] session_id fallback:', sessionId ? '***found***' : 'NOT FOUND');
  return sessionId ? `session_id=${sessionId}` : null;
}

async function fetchErpEmployees(cookieStr: string): Promise<ErpEmployee[]> {
  const res = await fetch(`${ERP_BASE_URL}/hr/get_employee_block`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieStr,
    },
    body: JSON.stringify({ jsonrpc: '2.0', params: {} }),
  });
  console.log('[erp-sync] employee fetch status:', res.status);
  if (!res.ok) return [];
  const data = await res.json();
  const list =
    (data?.result?.response as ErpEmployee[]) ||
    (data?.result as ErpEmployee[]) ||
    (Array.isArray(data) ? data : null) ||
    [];
  console.log('[erp-sync] employee count:', list.length);
  return list;
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  const isSecretAuth = SYNC_SECRET && token === SYNC_SECRET;

  if (!isSecretAuth) {
    const session = (await getServerSession(authOptions)) as any;
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const missing = ['ERP_PASSWORD', 'ERP_SYNC_DEFAULT_PASSWORD'].filter(
    (key) => !(process.env[key] ?? '').trim(),
  );
  if (missing.length > 0) {
    return NextResponse.json({ error: 'ERP configuration missing', missing }, { status: 503 });
  }

  try {
    const cookieStr = await erpLogin();
    if (!cookieStr) {
      return NextResponse.json({ error: 'ERP нэвтрэх амжилтгүй' }, { status: 502 });
    }

    const employees = await fetchErpEmployees(cookieStr);
    if (!employees.length) {
      return NextResponse.json({ error: 'ERP ажилчдын мэдээлэл хоосон' }, { status: 502 });
    }

    const passwordHash = await bcrypt.hash(DEFAULT_USER_PASSWORD, 10);

    const existing = await prisma.user.findMany({
      select: { id: true, email: true, name: true },
    });
    const emailSet = new Set(
      existing.filter((u) => u.email).map((u) => u.email!.toLowerCase()),
    );
    const nameSet = new Set(
      existing.filter((u) => u.name).map((u) => u.name!.toLowerCase()),
    );

    let created = 0;
    let skipped = 0;
    let errors = 0;
    const createdList: string[] = [];

    for (const emp of employees) {
      const role = resolveRole(emp.job_name);
      if (!role) { skipped++; continue; }

      const email =
        emp.mail && typeof emp.mail === 'string' ? emp.mail.toLowerCase().trim() : null;
      const displayName = `${emp.name} ${emp.last_name}`.trim();
      const displayNameLower = displayName.toLowerCase();

      if (email && emailSet.has(email)) { skipped++; continue; }
      if (!email && nameSet.has(displayNameLower)) { skipped++; continue; }

      try {
        await prisma.user.create({
          data: {
            email: email ?? null,
            name: displayName,
            passwordHash,
            role: role as any,
            isApproved: true,
            tabletAccessAllowed: true,
            mobileAccessAllowed: false,
          },
        });
        created++;
        createdList.push(`${displayName} (${role})`);
        if (email) emailSet.add(email);
        nameSet.add(displayNameLower);
      } catch (e: any) {
        if (e?.code === 'P2002') {
          skipped++;
        } else {
          errors++;
          console.error('[erp-sync] create error:', emp.name, e?.message);
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        actorUid: 'system',
        actorName: 'ERP Sync',
        action: 'erp_sync',
        entityType: 'user',
        entityId: 'bulk',
        details: `ERP синк: нийт ${employees.length}, шинэ ${created}, алгасан ${skipped}, алдаа ${errors}`,
      },
    });

    return NextResponse.json({
      ok: true,
      total: employees.length,
      created,
      skipped,
      errors,
      createdList,
    });
  } catch (error) {
    console.error('[erp-sync] fatal:', error);
    return NextResponse.json({ error: 'Sync амжилтгүй', details: String(error) }, { status: 500 });
  }
}
