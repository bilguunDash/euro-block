'use client';

import type { IngredientChangeRecordPayload } from '@/lib/ingredient-change-record-form';
import { INGREDIENT_CHANGE_ATTENTION } from '@/lib/ingredient-change-record-form';
import { FlaskConical, AlertTriangle } from 'lucide-react';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

export function IngredientChangeRecordReadOnly({ data }: { data: IngredientChangeRecordPayload }) {
  return (
    <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-orange-50/40">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-orange-600" />
          Бүтээгдэхүүний орц найрлага өөрчилсөн бүртгэл (хадгалсан)
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {data.shiftDate} · {data.shiftType}
          {data.submittedAt ? ` · Илгээсэн: ${new Date(data.submittedAt).toLocaleString()}` : ''}
        </p>
      </div>
      <div className="p-4 md:p-6 space-y-6 max-h-[720px] overflow-y-auto text-sm">
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 flex gap-3 items-start"
          role="status"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 border border-amber-200/80">
            <AlertTriangle className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800/90 mb-0.5">Анхаарах</p>
            <p className="text-sm text-amber-950 leading-relaxed">{INGREDIENT_CHANGE_ATTENTION}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="text-xs border border-gray-200 min-w-[560px] w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-200 px-2 py-1 w-10">д/д</th>
                <th className="border border-gray-200 px-2 py-1 text-left">Түүхий эд</th>
                <th className="border border-gray-200 px-2 py-1">Орц</th>
                <th className="border border-gray-200 px-2 py-1">Өөрчилсөн орц</th>
              </tr>
            </thead>
            <tbody>
              {(data.rows ?? []).map((r, idx) => (
                <tr key={r.key}>
                  <td className="border border-gray-100 px-2 py-1 text-gray-500">{idx + 1}</td>
                  <td className="border border-gray-100 px-2 py-1">{r.label}</td>
                  <td className="border border-gray-100 px-2 py-1">{r.originalValue?.trim() || '—'}</td>
                  <td className="border border-gray-100 px-2 py-1">{r.changedValue?.trim() || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.explanation?.trim() ? (
          <div>
            <p className="font-bold text-gray-800 mb-1">Тайлбар</p>
            <p className="text-gray-700 whitespace-pre-wrap">{data.explanation}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border-t border-gray-100 pt-4">
          <div>
            <p className="text-gray-500 font-bold uppercase mb-2">Орц найрлага өөрчилсөн</p>
            <p className="text-gray-500">Оператор</p>
            <p className="text-gray-900 mb-2">{data.sigOperator || '—'}</p>
            <p className="text-gray-500">Технологич инженер</p>
            <p className="text-gray-900">{data.sigTechnologistEngineer || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 font-bold uppercase mb-2">Хянасан</p>
            <p className="text-gray-500">Ерөнхий технологич</p>
            <p className="text-gray-900 mb-2">{data.sigChiefTechnologist || '—'}</p>
            <p className="text-gray-500">Чанарын мэргэжилтэн</p>
            <p className="text-gray-900">{data.sigQualitySpecialist || '—'}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 md:px-6 md:pb-6">
        <EnvironmentCheckSection rows={(data as any)?.environmentChecks} readOnly />
      </div>
    </section>
  );
}
