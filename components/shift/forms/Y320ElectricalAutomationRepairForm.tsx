'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ClipboardList, Plus, Save, Trash2 } from 'lucide-react';
import { ShiftSectionImageUploader, type ShiftSectionImage } from '@/components/shift/ShiftSectionImageUploader';
import {
  createEmptyY320Payload,
  emptyY320Row,
  y320RowHasData,
  type Y320ElectricalAutomationRepairPayload,
  type Y320RepairRow,
  type Y320RepairType,
} from '@/lib/y320-electrical-automation-repair-form';
import { useToast } from '@/components/ui/ToastProvider';
import { RoleUserSelect } from '@/components/ui/RoleUserSelect';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';
import { resolveReceivingName } from '@/lib/shift-signature';

const REPAIR_TYPES: { value: Y320RepairType; label: string; color: string }[] = [
  { value: 'major', label: 'Их засвар', color: 'bg-green-500' },
  { value: 'routine', label: 'Урсгал засвар', color: 'bg-yellow-400' },
  { value: 'planned', label: 'Төлөвлөгөөт засвар', color: 'bg-orange-400' },
  { value: 'sudden', label: 'Гэнэтийн эвдрэл', color: 'bg-red-500' },
];
const Y320_REPAIR_IMAGE_SECTION = 'y320_repair_record';
const Y320_REPAIR_IMAGE_COLUMNS = [
  { key: 'section', label: '1. Хэсэг' },
  { key: 'enteredRepairDate', label: '2. Засварт орсон' },
  { key: 'leftRepairDate', label: '3. Засвараас гарсан' },
  { key: 'shift', label: '4. Ээлж' },
  { key: 'repairStartTime', label: '5. Засвар эхлэх' },
  { key: 'repairEndTime', label: '6. Засвар дуусах' },
  { key: 'toolReceivedTime', label: '7. Багаж хүлээсэн цаг' },
  { key: 'partsReceivedTime', label: '8. Сэлбэг хүлээсэн цаг' },
  { key: 'affectedProduction', label: '9. Үйлдвэрийн бүтээлд нөлөөлсөн эсэх' },
  { key: 'shiftNumber', label: '10. Ээлж №' },
  { key: 'majorRepair', label: '11. Их засвар' },
  { key: 'routineRepair', label: '12. Урсгал засвар' },
  { key: 'plannedRepair', label: '13. Төлөвлөгөөт засвар' },
  { key: 'suddenFailure', label: '14. Гэнэтийн эвдрэл' },
  { key: 'damageCondition', label: '15. Эвдрэл гэмтлийн байдал' },
  { key: 'damageCause', label: '16. Эвдрэл гэмтлийн шалтгаан' },
  { key: 'repairWorkDone', label: '17. Засварын ажлын гүйцэтгэсэн ажил' },
  { key: 'performerName', label: '18. Гүйцэтгэсэн - Нэр' },
  { key: 'performerPosition', label: '19. Гүйцэтгэсэн - Албан тушаал' },
  { key: 'performerManHours', label: '20. Гүйцэтгэсэн - Хүн/цаг' },
  { key: 'receiverName', label: '21. Хүлээж авсан - Нэр' },
  { key: 'receiverPosition', label: '22. Хүлээж авсан - Албан тушаал' },
  { key: 'totalDuration', label: '23. Нийт хугацаа' },
  { key: 'workerCount', label: '24. Ажилласан хүний тоо' },
];

