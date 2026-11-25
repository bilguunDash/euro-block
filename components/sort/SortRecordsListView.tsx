'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronLeft, ChevronRight, Download, RefreshCw, RotateCcw } from 'lucide-react';
import { HorizontalPagedList } from '@/components/dashboard/HorizontalPagedList';
import { sortStatusLabel } from '@/lib/sort-status-labels';
import { SORT_AUTOCLAVE_CHOICES, SORT_SHIFT_CHOICES, SORT_SIZE_CHOICES } from '@/lib/sort-form-options';

/**
 * Excel татах сонголтууд. Хоёр тусдаа товч байсныг нэг цэс болгож нэгтгэв —
 * уламжлалт маягт нь хос горимд (600x250x200 + 600x250x100) м³-г НИЙЛБЭРЭЭР
 * гаргадаг тул задаргаа хэрэгтэй үед «200/100 задаргаа»-г сонгоно.
 */
const EXPORT_FORMATS = [
  { value: 'standard', label: 'Уламжлалт маягт', hint: 'Үйлдвэрийн хэвлэмэл маягттай ижил багана' },
  { value: 'dual', label: '200/100 задаргаа', hint: '600x250x200 ба 600x250x100-ийн тоо, м³ тусад нь' },
] as const;

const EXPORT_DUAL_OPTIONS = [
  { value: '', label: 'Бүгд' },
  { value: 'only', label: 'Зөвхөн хос горим' },
  { value: 'none', label: 'Зөвхөн энгийн бүртгэл' },
];

// Улаанбаатарын цагаар: Өдөр 08:00–20:00, Шөнө 20:00–08:00 (маргааш өглөө хүртэл).
// Хуучин десктоп аппын cb_shift-тэй ижил. Огноогүйгээр сонговол бүх өдрүүдээс
// тухайн цагийн цонхонд тохирох бүртгэлийг шүүнэ (server: buildSortRecordsRawFilter).
const SHIFT_FILTER_OPTIONS = [
  { value: '', label: 'Бүтэн өдөр' },
  { value: 'day', label: 'Өдөр (08:00–20:00)' },
  { value: 'night', label: 'Шөнө (20:00–08:00)' },
];

// Хадгалагдах бүтэц (нэг Огноо → хугацааны интервал) өөрчлөгдсөн тул key-г v2 болгов —
// хуучин v1 payload хүчингүй, харгалзахгүй.
const FILTERS_STORAGE_KEY = 'sort-records-filters-v2';

/** Хугацааны интервал: Эхлэх / Дуусах огноо (хоосон = хязгааргүй). */
type DateRange = { from: string; to: string };

type StoredFilters = { status: string; frameNo: string; range: DateRange; shift: string; autoclave: string; headerPoured: string };

/**
 * Одоо явж буй ээлжийн огноо + Өдөр/Шөнө (Улаанбаатар UTC+8, DST-гүй).
 * Шөнийн ээлж шөнө дундыг давдаг тул 08:00-аас өмнө бол "өчигдрийн шөнийн ээлж".
 */
function currentShiftDefaults(): { date: string; shift: 'day' | 'night' } {
  const ubNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const hour = ubNow.getUTCHours();
  const shift: 'day' | 'night' = hour >= 8 && hour < 20 ? 'day' : 'night';
  const anchor = shift === 'night' && hour < 8 ? new Date(ubNow.getTime() - 24 * 60 * 60 * 1000) : ubNow;
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${anchor.getUTCFullYear()}-${p(anchor.getUTCMonth() + 1)}-${p(anchor.getUTCDate())}`,
    shift,
  };
}

/**
 * Анхдагч: одоогийн ээлж (өнөөдрийн огноо + Өдөр/Шөнө) — бүх бүртгэл биш, зөвхөн
 * тухайн ээлжийнх харагдана. Хэрэглэгчийн өөрчилсөн шүүлтүүр sessionStorage-д
 * хадгалагдаж, бүртгэл рүү орж буцахад (компонент дахин үүсэхэд) арилахгүй.
 */
function loadInitialFilters(): StoredFilters {
  const defaults = currentShiftDefaults();
  const base: StoredFilters = {
    status: '',
    frameNo: '',
    range: { from: defaults.date, to: defaults.date },
    shift: defaults.shift,
    autoclave: '',
    headerPoured: '',
  };
  if (typeof window === 'undefined') return base;
  try {
    const raw = window.sessionStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    const range = parsed.range && typeof parsed.range === 'object' ? parsed.range : null;
    return {
      status: typeof parsed.status === 'string' ? parsed.status : base.status,
      frameNo: typeof parsed.frameNo === 'string' ? parsed.frameNo : base.frameNo,
      range: {
        from: range && typeof range.from === 'string' ? range.from : base.range.from,
        to: range && typeof range.to === 'string' ? range.to : base.range.to,
      },
      shift: typeof parsed.shift === 'string' ? parsed.shift : base.shift,
      autoclave: typeof parsed.autoclave === 'string' ? parsed.autoclave : base.autoclave,
      headerPoured: typeof parsed.headerPoured === 'string' ? parsed.headerPoured : base.headerPoured,
    };
  } catch {
    return base;
  }
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store', credentials: 'include' });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Failed to load');
  return data;
};

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Идэвхтэй бүх бүртгэл' },
  { value: 'waiting_sort', label: 'Хүлээгдэж байна' },
  { value: 'completed', label: 'Дууссан' },
  { value: 'deleted', label: 'Устгасан' },
  { value: 'all', label: 'Бүгд (устгасан оролцуулан)' },
];

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black ${
      status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'deleted' ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'
    }`}>
      {sortStatusLabel(status)}
    </span>
  );
}

