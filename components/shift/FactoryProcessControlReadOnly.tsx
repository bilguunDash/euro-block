'use client';

import { ClipboardList } from 'lucide-react';
import type { FactoryProcessControlPayload } from '@/lib/factory-process-control-form';
import { EQUIPMENT_CONTROL_ITEMS, normalizeFactoryProcessControlPayload } from '@/lib/factory-process-control-form';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

function badge(s: string) {
  if (s === 'normal') return <span className="text-emerald-700 font-bold">Хэвийн</span>;
  if (s === 'abnormal') return <span className="text-red-700 font-bold">Хэвийн бус</span>;
  return <span className="text-gray-400">—</span>;
}

export function FactoryProcessControlReadOnly({
  data,
  showEnvironmentChecks = true,
}: { data: FactoryProcessControlPayload; showEnvironmentChecks?: boolean }) {
  const normalized = normalizeFactoryProcessControlPayload(data, {
    shiftDate: data.shiftDate ?? '',
    shiftType: data.shiftType ?? '',
    operatorUid: data.operatorUid ?? '',
    operatorName: data.operatorName ?? '',
  });
  const rows = normalized.rows;
  return (
    <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-orange-50/40">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-orange-600" />
          Үйлдвэрийн процесст тавих хяналтын хуудас (хадгалсан)
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {normalized.shiftDate} · {normalized.shiftType}
          {normalized.submittedAt ? ` · Илгээсэн: ${new Date(normalized.submittedAt).toLocaleString()}` : ''}
        </p>
      </div>

      <div className="p-4 md:p-6 space-y-6 overflow-y-auto text-sm">
        {rows.length > 0 && (
          <div>
            <p className="font-bold text-gray-800 mb-2">Технологийн процесс</p>
            <div className="overflow-x-auto border rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                    <th className="px-3 py-2 w-10">№</th>
                    <th className="px-3 py-2">Хяналт</th>
                    <th className="px-3 py-2">Шаардлага</th>
                    <th className="px-3 py-2">Төлөв</th>
                    <th className="px-3 py-2">Тайлбар</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r, i) => (
                    <tr key={r.key}>
                      <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                      <td className="px-3 py-2 text-gray-900 font-medium">{r.label}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs italic">{r.requirement}</td>
                      <td className="px-3 py-2">{badge(r.status)}</td>
                      <td className="px-3 py-2 text-gray-600">{r.comment || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Тоног төхөөрөмжийн хяналт (доголдол + хяналт нэгтгэсэн, 1-18) */}
        {(normalized.failureRows.length > 0 || normalized.equipmentRows.length > 0) && (
          <div>
            <p className="font-bold text-gray-800 mb-2">Тоног төхөөрөмжийн хяналт</p>
            <div className="overflow-x-auto border rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                    <th className="px-3 py-2 w-10">№</th>
                    <th className="px-3 py-2">Хяналт</th>
                    <th className="px-3 py-2">Төлөв</th>
                    <th className="px-3 py-2">Тайлбар</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {normalized.failureRows.map((r, i) => (
                    <tr key={r.key}>
                      <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                      <td className="px-3 py-2 text-gray-900 font-medium">{r.label}</td>
                      <td className="px-3 py-2">{badge(r.status)}</td>
                      <td className="px-3 py-2 text-gray-600">{r.comment || '—'}</td>
                    </tr>
                  ))}
                  {normalized.equipmentRows.map((r, i) => {
                    const item = EQUIPMENT_CONTROL_ITEMS[i];
                    return (
                      <tr key={r.key}>
                        <td className="px-3 py-2 text-gray-500">{item?.num ?? i + 5}</td>
                        <td className="px-3 py-2 text-gray-900 font-medium">{r.label}</td>
                        <td className="px-3 py-2">{badge(r.status)}</td>
                        <td className="px-3 py-2 text-gray-600">{r.comment || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Signatures */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-t border-gray-100 pt-4">
          <div>
            <p className="text-gray-500 font-bold uppercase">Бүртгэл хөтөлсөн</p>
            <p className="text-gray-900">{normalized.operatorName || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 font-bold uppercase">Хяналт хийсэн ээлжийн мастер</p>
            <p className="text-gray-900">{normalized.sigMaster || '—'}</p>
          </div>
        </div>
      </div>

      {showEnvironmentChecks && (
        <div className="px-4 pb-4 md:px-6 md:pb-6">
          <EnvironmentCheckSection rows={(data as any)?.environmentChecks} readOnly />
        </div>
      )}
    </section>
  );
}
