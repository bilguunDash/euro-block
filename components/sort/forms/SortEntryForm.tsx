'use client';

import { useMemo, useState } from 'react';
import { SORT_DEFECT_CODES } from '@/lib/sort-form-options';
import { computeTotalM3, TOTAL_M3, updateSortTotals, validateTotalM3, type SortCountsInput } from '@/lib/sort-work-calc';

const EMPTY_COUNTS: SortCountsInput = {
  sort1Qty: 0, sort1Qty200: 0, sort1Qty100: 0,
  sort2Code: '', sort2Qty: 0, sort2Qty200: 0, sort2Qty100: 0, sort2Desc: '',
  sort3Code: '', sort3Qty: 0, sort3Qty200: 0, sort3Qty100: 0, sort3Desc: '',
  deficitQty: 0, deficitQty200: 0, deficitQty100: 0, deficitDesc: '',
};

const INPUT_CLASS = 'w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all';

type Grade = 'sort1' | 'sort2' | 'sort3' | 'deficit';

const DUAL_QTY_FIELDS: Array<keyof SortCountsInput> = [
  'sort1Qty', 'sort1Qty200', 'sort1Qty100',
  'sort2Qty', 'sort2Qty200', 'sort2Qty100',
  'sort3Qty', 'sort3Qty200', 'sort3Qty100',
  'deficitQty', 'deficitQty200', 'deficitQty100',
];

/** Port of _u2_fields_are_empty: бүх грейдийн тоо хоосон эсэх (шинэ, хараахан ороогүй бүртгэл). */
function isAllQtyEmpty(values: SortCountsInput): boolean {
  return DUAL_QTY_FIELDS.every((key) => !values[key]);
}

/** Record объектоос зөвхөн тооны талбаруудыг авна (илүүдэл түлхүүр state-д орохгүй). */
function pickInitial(initialValues: Partial<SortCountsInput> | undefined, dualMode: boolean): SortCountsInput {
  const values = { ...EMPTY_COUNTS };
  if (initialValues) {
    for (const key of Object.keys(EMPTY_COUNTS) as Array<keyof SortCountsInput>) {
      const v = initialValues[key];
      if (v != null) (values as any)[key] = v;
    }
  }
  // Port of _apply_dual_defaults_if_needed: dual mode-той шинэ бүртгэл дээр
  // I-р сортод стандарт 168/24-г урьдчилж бөглөнө (нэг рам = 168 x 600x250x200 +
  // 24 x 600x250x100). 2,3-р сорт/дутагдал байвал оператор эндээс шилжүүлж бичнэ.
  if (dualMode && isAllQtyEmpty(values)) {
    values.sort1Qty200 = 168;
    values.sort1Qty100 = 24;
  }
  return values;
}

// Модулийн түвшинд тодорхойлсон — parent доторх function component render бүрт
// шинэ төрөл болж input-ууд remount хийгдэн товч дарах бүрт focus алдагддаг байсан.
function QtyFields({ grade, dualMode, values, onQtyChange, disabled }: {
  grade: Grade;
  dualMode: boolean;
  values: SortCountsInput;
  onQtyChange: (key: keyof SortCountsInput) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}) {
  if (dualMode) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase">600x250x200 тоо (нийт 168)</label>
          <input type="number" min={0} value={values[`${grade}Qty200`] ?? 0} onChange={onQtyChange(`${grade}Qty200`)} className={INPUT_CLASS} disabled={disabled} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase">600x250x100 тоо (нийт 24)</label>
          <input type="number" min={0} value={values[`${grade}Qty100`] ?? 0} onChange={onQtyChange(`${grade}Qty100`)} className={INPUT_CLASS} disabled={disabled} />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-gray-400 uppercase">Тоо</label>
      <input type="number" min={0} value={values[`${grade}Qty`] ?? 0} onChange={onQtyChange(`${grade}Qty`)} className={INPUT_CLASS} disabled={disabled} />
    </div>
  );
}

