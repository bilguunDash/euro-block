export interface NotificationEntry {
  userId: string;
  kind: string;
  title: string;
  body: string;
  link?: string;
  read?: boolean;
}

export async function createNotification(entry: NotificationEntry) {
  try {
    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) {
      console.error('Failed to create notification via API');
    }
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

export async function markNotificationRead(notificationId: string) {
  try {
    const res = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId }),
    });
    if (!res.ok) {
      console.error('Failed to mark notification read via API');
    }
    return res.ok;
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    return false;
  }
}

export async function clearAllNotifications() {
  try {
    const res = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clearAll' }),
    });
    if (!res.ok) {
      console.error('Failed to clear notifications via API');
    }
    return res.ok;
  } catch (error) {
    console.error('Failed to clear notifications:', error);
    return false;
  }
}
