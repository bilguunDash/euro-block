'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useToast } from '@/components/ui/ToastProvider';
import { addDaysIso, isoFromDate } from '../dashboard-helpers';
import { HorizontalPagedList } from '../HorizontalPagedList';
import { ShiftSwapRequestModal } from './ShiftSwapRequestModal';

type MyRow = {
  id: string;
  shiftDate: string;
  shiftType: string;
  stationCode: string;
  existingShiftId: string | null;
};

type SwapRequest = {
  id: string;
  requesterUid: string;
  requesterName: string | null;
  requesterShiftDate: string;
  requesterShiftType: string;
  requesterStationCode: string;
  targetUid: string;
  targetName: string | null;
  targetShiftDate: string;
  targetShiftType: string;
  targetStationCode: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  decisionNote: string | null;
  expired: boolean;
  createdAt: string;
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) throw new Error(json?.error || 'Ачаалахад алдаа гарлаа');
  return json;
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Хүлээгдэж буй',
  accepted: 'Зөвшөөрсөн',
  rejected: 'Татгалзсан',
  cancelled: 'Цуцлагдсан',
};
const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

export function ShiftSwapRequestsPanel({
  confirmAsync,
}: {
  confirmAsync: (opts: { title: string; message: string; confirmText?: string; danger?: boolean }) => Promise<boolean>;
}) {
  const toast = useToast();
  const [swapModalRow, setSwapModalRow] = useState<MyRow | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);

  const today = useMemo(() => isoFromDate(new Date()), []);
  const rangeEnd = useMemo(() => addDaysIso(today, 90), [today]);

  const { data: myData, mutate: mutateMine } = useSWR(
    `/api/operator-schedules?queryType=mine_calendar&from=${today}&to=${rangeEnd}`,
    fetcher,
    { refreshInterval: 15000 }
  );
  const { data: incomingData, mutate: mutateIncoming } = useSWR('/api/shift-swap-requests?box=incoming', fetcher, {
    refreshInterval: 15000,
  });
  const { data: outgoingData, mutate: mutateOutgoing } = useSWR('/api/shift-swap-requests?box=outgoing', fetcher, {
    refreshInterval: 15000,
  });

  const outgoingPendingRowIds = useMemo(() => {
    const set = new Set<string>();
    ((outgoingData?.requests as SwapRequest[]) || []).forEach((r: any) => {
      if (r.status === 'pending') set.add(r.requesterScheduleId);
    });
    return set;
  }, [outgoingData]);

  const myFutureRows: MyRow[] = ((myData?.schedules as any[]) || []).filter((r) => !r.existingShiftId);
  const incoming: SwapRequest[] = incomingData?.requests || [];
  const outgoing: SwapRequest[] = outgoingData?.requests || [];

  const refreshAll = () => {
    void mutateMine();
    void mutateIncoming();
    void mutateOutgoing();
  };

  const handleDecision = async (req: SwapRequest, action: 'accept' | 'reject') => {
    const confirmed = await confirmAsync({
      title: action === 'accept' ? 'Ээлж солилцохыг зөвшөөрөх үү?' : 'Хүсэлтийг татгалзах уу?',
      message:
        action === 'accept'
          ? `Таны ${req.targetShiftDate} (${req.targetShiftType}) ээлж ${req.requesterName || 'оператор'}-д, харин таны хувьд ${req.requesterShiftDate} (${req.requesterShiftType}) ээлж шинээр оноогдоно.`
          : 'Энэ хүсэлтийг татгалзахдаа итгэлтэй байна уу?',
      confirmText: action === 'accept' ? 'Зөвшөөрөх' : 'Татгалзах',
      danger: action === 'reject',
    });
    if (!confirmed) return;

    setActingId(req.id);
    try {
      const res = await fetch(`/api/shift-swap-requests/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, note: noteDraft[req.id]?.trim() || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Үйлдэл амжилтгүй боллоо');
      toast.success(action === 'accept' ? 'Ээлж амжилттай солигдлоо.' : 'Хүсэлтийг татгалзлаа.');
      setNoteDraft((p) => ({ ...p, [req.id]: '' }));
      refreshAll();
    } catch (e: any) {
      toast.error(e?.message || 'Үйлдэл амжилтгүй боллоо');
    } finally {
      setActingId(null);
    }
  };

  const handleCancel = async (req: SwapRequest) => {
    const confirmed = await confirmAsync({
      title: 'Хүсэлтийг цуцлах уу?',
      message: `${req.targetName || 'Оператор'}-д илгээсэн солилцох хүсэлтийг цуцлах уу?`,
      confirmText: 'Цуцлах',
      danger: true,
    });
    if (!confirmed) return;

    setActingId(req.id);
    try {
      const res = await fetch(`/api/shift-swap-requests/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'cancel' }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Цуцлахад алдаа гарлаа');
      toast.success('Хүсэлтийг цуцаллаа.');
      refreshAll();
    } catch (e: any) {
      toast.error(e?.message || 'Цуцлахад алдаа гарлаа');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h4 className="font-bold text-gray-900">Ээлж солилцох</h4>
          <p className="text-sm text-gray-500 mt-1">Ирээдүйн ээлжээ ижил дамжлагын өөр операторт санал болгож солилцоно.</p>
        </div>
        <div className="p-6">
          {myFutureRows.length === 0 ? (
            <p className="text-sm text-gray-500">Ирээдүйд товлогдсон ээлж алга.</p>
          ) : (
            <ul className="space-y-2">
              {myFutureRows.map((row) => {
                const locked = outgoingPendingRowIds.has(row.id);
                return (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 px-4 py-3"
                  >
                    <span className="text-sm font-semibold text-gray-800">
                      {row.shiftDate} • {row.shiftType} • {row.stationCode}
                    </span>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => setSwapModalRow(row)}
                      className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-black hover:bg-orange-700 disabled:opacity-50"
                    >
                      {locked ? 'Хүсэлт илгээсэн' : 'Солилцох хүсэлт'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h4 className="font-bold text-gray-900">Ирсэн хүсэлтүүд</h4>
          <span className="text-xs font-bold text-blue-800 bg-blue-100 px-3 py-1 rounded-full">
            {incoming.filter((r) => r.status === 'pending').length}
          </span>
        </div>
        <div className="p-6">
          {incoming.length === 0 ? (
            <p className="text-sm text-gray-500">Ирсэн хүсэлт байхгүй.</p>
          ) : (
            <HorizontalPagedList
              items={incoming}
              renderPage={(page) => (
                <ul className="space-y-3">
                  {page.map((r) => (
                    <li key={r.id} className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold text-blue-900">{r.requesterName || 'Оператор'}</p>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_STYLE[r.status]}`}>
                          {r.expired ? 'Хугацаа хэтэрсэн' : STATUS_LABEL[r.status]}
                        </span>
                      </div>
                      <p className="text-sm text-blue-900/80 mt-1">
                        Танай {r.targetShiftDate} ({r.targetShiftType}) ↔ түүний {r.requesterShiftDate} ({r.requesterShiftType})
                      </p>
                      {r.message && <p className="text-xs text-blue-900/70 mt-1 italic">"{r.message}"</p>}
                      {r.status === 'pending' && !r.expired && (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={noteDraft[r.id] || ''}
                            onChange={(e) => setNoteDraft((p) => ({ ...p, [r.id]: e.target.value }))}
                            rows={2}
                            maxLength={500}
                            placeholder="Тайлбар (заавал биш)"
                            className="w-full px-3 py-2 rounded-xl border border-blue-200 text-sm outline-none"
                          />
                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              disabled={actingId === r.id}
                              onClick={() => handleDecision(r, 'accept')}
                              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Зөвшөөрөх
                            </button>
                            <button
                              type="button"
                              disabled={actingId === r.id}
                              onClick={() => handleDecision(r, 'reject')}
                              className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black hover:bg-red-700 disabled:opacity-50"
                            >
                              Татгалзах
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            />
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h4 className="font-bold text-gray-900">Илгээсэн хүсэлтүүд</h4>
        </div>
        <div className="p-6">
          {outgoing.length === 0 ? (
            <p className="text-sm text-gray-500">Илгээсэн хүсэлт байхгүй.</p>
          ) : (
            <HorizontalPagedList
              items={outgoing}
              renderPage={(page) => (
                <ul className="space-y-3">
                  {page.map((r) => (
                    <li key={r.id} className="rounded-2xl border border-gray-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold text-gray-900">{r.targetName || 'Оператор'}</p>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_STYLE[r.status]}`}>
                          {r.expired ? 'Хугацаа хэтэрсэн' : STATUS_LABEL[r.status]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Миний {r.requesterShiftDate} ({r.requesterShiftType}) ↔ түүний {r.targetShiftDate} ({r.targetShiftType})
                      </p>
                      {r.decisionNote && <p className="text-xs text-gray-500 mt-1 italic">"{r.decisionNote}"</p>}
                      {r.status === 'pending' && !r.expired && (
                        <div className="mt-3">
                          <button
                            type="button"
                            disabled={actingId === r.id}
                            onClick={() => handleCancel(r)}
                            className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-black hover:bg-gray-200 disabled:opacity-50"
                          >
                            Цуцлах
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            />
          )}
        </div>
      </div>

      <ShiftSwapRequestModal
        row={swapModalRow}
        onClose={() => setSwapModalRow(null)}
        onCreated={() => {
          setSwapModalRow(null);
          refreshAll();
        }}
      />
    </div>
  );
}
