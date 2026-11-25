'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useToast } from '@/components/ui/ToastProvider';

type SwapRow = { id: string; shiftDate: string; shiftType: string; stationCode: string };
type Candidate = { uid: string; name: string; rows: Array<SwapRow & { blocked: boolean; blockedReason: string | null }> };

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) throw new Error(json?.error || 'Ачаалахад алдаа гарлаа');
  return json as { ok: true; requesterRow: SwapRow; candidates: Candidate[] };
};

const BLOCKED_LABEL: Record<string, string> = {
  already_pending: 'Хүлээгдэж буй хүсэлттэй',
  shift_started: 'Ээлж эхэлсэн',
};

export function ShiftSwapRequestModal({
  row,
  onClose,
  onCreated,
}: {
  row: SwapRow | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [selectedUid, setSelectedUid] = useState('');
  const [selectedTargetRowId, setSelectedTargetRowId] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading, error } = useSWR(
    row ? `/api/shift-swap-requests/candidates?scheduleId=${encodeURIComponent(row.id)}` : null,
    fetcher
  );

  const candidates = data?.candidates || [];
  const selectedCandidate = useMemo(() => candidates.find((c) => c.uid === selectedUid) || null, [candidates, selectedUid]);

  if (!row) return null;

  const canSubmit = !!selectedUid && !!selectedTargetRowId && !submitting;

  const reset = () => {
    setSelectedUid('');
    setSelectedTargetRowId('');
    setMessage('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/shift-swap-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          requesterScheduleId: row.id,
          targetUid: selectedUid,
          targetScheduleId: selectedTargetRowId,
          message: message.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Хүсэлт илгээхэд алдаа гарлаа');
      toast.success('Ээлж солилцох хүсэлт илгээгдлээ.');
      reset();
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || 'Хүсэлт илгээхэд алдаа гарлаа');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-gray-900">Ээлж солилцох хүсэлт</h4>
            <p className="text-sm text-gray-500">
              Миний ээлж: {row.shiftDate} • {row.shiftType} • {row.stationCode}
            </p>
          </div>
          <button type="button" onClick={handleClose} className="text-gray-500 font-bold">
            x
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-500">Ачаалж байна...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error.message}</p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-gray-500">Ижил дамжлагад ирээдүйн хуваарьтай өөр оператор олдсонгүй.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Хэнтэй солих вэ?</label>
              <select
                value={selectedUid}
                onChange={(e) => {
                  setSelectedUid(e.target.value);
                  setSelectedTargetRowId('');
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value="">Сонгох...</option>
                {candidates.map((c) => (
                  <option key={c.uid} value={c.uid}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Тухайн хүний аль ээлжийг авах вэ?</label>
              <select
                value={selectedTargetRowId}
                onChange={(e) => setSelectedTargetRowId(e.target.value)}
                disabled={!selectedCandidate}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">{selectedCandidate ? 'Сонгох...' : 'Эхлээд хүн сонгоно уу'}</option>
                {selectedCandidate?.rows.map((r) => (
                  <option key={r.id} value={r.id} disabled={r.blocked}>
                    {r.shiftDate} • {r.shiftType}
                    {r.blocked ? ` — ${BLOCKED_LABEL[r.blockedReason || ''] || 'Боломжгүй'}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Зурвас (заавал биш)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="Тухайн хүнд илгээх тайлбар..."
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold"
          >
            Болих
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 disabled:opacity-50"
          >
            {submitting ? 'Илгээж байна...' : 'Хүсэлт илгээх'}
          </button>
        </div>
      </div>
    </div>
  );
}
