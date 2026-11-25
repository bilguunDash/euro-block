'use client';

import { useMemo, useState } from 'react';
import { Search, Trash2, X } from 'lucide-react';
import { isoDateInTimeZone } from '@/lib/handover-window';
import { HorizontalPagedList } from '../HorizontalPagedList';

// «Бүгдийг цэвэрлэх» товчийг түр хаасан (2026-08-05) — хүсэлтээр UI-д харуулахгүй.
// Дахин нээхдээ зөвхөн false-г true болгоно, доорх код бүрэн хэвээр байгаа.
const CLEAR_ALL_ENABLED = false;

type NotificationsTabProps = {
  notifications: any[];
  onClearNotifications?: () => Promise<void> | void;
  onOpenNotification?: (notification: any) => Promise<void> | void;
};

/** Мэдэгдлийн огноог Улаанбаатарын цагаар `YYYY-MM-DD` болгоно — хүснэгтэд харагдах
 *  цагтай (мөн `toLocaleString('mn-MN', Asia/Ulaanbaatar`) ижил өдөр гарахын тулд. */
function notificationDate(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
  return isoDateInTimeZone(parsed);
}

export function NotificationsTab({
  notifications,
  onClearNotifications,
  onOpenNotification,
}: NotificationsTabProps) {
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [query, setQuery] = useState('');

  // useMemo — эс бөгөөс `notifications` массив биш үед мөр бүрт шинэ [] үүсч,
  // доорх useMemo-гийн хамаарал render болгонд өөрчлөгдөнө.
  const allNotifications = useMemo(
    () => (Array.isArray(notifications) ? notifications : []),
    [notifications]
  );
  const hasActiveFilter = since !== '' || until !== '' || query.trim() !== '';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allNotifications.filter((n: any) => {
      const day = notificationDate(n?.createdAt);
      if (since && day && day < since) return false;
      if (until && day && day > until) return false;
      if (q) {
        const hay = [n?.title, n?.body, n?.message].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allNotifications, since, until, query]);

  const clearFilters = () => {
    setSince('');
    setUntil('');
    setQuery('');
  };

  return (
    <section className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-gray-900">Мэдэгдэл</h3>
        <p className="text-gray-500">Approval / late entry / issue alert</p>
      </div>

      {/* ── Шүүлтүүр ── */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-2">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Эхлэх огноо</p>
            <input
              type="date"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-50"
              value={since}
              max={until || undefined}
              onChange={(e) => setSince(e.target.value)}
            />
          </div>
          <div className="xl:col-span-2">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Дуусах огноо</p>
            <input
              type="date"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-50"
              value={until}
              min={since || undefined}
              onChange={(e) => setUntil(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 xl:col-span-8">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Хайлт (гарчиг / агуулга)</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-gray-800 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-50"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Мэдэгдлийн гарчиг эсвэл агуулгаар хайх..."
                />
              </div>
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50"
                >
                  <X className="h-4 w-4" />
                  Арилгах
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-3">
          <h4 className="font-bold text-gray-900">Сүүлийн мэдэгдлүүд</h4>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-600">
              {hasActiveFilter ? `${filtered.length} / ${allNotifications.length}` : allNotifications.length}
            </span>
            {CLEAR_ALL_ENABLED && allNotifications.length > 0 && onClearNotifications ? (
              <button
                type="button"
                onClick={() => void onClearNotifications()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-100 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Бүгдийг цэвэрлэх
              </button>
            ) : null}
          </div>
        </div>
        <div className="p-6">
          {allNotifications.length === 0 ? (
            <p className="text-sm text-gray-500">Одоогоор мэдэгдэл байхгүй.</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500">Шүүлтүүрт тохирох мэдэгдэл олдсонгүй.</p>
          ) : (
            <HorizontalPagedList
              items={filtered}
              renderPage={(page) => (
            <ul className="space-y-3">
              {page.map((n: any) => (
                <li key={n.id} className={`rounded-2xl border p-4 ${n.read ? 'border-gray-200 bg-white' : 'border-orange-200 bg-orange-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{n.title || 'Мэдэгдэл'}</p>
                      <p className="text-sm text-gray-600 mt-1">{n.body || n.message || ''}</p>
                      {n.createdAt ? (
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(n.createdAt).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!n.read && <span className="px-3 py-1 rounded-full bg-orange-600 text-white text-xs font-black">Шинэ</span>}
                      {onOpenNotification && (
                        <button
                          type="button"
                          onClick={() => void onOpenNotification(n)}
                          className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-xs font-black text-orange-700 hover:bg-orange-50"
                        >
                          Нээх
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
              )}
            />
          )}
        </div>
      </div>
    </section>
  );
}
