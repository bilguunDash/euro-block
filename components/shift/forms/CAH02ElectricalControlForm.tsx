'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { AlertCircle, CheckCircle2, ChevronLeft, ClipboardList, Save } from 'lucide-react';

const cah02Fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());
import { ShiftSectionImageUploader, type ShiftSectionImage } from '@/components/shift/ShiftSectionImageUploader';
import {
  CAH02_SCHEDULE,
  cah02RowHasData,
  normalizeCAH02Payload,
  type CAH02Payload,
  type CAH02TimeRow,
} from '@/lib/cah02-electrical-control-form';
import { useToast } from '@/components/ui/ToastProvider';
import { RoleUserSelect } from '@/components/ui/RoleUserSelect';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';
import { resolveReceivingName } from '@/lib/shift-signature';

const CAH02_TEN_KV_IMAGE_SECTION = 'cah02_10_04_substation';
const CAH02_THIRTY_FIVE_KV_IMAGE_SECTION = 'cah02_35_04_substation';
const CAH02_TEN_KV_IMAGE_COLUMNS = [
  { key: 'measuredTime', label: '1. Хэмжилт авсан цаг' },
  { key: 'lineVoltage', label: '2. Шугамын хүчдэл' },
  { key: 'transformerTempA', label: '3. Трансформаторын температур A T1/T2' },
  { key: 'transformerTempB', label: '4. Трансформаторын температур B T1/T2' },
  { key: 'transformerTempC', label: '5. Трансформаторын температур C T1/T2' },
  { key: 'transformerCurrentInput1', label: '6. Трансформаторын гүйдэл Оруулга-1' },
  { key: 'transformerCurrentInput2', label: '7. Трансформаторын гүйдэл Оруулга-2' },
  { key: 'dieselMotorHours', label: '8. Дизель генератор Мото/цаг' },
  { key: 'dieselOilTemp', label: '9. Дизель генератор Тосны температур' },
  { key: 'fuel', label: '10. Дизель генератор Түлш' },
  { key: 'mebu1Voltage', label: '11. МЕБУ-н секц-1 Хүчдэл' },
  { key: 'mebu1Current', label: '12. МЕБУ-н секц-1 Гүйдэл' },
  { key: 'mebu1SectionSwitch', label: '13. МЕБУ-н секц-1 Секц холбогч' },
  { key: 'mebu2Voltage', label: '14. МЕБУ-н секц-2 Хүчдэл' },
  { key: 'mebu2Current', label: '15. МЕБУ-н секц-2 Гүйдэл' },
  { key: 'mebu2SectionSwitch', label: '16. МЕБУ-н секц-2 Секц холбогч' },
];
const CAH02_THIRTY_FIVE_KV_IMAGE_COLUMNS = [
  { key: 'measuredTime35', label: '1. Хэмжилт авсан цаг' },
  { key: 'lineVoltage35', label: '2. Шугамын хүчдэл' },
  { key: 'transHighCurrentT1', label: '3. Трансформаторын өндөр талын гүйдэл T1' },
  { key: 'transHighCurrentT2', label: '4. Трансформаторын өндөр талын гүйдэл T2' },
  { key: 'transHighCurrentWindoor', label: '5. Трансформаторын өндөр талын гүйдэл Виндоор' },
  { key: 'transLowCurrentInput1', label: '6. Трансформаторын нам талын гүйдэл Оруулга-1' },
  { key: 'transLowCurrentInput2', label: '7. Трансформаторын нам талын гүйдэл Оруулга-2' },
];

