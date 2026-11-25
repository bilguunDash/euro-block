import { prisma } from '@/lib/prisma';

type CreateNotificationInput = {
  userId: string;
  kind: string;
  title: string;
  body: string;
  link?: string | null;
  dedupeKey?: string | null;
};

export async function createNotificationDeduped(
  input: CreateNotificationInput,
  opts?: { windowMinutes?: number }
) {
  const windowMinutes = typeof opts?.windowMinutes === 'number' && opts.windowMinutes > 0 ? opts.windowMinutes : 60;
  const userId = String(input.userId || '').trim();
  const kind = String(input.kind || '').trim();
  const title = String(input.title || '').trim();
  const body = String(input.body || '').trim();
  const link = input.link != null ? String(input.link) : null;
  const dedupeKey = input.dedupeKey != null ? String(input.dedupeKey).trim() : null;

  if (!userId || !kind || !title || !body) return { ok: false as const, created: false as const };

  if (dedupeKey) {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        dedupeKey,
        createdAt: { gte: since },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    if (existing?.id) return { ok: true as const, created: false as const, id: existing.id };
  }

  const created = await prisma.notification.create({
    data: {
      userId,
      kind,
      dedupeKey,
      title,
      body,
      link,
    },
    select: { id: true },
  });
  return { ok: true as const, created: true as const, id: created.id };
}

export async function notifyManyDeduped(
  userIds: string[],
  input: Omit<CreateNotificationInput, 'userId'>,
  opts?: { windowMinutes?: number }
) {
  const ids = Array.from(new Set((userIds || []).map((x) => String(x || '').trim()).filter(Boolean)));
  const results: Array<{ userId: string; ok: boolean; created: boolean }> = [];
  for (const uid of ids) {
    const r = await createNotificationDeduped({ userId: uid, ...input }, opts);
    results.push({ userId: uid, ok: r.ok, created: (r as any).created === true });
  }
  return results;
}

