import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api/responses';
import { parseRejectUserRequest, rejectPendingUser, UserRegistrationError } from '@/lib/user-registration';

/**
 * POST /api/users/reject — `{ id }`
 *
 * «Баталгаажуулах хүлээгдэж буй» хэрэглэгчийн бүртгэлийн хүсэлтийг татгалзаж акаунтыг устгана.
 * Зөвхөн админ (зөвшөөрөх `PATCH /api/users`-тэй ижил). Бизнес дүрэм: `lib/user-registration.ts`.
 */
export async function POST(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.user?.id) return jsonError(401, 'Unauthorized');
  if (String(session.user.role || '') !== 'admin') return jsonError(403, 'Forbidden');

  let request;
  try {
    request = parseRejectUserRequest(await req.json());
  } catch (error) {
    return jsonError(400, error instanceof SyntaxError ? 'Invalid JSON' : error instanceof Error ? error.message : 'Invalid request');
  }

  try {
    await prisma.$transaction((tx) => rejectPendingUser(tx, request.id, {
      id: String(session.user.id),
      name: String(session.user.name || session.user.email || '') || null,
    }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UserRegistrationError) return jsonError(error.status, error.message);
    console.error('POST /api/users/reject', error);
    return jsonError(500, 'Хүсэлтийг татгалзаж чадсангүй. Дахин оролдоно уу.');
  }
}