export function CAH02ElectricalControlForm({
  shiftDate, shiftType, operatorUid, operatorName, initialPayload, shiftId, initialImages, onImagesChange, onBack, onSubmit, submitting, receivingMasterName,
}: {
  shiftDate: string; shiftType: string; operatorUid: string; operatorName: string;
  initialPayload?: Partial<CAH02Payload> | null;
  receivingMasterName?: string | null;
  shiftId?: string;
  initialImages?: ShiftSectionImage[];
  onImagesChange?: (images: ShiftSectionImage[]) => void;
  onBack: () => void; onSubmit: (p: CAH02Payload) => Promise<void>; submitting: boolean;
}) {
  const toast = useToast();
  const initial = useMemo(() => {
    const payload = normalizeCAH02Payload(initialPayload, { shiftDate, shiftType, operatorUid, operatorName });
    return { ...payload, sigReceiving: resolveReceivingName(payload.sigReceiving, receivingMasterName) };
  }, [shiftDate, shiftType, operatorUid, operatorName, initialPayload, receivingMasterName]);
  const [form, setForm] = useState(() => ({ ...(initial as any) }));
  const [formShiftDate, setFormShiftDate] = useState(shiftDate);

  const nextMasterUrl =
    shiftId && shiftDate && shiftType
      ? `/api/master-schedule-next?stationCode=${encodeURIComponent('ҮЯ-410')}&shiftDate=${encodeURIComponent(shiftDate)}&shiftType=${encodeURIComponent(shiftType)}`
      : null;
  const { data: nextMasterData } = useSWR(nextMasterUrl, cah02Fetcher, { revalidateOnFocus: false });
  const autoMasterName: string =
    nextMasterData?.ok && nextMasterData?.found ? String(nextMasterData.schedule?.masterName || '') : '';
  const scheduleNotFound = nextMasterData !== undefined && nextMasterData?.ok && !nextMasterData?.found;

  const autoFilledRef = useRef(false);
  useEffect(() => {
    if (autoFilledRef.current || !autoMasterName) return;
    setForm((p: any) => {
      if (p.sigReceiving?.trim()) return p;
      autoFilledRef.current = true;
      return { ...p, sigReceiving: autoMasterName };
    });
  }, [autoMasterName]);
  const tenKvImageTargets = useMemo(
    () =>
      form.rows.map((row: CAH02TimeRow, index: number) => ({
        key: row.id,
        label: `${index + 1}. ${row.scheduledDay}/${row.scheduledNight}`,
      })),
    [form.rows]
  );
  const thirtyFiveKvImageTargets = useMemo(
    () =>
      form.rows.map((row: CAH02TimeRow, index: number) => ({
        key: row.id,
        label: `${index + 1}. ${row.scheduledDay}/${row.scheduledNight}`,
      })),
    [form.rows]
  );

  const patchRow = (id: string, patch: Partial<CAH02TimeRow>) => {
    setForm((p: CAH02Payload) => ({ ...p, rows: p.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Талбарууд ХООСОН БАЙЖ БОЛНО — «заавал бөглөх» шалгалтыг хэрэглэгчийн
    // хүсэлтээр авав. Дутуу бөглөсөн маягтыг ч хадгална.

    const payload: CAH02Payload = {
      ...(form as any),
      shiftDate: formShiftDate,
      shiftType,
      stationCode: 'ҮЯ-410',
      operatorUid,
      operatorName,
      sigHandingOver: operatorName,
      submittedAt: new Date().toISOString(),
      ...(scheduleNotFound ? { needsAdminApproval: true } : {}),
    } as any;
    await onSubmit(payload);
  };

  const inp = 'w-full px-1.5 py-1.5 rounded-lg border border-gray-200 text-sm text-center min-w-[60px]';
  const dtInp = 'w-full px-1.5 py-1.5 rounded-lg border border-gray-200 text-[10px] text-center min-w-[135px]';

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} disabled={submitting} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-bold disabled:opacity-50">
          <ChevronLeft className="w-5 h-5" /> Буцах
        </button>
        <p className="text-xs text-gray-500 font-medium hidden sm:block">ЦАХ-02</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-4">
          <h1 className="text-lg md:text-xl font-bold text-gray-900 leading-snug flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-600" />
            ЦАХ-02: Цахилгаан автоматжуулалтын хэсгийн ээлж хүлээлцэх хяналтын хуудас
          </h1>
          <p className="text-sm text-gray-500">10/0.4кВ дэд станц</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Огноо</label>
              <input type="date" value={formShiftDate} onChange={(e) => setFormShiftDate(e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Ээлж</label>
              <input type="text" value={shiftType} readOnly className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-gray-700" />
            </div>
          </div>
        </div>

        {/* ── Main table ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <span className="font-bold text-sm text-gray-800">Хэмжилтийн бүртгэл - 10/0.4кВ дэд станц</span>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Хэмжилт бүрийн дараа хадгалж болно. Бөглөж эхлээгүй мөрийг хоосон орхино.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="text-left text-[11px] w-max min-w-full">
              <thead>
                {/* Group headers row 1 */}
                <tr className="bg-gray-100 text-[9px] uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-2 py-1 w-8 text-center" rowSpan={3}>№</th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={2}>
                    <div className="text-[9px] normal-case">Хэмжилт авах<br />цаг / Ээлж</div>
                  </th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={3}>
                    <div className="text-[9px] normal-case">Хэмжилт<br />авсан цаг</div>
                  </th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={3}>
                    <div className="text-[9px] normal-case">Шугамын<br />хүчдэл</div>
                  </th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={3}>
                    <div className="text-[9px] normal-case">Трансформаторын<br />температур /С°/</div>
                  </th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={2}>
                    <div className="text-[9px] normal-case">Трансформаторын<br />гүйдэл /А/</div>
                  </th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={3}>
                    <div className="text-[9px] normal-case">Дизель генераторын<br />үзлэг</div>
                  </th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={3}>
                    <div className="text-[9px] normal-case">МЕБУ-н секц-1</div>
                  </th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={3}>
                    <div className="text-[9px] normal-case">МЕБУ-н секц-2</div>
                  </th>
                </tr>
                {/* Sub headers row 2 */}
                <tr className="bg-gray-50 text-[9px] text-gray-500 border-b border-gray-200">
                  <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={2}>Өдөр</th>
                  <th className="px-2 py-1 text-center" rowSpan={2}>Шөнө</th>
                  <th className="px-2 py-1 text-center border-l border-gray-200 min-w-[55px]" rowSpan={2}>A<br />T1/T2</th>
                  <th className="px-2 py-1 text-center min-w-[55px]" rowSpan={2}>B<br />T1/T2</th>
                  <th className="px-2 py-1 text-center min-w-[55px]" rowSpan={2}>C<br />T1/T2</th>
                  <th className="px-2 py-1 text-center border-l border-gray-200 min-w-[65px]" rowSpan={2}>Оруулга-1</th>
                  <th className="px-2 py-1 text-center min-w-[65px]" rowSpan={2}>Оруулга-2</th>
                  <th className="px-2 py-1 text-center border-l border-gray-200 min-w-[60px]" rowSpan={2}>Мото/<br />цаг</th>
                  <th className="px-2 py-1 text-center min-w-[60px]" rowSpan={2}>Тосны<br />темп /С°/</th>
                  <th className="px-2 py-1 text-center min-w-[60px]" rowSpan={2}>Түлш<br />/л/</th>
                  <th className="px-2 py-1 text-center border-l border-gray-200 min-w-[60px]" rowSpan={2}>Хүчдэл<br />/В/</th>
                  <th className="px-2 py-1 text-center min-w-[60px]" rowSpan={2}>Гүйдэл<br />/А/</th>
                  <th className="px-2 py-1 text-center min-w-[55px]" rowSpan={2}>Секц<br />холбогч</th>
                  <th className="px-2 py-1 text-center border-l border-gray-200 min-w-[60px]" rowSpan={2}>Хүчдэл</th>
                  <th className="px-2 py-1 text-center min-w-[60px]" rowSpan={2}>Гүйдэл<br />/А/</th>
                  <th className="px-2 py-1 text-center min-w-[55px]" rowSpan={2}>Секц<br />холбогч</th>
                </tr>
                <tr className="border-b border-gray-200" />
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.rows.map((row: CAH02TimeRow, idx: number) => {
                  const sched = CAH02_SCHEDULE[idx];
                  return (
                    <tr key={row.id} className="align-middle hover:bg-gray-50/50">
                      <td className="px-2 py-2 text-gray-500 text-center">{sched?.num ?? idx + 1}</td>
                      <td className="px-2 py-2 text-center text-gray-700 font-medium">{row.scheduledDay}</td>
                      <td className="px-2 py-2 text-center text-gray-700 font-medium">{row.scheduledNight}</td>
                      <td className="px-2 py-2"><input type="datetime-local" value={row.measuredTime} onChange={(e) => patchRow(row.id, { measuredTime: e.target.value })} className={dtInp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.lineVoltage} onChange={(e) => patchRow(row.id, { lineVoltage: e.target.value })} className={inp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.transformerTempA} onChange={(e) => patchRow(row.id, { transformerTempA: e.target.value })} className={inp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.transformerTempB} onChange={(e) => patchRow(row.id, { transformerTempB: e.target.value })} className={inp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.transformerTempC} onChange={(e) => patchRow(row.id, { transformerTempC: e.target.value })} className={inp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.transformerCurrentInput1} onChange={(e) => patchRow(row.id, { transformerCurrentInput1: e.target.value })} className={inp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.transformerCurrentInput2} onChange={(e) => patchRow(row.id, { transformerCurrentInput2: e.target.value })} className={inp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.dieselMotorHours} onChange={(e) => patchRow(row.id, { dieselMotorHours: e.target.value })} className={inp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.dieselOilTemp} onChange={(e) => patchRow(row.id, { dieselOilTemp: e.target.value })} className={inp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.fuel} onChange={(e) => patchRow(row.id, { fuel: e.target.value })} className={inp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.mebu1Voltage} onChange={(e) => patchRow(row.id, { mebu1Voltage: e.target.value })} className={inp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.mebu1Current} onChange={(e) => patchRow(row.id, { mebu1Current: e.target.value })} className={inp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.mebu1SectionSwitch} onChange={(e) => patchRow(row.id, { mebu1SectionSwitch: e.target.value })} className={inp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.mebu2Voltage} onChange={(e) => patchRow(row.id, { mebu2Voltage: e.target.value })} className={inp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.mebu2Current} onChange={(e) => patchRow(row.id, { mebu2Current: e.target.value })} className={inp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.mebu2SectionSwitch} onChange={(e) => patchRow(row.id, { mebu2SectionSwitch: e.target.value })} className={inp} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <ShiftSectionImageUploader
          shiftId={shiftId}
          images={initialImages}
          onImagesChange={onImagesChange}
          section={CAH02_TEN_KV_IMAGE_SECTION}
          title="10/0.4кВ дэд станцын зураг хавсаргах төрөл"
          targets={tenKvImageTargets}
          columns={CAH02_TEN_KV_IMAGE_COLUMNS}
          fallbackLabel="10/0.4кВ дэд станцын зураг"
        />

        {/* ── 35/0.4кВ дэд станц ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-bold text-sm text-gray-800">
            Хэмжилтийн бүртгэл - 35/0.4кВ дэд станц
          </div>
          <div className="overflow-x-auto">
            <table className="text-left text-[11px] w-max min-w-full">
              <thead>
                <tr className="bg-gray-100 text-[9px] uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-2 py-1 w-8 text-center" rowSpan={3}>№</th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={2}>
                    <div className="text-[9px] normal-case">Хэмжилт авах<br />цаг</div>
                  </th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={3}>
                    <div className="text-[9px] normal-case">Хэмжилт<br />авсан цаг</div>
                  </th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={3}>
                    <div className="text-[9px] normal-case">Шугамын<br />хүчдэл</div>
                  </th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={3}>
                    <div className="text-[9px] normal-case">Трансформаторын өндөр<br />талын гүйдэл /А/</div>
                  </th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={2}>
                    <div className="text-[9px] normal-case">Трансформаторын нам<br />талын гүйдэл</div>
                  </th>
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
                {form.rows.map((row: CAH02TimeRow, idx: number) => {
                  const sched = CAH02_SCHEDULE[idx];
                  return (
                    <tr key={row.id} className="align-middle hover:bg-gray-50/50">
                      <td className="px-2 py-2 text-gray-500 text-center">{sched?.num ?? idx + 1}</td>
                      <td className="px-2 py-2 text-center text-gray-700 font-medium">{row.scheduledDay}</td>
                      <td className="px-2 py-2 text-center text-gray-700 font-medium">{row.scheduledNight}</td>
                      <td className="px-2 py-2"><input type="datetime-local" value={row.measuredTime35} onChange={(e) => patchRow(row.id, { measuredTime35: e.target.value })} className={dtInp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.lineVoltage35} onChange={(e) => patchRow(row.id, { lineVoltage35: e.target.value })} className={inp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.transHighCurrentT1} onChange={(e) => patchRow(row.id, { transHighCurrentT1: e.target.value })} className={inp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.transHighCurrentT2} onChange={(e) => patchRow(row.id, { transHighCurrentT2: e.target.value })} className={inp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.transHighCurrentWindoor} onChange={(e) => patchRow(row.id, { transHighCurrentWindoor: e.target.value })} className={inp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.transLowCurrentInput1} onChange={(e) => patchRow(row.id, { transLowCurrentInput1: e.target.value })} className={inp} /></td>
                      <td className="px-2 py-2"><input type="text" value={row.transLowCurrentInput2} onChange={(e) => patchRow(row.id, { transLowCurrentInput2: e.target.value })} className={inp} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <ShiftSectionImageUploader
          shiftId={shiftId}
          images={initialImages}
          onImagesChange={onImagesChange}
          section={CAH02_THIRTY_FIVE_KV_IMAGE_SECTION}
          title="35/0.4кВ дэд станцын зураг хавсаргах төрөл"
          targets={thirtyFiveKvImageTargets}
          columns={CAH02_THIRTY_FIVE_KV_IMAGE_COLUMNS}
          fallbackLabel="35/0.4кВ дэд станцын зураг"
        />

        {/* ── Анхаарах зүйлс ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="text-xs font-bold text-gray-600 uppercase mb-3">Анхаарах зүйлс</p>
          <textarea 
            value={form.attentionNotes} 
            onChange={(e) => setForm((p: CAH02Payload) => ({ ...p, attentionNotes: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm min-h-[120px] focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
            placeholder="Тэмдэглэл бичих..."
          />
        </div>

        {/* ── Хийж гүйцэтгэсэн ажил ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="text-xs font-bold text-gray-600 uppercase mb-3">Хийж гүйцэтгэсэн ажил</p>
          <textarea 
            value={form.workPerformed} 
            onChange={(e) => setForm((p: CAH02Payload) => ({ ...p, workPerformed: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm min-h-[120px] focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
            placeholder="Ажлын тайлан бичих..."
          />
        </div>

        {/* ── Гарын үсэг + Submit ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          {autoMasterName && form.sigReceiving === autoMasterName && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
              <span>Хуваарийн дагуу <strong>{autoMasterName}</strong> автоматаар тодорхойлогдлоо.</span>
            </div>
          )}
          {scheduleNotFound && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
              <span>Дараагийн мастерын хуваарь олдсонгүй. Гараар сонгох эсвэл Admin баталгаажуулна.</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-2">Ээлж хүлээлгэж өгсөн цахилгаан автоматжуулалтын мастер, цахилгаанчин</p>
              <input type="text" value={operatorName} readOnly className="w-full px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-700 font-medium" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-2">Ээлж хүлээж авсан цахилгаан автоматжуулалтын мастер, цахилгаанчин</p>
              <RoleUserSelect
                roles={['master']}
                value={form.sigReceiving}
                onChange={(_id, user) => setForm((p: CAH02Payload) => ({ ...p, sigReceiving: user?.label || '' }))}
                placeholder="Сонгох..."
              />
            </div>
          </div>

          <EnvironmentCheckSection
            rows={(form as any).environmentChecks}
            onChange={(rows) => setForm((prev: any) => ({ ...prev, environmentChecks: rows }))}
            disabled={submitting}
          />

          <div className="flex items-center justify-end gap-3 pt-6">
            <button type="button" onClick={onBack} disabled={submitting} className="px-6 py-3 rounded-xl bg-gray-100 font-bold text-gray-800 hover:bg-gray-200 disabled:opacity-60">Цуцлах</button>
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 disabled:opacity-60">
              <Save className="w-5 h-5" /> Хадгалах
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
