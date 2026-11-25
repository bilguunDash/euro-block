import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Буруу өгөгдөл' }, { status: 400 });

  const { name, email, password } = body as { name?: string; email?: string; password?: string };

  if (!email?.trim()) return NextResponse.json({ error: 'Имэйл оруулна уу' }, { status: 400 });
  if (!password || password.length < 6) return NextResponse.json({ error: 'Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой' }, { status: 400 });

  // ЗААВАЛ жижиг үсэгт хөрвүүлнэ: `lib/auth-options.ts`-ийн authorize() нэвтрэхдээ
  // имэйлийг lowercase болгож хайдаг (erp-sync мөн адил). Энд хөрвүүлэхгүй бол
  // жижиг ЖИЖИГ бус (Том/Жижиг холимог) имэйлээр бүртгүүлсэн хэрэглэгч дараа нь
  // өөр том/жижиг үсгээр нэвтрэх гэхэд "нэвтрэх нэр эсвэл нууц үг буруу" гэж
  // татгалздаг байсан — нууц үг зөв байсан ч. Мөн @@unique(email) том/жижиг
  // ялгаатай тул давхар бүртгэлийг блоклохгүй байх эрсдэлтэй байсан.
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) return NextResponse.json({ error: 'Энэ имэйл аль хэдийн бүртгэлтэй байна' }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name: name?.trim() || null,
      email: normalizedEmail,
      passwordHash,
      role: 'operator',
      // Нийтийн endpoint тул шинэ акаунт админ батлах хүртэл нэвтэрч чадахгүй
      // (authorize → ACCOUNT_NOT_APPROVED). Админ «Баталгаажуулах хүлээгдэж буй»-гаас батална.
      isApproved: false,
      tabletAccessAllowed: true,
      mobileAccessAllowed: false,
    },
  });

  return NextResponse.json({ ok: true });
}
