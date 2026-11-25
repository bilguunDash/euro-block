'use client';

import React from 'react';
import { ClipboardList } from 'lucide-react';
import {
  CAH02_SCHEDULE,
  normalizeCAH02Payload,
  type CAH02Payload,
  type CAH02TimeRow,
} from '@/lib/cah02-electrical-control-form';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';
import { resolveReceivingName } from '@/lib/shift-signature';

export function CAH02ElectricalControlReadOnly({
  data,
  receivingMasterName,
}: {
  data: CAH02Payload;
  receivingMasterName?: string | null;
}) {
  const normalized = normalizeCAH02Payload(data, {
    shiftDate: data.shiftDate || '',
    shiftType: data.shiftType || '',
    operatorUid: data.operatorUid || '',
    operatorName: data.operatorName || '',
  });
  const rows: CAH02TimeRow[] = normalized.rows;
  const st = (v: string | undefined) => v || '-';
  const fmtDT = (v: string | undefined) => {
    if (!v) return '-';
    if (v.includes('T')) return v.replace('T', ' ');
    return v;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-orange-600" />
        ЦАХ-02: Цахилгаан автоматжуулалтын хэсгийн ээлж хүлээлцэх хяналтын хуудас
      </h2>
      <p className="text-sm text-gray-500">10/0.4кВ дэд станц</p>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="text-[11px] w-max min-w-full">
          <thead>
            <tr className="bg-gray-100 text-[9px] uppercase text-gray-500 border-b border-gray-200">
              <th className="px-2 py-1 text-center" rowSpan={2}>№</th>
              <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={2}>Ээлж</th>
              <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={2}>Хэмжилт<br/>авсан цаг</th>
              <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={2}>Шугамын<br/>хүчдэл</th>
              <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={3}>Трансф. температур /С°/</th>
              <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={2}>Трансф. гүйдэл /А/</th>
              <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={3}>Дизель генератор</th>
              <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={3}>МЕБУ-н секц-1</th>
              <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={3}>МЕБУ-н секц-2</th>
            </tr>
            <tr className="bg-gray-50 text-[9px] text-gray-500 border-b border-gray-200">
              <th className="px-2 py-1 text-center border-l border-gray-200">Өдөр</th>
              <th className="px-2 py-1 text-center">Шөнө</th>
              <th className="px-2 py-1 text-center border-l border-gray-200">A T1/T2</th>
              <th className="px-2 py-1 text-center">B T1/T2</th>
              <th className="px-2 py-1 text-center">C T1/T2</th>
              <th className="px-2 py-1 text-center border-l border-gray-200">Оруулга-1</th>
              <th className="px-2 py-1 text-center">Оруулга-2</th>
              <th className="px-2 py-1 text-center border-l border-gray-200">Мото/цаг</th>
              <th className="px-2 py-1 text-center">Тосны темп</th>
              <th className="px-2 py-1 text-center">Түлш /л/</th>
              <th className="px-2 py-1 text-center border-l border-gray-200">Хүчдэл</th>
              <th className="px-2 py-1 text-center">Гүйдэл</th>
              <th className="px-2 py-1 text-center">Секц холб.</th>
              <th className="px-2 py-1 text-center border-l border-gray-200">Хүчдэл</th>
              <th className="px-2 py-1 text-center">Гүйдэл</th>
              <th className="px-2 py-1 text-center">Секц холб.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, idx) => {
              const sched = CAH02_SCHEDULE[idx];
              return (
                <tr key={row.id ?? idx} className="align-middle">
                  <td className="px-2 py-1.5 text-center text-gray-500">{sched?.num ?? idx + 1}</td>
                  <td className="px-2 py-1.5 text-center font-medium">{row.scheduledDay}</td>
                  <td className="px-2 py-1.5 text-center font-medium">{row.scheduledNight}</td>
                  <td className="px-2 py-1.5 text-center">{fmtDT(row.measuredTime)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.lineVoltage)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.transformerTempA)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.transformerTempB)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.transformerTempC)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.transformerCurrentInput1)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.transformerCurrentInput2)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.dieselMotorHours)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.dieselOilTemp)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.fuel)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.mebu1Voltage)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.mebu1Current)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.mebu1SectionSwitch)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.mebu2Voltage)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.mebu2Current)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.mebu2SectionSwitch)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 bg-gray-50 border-y border-gray-200 font-bold text-xs text-gray-800">
        Хэмжилтийн бүртгэл - 35/0.4кВ дэд станц
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="text-[11px] w-max min-w-full">
          <thead>
            <tr className="bg-gray-100 text-[9px] uppercase text-gray-500 border-b border-gray-200">
              <th className="px-2 py-1 text-center" rowSpan={3}>№</th>
              <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={2}>Хэмжилт авах цаг</th>
              <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={3}>Хэмжилт авсан цаг</th>
              <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={3}>Шугамын хүчдэл</th>
              <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={3}>Трансф. өндөр талын гүйдэл /А/</th>
              <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={2}>Трансф. нам талын гүйдэл</th>
            </tr>
            <tr className="bg-gray-50 text-[9px] text-gray-500 border-b border-gray-200">
              <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={2}>Ээлж</th>
              <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={2}>T1</th>
              <th className="px-2 py-1 text-center" rowSpan={2}>T2</th>
              <th className="px-2 py-1 text-center" rowSpan={2}>Виндоор</th>
              <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={2}>Оруулга-1</th>
              <th className="px-2 py-1 text-center" rowSpan={2}>Оруулга-2</th>
            </tr>
            <tr className="bg-gray-50 text-[9px] text-gray-500 border-b border-gray-200">
              <th className="px-2 py-1 text-center border-l border-gray-200">Өдөр</th>
              <th className="px-2 py-1 text-center">Шөнө</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, idx) => {
              const sched = CAH02_SCHEDULE[idx];
              return (
                <tr key={row.id ?? idx} className="align-middle">
                  <td className="px-2 py-1.5 text-center text-gray-500">{sched?.num ?? idx + 1}</td>
                  <td className="px-2 py-1.5 text-center font-medium">{row.scheduledDay}</td>
                  <td className="px-2 py-1.5 text-center font-medium">{row.scheduledNight}</td>
                  <td className="px-2 py-1.5 text-center">{fmtDT(row.measuredTime35)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.lineVoltage35)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.transHighCurrentT1)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.transHighCurrentT2)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.transHighCurrentWindoor)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.transLowCurrentInput1)}</td>
                  <td className="px-2 py-1.5 text-center">{st(row.transLowCurrentInput2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Анхаарах зүйлс</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{st(normalized.attentionNotes)}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Хийж гүйцэтгэсэн ажил</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{st(normalized.workPerformed)}</p>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4 border-t border-gray-100">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Ээлж хүлээлгэж өгсөн мастер, цахилгаанчин</p>
          <p className="text-sm font-bold text-gray-800">{normalized.sigHandingOver || '-'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Ээлж хүлээж авсан мастер, цахилгаанчин</p>
          <p className="text-sm font-bold text-gray-800">{resolveReceivingName(normalized.sigReceiving, receivingMasterName) || '—'}</p>
        </div>
      </div>

      <EnvironmentCheckSection rows={(data as any)?.environmentChecks} readOnly />
    </div>
  );
}
