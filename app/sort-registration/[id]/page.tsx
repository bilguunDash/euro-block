'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ui/ToastProvider';
import { RamHeaderForm, type RamHeaderValues } from '@/components/sort/forms/RamHeaderForm';
import { SortEntryForm } from '@/components/sort/forms/SortEntryForm';
import { SortRecordReadOnly } from '@/components/sort/SortRecordReadOnly';
import { canDeleteSortRecord, canEditSortCounts, canEditSortHeader, type SessionActor } from '@/lib/sort-api-permissions';
import { sortStatusLabel } from '@/lib/sort-status-labels';
import { SORT_SIZE_CHOICES } from '@/lib/sort-form-options';
import type { SortCountsInput } from '@/lib/sort-work-calc';

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store', credentials: 'include' });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Failed to load');
  return data;
};

function toActor(profile: any): SessionActor {
  return {
    id: profile?.uid || '',
    role: profile?.role || 'operator',
    stationCode: profile?.stationCode ?? null,
    name: profile?.displayName ?? null,
    sortDualRole: Boolean(profile?.sortDualRole),
  };
}

/** 2 үе шаттай процессын хаана явааг харуулна: 1. Рам → 2. Сорт. */
function StepStrip({ status }: { status: string }) {
  if (status === 'deleted') return null;
  const sortDone = status === 'completed';
  return (
    <div className="flex items-center gap-2 text-xs font-bold">
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
        1. Рам ✓
      </span>
      <span className="h-px w-4 bg-gray-300" />
      <span className={`inline-flex items-center rounded-full border px-3 py-1 ${
        sortDone ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}>
        2. Сорт {sortDone ? '✓' : 'хүлээгдэж байна'}
      </span>
    </div>
  );
}

export default function SortRecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [frameSizeDraft, setFrameSizeDraft] = useState<{ sort1FrameNo: string; sort1SizeMm: string } | null>(null);

  const { data, isLoading, mutate } = useSWR(id ? `/api/sort/records/${id}` : null, fetcher);
  const record = data?.data;

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-gray-600">Бүртгэл олдсонгүй.</p>
          <Link href="/sort-registration" className="mt-4 inline-block text-orange-600 font-bold hover:underline">
            Буцах
          </Link>
        </div>
      </div>
    );
  }

  const actor = toActor(profile);
  const canEditHeader = canEditSortHeader(actor, record.status);
  const canEditCounts = canEditSortCounts(actor, record.status);
  const canDelete = canDeleteSortRecord(actor);

  const draft = frameSizeDraft ?? { sort1FrameNo: record.sort1FrameNo, sort1SizeMm: record.sort1SizeMm };

  const handleHeaderSubmit = async (values: RamHeaderValues) => {
    try {
      const res = await fetch(`/api/sort/records/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Хадгалахад алдаа гарлаа');
      toast.success('Хадгалагдлаа.');
      await mutate();
    } catch (error: any) {
      toast.error(error?.message || 'Алдаа гарлаа');
    }
  };

  const handleFrameSizeSubmit = async () => {
    try {
      const res = await fetch(`/api/sort/records/${id}/sort-header`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Хадгалахад алдаа гарлаа');
      toast.success('Хадгалагдлаа.');
      setFrameSizeDraft(null);
      await mutate();
    } catch (error: any) {
      toast.error(error?.message || 'Алдаа гарлаа');
    }
  };

  const handleSortSubmit = async (values: SortCountsInput) => {
    try {
      const res = await fetch(`/api/sort/records/${id}/sort`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Дуусгахад алдаа гарлаа');

      // Хуучин десктоп апп шиг: СОРТ оператор "Дуусгах" дарахад ээлжийн
      // хугацаанд олон рамыг дараалан бүртгэхэд хялбар байхын тулд дараагийн
      // "хүлээгдэж байна" бичлэг рүү автоматаар шилжинэ (select_next_waiting_after).
      let nextId: string | null = null;
      try {
        const nextRes = await fetch('/api/sort/records?status=waiting_sort&limit=1', {
          cache: 'no-store',
          credentials: 'include',
        });
        const nextJson = await nextRes.json();
        if (nextJson.ok && nextJson.data?.[0]?.id) nextId = nextJson.data[0].id;
      } catch {
        // Дараагийн бичлэг татахад алдаа гарвал одоогийн бичлэг дээрээ үлдэнэ — доор mutate() хийнэ.
      }

      if (nextId) {
        toast.success('Бүртгэл дууслаа. Дараагийн хүлээгдэж буй бичлэг рүү шиллээ.');
        router.push(`/sort-registration/${nextId}`);
      } else {
        toast.success('Бүртгэл дууслаа.');
        await mutate();
      }
    } catch (error: any) {
      toast.error(error?.message || 'Алдаа гарлаа');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Энэ бүртгэлийг устгах уу?')) return;
    try {
      const res = await fetch(`/api/sort/records/${id}`, { method: 'DELETE', credentials: 'include' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Устгахад алдаа гарлаа');
      toast.success('Устгагдлаа.');
      // Хуучин систем шиг жагсаалт руу буцна — үгүй бол хуудас өөрчлөлтгүй
      // харагдаж "устгагдсангүй" мэт ойлголт төрүүлдэг байсан.
      router.push('/sort-registration');
    } catch (error: any) {
      toast.error(error?.message || 'Алдаа гарлаа');
    }
  };

  const showReadOnly = !canEditHeader && !canEditCounts;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/sort-registration" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors">
            <ChevronLeft className="w-5 h-5" />
            <span>Буцах</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black ${
              record.status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : record.status === 'deleted' ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}>
              {sortStatusLabel(record.status)}
            </span>
            {canDelete && record.status !== 'deleted' && (
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100"
              >
                <Trash2 className="w-4 h-4" />
                Устгах
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase">Ц.дугаар</p>
              <h1 className="text-2xl font-bold text-gray-900">{record.headerCNumber || '—'}</h1>
              <p className="text-sm text-gray-500 mt-1">
                Рам №: {record.sort1FrameNo || '—'} · Хэмжээ: {record.sort1SizeMm || '—'} · Автоклав: {record.autoclaveNo || '—'}
              </p>
            </div>
            <StepStrip status={record.status} />
          </div>
        </div>

        {canEditHeader && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 md:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">1) Рамны мэдээлэл</h2>
            <RamHeaderForm
              initialValues={record}
              onSubmit={handleHeaderSubmit}
              submitLabel="Хадгалах"
            />
          </div>
        )}

        {canEditCounts && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">2) Сортын мэдээлэл</h2>
              <p className="text-xs text-gray-400 mt-1">
                Грейд тус бүрийн тоог оруулахад м³ автоматаар бодогдоно. Нийт м³ яг 5.400 болоход «Дуусгах» товч идэвхжинэ.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-3">Рам №, Хэмжээ (шаардлагатай бол засна)</p>
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={draft.sort1FrameNo}
                  onChange={(e) => setFrameSizeDraft({ ...draft, sort1FrameNo: e.target.value })}
                  placeholder="Рам №"
                  className="px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                />
                <select
                  value={draft.sort1SizeMm}
                  onChange={(e) => setFrameSizeDraft({ ...draft, sort1SizeMm: e.target.value })}
                  className="px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="">Хэмжээ сонгоно уу</option>
                  {SORT_SIZE_CHOICES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              {frameSizeDraft && (
                <button
                  type="button"
                  onClick={handleFrameSizeSubmit}
                  className="mt-3 px-4 py-2 rounded-xl bg-gray-900 text-sm font-bold text-white hover:bg-gray-700"
                >
                  Рам №/Хэмжээ хадгалах
                </button>
              )}
            </div>
            <SortEntryForm sizeMm={record.sort1SizeMm} dualMode={record.specialDualMode} initialValues={record} onSubmit={handleSortSubmit} />
          </div>
        )}

        {showReadOnly && <SortRecordReadOnly data={record} />}
      </div>
    </div>
  );
}