export function SortRecordsListView() {
  const router = useRouter();
  // Lazy initializer: sessionStorage-ийг mount үед НЭГ л удаа уншина. Ref-ийг render үед
  // уншихаас (react-hooks/refs) ялгаатай нь state-ийг render үед унших нь зөв.
  const [initial] = useState(loadInitialFilters);
  const [status, setStatus] = useState(initial.status);
  const [frameNo, setFrameNo] = useState(initial.frameNo);
  // Эхлэх/Дуусах огноог ЗОРИУДААР нэг объект state-ээр барив: эсрэг интервалын
  // залруулгыг нэг setRange(prev => …)-аар атомаар хийнэ.
  const [range, setRange] = useState(initial.range);
  const [shift, setShift] = useState(initial.shift);
  const [autoclave, setAutoclave] = useState(initial.autoclave);
  const [headerPoured, setHeaderPoured] = useState(initial.headerPoured);

  // Серверийн "багц" хуудас (RECORDS_PAGE_LIMIT хэмжээтэй блок) — доорх
  // HorizontalPagedList-ийн дотоод 20 мөрийн клиент хуудаслалтаас ЯЛГААТАЙ тусдаа
  // ойлголт. Санаатайгаар ТУЙЛ утгаар эхэлнэ (initial.xxx-ээс биш).
  const [serverPage, setServerPage] = useState(1);
  const RECORDS_PAGE_LIMIT = 200;

  // Excel татах цэс — жагсаалтын шүүлтүүрээс ТУСДАА (татахад л хамаарна).
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<string>('standard');
  const [exportSize, setExportSize] = useState('');
  const [exportDual, setExportDual] = useState('');
  const exportRef = useRef<HTMLDivElement | null>(null);

  // Цэсний гадуур дарах / Esc дарахад хаана.
  useEffect(() => {
    if (!exportOpen) return;
    const onDown = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [exportOpen]);

  useEffect(() => {
    // Шүүлтүүр өөрчлөгдөх бүрт серверийн багц хуудсыг 1 рүү буцаана — эс бөгөөс
    // хуучин хуудсан дээр зогсож байхад огт өөр шүүлтэд тохирохгүй мөрүүд ачаалагдана.
    // АНХААР: `serverPage`-г dependency-д бүү нэм — нэмбэл "Дараагийн" товч дарах бүрд
    // өөрөө даруй 1 рүү буцаж, хуудаслалт огт ажиллахгүй болно.
    setServerPage(1);
    try {
      window.sessionStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({ status, frameNo, range, shift, autoclave, headerPoured } satisfies StoredFilters)
      );
    } catch {
      // sessionStorage боломжгүй бол (private mode гэх мэт) шүүлтүүр хадгалагдахгүй л болно.
    }
  }, [status, frameNo, range, shift, autoclave, headerPoured]);

  // Эсрэг интервал (Эхлэх > Дуусах) бүрмөсөн боломжгүй байх ёстой: min/max нь бүх
  // browser-т ГАР бичвэрийг блоклодоггүй тул state-ийн түвшинд нөгөө хязгаарыг татна.
  // Хоосон утга хэзээ ч залруулга хийхгүй (= тэр талдаа хязгаар тавихгүй гэсэн үг).
  const setRangeFrom = (value: string) =>
    setRange((prev) => ({ from: value, to: value && prev.to && prev.to < value ? value : prev.to }));
  const setRangeTo = (value: string) =>
    setRange((prev) => ({ from: value && prev.from && prev.from > value ? value : prev.from, to: value }));

  const resetToCurrentShift = () => {
    const defaults = currentShiftDefaults();
    setStatus('');
    setFrameNo('');
    setRange({ from: defaults.date, to: defaults.date });
    setShift(defaults.shift);
    setAutoclave('');
    setHeaderPoured('');
  };

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (status === 'all') params.set('includeDeleted', 'true');
  if (frameNo.trim()) params.set('frameNo', frameNo.trim());
  // Хоёр хязгаар ижил (эсвэл «Одоогийн ээлж») бол хуучин `date=`-аар илгээнэ — ээлжийн
  // цонхны логик (шөнө дундыг давах) яг хэвээр. Ялгаатай/хагас бол шинэ dateFrom/dateTo.
  // `date` ба `dateFrom`/`dateTo`-г ХЭЗЭЭ Ч хамт илгээхгүй.
  if (range.from && range.to) {
    if (range.from === range.to) {
      params.set('date', range.from);
    } else {
      params.set('dateFrom', range.from);
      params.set('dateTo', range.to);
    }
  } else if (range.from) {
    params.set('dateFrom', range.from);
  } else if (range.to) {
    params.set('dateTo', range.to);
  }
  if (shift) params.set('shift', shift);
  if (autoclave) params.set('autoclave', autoclave);
  if (headerPoured) params.set('headerPoured', headerPoured);
  params.set('limit', String(RECORDS_PAGE_LIMIT));
  params.set('page', String(serverPage));

  // Татах холбоос: жагсаалтын шүүлтүүр + цэсэн дэх нэмэлт сонголтууд.
  // `limit`/`page` нь зөвхөн жагсаалтын хуудаслалтад хамаарна — экспорт бүх мөрийг авна.
  const exportParams = new URLSearchParams(params);
  exportParams.delete('limit');
  exportParams.delete('page');
  if (exportSize) exportParams.set('sizeMm', exportSize);
  if (exportDual) exportParams.set('dual', exportDual);

  const { data, isLoading, mutate } = useSWR(`/api/sort/records?${params.toString()}`, fetcher, {
    refreshInterval: 15000,
    onSuccess: (d) => {
      const pages = Math.max(1, Math.ceil((d?.total ?? 0) / RECORDS_PAGE_LIMIT));
      setServerPage((p) => (p > pages ? pages : p));
    },
  });
  const records: any[] = data?.data || [];
  const recordsTotal: number = typeof data?.total === 'number' ? data.total : 0;
  const totalServerPages = Math.max(1, Math.ceil(recordsTotal / RECORDS_PAGE_LIMIT));

  return (
    // `overflow-hidden` нь ЗӨВХӨН доод хэсэгт (хүснэгт) байна — эс бөгөөс энэ түвшинд
    // тавихад Excel татах цэсний `absolute` dropdown доод хэсэгтээ тасрагдана
    // (rounded-3xl булангийн доторлуулга-с давж гарахгүй тул).
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-100 space-y-4">
        {/* Мөр 1 — шүүлтүүрүүд */}
        <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-gray-500 uppercase">Төлөв</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-gray-500 uppercase">Эхлэх огноо</label>
          <input
            type="date"
            value={range.from}
            max={range.to || undefined}
            onChange={(e) => setRangeFrom(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
          />
        </div>
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-gray-500 uppercase">Дуусах огноо</label>
          <input
            type="date"
            value={range.to}
            min={range.from || undefined}
            onChange={(e) => setRangeTo(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
          />
        </div>
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-gray-500 uppercase">Ээлж</label>
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
          >
            {SHIFT_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-gray-500 uppercase">Автоклав</label>
          <select
            value={autoclave}
            onChange={(e) => setAutoclave(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
          >
            <option value="">Бүх автоклав</option>
            {SORT_AUTOCLAVE_CHOICES.filter(Boolean).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-gray-500 uppercase">Цутгасан</label>
          <select
            value={headerPoured}
            onChange={(e) => setHeaderPoured(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
          >
            <option value="">Бүх цутгасан ээлж</option>
            {SORT_SHIFT_CHOICES.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-gray-500 uppercase">Рамын дугаар</label>
          <input
            value={frameNo}
            onChange={(e) => setFrameNo(e.target.value)}
            placeholder="Хайх..."
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
          />
        </div>
        </div>

        {/* Мөр 2 — үйлдлүүд */}
        <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => mutate()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Шинэчлэх
        </button>
        <button
          type="button"
          onClick={resetToCurrentShift}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orange-200 bg-orange-50 text-sm font-bold text-orange-700 hover:bg-orange-100"
        >
          <RotateCcw className="w-4 h-4" />
          Одоогийн ээлж
        </button>
        <div className="relative" ref={exportRef}>
          <button
            type="button"
            onClick={() => setExportOpen((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Excel татах
            <ChevronDown className={`w-4 h-4 transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
          </button>

          {exportOpen && (
            <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-gray-500">Маягт</p>
                {EXPORT_FORMATS.map((f) => (
                  <label key={f.value} className="flex cursor-pointer items-start gap-2.5 rounded-xl p-2 hover:bg-gray-50">
                    <input
                      type="radio"
                      name="export-format"
                      value={f.value}
                      checked={exportFormat === f.value}
                      onChange={() => setExportFormat(f.value)}
                      className="mt-1 accent-orange-600"
                    />
                    <span>
                      <span className="block text-sm font-bold text-gray-900">{f.label}</span>
                      <span className="block text-xs text-gray-500">{f.hint}</span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-gray-500">Хэмжээ</label>
                <select
                  value={exportSize}
                  onChange={(e) => setExportSize(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Бүх хэмжээ</option>
                  {SORT_SIZE_CHOICES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-gray-500">Хос горим</label>
                <select
                  value={exportDual}
                  onChange={(e) => setExportDual(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {EXPORT_DUAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600">
                Дээрх шүүлтүүр (хугацаа, ээлж, автоклав, цутгасан, рам №, төлөв) мөн хамаарна.
                <br />
                Татагдах: <span className="font-bold text-gray-900">{data?.total ?? '—'}</span> бүртгэлээс шүүсэн хэсэг.
              </p>

              <a
                href={`${exportFormat === 'dual' ? '/api/sort/records/export-dual' : '/api/sort/records/export'}?${exportParams.toString()}`}
                onClick={() => setExportOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700"
              >
                <Download className="w-4 h-4" />
                Татах
              </a>
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {recordsTotal > RECORDS_PAGE_LIMIT ? (
            <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
              <button
                type="button"
                onClick={() => setServerPage((p) => Math.max(1, p - 1))}
                disabled={serverPage <= 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Өмнөх 200"
                title="Өмнөх 200"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>
                {(serverPage - 1) * RECORDS_PAGE_LIMIT + 1}–{Math.min(serverPage * RECORDS_PAGE_LIMIT, recordsTotal)} / {recordsTotal} бүртгэл
              </span>
              <button
                type="button"
                onClick={() => setServerPage((p) => Math.min(totalServerPages, p + 1))}
                disabled={serverPage >= totalServerPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Дараагийн 200"
                title="Дараагийн 200"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="text-sm font-bold text-gray-500">
              Нийт: {data?.total ?? '—'}
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Доод хэсэгт л overflow-hidden — ингэснээр мөрийн hover фон rounded-3xl-ийн
          доод буланг давахгүй, харин дээрх шүүлтүүрийн мөрийн dropdown чөлөөтэй гарна. */}
      <div className="overflow-hidden rounded-b-3xl">
      <HorizontalPagedList
        items={records}
        pageSize={20}
        renderPage={(page) => (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] table-fixed text-left">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider">
                  <th className="w-[13%] px-4 py-3 font-bold">Үүсгэсэн</th>
                  <th className="w-[10%] px-4 py-3 font-bold">Ц.дугаар</th>
                  <th className="w-[10%] px-4 py-3 font-bold">Цутгасан</th>
                  <th className="w-[9%] px-4 py-3 font-bold">Автоклав</th>
                  <th className="w-[10%] px-4 py-3 font-bold">Рам №</th>
                  <th className="w-[11%] px-4 py-3 font-bold">Хэмжээ</th>
                  <th className="w-[14%] px-4 py-3 font-bold">Тайлбар</th>
                  <th className="w-[8%] px-4 py-3 font-bold whitespace-nowrap">Нийт м³</th>
                  <th className="w-[11%] px-4 py-3 font-bold">Төлөв</th>
                  <th className="w-[4%] px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400">Ачаалж байна...</td></tr>
                ) : page.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                      Бүртгэл олдсонгүй.
                      <span className="block mt-1 text-xs">Шүүлтүүрээ өөрчилж үзнэ үү.</span>
                    </td>
                  </tr>
                ) : (
                  page.map((r) => {
                    const totalM3 = (r.sort1M3 || 0) + (r.sort2M3 || 0) + (r.sort3M3 || 0) + (r.deficitM3 || 0);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => router.push(`/sort-registration/${r.id}`)}
                        className="hover:bg-orange-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-4 text-sm text-gray-600">
                          <Link href={`/sort-registration/${r.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                            {fmtDateTime(r.createdAt)}
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-sm font-bold text-gray-900">{r.headerCNumber || '—'}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{r.headerPoured || '—'}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{r.autoclaveNo || '—'}</td>
                        <td className="px-4 py-4 text-sm font-bold text-gray-900">{r.sort1FrameNo || '—'}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{r.sort1SizeMm || '—'}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          <p className="truncate" title={r.sort1Desc || undefined}>{r.sort1Desc || '—'}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">{totalM3 > 0 ? totalM3.toFixed(3) : '—'}</td>
                        <td className="px-4 py-4">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-4 text-right text-gray-300 text-sm">›</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      />
      </div>
    </div>
  );
}
