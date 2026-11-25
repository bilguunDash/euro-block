'use client';

import { ClipboardList } from 'lucide-react';
import type { Y310RepairMasterHandoverPayload } from '@/lib/y310-repair-master-handover-form';
import { mergeY310PayloadRows } from '@/lib/y310-repair-master-handover-form';
import { resolveReceivingName } from '@/lib/shift-signature';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

function badge(s: string) {
  if (s === 'normal') return <span className="text-emerald-700 font-bold">Хэвийн (+)</span>;
  if (s === 'abnormal') return <span className="text-red-700 font-bold">Хэвийн бус (−)</span>;
  return <span className="text-gray-400">—</span>;
}

export function Y310RepairMasterHandoverReadOnly({
  data,
  receivingMasterName,
}: {
  data: Y310RepairMasterHandoverPayload;
  receivingMasterName?: string | null;
}) {
  const rows = mergeY310PayloadRows(data);

  return (
    <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-orange-50/40">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-orange-600" />
          ҮЯ-310 — Засварын мастерын ээлж хүлээлцэх бүртгэл (хадгалсан)
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {data.shiftDate} · {data.shiftType}
          {data.submittedAt ? ` · Илгээсэн: ${new Date(data.submittedAt).toLocaleString()}` : ''}
        </p>
      </div>

      <div className="p-4 md:p-6 space-y-6 overflow-y-auto text-sm">
        {/* 1. Засварын тоног төхөөрөмж */}
        {rows.repairEquipment.length > 0 && (
          <div>
            <p className="font-bold text-gray-800 mb-2">Засварын тоног төхөөрөмж</p>
            <div className="overflow-x-auto border rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                    <th className="px-3 py-2 w-10">№</th>
                    <th className="px-3 py-2">Нэр</th>
                    <th className="px-3 py-2">Төлөв</th>
                    <th className="px-3 py-2">Тайлбар</th>
                    <th className="px-3 py-2">Үзлэг</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.repairEquipment.map((r, i) => (
                    <tr key={r.key}>
                      <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                      <td className="px-3 py-2 text-gray-900">{r.label}</td>
                      <td className="px-3 py-2">{badge(r.status)}</td>
                      <td className="px-3 py-2 text-gray-600">{r.comment || '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{r.weeklyInspection || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. Компрессор */}
        {rows.compressors.length > 0 && (
          <div>
            <p className="font-bold text-gray-800 mb-2">Хийн хангалт</p>
            <div className="overflow-x-auto border rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                    <th className="px-3 py-2 w-10">№</th>
                    <th className="px-3 py-2">Хийн хангалт</th>
                    <th className="px-3 py-2">Хэвийн</th>
                    <th className="px-3 py-2">Цэвэрлэгээ</th>
                    <th className="px-3 py-2">Тайлбар</th>
                    <th className="px-3 py-2">Аварын ТТ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.compressors.map((r, i) => (
                    <tr key={r.key}>
                      <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                      <td className="px-3 py-2 text-gray-900">{r.label}</td>
                      <td className="px-3 py-2">{badge(r.statusOk)}</td>
                      <td className="px-3 py-2">{badge(r.cleaned)}</td>
                      <td className="px-3 py-2 text-gray-600">{r.comment || '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{r.emergencyEquipment || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. Хэсэг */}
        {rows.sections.length > 0 && (
          <div>
            <p className="font-bold text-gray-800 mb-2">Хэсэг</p>
            <div className="overflow-x-auto border rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                    <th className="px-3 py-2 w-10">№</th>
                    <th className="px-3 py-2">Хэсэг</th>
                    <th className="px-3 py-2">Хэвийн</th>
                    <th className="px-3 py-2">Цэвэрлэгээ</th>
                    <th className="px-3 py-2">ТТ анхаарах</th>
                    <th className="px-3 py-2">Дараа ээлж</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.sections.map((r, i) => (
                    <tr key={r.key}>
                      <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                      <td className="px-3 py-2">
                        {r.labelEn && <div className="text-gray-900 font-medium text-xs">{r.labelEn}</div>}
                        <div className="text-gray-600 text-xs">{r.labelMn}</div>
                      </td>
                      <td className="px-3 py-2">{badge(r.statusOk)}</td>
                      <td className="px-3 py-2">{badge(r.cleaned)}</td>
                      <td className="px-3 py-2 text-gray-600">{r.equipmentNotes || '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{r.nextShiftWork || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. Засварын ажлын бүртгэл */}
        {rows.repairWork.length > 0 && (
          <div>
            <p className="font-bold text-gray-800 mb-2">Засварын ажлын бүртгэл</p>
            <div className="overflow-x-auto border rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                    <th className="px-3 py-2 w-10">№</th>
                    <th className="px-3 py-2">Хэсэг</th>
                    <th className="px-3 py-2">Нөлөөлөгдөөгүй Цаг</th>
                    <th className="px-3 py-2">Нөлөөлөгдсөн Цаг</th>
                    <th className="px-3 py-2">Тайлбар</th>
                    <th className="px-3 py-2">Нэмэлт ажил</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.repairWork.map((r, i) => (
                    <tr key={r.key}>
                      <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                      <td className="px-3 py-2">
                        {r.labelEn && <div className="text-gray-900 font-medium text-xs">{r.labelEn}</div>}
                        <div className="text-gray-600 text-xs">{r.labelMn}</div>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{r.unplannedTime ? new Date(r.unplannedTime).toLocaleString() : '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{r.plannedTime ? new Date(r.plannedTime).toLocaleString() : '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{r.comment || '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{r.additionalWork || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Signatures */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-t border-gray-100 pt-4">
          <div>
            <p className="text-gray-500 font-bold uppercase">Хүлээлгэн өгсөн: Засварын мастер</p>
            <p className="text-gray-900">{data.sigHandingOver || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 font-bold uppercase">Ээлж хүлээн авсан: Засварын мастер</p>
            <p className="text-gray-900">{resolveReceivingName(data.sigReceiving, receivingMasterName) || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 font-bold uppercase">Бүртгэл хянасан: Инженер</p>
            <p className="text-gray-900">{(data as any).sigEngineer || '—'}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 md:px-6 md:pb-6">
        <EnvironmentCheckSection rows={(data as any)?.environmentChecks} readOnly />
      </div>
    </section>
  );
}
