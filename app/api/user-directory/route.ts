import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { AllowedRole, isAllowedRole, normalizeRole as normalizeRoleValue } from '@/lib/roles';

// `chief_engineer` мөн эцсийн баталгаажуулалт хийдэг тул «батлах админ» сонгогчид
// харагдах ёстой.
const DIRECTORY_FILTERABLE_ROLES: Set<AllowedRole> = new Set([
  'operator',
  'master',
  'admin',
  'hse_engineer',
  'dispatcher',
  'chief_engineer',
]);

function normalizeRole(role: unknown): string | null {
  if (role == null) return null;
  return normalizeRoleValue(role);
}

export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const rolesParam = String(searchParams.get('roles') || '').trim();
    const roles = rolesParam
      ? rolesParam
          .split(',')
          .map((r) => normalizeRole(r))
          .filter((r): r is AllowedRole => isAllowedRole(r) && DIRECTORY_FILTERABLE_ROLES.has(r))
      : [];

    const where: any = {};
    if (roles.length) where.role = { in: roles };

    const users = await prisma.user.findMany({
      where,
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      select: { id: true, name: true, email: true, role: true },
      take: 500,
    });

    return NextResponse.json({
      ok: true,
      users: users.map((u) => ({
        id: u.id,
        name: u.name || '',
        email: u.email,
        role: normalizeRole(u.role) || String(u.role || ''),
      })),
    });
  } catch (e: any) {
    console.error('GET /api/user-directory', e);
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
  }
}

