'use client';

import type { Y150CuttingLineHandoverPayload } from '@/lib/y150-cutting-line-handover-form';
import {
  Y150_CUTTING_ATTENTION,
  Y150_EQUIPMENT_COMMENT_ONLY_KEYS,
  Y150_EQUIPMENT_LABELS,
} from '@/lib/y150-cutting-line-handover-form';
import { ClipboardList, AlertTriangle } from 'lucide-react';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

function badge(s: string) {
  if (s === 'normal') return <span className="text-emerald-700 font-bold">Хэвийн (+)</span>;
  if (s === 'abnormal') return <span className="text-red-700 font-bold">Хэвийн бус (−)</span>;
  return <span className="text-gray-400">—</span>;
}

const CUT_HEADERS = [
  'Хэвний дугаар',
  'Тавцангийн дугаар',
  'Цутгасан цаг',
  'Зүсэлтийн хугацаа, мин',
  'Хүлээлгийн хугацаа, мин',
  'Цутгалтын дугаар',
  'Ээлж № (цутгасан)',
  'Ээлж № (зүссэн)',
  'Өргөний хэмжээ',
  'Тайлбар',
];

export function Y150HandoverFormReadOnly({ data }: { data: Y150CuttingLineHandoverPayload }) {
  const savedEquipment = Array.isArray(data.equipmentInspections) ? data.equipmentInspections : [];
  const equipmentByKey = new Map(savedEquipment.map((r) => [String(r?.key ?? ''), r]));
  const equipmentInspections = Y150_EQUIPMENT_LABELS.map((row) => {
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
          ҮЯ-150 — Зүсэх дамжлагын хүлээлцэх бүртгэл (хадгалсан)
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {data.shiftDate} · {data.shiftType}
          {data.submittedAt ? ` · Илгээсэн: ${new Date(data.submittedAt).toLocaleString()}` : ''}
        </p>
      </div>
      <div className="p-4 md:p-6 space-y-6 max-h-[720px] overflow-y-auto text-sm">
        <div>
          <p className="font-bold text-gray-800 mb-2">Тоног төхөөрөмжийн ажиллагаа (1–20)</p>
          <ul className="space-y-2 border rounded-xl divide-y divide-gray-100 max-h-52 overflow-y-auto">
            {equipmentInspections.map((r, i) => {
              const commentOnly = Y150_EQUIPMENT_COMMENT_ONLY_KEYS.has(r.key);
              return (
                <li key={r.key} className="px-3 py-2 flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-gray-700">
                    {i + 1}. {r.label}
                  </span>
                  <span className="flex flex-wrap gap-3">
                    {commentOnly ? null : badge(r.status)}
                    {r.comment ? <span className="text-gray-500">{r.comment}</span> : commentOnly ? <span className="text-gray-400">—</span> : null}
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
            <p className="text-sm font-bold text-amber-950 leading-snug">{Y150_CUTTING_ATTENTION}</p>
          </div>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-3">Бүтээгдэхүүн зүсэлтийн бүртгэл</p>
          <div className="overflow-x-auto">
            <table className="text-xs border border-gray-200 min-w-[900px] w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-2 py-1">д/д</th>
                  {CUT_HEADERS.map((h) => (
                    <th key={h} className="border border-gray-200 px-2 py-1">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.cuttingLog ?? []).map((r, idx) => (
                  <tr key={r.id}>
                    <td className="border border-gray-100 px-2 py-1 text-gray-500">{idx + 1}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.moldNumber || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.platformNumber || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.pouredTime || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.cuttingDurationMin || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.waitingDurationMin || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.castingNumber || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.shiftPour || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.shiftCut || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.widthSize || '—'}</td>
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
