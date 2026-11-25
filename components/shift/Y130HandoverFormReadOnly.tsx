'use client';

import {
  type Y130MixingTowerHandoverPayload,
  Y130_EQUIPMENT_LABELS,
  Y130_INDICATOR_DEFS,
} from '@/lib/y130-mixing-tower-handover-form';
import { ClipboardList } from 'lucide-react';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

function badge(s: string) {
  if (s === 'normal') return <span className="text-emerald-700 font-bold">Хэвийн (+)</span>;
  if (s === 'abnormal') return <span className="text-red-700 font-bold">Хэвийн бус (−)</span>;
  return <span className="text-gray-400">—</span>;
}

export function Y130HandoverFormReadOnly({ data }: { data: Y130MixingTowerHandoverPayload }) {
  const savedIndicators = Array.isArray(data.indicators) ? data.indicators : [];
  const indicatorByKey = new Map(savedIndicators.map((r) => [String(r?.key ?? ''), r]));
  const indicators = Y130_INDICATOR_DEFS.map((d) => {
    const saved = indicatorByKey.get(d.key);
    return { ...d, value: typeof saved?.value === 'string' ? saved.value : '' };
  });
  const savedEquipment = Array.isArray(data.equipmentInspections) ? data.equipmentInspections : [];
  const equipmentByKey = new Map(savedEquipment.map((r) => [String(r?.key ?? ''), r]));
  const equipmentInspections = Y130_EQUIPMENT_LABELS.map((d) => {
    const saved = equipmentByKey.get(d.key);
    return saved && typeof saved === 'object'
      ? { ...d, status: saved.status ?? '', comment: saved.comment ?? '' }
      : { ...d, status: '', comment: '' };
  });

  return (
    <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-orange-50/40">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-orange-600" />
          ҮЯ-130 — Зуурах цамхагийн хүлээлцэх бүртгэл (хадгалсан)
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {data.shiftDate} · {data.shiftType}
          {data.submittedAt ? ` · Илгээсэн: ${new Date(data.submittedAt).toLocaleString()}` : ''}
        </p>
      </div>
      <div className="p-4 md:p-6 space-y-6 max-h-[720px] overflow-y-auto text-sm">
        <div>
          <p className="font-bold text-gray-800 mb-2">Үзүүлэлтүүд</p>
          <div className="overflow-x-auto">
            <table className="text-xs border border-gray-200 min-w-[520px] w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-2 py-1 w-10">д/д</th>
                  <th className="border border-gray-200 px-2 py-1 text-left">Үзүүлэлтүүд</th>
                  <th className="border border-gray-200 px-2 py-1 w-16">Нэгж</th>
                  <th className="border border-gray-200 px-2 py-1 w-24">Утга</th>
                </tr>
              </thead>
              <tbody>
                {indicators.map((r, idx) => (
                  <tr key={r.key}>
                    <td className="border border-gray-100 px-2 py-1 text-gray-500">{idx + 1}</td>
                    <td className="border border-gray-100 px-2 py-1">{r.label}</td>
                    <td className="border border-gray-100 px-2 py-1 text-gray-600">{r.unit}</td>
                    <td className="border border-gray-100 px-2 py-1 font-mono">{r.value?.trim() ? r.value : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-2">Тоног төхөөрөмжийн ажиллагаа (1–11)</p>
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

        {(data.hseInfo ||
          data.equipmentInfo ||
          data.workplaceCleaning ||
          data.workplaceCleaningNote) && (
          <div className="space-y-3 text-sm">
            {data.hseInfo ? (
              <div>
                <p className="font-bold">12. ХАБЭА тухай мэдээлэл, санал</p>
                <p className="text-gray-700 whitespace-pre-wrap">{data.hseInfo}</p>
              </div>
            ) : null}
            {data.equipmentInfo ? (
              <div>
                <p className="font-bold">13. Тоног төхөөрөмжийн мэдээлэл, санал</p>
                <p className="text-gray-700 whitespace-pre-wrap">{data.equipmentInfo}</p>
              </div>
            ) : null}
            {data.workplaceCleaning || data.workplaceCleaningNote ? (
              <div>
                <p className="font-bold">14. Ажлын байрны эмх цэгц, цэвэрлэгээ</p>
                {data.workplaceCleaning ? (
                  <div className="flex flex-wrap gap-3 items-baseline">
                    {badge(data.workplaceCleaning.status)}
                    {data.workplaceCleaning.comment?.trim() ? (
                      <span className="text-gray-600">{data.workplaceCleaning.comment}</span>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-gray-700 whitespace-pre-wrap">{data.workplaceCleaningNote}</p>
                )}
              </div>
            ) : null}
          </div>
        )}

        {data.shiftNotes ? (
          <div>
            <p className="font-bold text-gray-800 mb-1">Тэмдэглэл</p>
            <p className="text-gray-700 whitespace-pre-wrap font-mono text-xs">{data.shiftNotes}</p>
          </div>
        ) : null}

        {data.ingredientChangeNote ? (
          <div>
            <p className="font-bold text-gray-800 mb-1">Орц найрлага өөрчлөх үеийн бүртгэл</p>
            <p className="text-gray-700 whitespace-pre-wrap">{data.ingredientChangeNote}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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
