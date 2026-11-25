import { prisma } from '@/lib/prisma';

export async function writeServerAuditLog(entry: {
  actorUid: string;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      actorUid: entry.actorUid,
      actorName: entry.actorName,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      details: entry.details ?? null,
    },
  });
}
