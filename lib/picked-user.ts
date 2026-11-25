import { prisma } from './prisma';

export class PickedUserSelectionError extends Error {}

/** IDs are authoritative; old name/email selections must identify exactly one user. */
export async function resolvePickedUserSelection({
  uid, label, roles,
}: { uid?: unknown; label?: unknown; roles: string[] }): Promise<{ id: string; name: string | null } | null> {
  const id = String(uid ?? '').trim();
  const legacyLabel = String(label ?? '').trim();
  const value = id || legacyLabel;
  if (!value) return null;

  const byId = await prisma.user.findUnique({
    where: { id: value },
    select: { id: true, name: true, email: true, role: true, isApproved: true },
  });
  if (byId) {
    return byId.isApproved && roles.includes(byId.role) ? { id: byId.id, name: byId.name || byId.email } : null;
  }
  // An explicitly supplied ID never falls back to a different account by name.
  if (id) return null;

  const matches = await prisma.user.findMany({
    where: { role: { in: roles }, isApproved: true, OR: [{ name: legacyLabel }, { email: legacyLabel }] },
    select: { id: true, name: true, email: true },
    take: 2,
  });
  if (matches.length > 1) {
    throw new PickedUserSelectionError('Ижил нэртэй хэд хэдэн хэрэглэгч байна. Жагсаалтаас тухайн хүнийг дахин сонгоно уу.');
  }
  const match = matches[0];
  return match ? { id: match.id, name: match.name || match.email } : null;
}
