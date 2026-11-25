export interface AuditLogEntry {
  actorUid: string;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details?: string;
}

export async function appendAuditLog(entry: AuditLogEntry) {
  try {
    const res = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) {
      console.error('Failed to append audit log via API');
    }
  } catch (error) {
    console.error('Failed to append audit log:', error);
  }
}
