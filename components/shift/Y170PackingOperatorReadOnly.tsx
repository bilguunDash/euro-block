'use client';

import { ClipboardList } from 'lucide-react';
import type { Y170PackingOperatorPayload } from '@/lib/y170-packing-operator-form';
import {
  Y170_PACKING_COMMENT_ONLY_KEYS,
  Y170_PACKING_EQUIPMENT_LABELS,
} from '@/lib/y170-packing-operator-form';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

function badge(s: string) {
  if (s === 'normal') return <span className="text-emerald-700 font-bold">Хэвийн (+)</span>;
  if (s === 'abnormal') return <span className="text-red-700 font-bold">Хэвийн бус (−)</span>;
  return <span className="text-gray-400">—</span>;
}

export function Y170PackingOperatorReadOnly({ data }: { data: Y170PackingOperatorPayload }) {
  const savedEquipment = Array.isArray(data.equipmentInspections) ? data.equipmentInspections : [];
  const equipmentByKey = new Map(savedEquipment.map((r) => [String(r?.key ?? ''), r]));
  const equipmentInspections = Y170_PACKING_EQUIPMENT_LABELS.map((row) => {
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
          ҮЯ-170 — Савлах төхөөрөмжийн операторын бүртгэл (хадгалсан)
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {data.shiftDate} · {data.shiftType}
          {data.submittedAt ? ` · Илгээсэн: ${new Date(data.submittedAt).toLocaleString()}` : ''}
        </p>
      </div>

      <div className="p-4 md:p-6 space-y-6 max-h-[640px] overflow-y-auto text-sm">
        <div>
          <p className="font-bold text-gray-800 mb-2">Тоног төхөөрөмжийн ажиллагаа (1–15)</p>
          <ul className="space-y-2 border rounded-xl divide-y divide-gray-100">
            {equipmentInspections.map((r, i) => {
              const commentOnly = Y170_PACKING_COMMENT_ONLY_KEYS.has(r.key);
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
