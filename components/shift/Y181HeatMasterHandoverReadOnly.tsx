'use client';

import { ClipboardList } from 'lucide-react';
import type { Y181HeatMasterHandoverPayload } from '@/lib/y181-heat-master-form';
import { normalizeY181HeatMasterHandoverPayload } from '@/lib/y181-heat-master-form';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';
import { resolveReceivingName } from '@/lib/shift-signature';

function badge(s: string) {
  if (s === 'yes') return <span className="text-emerald-700 font-bold">Тийм</span>;
  if (s === 'no') return <span className="text-red-700 font-bold">Үгүй</span>;
  return <span className="text-gray-400">—</span>;
}

function Section({ title, rows }: { title: string; rows: { key: string; label: string; status: string; note: string; valueOnly?: boolean }[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="font-bold text-gray-800 mb-2">{title}</p>
      <div className="overflow-x-auto border rounded-2xl">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
              <th className="px-3 py-2 w-10">№</th>
              <th className="px-3 py-2">Хяналт</th>
              <th className="px-3 py-2">Тийм / Үгүй</th>
              <th className="px-3 py-2">Нэмэлт мэдээлэл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <tr key={r.key}>
                <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                <td className="px-3 py-2 text-gray-900 font-medium">{r.label}</td>
                <td className="px-3 py-2">{r.valueOnly ? <span className="text-gray-400">—</span> : badge(r.status)}</td>
                <td className="px-3 py-2 text-gray-600">{r.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Y181HeatMasterHandoverReadOnly({
  data,
  receivingMasterName,
}: {
  data: Y181HeatMasterHandoverPayload;
  receivingMasterName?: string | null;
}) {
  const normalized = normalizeY181HeatMasterHandoverPayload(data, {
    shiftDate: data.shiftDate ?? '',
    shiftType: data.shiftType ?? '',
    operatorUid: data.operatorUid ?? '',
    operatorName: data.operatorName ?? '',
  });

  return (
    <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-orange-50/40">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-orange-600" />
          ҮЯ-181: Дулааны мастерын ээлж хүлээлцэх бүртгэл (хадгалсан)
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {normalized.shiftDate} · {normalized.shiftType}
          {normalized.crewNumber ? ` · Ээлж ${normalized.crewNumber}` : ''}
          {normalized.submittedAt ? ` · Илгээсэн: ${new Date(normalized.submittedAt).toLocaleString()}` : ''}
        </p>
      </div>

      <div className="p-4 md:p-6 space-y-6 overflow-y-auto text-sm">
        <Section title="1. Ус хангамж, бохир ус" rows={normalized.waterSupplyRows} />
        <Section title="2. Технологийн зуух" rows={normalized.kilnRows} />
        <Section title="3. Автоклав" rows={normalized.autoclaveRows} />
        <Section title="4. Халаалтын зуух, сантехникийн систем" rows={normalized.heatingRows} />

        {normalized.attentionNotes ? (
          <div>
            <p className="font-bold text-gray-800 mb-1">Дараагийн ээлжинд анхаарах зүйлс</p>
            <p className="text-gray-600 whitespace-pre-line">{normalized.attentionNotes}</p>
          </div>
        ) : null} 

        {normalized.workPerformed ? (
          <div>
            <p className="font-bold text-gray-800 mb-1">Хийсэн ажил</p>
            <p className="text-gray-600 whitespace-pre-line">{normalized.workPerformed}</p>
          </div>
        ) : null}

        {/* Signatures */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-t border-gray-100 pt-4">
          <div>
            <p className="text-gray-500 font-bold uppercase">Ээлж хүлээлгэн өгсөн</p>
            <p className="text-gray-900">{normalized.sigHandingOver || normalized.operatorName || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500 font-bold uppercase">Ээлж хүлээн авсан</p>
            <p className="text-gray-900">{resolveReceivingName(normalized.sigReceiving, receivingMasterName) || '—'}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 md:px-6 md:pb-6">
        <EnvironmentCheckSection rows={(data as any)?.environmentChecks} readOnly />
      </div>
    </section>
  );
}
