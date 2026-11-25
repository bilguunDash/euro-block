'use client';

import { ClipboardList } from 'lucide-react';
import type { Y320ElectricalAutomationRepairPayload, Y320RepairType } from '@/lib/y320-electrical-automation-repair-form';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';
import { resolveReceivingName } from '@/lib/shift-signature';

const TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  major: { label: 'Их засвар', cls: 'bg-green-100 text-green-800' },
  routine: { label: 'Урсгал засвар', cls: 'bg-yellow-100 text-yellow-800' },
  planned: { label: 'Төлөвлөгөөт засвар', cls: 'bg-orange-100 text-orange-800' },
  sudden: { label: 'Гэнэтийн эвдрэл', cls: 'bg-red-100 text-red-800' },
};

function repairBadge(t: Y320RepairType) {
  if (!t) return <span className="text-gray-400">—</span>;
  const info = TYPE_LABELS[t];
  if (!info) return <span className="text-gray-400">—</span>;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${info.cls}`}>{info.label}</span>;
}

export function Y320ElectricalAutomationRepairReadOnly({
  data,
  receivingName,
}: {
  data: Y320ElectricalAutomationRepairPayload;
  receivingName?: string | null;
}) {
  const rows = data.rows ?? [];
  return (
    <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-orange-50/40">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-orange-600" />
          ҮЯ-320 — Цахилгаан автоматжуулалтын засварын бүртгэл (хадгалсан)
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {data.shiftDate} · {data.shiftType}
          {data.submittedAt ? ` · Илгээсэн: ${new Date(data.submittedAt).toLocaleString()}` : ''}
        </p>
      </div>

      <div className="p-4 md:p-6 space-y-6 overflow-y-auto text-sm">
        {rows.length > 0 && (
          <div>
            <p className="font-bold text-gray-800 mb-2">Бүртгэл ({rows.length} мөр)</p>
            <div className="overflow-x-auto border rounded-2xl">
              <table className="text-left text-sm w-max min-w-full">
                <thead>
                  <tr className="bg-gray-100 text-[10px] uppercase text-gray-500 border-b border-gray-200">
                    <th className="px-2 py-1 w-8" rowSpan={2}>№</th>
                    <th className="px-2 py-1" rowSpan={2}>Хэсэг</th>
                    <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={2}>Огноо</th>
                    <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={2}>Ээлж</th>
                    <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={2}>Хугацаа /цаг/</th>
                    <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={2}>Багаж<br />хүлээсэн</th>
                    <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={2}>Сэлбэг<br />хүлээсэн</th>
                    <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={2}>Нөлөөлсөн<br />эсэх</th>
                    <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={2}>Ээлж №</th>
                    <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={2}>Төлөв</th>
                    <th className="px-2 py-1 border-l border-gray-200" rowSpan={2}>Эвдрэл<br />байдал</th>
                    <th className="px-2 py-1 border-l border-gray-200" rowSpan={2}>Эвдрэл<br />шалтгаан</th>
                    <th className="px-2 py-1 border-l border-gray-200" rowSpan={2}>Гүйцэтгэсэн<br />ажил</th>
                    <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={3}>Гүйцэтгэсэн</th>
                    <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={2}>Хүлээж авсан</th>
                    <th className="px-2 py-1 border-l border-gray-200" rowSpan={2}>Нийт<br />хугацаа</th>
                    <th className="px-2 py-1 border-l border-gray-200" rowSpan={2}>Хүний<br />тоо</th>
                  </tr>
                  <tr className="bg-gray-50 text-[10px] text-gray-500 border-b border-gray-200">
                    <th className="px-2 py-1 border-l border-gray-200">Засварт орсон</th>
                    <th className="px-2 py-1">Засвараас гарсан</th>
                    <th className="px-2 py-1 border-l border-gray-200">Эхлэх</th>
                    <th className="px-2 py-1">Дуусах</th>
                    <th className="px-2 py-1 border-l border-gray-200">Нэр</th>
                    <th className="px-2 py-1">Албан тушаал</th>
                    <th className="px-2 py-1">Хүн/цаг</th>
                    <th className="px-2 py-1 border-l border-gray-200">Нэр</th>
                    <th className="px-2 py-1">Албан тушаал</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r, i) => (
                    <tr key={r.id ?? i}>
                      <td className="px-2 py-2 text-gray-500 text-center">{i + 1}</td>
                      <td className="px-2 py-2 text-gray-700">{r.section || '—'}</td>
                      <td className="px-2 py-2 text-gray-700">{r.enteredRepairDate || '—'}</td>
                      <td className="px-2 py-2 text-gray-700">{r.leftRepairDate || '—'}</td>
                      <td className="px-2 py-2 text-gray-700">{r.shift || '—'}</td>
                      <td className="px-2 py-2 text-gray-700">{r.repairStartTime || '—'}</td>
                      <td className="px-2 py-2 text-gray-700">{r.repairEndTime || '—'}</td>
                      <td className="px-2 py-2 text-gray-700">{r.toolReceivedTime || '—'}</td>
                      <td className="px-2 py-2 text-gray-700">{r.partsReceivedTime || '—'}</td>
                      <td className="px-2 py-2 text-gray-700">{r.affectedProduction || '—'}</td>
                      <td className="px-2 py-2 text-gray-700">{r.shiftNumber || '—'}</td>
                      <td className="px-2 py-2">{repairBadge(r.repairType)}</td>
                      <td className="px-2 py-2 text-gray-700">{r.damageCondition || '—'}</td>
                      <td className="px-2 py-2 text-gray-700">{r.damageCause || '—'}</td>
                      <td className="px-2 py-2 text-gray-700">{r.repairWorkDone || '—'}</td>
                      <td className="px-2 py-2 text-gray-700">{r.performerName || '—'}</td>
                      <td className="px-2 py-2 text-gray-700">{r.performerPosition || '—'}</td>
                      <td className="px-2 py-2 text-gray-700">{r.performerManHours || '—'}</td>
                      <td className="px-2 py-2 text-gray-700">{r.receiverName || '—'}</td>
                      <td className="px-2 py-2 text-gray-700">{r.receiverPosition || '—'}</td>
                      <td className="px-2 py-2 text-gray-700">{r.totalDuration || '—'}</td>
                      <td className="px-2 py-2 text-gray-700">{r.workerCount || '—'}</td>
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
            <p className="text-gray-500 font-bold uppercase">Ээлж хүлээлгэн өгсөн</p>
            <p className="text-gray-900">{data.sigHandingOver || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 font-bold uppercase">Ээлж хүлээн авсан</p>
            <p className="text-gray-900">{resolveReceivingName(data.sigReceiving, receivingName) || '—'}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 md:px-6 md:pb-6">
        <EnvironmentCheckSection rows={(data as any)?.environmentChecks} readOnly />
      </div>
    </section>
  );
}
