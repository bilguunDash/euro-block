'use client';

import { useState } from 'react';
import { SORT_AUTOCLAVE_CHOICES, SORT_DEFECT_CODES, SORT_SHIFT_CHOICES, SORT_SIZE_CHOICES } from '@/lib/sort-form-options';
import { toUlaanbaatarLocalInput, validateRamHeaderRequired } from '@/lib/sort-work-calc';

// shiftNo талбар зориуд байхгүй — хуучин систем shift_no-г үргэлж Ц.дугаартай
// тэнцүү илгээдэг байсан тул API талдаа headerCNumber-ээс автоматаар оноодог.
export type RamHeaderValues = {
  headerCNumber: string;
  headerPoured: string;
  pouredAt: string;
  headerCut: string;
  cutAt: string;
  autoclaveNo: string;
  sort1FrameNo: string;
  sort1SizeMm: string;
  sort1Desc: string;
  ramDefectCode: string;
};

const EMPTY_VALUES: RamHeaderValues = {
  headerCNumber: '',
  headerPoured: '',
  pouredAt: '',
  headerCut: '',
  cutAt: '',
  autoclaveNo: '',
  sort1FrameNo: '',
  sort1SizeMm: '',
  sort1Desc: '',
  ramDefectCode: '',
};

/** `datetime-local` талбарууд — сервер ISO мөрөөр буцаадаг тул хөрвүүлж оруулна. */
const TIME_KEYS: ReadonlyArray<keyof RamHeaderValues> = ['pouredAt', 'cutAt'];

/** Record объектоос зөвхөн энэ формын талбаруудыг авна (илүүдэл түлхүүр state-д орохгүй). */
function pickInitial(initialValues?: Partial<RamHeaderValues>): RamHeaderValues {
  const values = { ...EMPTY_VALUES };
  if (initialValues) {
    for (const key of Object.keys(EMPTY_VALUES) as Array<keyof RamHeaderValues>) {
      const v = initialValues[key];
      if (TIME_KEYS.includes(key)) {
        // Сервер `2026-09-15T02:10:00.000Z` өгдөг; `datetime-local` нь `2026-09-15T10:10`
        // хэлбэрийг л уншина — хөрвүүлэхгүй бол талбар ХООСОН харагдана.
        values[key] = toUlaanbaatarLocalInput(v as string | null | undefined);
        continue;
      }
      if (typeof v === 'string') values[key] = v;
    }
  }
  return values;
}

interface RamHeaderFormProps {
  initialValues?: Partial<RamHeaderValues>;
  onSubmit: (values: RamHeaderValues) => Promise<void> | void;
  submitLabel?: string;
  disabled?: boolean;
}

export function RamHeaderForm({ initialValues, onSubmit, submitLabel = 'Сорт руу илгээх', disabled }: RamHeaderFormProps) {
  const [values, setValues] = useState<RamHeaderValues>(() => pickInitial(initialValues));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof RamHeaderValues>(key: K, value: RamHeaderValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Хуучин клиентийн validate_u1-тэй ижил: дутуу талбартай бол илгээхгүй.
    const check = validateRamHeaderRequired(values);
    if (!check.ok) {
      setError(check.error!);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all';
  const labelClass = 'text-xs font-bold text-gray-500 uppercase';
  const req = <span className="text-red-500"> *</span>;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-xs text-gray-400">
        <span className="text-red-500">*</span> тэмдэгтэй талбарыг заавал бөглөнө
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label className={labelClass}>Ц.дугаар{req}</label>
          <input
            value={values.headerCNumber}
            onChange={(e) => set('headerCNumber', e.target.value)}
            className={inputClass}
            placeholder="Батчийн Ц.дугаар"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <label className={labelClass}>Цутгасан ээлж{req}</label>
          <select value={values.headerPoured} onChange={(e) => set('headerPoured', e.target.value)} className={inputClass} disabled={disabled}>
            {SORT_SHIFT_CHOICES.map((s) => (
              <option key={s} value={s}>{s || 'Сонгоно уу'}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className={labelClass}>Цутгасан цаг</label>
          <input
            type="datetime-local"
            value={values.pouredAt}
            onChange={(e) => set('pouredAt', e.target.value)}
            className={inputClass}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <label className={labelClass}>Зүссэн ээлж{req}</label>
          <select value={values.headerCut} onChange={(e) => set('headerCut', e.target.value)} className={inputClass} disabled={disabled}>
            {SORT_SHIFT_CHOICES.map((s) => (
              <option key={s} value={s}>{s || 'Сонгоно уу'}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className={labelClass}>Зүссэн цаг</label>
          <input
            type="datetime-local"
            value={values.cutAt}
            onChange={(e) => set('cutAt', e.target.value)}
            className={inputClass}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <label className={labelClass}>Автоклав{req}</label>
          <select value={values.autoclaveNo} onChange={(e) => set('autoclaveNo', e.target.value)} className={inputClass} disabled={disabled}>
            {SORT_AUTOCLAVE_CHOICES.map((s) => (
              <option key={s} value={s}>{s || 'Сонгоно уу'}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className={labelClass}>Рамын дугаар{req}</label>
          <input
            value={values.sort1FrameNo}
            onChange={(e) => set('sort1FrameNo', e.target.value)}
            className={inputClass}
            placeholder="Жишээ: Р-12"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <label className={labelClass}>Хэмжээ{req}</label>
          <select value={values.sort1SizeMm} onChange={(e) => set('sort1SizeMm', e.target.value)} className={inputClass} disabled={disabled}>
            <option value="">Сонгоно уу</option>
            {SORT_SIZE_CHOICES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <label className={labelClass}>Алдааны код (заавал биш)</label>
        <select
          value={values.ramDefectCode}
          onChange={(e) => set('ramDefectCode', e.target.value)}
          className={inputClass}
          disabled={disabled}
        >
          {SORT_DEFECT_CODES.map((c) => (
            <option key={c} value={c}>{c || 'Сонгохгүй'}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label className={labelClass}>Тайлбар</label>
        <textarea
          value={values.sort1Desc}
          onChange={(e) => set('sort1Desc', e.target.value)}
          className={`${inputClass} min-h-[80px]`}
          disabled={disabled}
        />
      </div>
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={disabled || submitting}
        className="w-full py-4 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-100 disabled:opacity-50"
      >
        {submitting ? 'Илгээж байна...' : submitLabel}
      </button>
    </form>
  );
}
