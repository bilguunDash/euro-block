'use client';

import type { Y120LimeMillHandoverPayload } from '@/lib/y120-lime-mill-handover-form';
import { ClipboardList } from 'lucide-react';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

function badge(s: string) {
  if (s === 'normal') return <span className="text-emerald-700 font-bold">Хэвийн (+)</span>;
  if (s === 'abnormal') return <span className="text-red-700 font-bold">Хэвийн бус (−)</span>;
  return <span className="text-gray-400">—</span>;
}

export function Y120HandoverFormReadOnly({ data }: { data: Y120LimeMillHandoverPayload }) {
  return (
    <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-orange-50/40">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-orange-600" />
          ҮЯ-120 — Шохойн тээрмийн хүлээлцэх бүртгэл (хадгалсан)
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {data.shiftDate} · {data.shiftType}
          {data.submittedAt ? ` · Илгээсэн: ${new Date(data.submittedAt).toLocaleString()}` : ''}
        </p>
      </div>
      <div className="p-4 md:p-6 space-y-6 max-h-[520px] overflow-y-auto text-sm">
        <div>
          <p className="font-bold text-gray-800 mb-2">Үзлэг (1–12)</p>
          <ul className="space-y-2 border rounded-xl divide-y divide-gray-100">
            {data.inspections.map((r, i) => (
              <li key={r.key} className="px-3 py-2 flex flex-col sm:flex-row sm:justify-between gap-1">
                <span className="text-gray-700">
                  {i + 1}. {r.label}
                </span>
                <span className="flex flex-wrap gap-3">
                  {badge(r.status)}
                  {r.comment ? <span className="text-gray-500">{r.comment}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {(data.hseInfo || data.equipmentInfo) && (
          <div className="space-y-2">
            {data.hseInfo ? (
              <div>
                <p className="font-bold">13. ХАБЭА тухай мэдээлэл, санал</p>
                <p className="text-gray-700 whitespace-pre-wrap">{data.hseInfo}</p>
              </div>
            ) : null}
            {data.equipmentInfo ? (
              <div>
                <p className="font-bold">14. Тоног төхөөрөмжийн мэдээлэл, санал</p>
                <p className="text-gray-700 whitespace-pre-wrap">{data.equipmentInfo}</p>
              </div>
            ) : null}
          </div>
        )}
        <div>
          <p className="font-bold mb-1">15. Ажлын байрны эмх цэгц, цэвэрлэгээ</p>
          {badge(data.workplaceTidiness.status)}
          {data.workplaceTidiness.comment && (
            <p className="text-gray-600 mt-1">{data.workplaceTidiness.comment}</p>
          )}
        </div>
        <div>
          <p className="font-bold text-gray-800 mb-2">Тээрэмдсэн түүхий эд (%)</p>
          <ul className="grid sm:grid-cols-2 gap-2">
            {data.milledMaterials.map((r) => (
              <li key={r.key} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500">{r.label}</p>
                <p className="font-bold text-gray-900">{r.total || '—'} {r.unit}</p>
              </li>
            ))}
          </ul>
        </div>
        {data.shiftNotes ? (
          <div>
            <p className="font-bold mb-1">Тэмдэглэл</p>
            <p className="text-gray-700 whitespace-pre-wrap">{data.shiftNotes}</p>
          </div>
        ) : null}
        <div className="grid sm:grid-cols-2 gap-3 text-xs border-t pt-4">
          <p>
            <span className="font-bold text-gray-600">Хүлээлгэн өгсөн:</span> {data.sigHandingOver || '—'}
          </p>
          <p>
            <span className="font-bold text-gray-600">Хүлээн авсан:</span> {data.sigReceiving || '—'}
          </p>
          <p>
            <span className="font-bold text-gray-600">Ээлжийн мастер:</span> {data.sigShiftMaster || '—'}
          </p>
        </div>
      </div>

      <div className="px-4 pb-4 md:px-6 md:pb-6">
        <EnvironmentCheckSection rows={(data as any)?.environmentChecks} readOnly />
      </div>
    </section>
  );
}
