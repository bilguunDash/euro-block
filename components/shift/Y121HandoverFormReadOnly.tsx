'use client';

import {
  type Y121BallMillHandoverPayload,
  emptyMetricsFields,
  y121FormatDateTimeDisplay,
  y121IsDatetimeMetricField,
} from '@/lib/y121-ball-mill-handover-form';
import { ClipboardList } from 'lucide-react';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

function badge(s: string) {
  if (s === 'normal') return <span className="text-emerald-700 font-bold">Хэвийн (+)</span>;
  if (s === 'abnormal') return <span className="text-red-700 font-bold">Хэвийн бус (−)</span>;
  return <span className="text-gray-400">—</span>;
}

export function Y121HandoverFormReadOnly({ data }: { data: Y121BallMillHandoverPayload }) {
  const flowMetrics = Array.isArray(data.flowMetrics) ? data.flowMetrics : [];
  const flowMetricsTotal = data.flowMetricsTotal ?? emptyMetricsFields();
  const inspections = Array.isArray(data.inspections) ? data.inspections : [];
  const workplaceTidiness = data.workplaceTidiness ?? { status: '', comment: '' };
  const cols = [
    { k: 'workingStarted' as const, l: 'Эхэлсөн' },
    { k: 'workingStopped' as const, l: 'Зогссон' },
    { k: 'sampleTime' as const, l: 'Дээжийн цаг' },
    { k: 'currentA' as const, l: 'Гүйдэл (A)' },
    { k: 'electricityKwh' as const, l: 'кВтц' },
    { k: 'waterM3h' as const, l: 'Ус м³/ц' },
    { k: 'sandTh' as const, l: 'Элс тн/ц' },
    { k: 'millDensityKgM3' as const, l: 'Нягт кг/м³' },
    { k: 'electricityKwhPerT' as const, l: 'кВтц/тн' },
  ];

  return (
    <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-orange-50/40">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-orange-600" />
          ҮЯ-121 — Бөмбөлөгт тээрмийн хүлээлцэх бүртгэл (хадгалсан)
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {data.shiftDate} · {data.shiftType}
          {data.submittedAt ? ` · Илгээсэн: ${new Date(data.submittedAt).toLocaleString()}` : ''}
        </p>
      </div>
      <div className="p-4 md:p-6 space-y-6 max-h-[560px] overflow-y-auto text-sm">
        <div className="overflow-x-auto">
          <p className="font-bold text-gray-800 mb-2">Урсгалын хэмжээ</p>
          <table className="text-xs border border-gray-200 min-w-[640px] w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-200 px-2 py-1">д/д</th>
                <th className="border border-gray-200 px-2 py-1">Мөр</th>
                {cols.map((c) => (
                  <th key={c.k} className="border border-gray-200 px-1 py-1">
                    {c.l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flowMetrics.map((r, i) => (
                <tr key={r.key}>
                  <td className="border border-gray-100 px-2 py-1 text-gray-500">{i + 1}</td>
                  <td className="border border-gray-100 px-2 py-1">{r.label}</td>
                  {cols.map((c) => (
                    <td key={c.k} className="border border-gray-100 px-1 py-1 whitespace-nowrap">
                      {y121IsDatetimeMetricField(c.k) ? y121FormatDateTimeDisplay(r[c.k]) : r[c.k] || '—'}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-amber-50 font-bold">
                <td className="border border-gray-200 px-2 py-1" colSpan={2}>
                  Нийт
                </td>
                {cols.map((c) => (
                  <td key={c.k} className="border border-gray-200 px-1 py-1 whitespace-nowrap">
                    {y121IsDatetimeMetricField(c.k)
                      ? y121FormatDateTimeDisplay(flowMetricsTotal[c.k])
                      : flowMetricsTotal[c.k] || '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <p className="font-bold text-gray-800 mb-2">Тоног төхөөрөмжийн ажиллагаа (1–12)</p>
          <ul className="space-y-2 border rounded-xl divide-y divide-gray-100">
            {inspections.map((r, i) => (
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

        {(data.equipmentInfo || data.hseInfo) && (
          <div className="space-y-2">
            {data.equipmentInfo ? (
              <div>
                <p className="font-bold">13. Тоног төхөөрөмжийн мэдээлэл, санал</p>
                <p className="text-gray-700 whitespace-pre-wrap">{data.equipmentInfo}</p>
              </div>
            ) : null}
            {data.hseInfo ? (
              <div>
                <p className="font-bold">14. ХАБЭА тухай мэдээлэл, санал</p>
                <p className="text-gray-700 whitespace-pre-wrap">{data.hseInfo}</p>
              </div>
            ) : null}
          </div>
        )}

        <div>
          <p className="font-bold mb-1">15. Ажлын байрны эмх, цэгц, цэвэрлэгээ</p>
          {badge(workplaceTidiness.status)}
          {workplaceTidiness.comment && (
            <p className="text-gray-600 mt-1">{workplaceTidiness.comment}</p>
          )}
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
