import type { Prisma } from '../generated/prisma/client';

/** Татгалзсан бүртгэлийн хүсэлтийн аудит action — `components/dashboard/dashboard-helpers.ts`-д шошготой. */
export const USER_REGISTRATION_REJECTED_ACTION = 'user_registration_rejected';

type Actor = { id: string; name: string | null };

export class UserRegistrationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function parseRejectUserRequest(body: unknown): { id: string } {
  const id = (body as { id?: unknown } | null)?.id;
  if (typeof id !== 'string' || !id.trim()) throw new Error('Хэрэглэгчийн ID шаардлагатай.');
  return { id: id.trim() };
}

/**
 * «Баталгаажуулах хүлээгдэж буй» хэрэглэгчийн бүртгэлийн хүсэлтийг татгалзаж, акаунтыг нь устгана.
 * `isApproved` дээр «татгалзсан» гэсэн тусдаа төлөв байхгүй — татгалзсан хүн хүсвэл дахин бүртгүүлж болно.
 *
 * Зөвхөн ХҮЛЭЭГДЭЖ буй акаунт дээр ажиллана. Жагсаалт хуучирч, өөр админ тэр хооронд батласан бол
 * нэвтэрч байгаа хэрэглэгчийг устгахгүй, 409 буцаана. Устгал ба аудит нэг transaction-д commit хийгдэнэ.
 */
export async function rejectPendingUser(tx: Prisma.TransactionClient, id: string, actor: Actor) {
  const user = await tx.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isApproved: true },
  });
  if (!user) throw new UserRegistrationError(404, 'Бүртгэлийн хүсэлт олдсонгүй. Өөр админ боловсруулсан байж болно.');
  if (user.isApproved) throw new UserRegistrationError(409, 'Хэрэглэгч аль хэдийн баталгаажсан байна. Жагсаалтыг шинэчилнэ үү.');

  // Харьцуулж-устгана: уншсанаас хойш батлагдсан бол (isApproved = true) энэ нөхцөл таарахгүй.
  const { count } = await tx.user.deleteMany({ where: { id, isApproved: false } });
  if (count !== 1) throw new UserRegistrationError(409, 'Хэрэглэгчийн төлөв өөрчлөгдсөн. Жагсаалтыг шинэчилнэ үү.');

  await tx.auditLog.create({
    data: {
      actorUid: actor.id,
      actorName: actor.name,
      action: USER_REGISTRATION_REJECTED_ACTION,
      entityType: 'user',
      entityId: user.id,
      details: `Rejected registration request of ${user.email || '-'} (name=${user.name || '-'}, role=${user.role})`,
    },
  });
  return user;
}
