'use client';

import { ClipboardList } from 'lucide-react';
import type { Y180AutoclaveOperatorPayload } from '@/lib/y180-autoclave-operator-form';
import {
  mergeY180EquipmentRows,
  mergeY180TimeRows,
  normalizeY180OperationRows,
  y180HasLegacyTimeData,
  Y180_AUTOCLAVE_COUNT,
  Y180_DEFAULT_CONDITION,
  Y180_DEFAULT_OTHER_FACTORS,
  toHHMM,
} from '@/lib/y180-autoclave-operator-form';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

function badge(s: string) {
  if (s === 'normal') return <span className="text-emerald-700 font-bold">Хэвийн (+)</span>;
  if (s === 'abnormal') return <span className="text-red-700 font-bold">Хэвийн бус (−)</span>;
  return <span className="text-gray-400">—</span>;
}

const AC_LABELS: readonly { key: string; label: string; time?: boolean }[] = [
  { key: 'startTime', label: 'Эхэл', time: true },
  { key: 'startRoller', label: 'Ролик(э)' },
  { key: 'stopTime', label: 'Зогс', time: true },
  { key: 'stopRoller', label: 'Ролик(з)' },
  { key: 'outTrack1', label: 'Г зам-1' },
  { key: 'outTrack2', label: 'Г зам-2' },
  { key: 'inTrack3', label: 'О зам-3' },
  { key: 'inTrack4', label: 'О зам-4' },
];

function cell(val: string | undefined, isTime?: boolean) {
  if (!val) return <span className="text-gray-400">—</span>;
  if (isTime) return <span className="tabular-nums">{toHHMM(val) || val}</span>;
  return <>{val}</>;
}

/** «хэвийн» / «байхгүй»-гээс өөр утгыг (асуудал бичсэн) тодруулна. */
function remark(value: string, normal: string) {
  const text = value.trim();
  if (!text) return <span className="text-gray-400">—</span>;
  return text.toLowerCase() === normal ? <>{text}</> : <span className="font-bold text-red-700">{text}</span>;
}

