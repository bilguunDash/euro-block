'use client';

import {
  type Y140MoldRotationHandoverPayload,
  Y140_CASTING_ATTENTION,
  Y140_EQUIPMENT_LABELS,
} from '@/lib/y140-mold-rotation-handover-form';
import { ClipboardList, AlertTriangle } from 'lucide-react';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

function badge(s: string) {
  if (s === 'normal') return <span className="text-emerald-700 font-bold">Хэвийн (+)</span>;
  if (s === 'abnormal') return <span className="text-red-700 font-bold">Хэвийн бус (−)</span>;
  return <span className="text-gray-400">—</span>;
}

const CASTING_HEADERS = [
  'Хэвний дугаар',
  'Тавцангийн дугаар',
  'Цутгалтын дугаар',
  'Бэхжсэн хугацаа',
  'Температур',
  'Тархалт',
  'Нягт',
  'Ээлж',
  'Тайлбар',
];

export function Y140HandoverFormReadOnly({ data }: { data: Y140MoldRotationHandoverPayload }) {
  const equipmentInspections = (Array.isArray(data.equipmentInspections) && data.equipmentInspections.length > 0
    ? data.equipmentInspections
    : Y140_EQUIPMENT_LABELS.map(({ key, label }) => ({ key, label, status: '', comment: '' })));

  return (
    <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-orange-50/40">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-orange-600" />
          ҮЯ-140 — Хэв эргэлтийн хүлээлцэх бүртгэл (хадгалсан)
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {data.shiftDate} · {data.shiftType}
          {data.submittedAt ? ` · Илгээсэн: ${new Date(data.submittedAt).toLocaleString()}` : ''}
        </p>
      </div>
      <div className="p-4 md:p-6 space-y-6 max-h-[640px] overflow-y-auto text-sm">
        <div>
          <p className="font-bold text-gray-800 mb-2">Тоног төхөөрөмжийн ажиллагаа (1–10)</p>
          <ul className="space-y-2 border rounded-xl divide-y divide-gray-100">
            {equipmentInspections.map((r, i) => (
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

        {(data.hseInfo || data.equipmentInfo || data.platformMaintenanceNote || data.moldMaintenanceNote) && (
          <div className="space-y-2 text-sm">
            {data.hseInfo ? (
              <div>
                <p className="font-bold">11. ХАБЭА</p>
                <p className="text-gray-700 whitespace-pre-wrap">{data.hseInfo}</p>
              </div>
            ) : null}
            {data.equipmentInfo ? (
              <div>
                <p className="font-bold">12. Тоног төхөөрөмж</p>
                <p className="text-gray-700 whitespace-pre-wrap">{data.equipmentInfo}</p>
              </div>
            ) : null}
            {data.platformMaintenanceNote ? (
              <div>
                <p className="font-bold">13. Тавцан, тулгуур</p>
                <p className="text-gray-700 whitespace-pre-wrap">{data.platformMaintenanceNote}</p>
              </div>
            ) : null}
            {data.moldMaintenanceNote ? (
              <div>
                <p className="font-bold">14. Хэвний засвар</p>
                <p className="text-gray-700 whitespace-pre-wrap">{data.moldMaintenanceNote}</p>
              </div>
            ) : null}
          </div>
        )}

        <div>
          <p className="font-bold text-gray-800 mb-3">Цутгалтын бүртгэл</p>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 mb-4 flex gap-3 items-start">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 border border-amber-200/80">
              <AlertTriangle className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800/90 mb-0.5">Анхаар</p>
              <p className="text-sm font-bold text-amber-950 leading-snug">{Y140_CASTING_ATTENTION}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs border border-gray-200 min-w-[720px] w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-2 py-1">д/д</th>
                  {CASTING_HEADERS.map((h) => (
                    <th key={h} className="border border-gray-200 px-2 py-1">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.castingLog.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="border border-gray-100 px-2 py-1 text-gray-500">{idx + 1}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.moldNumber || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.platformNumber || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.castingNumber || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.curingTime || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.temperature || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.spread || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.density || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.shift || '—'}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.comment || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
