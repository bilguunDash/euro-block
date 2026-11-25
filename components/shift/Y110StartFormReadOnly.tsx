'use client';

import type { Y110CementPumpStartPayload } from '@/lib/y110-cement-pump-form';
import { ClipboardList } from 'lucide-react';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

function badge(s: string) {
  if (s === 'normal') return <span className="text-emerald-700 font-bold">Хэвийн (+)</span>;
  if (s === 'abnormal') return <span className="text-red-700 font-bold">Хэвийн бус (−)</span>;
  return <span className="text-gray-400">—</span>;
}

export function Y110StartFormReadOnly({ data }: { data: Y110CementPumpStartPayload }) {
  return (
    <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-orange-50/40">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-orange-600" />
          ҮЯ-110 — Ээлж эхлэх үзлэгийн бүртгэл (хадгалсан)
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {data.shiftDate} · {data.shiftType}
          {data.submittedAt ? ` · Илгээсэн: ${new Date(data.submittedAt).toLocaleString()}` : ''}
        </p>
      </div>
      <div className="p-4 md:p-6 space-y-6 max-h-[480px] overflow-y-auto text-sm">
        <div>
          <p className="font-bold text-gray-800 mb-2">Үзлэгийн төрөл</p>
          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
                  <th className="px-3 py-2 font-bold w-10">д/д</th>
                  <th className="px-3 py-2 font-bold">Үзлэгийн төрөл</th>
                  <th className="px-3 py-2 font-bold">Хэвийн / Хэвийн бус</th>
                  <th className="px-3 py-2 font-bold">Тайлбар</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.compressors.map((r, i) => (
                  <tr key={r.key}>
                    <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                    <td className="px-3 py-2 text-gray-900">{r.label}</td>
                    <td className="px-3 py-2">{badge(r.status)}</td>
                    <td className="px-3 py-2 text-gray-600">{r.comment || '—'}</td>
                  </tr>
                ))}
                {data.silos.map((r, i) => (
                  <tr key={r.key} className="bg-orange-50/20">
                    <td className="px-3 py-2 text-gray-500">{i + 6}</td>
                    <td className="px-3 py-2 text-gray-900">{r.label.replace(' — Хэмжээ, %', '')}</td>
                    <td className="px-3 py-2">
                      <span className="text-gray-600 text-xs">Хэмжээ, %: </span>
                      <span className="font-bold text-gray-900">{r.percent || '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.comment || '—'}</td>
                  </tr>
                ))}
                <tr>
                  <td className="px-3 py-2 text-gray-500">10</td>
                  <td className="px-3 py-2 text-gray-900">Шугам хоолойн ажиллагаа</td>
                  <td className="px-3 py-2">{badge(data.pipeline.status)}</td>
                  <td className="px-3 py-2 text-gray-600">{data.pipeline.comment || '—'}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-500">11</td>
                  <td className="px-3 py-2 text-gray-900">Хийн даралт</td>
                  <td className="px-3 py-2">{badge(data.airPressure.status)}</td>
                  <td className="px-3 py-2 text-gray-600">{data.airPressure.comment || '—'}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-500">12</td>
                  <td className="px-3 py-2 text-gray-900">Тосолгоо, үйлчилгээ</td>
                  <td className="px-3 py-2">{badge(data.lubrication.status)}</td>
                  <td className="px-3 py-2 text-gray-600">{data.lubrication.comment || '—'}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-500">13</td>
                  <td className="px-3 py-2 text-gray-900">ХАБЭА тухай мэдээлэл, санал</td>
                  <td colSpan={2} className="px-3 py-2 text-gray-600">{data.hseInfo || '—'}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-500">14</td>
                  <td className="px-3 py-2 text-gray-900">Тоног төхөөрөмжийн мэдээлэл, санал</td>
                  <td colSpan={2} className="px-3 py-2 text-gray-600">{data.equipmentInfo || '—'}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-500">15</td>
                  <td className="px-3 py-2 text-gray-900">Ажлын байрны эмх цэгц, цэвэрлэгээ</td>
                  <td className="px-3 py-2">{badge(data.workplaceTidiness.status)}</td>
                  <td className="px-3 py-2 text-gray-600">{data.workplaceTidiness.comment || '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <p className="font-bold mb-1">Түүхий эд</p>
          <p className="text-gray-700">
            Цемент буулгалт: {data.rawCementUnloadTons || '—'} тн · Вагоны цэвэрлэгээ:{' '}
            {data.rawWagonCleaningCount || '—'} ш
          </p>
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