interface SortEntryFormProps {
  sizeMm: string;
  dualMode: boolean;
  initialValues?: Partial<SortCountsInput>;
  onSubmit: (values: SortCountsInput) => Promise<void> | void;
  disabled?: boolean;
}

export function SortEntryForm({ sizeMm, dualMode, initialValues, onSubmit, disabled }: SortEntryFormProps) {
  const [values, setValues] = useState<SortCountsInput>(() => pickInitial(initialValues, dualMode));
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof SortCountsInput>(key: K, value: SortCountsInput[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const setNum = (key: keyof SortCountsInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Math.max(0, Math.trunc(Number(e.target.value) || 0));
    set(key, n as any);
  };

  const preview = useMemo(() => {
    const totals = updateSortTotals(sizeMm, dualMode, values);
    const totalM3 = computeTotalM3(totals);
    return { totalM3, check: validateTotalM3(totalM3) };
  }, [sizeMm, dualMode, values]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {dualMode && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-700">
          Хосолсон хэмжээ (600x250x200): нэг рамаас стандартаар 200-хэмжээ <b>168 шир</b> (5.04 м³) +
          100-хэмжээ <b>24 шир</b> (0.36 м³) = 5.4 м³ гардаг. Грейд бүрд 200 болон 100-гийн тоог тусад нь оруулна.
        </div>
      )}
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <h4 className="text-sm font-bold text-gray-900">I-р сорт</h4>
        <QtyFields grade="sort1" dualMode={dualMode} values={values} onQtyChange={setNum} disabled={disabled} />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <h4 className="text-sm font-bold text-gray-900">II-р сорт</h4>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase">Код</label>
          <select value={values.sort2Code} onChange={(e) => set('sort2Code', e.target.value)} className={INPUT_CLASS} disabled={disabled}>
            {SORT_DEFECT_CODES.map((c) => (
              <option key={c} value={c}>{c || 'Сонгоно уу'}</option>
            ))}
          </select>
        </div>
        <QtyFields grade="sort2" dualMode={dualMode} values={values} onQtyChange={setNum} disabled={disabled} />
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase">Тайлбар</label>
          <input value={values.sort2Desc} onChange={(e) => set('sort2Desc', e.target.value)} className={INPUT_CLASS} disabled={disabled} />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <h4 className="text-sm font-bold text-gray-900">III-р сорт</h4>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase">Код</label>
          <select value={values.sort3Code} onChange={(e) => set('sort3Code', e.target.value)} className={INPUT_CLASS} disabled={disabled}>
            {SORT_DEFECT_CODES.map((c) => (
              <option key={c} value={c}>{c || 'Сонгоно уу'}</option>
            ))}
          </select>
        </div>
        <QtyFields grade="sort3" dualMode={dualMode} values={values} onQtyChange={setNum} disabled={disabled} />
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase">Тайлбар</label>
          <input value={values.sort3Desc} onChange={(e) => set('sort3Desc', e.target.value)} className={INPUT_CLASS} disabled={disabled} />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <h4 className="text-sm font-bold text-gray-900">Дутагдал</h4>
        <QtyFields grade="deficit" dualMode={dualMode} values={values} onQtyChange={setNum} disabled={disabled} />
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase">Тайлбар</label>
          <input value={values.deficitDesc} onChange={(e) => set('deficitDesc', e.target.value)} className={INPUT_CLASS} disabled={disabled} />
        </div>
      </div>

      <div className={`rounded-2xl border p-4 flex items-center justify-between ${preview.check.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
        <div>
          <p className={`text-sm font-bold ${preview.check.ok ? 'text-emerald-700' : 'text-red-700'}`}>
            Нийт: {preview.totalM3.toFixed(3)} м³ / {TOTAL_M3} м³
          </p>
          {!preview.check.ok && <p className="text-xs text-red-600 mt-1">{preview.check.error}</p>}
        </div>
      </div>

      <button
        type="submit"
        disabled={disabled || submitting || !preview.check.ok}
        className="w-full py-4 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-100 disabled:opacity-50"
      >
        {submitting ? 'Хадгалж байна...' : 'Дуусгах'}
      </button>
    </form>
  );
}
