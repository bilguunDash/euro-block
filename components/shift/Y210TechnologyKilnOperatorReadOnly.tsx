'use client';

import { ClipboardList } from 'lucide-react';
import type { Y210TechnologyKilnOperatorPayload } from '@/lib/y210-technology-kiln-operator-form';
import {
  mergeY210Rows,
  Y210_PARAM_COLS_MAIN,
  Y210_PARAM_COLS_TAIL,
} from '@/lib/y210-technology-kiln-operator-form';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

function badge(s: string) {
  if (s === 'normal') return <span className="text-emerald-700 font-bold">Хэвийн (+)</span>;
  if (s === 'abnormal') return <span className="text-red-700 font-bold">Хэвийн бус (−)</span>;
  return <span className="text-gray-400">—</span>;
}

export function Y210TechnologyKilnOperatorReadOnly({ data }: { data: Y210TechnologyKilnOperatorPayload }) {
  const rows = mergeY210Rows(data.rows);

  return (
    <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-orange-50/40">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-orange-600" />
          ҮЯ-210 — Технологийн зуухны операторын бүртгэл (хадгалсан)
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {data.shiftDate} · {data.shiftType}
          {data.submittedAt ? ` · Илгээсэн: ${new Date(data.submittedAt).toLocaleString()}` : ''}
        </p>
      </div>

      <div className="p-4 md:p-6 space-y-6 max-h-[640px] overflow-y-auto text-sm">
        <div className="overflow-x-auto border rounded-2xl">
          <table className="w-full text-left text-sm min-w-[1400px]">
            <thead>
              <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                <th className="px-3 py-2 font-bold w-10">№</th>
                <th className="px-3 py-2 font-bold w-20">Цаг</th>
                {Y210_PARAM_COLS_MAIN.map((c) => (
                  <th key={String(c.key)} className="px-3 py-2 font-bold min-w-[140px]">
                    <div className="leading-tight">
                      <div className="text-gray-700 normal-case">{c.label}</div>
                      {c.unit ? <div className="text-[10px] text-gray-400 normal-case">{c.unit}</div> : null}
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2 font-bold min-w-[140px]">
                  <div className="leading-tight normal-case">
                    <div className="text-gray-700">Ус зөөлрүүлэгчийн ажиллагаа</div>
                    <div className="text-[10px] text-gray-400 font-normal">Хэвийн / Хэвийн бус</div>
                  </div>
                </th>
                {Y210_PARAM_COLS_TAIL.map((c) => (
                  <th key={String(c.key)} className="px-3 py-2 font-bold min-w-[120px]">
                    <div className="leading-tight">
                      <div className="text-gray-700 normal-case">{c.label}</div>
                      {c.unit ? <div className="text-[10px] text-gray-400 normal-case">{c.unit}</div> : null}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, idx) => {
                return (
                  <tr key={`${r.time}_${idx}`} className="align-top">
                    <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-2 text-gray-900">{r.time || '—'}</td>
                    {Y210_PARAM_COLS_MAIN.map((c) => (
                      <td key={String(c.key)} className="px-3 py-2 text-gray-700">
                        {(r as any)[c.key]?.toString?.().trim?.() ? (r as any)[c.key] : <span className="text-gray-400">—</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2">{badge(r.status)}</td>
                    {Y210_PARAM_COLS_TAIL.map((c) => (
                      <td key={String(c.key)} className="px-3 py-2 text-gray-700">
                        {(r as any)[c.key]?.toString?.().trim?.() ? (r as any)[c.key] : <span className="text-gray-400">—</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {data.totalNote?.trim() ? (
          <div>
            <p className="font-bold text-gray-800 mb-1">Нийт хэрэглээ</p>
            <p className="text-gray-700 whitespace-pre-wrap">{data.totalNote}</p>
          </div>
        ) : null}

        {data.report?.trim() ? (
          <div>
            <p className="font-bold text-gray-800 mb-1">РАПОРТ</p>
            <p className="text-gray-700 whitespace-pre-wrap font-mono text-xs">{data.report}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-t border-gray-100 pt-4">
          <div>
            <p className="text-gray-500 font-bold uppercase">Хүлээлгэн өгсөн</p>
            <p className="text-gray-900">{data.sigHandingOver || data.operatorName || '—'}</p>
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
