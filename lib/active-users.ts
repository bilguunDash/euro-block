import { prisma } from '@/lib/prisma';

/**
 * Өгсөн uid-уудаас НЭВТЭРЧ ЧАДАХ (идэвхтэй) хэрэглэгчдийг шүүнэ.
 *
 * `isApproved = false` хэрэглэгч `lib/auth-options.ts`-д нэвтрэхээс блоклогддог
 * (`ACCOUNT_NOT_APPROVED`). Тиймээс ээлж хүлээлцэх дараагийн хүнийг хуваарийн
 * дагуу автоматаар сонгохдоо ЗААВАЛ энэ шүүлтийг хийнэ — эс бөгөөс гинжин хэлхээ
 * хэзээ ч нэвтэрч чадахгүй бүртгэл рүү заагаад үүрд гацна (зөвхөн admin гаргана).
 */
export async function filterActiveUserIds(
  uids: readonly (string | null | undefined)[]
): Promise<Set<string>> {
  const unique = [...new Set(uids.map((u) => String(u ?? '').trim()).filter(Boolean))];
  if (!unique.length) return new Set();

  const rows = await prisma.user.findMany({
    where: { id: { in: unique }, isApproved: true },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}