export function Y180AutoclaveOperatorReadOnly({ data }: { data: Y180AutoclaveOperatorPayload }) {
  const operationRows = normalizeY180OperationRows(data.operationRows);
  // Хуучин (formVersion 1) цагийн хүснэгт — бөглөсөн мөртэй хуучин бүртгэлд л харагдана.
  const timeRows = y180HasLegacyTimeData(data.timeRows) ? mergeY180TimeRows(data.timeRows) : [];
  const equipmentInspections = mergeY180EquipmentRows(data.equipmentInspections);
  const displayTime = (t: string) => {
    if (!t) return '—';
    if (t.includes('T')) return new Date(t).toLocaleString('mn-MN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    return t;
  };

  return (
    <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-orange-50/40">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-orange-600" />
          ҮЯ-180 — Автоклавын операторын бүртгэл (хадгалсан)
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {data.shiftDate} · {data.shiftType}
          {data.submittedAt ? ` · Илгээсэн: ${new Date(data.submittedAt).toLocaleString()}` : ''}
        </p>
      </div>

      <div className="p-4 md:p-6 space-y-6 overflow-y-auto text-sm">
        {/* Автоклавын ажилбарын бүртгэл (formVersion 2) */}
        {operationRows.length > 0 ? (
          <div className="overflow-x-auto border rounded-2xl">
            <p className="px-3 py-2 text-xs font-bold text-gray-700 bg-gray-50 border-b border-gray-200">Автоклавын ажилбарын бүртгэл</p>
            <table className="text-left text-xs border-collapse w-max min-w-full">
              <thead>
                <tr className="bg-gray-50 text-[10px] text-gray-500 border-b border-gray-200 align-bottom">
                  <th className="px-2 py-1.5">№</th>
                  <th className="px-2 py-1.5">Бүтээгдэхүүний хэмжээ</th>
                  <th className="px-2 py-1.5">Автоклав</th>
                  <th className="px-2 py-1.5">Оруулсан / гаргасан</th>
                  <th className="px-2 py-1.5">Эхлүүлсэн цаг</th>
                  <th className="px-2 py-1.5">Онгойлгосон цаг</th>
                  <th className="px-2 py-1.5">Тухайн автоклавын ажиллагаа</th>
                  <th className="px-2 py-1.5">Нөлөөлсөн бусад зүйл</th>
                  <th className="px-2 py-1.5">Нэмэлт ажил</th>
                  <th className="px-2 py-1.5">Бүртгэл хөтөлсөн</th>
                </tr>
              </thead>
              <tbody>
                {operationRows.map((row, ri) => (
                  <tr key={row.id} className="border-b border-gray-100 align-top">
                    <td className="px-2 py-1.5 text-gray-400">{ri + 1}</td>
                    <td className="px-2 py-1.5 text-gray-900">{cell(row.blockSize)}</td>
                    <td className="px-2 py-1.5 text-gray-900">{row.autoclaveNum ? `Автоклав №${row.autoclaveNum}` : cell('')}</td>
                    <td className="px-2 py-1.5 text-gray-900">{cell(row.loadDirection)}</td>
                    <td className="px-2 py-1.5 text-gray-700">{cell(row.startedTime, true)}</td>
                    <td className="px-2 py-1.5 text-gray-700">{cell(row.openedTime, true)}</td>
                    <td className="px-2 py-1.5">{remark(row.autoclaveCondition, Y180_DEFAULT_CONDITION)}</td>
                    <td className="px-2 py-1.5">{remark(row.otherFactors, Y180_DEFAULT_OTHER_FACTORS)}</td>
                    <td className="px-2 py-1.5 text-gray-700 whitespace-pre-wrap">{cell(row.extraWork)}</td>
                    <td className="px-2 py-1.5 text-gray-700">{cell(row.recordedBy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : timeRows.length === 0 ? (
          <p className="text-gray-400">Автоклавын ажилбарын бүртгэл хийгдээгүй.</p>
        ) : null}

        {/* Хуучин загварын цагийн хүснэгт */}
        {timeRows.length > 0 && (
          <div className="overflow-x-auto border rounded-2xl">
            <table className="text-left text-xs border-collapse w-max">
              <thead>
                <tr className="bg-gray-100 text-[10px] text-gray-600 border-b border-gray-200">
                  <th colSpan={4} className="px-2 py-1 font-bold border-r border-gray-300 text-center">Үндсэн</th>
                  {Array.from({ length: Y180_AUTOCLAVE_COUNT }, (_, i) => (
                    <th key={i} colSpan={8} className="px-2 py-1 font-bold border-r border-gray-300 text-center text-orange-700">Автоклав №{i + 1}</th>
                  ))}
                  <th colSpan={2} className="px-2 py-1 font-bold border-r border-gray-300 text-center text-emerald-700">
                    <div className="leading-tight"><div>Нийт</div><div>бүтээгдэхүүний</div></div>
                  </th>
                </tr>
                <tr className="bg-gray-50 text-[10px] text-gray-500 border-b border-gray-200">
                  <th className="px-2 py-1">№</th>
                  <th className="px-2 py-1">Цаг</th>
                  <th className="px-2 py-1">Зуухны /бар/</th>
                  <th className="px-2 py-1 border-r border-gray-300">Уурын /бар/</th>
                  {Array.from({ length: Y180_AUTOCLAVE_COUNT }, (_, i) =>
                    AC_LABELS.map((f, fi) => (
                      <th key={`${i}-${f.key}`} className={`px-1 py-1 whitespace-nowrap${fi === AC_LABELS.length - 1 ? ' border-r border-gray-300' : ''}`}>{f.label}</th>
                    ))
                  )}
                  <th className="px-1 py-1 whitespace-nowrap">Гарсан</th>
                  <th className="px-1 py-1 whitespace-nowrap border-r border-gray-300">Орсон</th>
                </tr>
              </thead>
              <tbody>
                {timeRows.map((row, ri) => (
                  <tr key={ri} className="border-b border-gray-100">
                    <td className="px-2 py-1 text-gray-400">{ri + 1}</td>
                    <td className="px-2 py-1 text-gray-900 tabular-nums">{displayTime(row.time)}</td>
                    <td className="px-2 py-1 text-gray-700">{row.furnacePressure || '—'}</td>
                    <td className="px-2 py-1 text-gray-700 border-r border-gray-300">{row.steamLinePressure || '—'}</td>
                    {(row.autoclaves ?? []).map((ac, ai) =>
                      AC_LABELS.map((f, fi) => (
                        <td key={`${ai}-${f.key}`} className={`px-1 py-1 text-gray-700${fi === AC_LABELS.length - 1 ? ' border-r border-gray-300' : ''}`}>
                          {cell((ac as any)[f.key], f.time)}
                        </td>
                      ))
                    )}
                    <td className="px-1 py-1 text-gray-700 font-medium">{row.totalProductOut || '—'}</td>
                    <td className="px-1 py-1 text-gray-700 font-medium border-r border-gray-300">{row.totalProductIn || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Equipment */}
        {equipmentInspections.length > 0 && (
          <div className="overflow-x-auto border rounded-2xl">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-3 py-2 font-bold w-10">д/д</th>
                  <th className="px-3 py-2 font-bold">Тоног төхөөрөмж</th>
                  <th className="px-3 py-2 font-bold">Төлөв</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {equipmentInspections.map((r, idx) => (
                  <tr key={r.key}>
                    <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-2 text-gray-900">{r.label}</td>
                    <td className="px-3 py-2">{badge(r.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.notes?.trim() ? (
          <div>
            <p className="font-bold text-gray-800 mb-1">Тэмдэглэгээ</p>
            <p className="text-gray-700 whitespace-pre-wrap font-mono text-xs">{data.notes}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-t border-gray-100 pt-4">
          <div><p className="text-gray-500 font-bold uppercase">Хүлээлгэн өгсөн</p><p className="text-gray-900">{data.sigHandingOver || data.operatorName || '—'}</p></div>
          <div><p className="text-gray-500 font-bold uppercase">Хүлээн авсан</p><p className="text-gray-900">{data.sigReceiving || '—'}</p></div>
          <div><p className="text-gray-500 font-bold uppercase">Технологийн мастер</p><p className="text-gray-900">{data.sigShiftMaster || '—'}</p></div>
        </div>
      </div>

      <div className="px-4 pb-4 md:px-6 md:pb-6">
        <EnvironmentCheckSection rows={(data as any)?.environmentChecks} readOnly />
      </div>
    </section>
  );
}