export function Y320ElectricalAutomationRepairForm({
  shiftDate, shiftType, operatorUid, operatorName, initialPayload, shiftId, initialImages, onImagesChange, onBack, onSubmit, submitting, receivingName,
}: {
  shiftDate: string; shiftType: string; operatorUid: string; operatorName: string;
  initialPayload?: Partial<Y320ElectricalAutomationRepairPayload> | null;
  receivingName?: string | null;
  shiftId?: string;
  initialImages?: ShiftSectionImage[];
  onImagesChange?: (images: ShiftSectionImage[]) => void;
  onBack: () => void; onSubmit: (p: Y320ElectricalAutomationRepairPayload) => Promise<void>; submitting: boolean;
}) {
  const toast = useToast();
  const initial = useMemo(() => {
    const empty = createEmptyY320Payload({ shiftDate, shiftType, operatorUid, operatorName });
    const p = initialPayload ?? null;
    return p
      ? ({
          ...empty,
          ...p,
          rows: Array.isArray(p.rows) && p.rows.length > 0 ? p.rows : empty.rows,
          sigReceiving: resolveReceivingName(p.sigReceiving, receivingName),
        } as any)
      : { ...empty, sigReceiving: resolveReceivingName(receivingName) };
  }, [shiftDate, shiftType, operatorUid, operatorName, initialPayload, receivingName]);
  const [form, setForm] = useState<Y320ElectricalAutomationRepairPayload>(() => ({ ...(initial as any) }));
  const [formShiftDate, setFormShiftDate] = useState(shiftDate);
  const repairImageTargets = useMemo(
    () =>
      form.rows.map((row, index) => ({
        key: row.id,
        label: `${index + 1}. ${row.section?.trim() || 'Засварын мөр'}`,
      })),
    [form.rows]
  );

  const patchRow = (id: string, patch: Partial<Y320RepairRow>) => {
    setForm((p) => ({ ...p, rows: p.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  };
  const addRow = () => setForm((p) => ({ ...p, rows: [...p.rows, emptyY320Row(shiftType)] }));
  const removeRow = (id: string) => {
    setForm((p) => ({ ...p, rows: p.rows.length > 1 ? p.rows.filter((r) => r.id !== id) : p.rows }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Талбарууд ХООСОН БАЙЖ БОЛНО — «заавал бөглөх» шалгалтыг хэрэглэгчийн
    // хүсэлтээр авав. Дутуу бөглөсөн маягтыг ч хадгална.
    //
    // `filledRows` нь ХЭВЭЭР — огт хоосон мөрийг payload-д оруулахгүйн тулд
    // ашиглагдана (маягт үргэлж нэг хоосон мөртэй эхэлдэг).
    const filledRows = form.rows.filter(y320RowHasData);

    const payload: Y320ElectricalAutomationRepairPayload = {
      ...(form as any),
      // Хоосон мөрийг хадгалахгүй — засвар гараагүй ээлжид `rows: []` болно.
      rows: filledRows,
      shiftDate: formShiftDate,
      shiftType,
      stationCode: 'ҮЯ-320',
      operatorUid,
      operatorName,
      sigHandingOver: operatorName,
      submittedAt: new Date().toISOString(),
    };
    await onSubmit(payload);
  };

  const inp = 'w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm';

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} disabled={submitting} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-bold disabled:opacity-50">
          <ChevronLeft className="w-5 h-5" /> Буцах
        </button>
        <p className="text-xs text-gray-500 font-medium hidden sm:block">ҮЯ-320</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-4">
          <h1 className="text-lg md:text-xl font-bold text-gray-900 leading-snug flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-600" />
            ҮЯ-320: Цахилгаан автоматжуулалтын засварын бүртгэл
          </h1>
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

        {/* ── Засварын бүртгэл хүснэгт ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-3">
            <div>
              <span className="font-bold text-sm text-gray-800">Бүртгэл</span>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Ээлжид засвар гараагүй бол мөрийг хоосон орхиод шууд хадгална.
              </p>
            </div>
            <button type="button" onClick={addRow} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700">
              <Plus className="w-4 h-4" /> Мөр нэмэх
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="text-left text-sm w-max min-w-full">
              <thead>
                {/* Group headers */}
                <tr className="bg-gray-100 text-[10px] uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-2 py-1 w-8" rowSpan={2}>№</th>
                  <th className="px-2 py-1 min-w-[140px]" rowSpan={2}>Хэсэг</th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={2}>Огноо</th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={2}>
                    <div className="leading-tight normal-case text-[10px]">Ээлж:<br />Өдөр/Шөнө</div>
                  </th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={2}>Хугацаа /цаг/</th>
                  <th className="px-2 py-1 text-center border-l border-gray-200 min-w-[170px]" rowSpan={2}>
                    <div className="leading-tight normal-case text-[10px]">Багаж<br />хүлээсэн цаг</div>
                  </th>
                  <th className="px-2 py-1 text-center border-l border-gray-200 min-w-[170px]" rowSpan={2}>
                    <div className="leading-tight normal-case text-[10px]">Сэлбэг<br />хүлээсэн цаг</div>
                  </th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={2}>
                    <div className="leading-tight normal-case text-[10px]">Үйлдвэрийн<br />бүтээлд<br />нөлөөлсөн эсэх</div>
                  </th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" rowSpan={2}>
                    <div className="leading-tight normal-case text-[10px]">Ээлж №</div>
                  </th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={4}>Төлөв</th>
                  <th className="px-2 py-1 min-w-[160px] border-l border-gray-200" rowSpan={2}>
                    <div className="leading-tight normal-case text-[10px]">Эвдрэл гэмтлийн<br />байдал</div>
                  </th>
                  <th className="px-2 py-1 min-w-[160px] border-l border-gray-200" rowSpan={2}>
                    <div className="leading-tight normal-case text-[10px]">Эвдрэл гэмтлийн<br />шалтгаан</div>
                  </th>
                  <th className="px-2 py-1 min-w-[180px] border-l border-gray-200" rowSpan={2}>
                    <div className="leading-tight normal-case text-[10px]">Засварын ажлын<br />гүйцэтгэсэн ажил</div>
                  </th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={3}>Гүйцэтгэсэн</th>
                  <th className="px-2 py-1 text-center border-l border-gray-200" colSpan={2}>Хүлээж авсан</th>
                  <th className="px-2 py-1 min-w-[90px] border-l border-gray-200" rowSpan={2}>
                    <div className="leading-tight normal-case text-[10px]">Нийт<br />хугацаа</div>
                  </th>
                  <th className="px-2 py-1 min-w-[80px] border-l border-gray-200" rowSpan={2}>
                    <div className="leading-tight normal-case text-[10px]">Ажилласан<br />хүний тоо</div>
                  </th>
                  <th className="px-2 py-1 w-10 border-l border-gray-200" rowSpan={2}></th>
                </tr>
                {/* Sub headers */}
                <tr className="bg-gray-50 text-[10px] text-gray-500 border-b border-gray-200">
                  <th className="px-2 py-1.5 min-w-[170px] border-l border-gray-200 whitespace-normal">Засварт орсон</th>
                  <th className="px-2 py-1.5 min-w-[170px] whitespace-normal">Засвараас гарсан</th>
                  <th className="px-2 py-1.5 min-w-[170px] border-l border-gray-200 whitespace-normal">Засвар эхлэх</th>
                  <th className="px-2 py-1.5 min-w-[170px] whitespace-normal">Засвар дуусах</th>
                  <th className="px-2 py-1.5 min-w-[70px] border-l border-gray-200 text-center">
                    <span className="inline-block w-full px-1 py-0.5 rounded bg-green-500 text-white font-bold text-[9px]">Их засвар</span>
                  </th>
                  <th className="px-2 py-1.5 min-w-[70px] text-center">
                    <span className="inline-block w-full px-1 py-0.5 rounded bg-yellow-400 text-gray-900 font-bold text-[9px]">Урсгал засвар</span>
                  </th>
                  <th className="px-2 py-1.5 min-w-[80px] text-center">
                    <span className="inline-block w-full px-1 py-0.5 rounded bg-orange-400 text-white font-bold text-[9px]">Төлөвлөгөөт засвар</span>
                  </th>
                  <th className="px-2 py-1.5 min-w-[80px] text-center">
                    <span className="inline-block w-full px-1 py-0.5 rounded bg-red-500 text-white font-bold text-[9px]">Гэнэтийн эвдрэл</span>
                  </th>
                  <th className="px-2 py-1.5 min-w-[100px] border-l border-gray-200 whitespace-normal">Нэр</th>
                  <th className="px-2 py-1.5 min-w-[100px] whitespace-normal">Албан тушаал</th>
                  <th className="px-2 py-1.5 min-w-[80px] whitespace-normal">Хүн/цаг</th>
                  <th className="px-2 py-1.5 min-w-[100px] border-l border-gray-200 whitespace-normal">Нэр</th>
                  <th className="px-2 py-1.5 min-w-[100px] whitespace-normal">Албан тушаал</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.rows.map((row, idx) => (
                  <tr key={row.id} className="align-top hover:bg-gray-50/50">
                    <td className="px-2 py-2 text-gray-500 text-center">{idx + 1}</td>
                    <td className="px-2 py-2"><input type="text" value={row.section} onChange={(e) => patchRow(row.id, { section: e.target.value })} className={inp} /></td>
                    <td className="px-2 py-2"><input type="datetime-local" value={row.enteredRepairDate} onChange={(e) => patchRow(row.id, { enteredRepairDate: e.target.value })} className={inp} /></td>
                    <td className="px-2 py-2"><input type="datetime-local" value={row.leftRepairDate} onChange={(e) => patchRow(row.id, { leftRepairDate: e.target.value })} className={inp} /></td>
                    <td className="px-2 py-2 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${shiftType === 'Өдрийн' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>
                        {shiftType}
                      </span>
                    </td>
                    <td className="px-2 py-2"><input type="datetime-local" value={row.repairStartTime} onChange={(e) => patchRow(row.id, { repairStartTime: e.target.value })} className={inp} /></td>
                    <td className="px-2 py-2"><input type="datetime-local" value={row.repairEndTime} onChange={(e) => patchRow(row.id, { repairEndTime: e.target.value })} className={inp} /></td>
                    <td className="px-2 py-2"><input type="datetime-local" value={row.toolReceivedTime} onChange={(e) => patchRow(row.id, { toolReceivedTime: e.target.value })} className={inp} /></td>
                    <td className="px-2 py-2"><input type="datetime-local" value={row.partsReceivedTime} onChange={(e) => patchRow(row.id, { partsReceivedTime: e.target.value })} className={inp} /></td>
                    <td className="px-2 py-2"><input type="text" value={row.affectedProduction} onChange={(e) => patchRow(row.id, { affectedProduction: e.target.value })} className={inp} /></td>
                    <td className="px-2 py-2"><input type="text" value={row.shiftNumber} onChange={(e) => patchRow(row.id, { shiftNumber: e.target.value })} className={inp + ' max-w-[60px]'} /></td>
                    {/* Төлөв radio columns */}
                    {REPAIR_TYPES.map((rt) => (
                      <td key={rt.value} className="px-2 py-2 text-center">
                        <input
                          type="radio"
                          name={`repairType-${row.id}`}
                          checked={row.repairType === rt.value}
                          onChange={() => patchRow(row.id, { repairType: rt.value })}
                          className="w-4 h-4 accent-gray-700 cursor-pointer"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2"><input type="text" value={row.damageCondition} onChange={(e) => patchRow(row.id, { damageCondition: e.target.value })} className={inp} /></td>
                    <td className="px-2 py-2"><input type="text" value={row.damageCause} onChange={(e) => patchRow(row.id, { damageCause: e.target.value })} className={inp} /></td>
                    <td className="px-2 py-2"><input type="text" value={row.repairWorkDone} onChange={(e) => patchRow(row.id, { repairWorkDone: e.target.value })} className={inp} /></td>
                    <td className="px-2 py-2"><input type="text" value={row.performerName} onChange={(e) => patchRow(row.id, { performerName: e.target.value })} className={inp} /></td>
                    <td className="px-2 py-2"><input type="text" value={row.performerPosition} onChange={(e) => patchRow(row.id, { performerPosition: e.target.value })} className={inp} /></td>
                    <td className="px-2 py-2"><input type="text" value={row.performerManHours} onChange={(e) => patchRow(row.id, { performerManHours: e.target.value })} className={inp} /></td>
                    <td className="px-2 py-2"><input type="text" value={row.receiverName} onChange={(e) => patchRow(row.id, { receiverName: e.target.value })} className={inp} /></td>
                    <td className="px-2 py-2"><input type="text" value={row.receiverPosition} onChange={(e) => patchRow(row.id, { receiverPosition: e.target.value })} className={inp} /></td>
                    <td className="px-2 py-2"><input type="text" value={row.totalDuration} onChange={(e) => patchRow(row.id, { totalDuration: e.target.value })} className={inp} /></td>
                    <td className="px-2 py-2"><input type="text" value={row.workerCount} onChange={(e) => patchRow(row.id, { workerCount: e.target.value })} className={inp} /></td>
                    <td className="px-2 py-2 text-center">
                      <button type="button" onClick={() => removeRow(row.id)} disabled={form.rows.length <= 1} className="text-red-400 hover:text-red-600 disabled:opacity-30">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <ShiftSectionImageUploader
          shiftId={shiftId}
          images={initialImages}
          onImagesChange={onImagesChange}
          section={Y320_REPAIR_IMAGE_SECTION}
          title="ҮЯ-320 засварын бүртгэлийн зураг хавсаргах төрөл"
          targets={repairImageTargets}
          columns={Y320_REPAIR_IMAGE_COLUMNS}
          fallbackLabel="ҮЯ-320 засварын бүртгэлийн зураг"
        />

        {/* ── Гарын үсэг + Submit ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">Ээлж хүлээлгэн өгсөн</p>
              <input type="text" value={operatorName} readOnly className="w-full px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-700" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">Ээлж хүлээн авсан</p>
              <RoleUserSelect
                roles={['operator', 'master']}
                value={form.sigReceiving}
                onChange={(_id, user) => setForm((p) => ({ ...p, sigReceiving: user?.label || '' }))}
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
