'use client';

import type { Y170TrolleyRotationHandoverPayload } from '@/lib/y170-trolley-rotation-handover-form';
import {
  Y170_PRODUCT_ATTENTION,
  Y170_EQUIPMENT_COMMENT_ONLY_KEYS,
  Y170_EQUIPMENT_LABELS,
} from '@/lib/y170-trolley-rotation-handover-form';
import { ClipboardList, AlertTriangle } from 'lucide-react';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

function badge(s: string) {
  if (s === 'normal') return <span className="text-emerald-700 font-bold">Хэвийн (+)</span>;
  if (s === 'abnormal') return <span className="text-red-700 font-bold">Хэвийн бус (−)</span>;
  return <span className="text-gray-400">—</span>;
}

export function Y170HandoverFormReadOnly({ data }: { data: Y170TrolleyRotationHandoverPayload }) {
  const savedEquipment = Array.isArray(data.equipmentInspections) ? data.equipmentInspections : [];
  const equipmentByKey = new Map(savedEquipment.map((r) => [String(r?.key ?? ''), r]));
  const equipmentInspections = Y170_EQUIPMENT_LABELS.map((row) => {
    const saved = equipmentByKey.get(row.key);
    return {
      ...row,
      status: saved?.status ?? '',
      comment: saved?.comment ?? '',
    };
  });

  return (
    <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-orange-50/40">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-orange-600" />
          ҮЯ-161 — Тэргэнцэр эргэлтийн бүртгэл (хадгалсан)
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {data.shiftDate} · {data.shiftType}
          {data.submittedAt ? ` · Илгээсэн: ${new Date(data.submittedAt).toLocaleString()}` : ''}
        </p>
      </div>
      <div className="p-4 md:p-6 space-y-6 max-h-[720px] overflow-y-auto text-sm">
        <div>
          <p className="font-bold text-gray-800 mb-2">Тоног төхөөрөмжийн ажиллагаа</p>
          <ul className="space-y-2 border rounded-xl divide-y divide-gray-100">
            {equipmentInspections.map((r, i) => {
              const commentOnly = Y170_EQUIPMENT_COMMENT_ONLY_KEYS.has(r.key);
              return (
                <li key={r.key} className="px-3 py-2 flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-gray-700">
                    {i + 1}. {r.label}
                  </span>
                  <span className="flex flex-wrap gap-3">
                    {commentOnly ? null : badge(r.status)}
                    {r.comment?.trim() ? (
                      <span className="text-gray-600 whitespace-pre-wrap">{r.comment}</span>
                    ) : commentOnly ? (
                      <span className="text-gray-400">—</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div
          className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 flex gap-3 items-start"
          role="status"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 border border-amber-200/80">
            <AlertTriangle className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800/90 mb-0.5">Анхаарах</p>
            <p className="text-sm font-bold text-amber-950 leading-snug">{Y170_PRODUCT_ATTENTION}</p>
          </div>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-3">Бүтээгдэхүүн бүртгэл</p>
          <div className="overflow-x-auto">
            <table className="text-xs border border-gray-200 min-w-[800px] w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-2 py-1" rowSpan={2}>
                    №
                  </th>
                  <th className="border border-gray-200 px-2 py-1" rowSpan={2}>
                    Цутгалтын дугаар
                  </th>
                  <th className="border border-gray-200 px-2 py-1 text-center" colSpan={2}>
                    Ээлж
                  </th>
                  <th className="border border-gray-200 px-2 py-1" rowSpan={2}>
                    Рам
                  </th>
                  <th className="border border-gray-200 px-2 py-1" rowSpan={2}>
                    600×250
                  </th>
                  <th className="border border-gray-200 px-2 py-1" rowSpan={2}>
                    Төлөв
                  </th>
                  <th className="border border-gray-200 px-2 py-1" rowSpan={2}>
                    Тайлбар
                  </th>
                </tr>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-2 py-1">Цутгасан</th>
                  <th className="border border-gray-200 px-2 py-1">Зүссэн</th>
                </tr>
              </thead>
              <tbody>
                {(data.productLog ?? []).map((r, idx) => (
                  <tr key={r.id}>
                    <td className="border border-gray-100 px-2 py-1 text-gray-500">{idx + 1}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.castingNumber || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.shiftPour || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.shiftCut || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.frameNumber || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.size600x250 || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{badge(r.status)}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.comment || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {data.shiftNotes?.trim() ? (
          <div>
            <p className="font-bold text-gray-800 mb-1">Тэмдэглэл</p>
            <p className="text-gray-700 whitespace-pre-wrap font-mono text-xs">{data.shiftNotes}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-t border-gray-100 pt-4">
          <div>
            <p className="text-gray-500 font-bold uppercase">Хүлээлгэн өгсөн</p>
            <p className="text-gray-900">{data.sigHandingOver || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 font-bold uppercase">Хүлээн авсан</p>
            <p className="text-gray-900">{data.sigReceiving || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 font-bold uppercase">Ээлжийн мастер</p>
            <p className="text-gray-900">{data.sigShiftMaster || '—'}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 md:px-6 md:pb-6">
        <EnvironmentCheckSection rows={(data as any)?.environmentChecks} readOnly />
      </div>
    </section>
  );
}
