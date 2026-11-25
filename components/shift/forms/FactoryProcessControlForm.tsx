'use client';

import React, { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ClipboardList, Save } from 'lucide-react';
import { ShiftSectionImageUploader, type ShiftSectionImage } from '@/components/shift/ShiftSectionImageUploader';
import { RoleUserSelect } from '@/components/ui/RoleUserSelect';
import {
  EQUIPMENT_CONTROL_ITEMS,
  normalizeFactoryProcessControlPayload,
  type ProcessControlStatus,
  type FactoryProcessControlPayload,
} from '@/lib/factory-process-control-form';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

const Y400_PROCESS_IMAGE_SECTION = 'y400_technology_process';
const Y400_FAILURE_IMAGE_SECTION = 'y400_equipment_failure';
const Y400_EQUIPMENT_CONTROL_IMAGE_SECTION = 'y400_equipment_control';

function StatusRadios({ value, onChange, name }: { value: ProcessControlStatus; onChange: (v: ProcessControlStatus) => void; name: string }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <label className="inline-flex items-center gap-1.5 cursor-pointer">
        <input type="radio" name={name} checked={value === 'normal'} onChange={() => onChange('normal')} />
        <span>Хэвийн</span>
      </label>
      <label className="inline-flex items-center gap-1.5 cursor-pointer">
        <input type="radio" name={name} checked={value === 'abnormal'} onChange={() => onChange('abnormal')} />
        <span>Хэвийн бус</span>
      </label>
    </div>
  );
}

export function FactoryProcessControlForm({
  shiftDate, shiftType, operatorUid, operatorName, initialPayload, shiftId, initialImages, onImagesChange, onBack, onSubmit, submitting,
  showEnvironmentChecks = true,
}: {
  shiftDate: string; shiftType: string; operatorUid: string; operatorName: string;
  initialPayload?: Partial<FactoryProcessControlPayload> | null;
  shiftId?: string;
  initialImages?: ShiftSectionImage[];
  onImagesChange?: (images: ShiftSectionImage[]) => void;
  onBack: () => void; onSubmit: (p: FactoryProcessControlPayload) => Promise<void>; submitting: boolean;
  showEnvironmentChecks?: boolean;
}) {
  const initial = useMemo(() => {
    return normalizeFactoryProcessControlPayload(initialPayload, { shiftDate, shiftType, operatorUid, operatorName });
  }, [shiftDate, shiftType, operatorUid, operatorName, initialPayload]);
  const [form, setForm] = useState(() => ({ ...(initial as any) }));
  const [formShiftDate, setFormShiftDate] = useState(shiftDate);
  const [invalidRowKey, setInvalidRowKey] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const processImageTargets = useMemo(
    () => form.rows.map((row: any, index: number) => ({ key: row.key, label: `${index + 1}. ${row.label}` })),
    [form.rows]
  );
  const failureImageTargets = useMemo(
    () => form.failureRows.map((row: any, index: number) => ({ key: row.key, label: `${index + 1}. ${row.label}` })),
    [form.failureRows]
  );
  const equipmentControlImageTargets = useMemo(
    () =>
      form.equipmentRows.map((row: any, index: number) => {
        const item = EQUIPMENT_CONTROL_ITEMS[index];
        return { key: row.key, label: `${item?.num ?? index + 5}. ${row.label}` };
      }),
    [form.equipmentRows]
  );

  const patchRow = (key: string, patch: Record<string, unknown>) => {
    setForm((p: FactoryProcessControlPayload) => ({ ...p, rows: p.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
    if (invalidRowKey === key && 'status' in patch) setInvalidRowKey(null);
  };
  const patchFailure = (key: string, patch: Record<string, unknown>) => {
    setForm((p: FactoryProcessControlPayload) => ({ ...p, failureRows: p.failureRows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
    if (invalidRowKey === key && 'status' in patch) setInvalidRowKey(null);
  };
  const patchEquipment = (key: string, patch: Record<string, unknown>) => {
    setForm((p: FactoryProcessControlPayload) => ({ ...p, equipmentRows: p.equipmentRows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
    if (invalidRowKey === key && 'status' in patch) setInvalidRowKey(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Талбарууд ХООСОН БАЙЖ БОЛНО — «заавал бөглөх» шалгалтуудыг (мөрүүдийн
    // төлөв, мастерын нэр) хэрэглэгчийн хүсэлтээр авав. Дутуу бөглөсөн хуудсыг
    // ч хадгална.
    const payload: FactoryProcessControlPayload = {
      ...(form as any),
      shiftDate: formShiftDate,
      shiftType,
      stationCode: 'ҮЯ-400',
      operatorUid,
      operatorName,
      submittedAt: new Date().toISOString(),
    };
    await onSubmit(payload);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} disabled={submitting} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-bold disabled:opacity-50">
          <ChevronLeft className="w-5 h-5" /> Буцах
        </button>
        <p className="text-xs text-gray-500 font-medium hidden sm:block">ҮЯ-400</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-4">
          <h1 className="text-lg md:text-xl font-bold text-gray-900 leading-snug flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-600" />
            Үйлдвэрийн процесст тавих хяналтын хуудас
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

        {/* ── Технологийн процесс ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-bold text-sm text-gray-800">
            Технологийн процесс
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-3 py-2 font-bold w-10">№</th>
                  <th className="px-3 py-2 font-bold min-w-[260px]">Хяналт</th>
                  <th className="px-3 py-2 font-bold min-w-[180px]">Шаардлага</th>
                  <th className="px-3 py-2 font-bold min-w-[140px]">Хэвийн / Хэвийн бус</th>
                  <th className="px-3 py-2 font-bold min-w-[200px]">Тайлбар</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.rows.map((row: any, idx: number) => (
                  <tr
                    key={row.key}
                    ref={(el) => { rowRefs.current[row.key] = el; }}
                    className={`align-top hover:bg-gray-50/50 ${invalidRowKey === row.key ? 'bg-red-50 ring-2 ring-inset ring-red-400' : ''}`}
                  >
                    <td className="px-3 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-3 text-gray-900 font-medium text-sm">{row.label}</td>
                    <td className="px-3 py-3 text-gray-600 text-xs italic whitespace-pre-line">{row.requirement}</td>
                    <td className="px-3 py-3">
                      <StatusRadios name={`pc-${row.key}`} value={row.status} onChange={(v) => patchRow(row.key, { status: v })} />
                    </td>
                    <td className="px-3 py-3">
                      <input type="text" value={row.comment} onChange={(e) => patchRow(row.key, { comment: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-4 border-t border-gray-200 bg-white">
            <ShiftSectionImageUploader
              shiftId={shiftId}
              images={initialImages}
              onImagesChange={onImagesChange}
              section={Y400_PROCESS_IMAGE_SECTION}
              title="Технологийн процессын зураг хавсаргах төрөл"
              targets={processImageTargets}
              fallbackLabel="Технологийн процессын зураг"
            />
          </div>
        </div>

        {/* ── Тоног төхөөрөмжийн хяналт (доголдол + хяналт нэгтгэсэн, 1-18) ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-bold text-sm text-gray-800">
            Тоног төхөөрөмжийн хяналт
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-3 py-2 font-bold w-10">№</th>
                  <th className="px-3 py-2 font-bold min-w-[260px]">Хяналт</th>
                  <th className="px-3 py-2 font-bold min-w-[140px]">Хэвийн / Хэвийн бус</th>
                  <th className="px-3 py-2 font-bold min-w-[200px]">Тайлбар</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.failureRows.map((row: any, idx: number) => (
                  <tr
                    key={row.key}
                    ref={(el) => { rowRefs.current[row.key] = el; }}
                    className={`align-top hover:bg-gray-50/50 ${invalidRowKey === row.key ? 'bg-red-50 ring-2 ring-inset ring-red-400' : ''}`}
                  >
                    <td className="px-3 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-3 text-gray-900 font-medium text-sm">{row.label}</td>
                    <td className="px-3 py-3">
                      <StatusRadios name={`fl-${row.key}`} value={row.status} onChange={(v) => patchFailure(row.key, { status: v })} />
                    </td>
                    <td className="px-3 py-3">
                      <input type="text" value={row.comment} onChange={(e) => patchFailure(row.key, { comment: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm" />
                    </td>
                  </tr>
                ))}
                {form.equipmentRows.map((row: any, idx: number) => {
                  const item = EQUIPMENT_CONTROL_ITEMS[idx];
                  return (
                    <tr
                      key={row.key}
                      ref={(el) => { rowRefs.current[row.key] = el; }}
                      className={`align-top hover:bg-gray-50/50 ${invalidRowKey === row.key ? 'bg-red-50 ring-2 ring-inset ring-red-400' : ''}`}
                    >
                      <td className="px-3 py-3 text-gray-500">{item?.num ?? idx + 5}</td>
                      <td className="px-3 py-3 text-gray-900 font-medium text-sm">{row.label}</td>
                      <td className="px-3 py-3">
                        <StatusRadios name={`eq-${row.key}`} value={row.status} onChange={(v) => patchEquipment(row.key, { status: v })} />
                      </td>
                      <td className="px-3 py-3">
                        <input type="text" value={row.comment} onChange={(e) => patchEquipment(row.key, { comment: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-4 border-t border-gray-200 bg-white space-y-4">
            <ShiftSectionImageUploader
              shiftId={shiftId}
              images={initialImages}
              onImagesChange={onImagesChange}
              section={Y400_FAILURE_IMAGE_SECTION}
              title="Тоног төхөөрөмжийн доголдлын зураг хавсаргах төрөл"
              targets={failureImageTargets}
              fallbackLabel="Тоног төхөөрөмжийн доголдлын зураг"
            />
            <ShiftSectionImageUploader
              shiftId={shiftId}
              images={initialImages}
              onImagesChange={onImagesChange}
              section={Y400_EQUIPMENT_CONTROL_IMAGE_SECTION}
              title="Тоног төхөөрөмжийн хяналтын зураг хавсаргах төрөл"
              targets={equipmentControlImageTargets}
              fallbackLabel="Тоног төхөөрөмжийн хяналтын зураг"
            />
          </div>
        </div>

        {/* ── Тайлбар ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="font-bold text-sm text-gray-800 mb-3">Тайлбар:</p>
          <ol className="list-decimal list-inside text-sm text-gray-700 space-y-2">
            <li>Хяналтын хуудсыг ээлж тутам бүртгэж баталгаажуулна.</li>
            <li>Технологийн процесс хэсгийн 1-12 дугаарыг 3 цаг тутам (09:00, 12:00, 15:00, 18:00) хяналт хийх ёстой.</li>
            <li>Технологийн процессын алдаа гарвал шаардлагын дагуу залруулах арга хэмжээг авч шаардлагатай тохиолдолд технологич инженерт мэдэгдэн заавар авна.</li>
            <li>Тоног төхөөрөмжийн доголдол илэрвэл холбогдох мастер болон инженерт мэдэгдэн залруулах арга хэмжээг авна.</li>
          </ol>
        </div>

        {/* ── Гарын үсэг + Submit ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">Бүртгэл хөтөлсөн</p>
              <input type="text" value={operatorName} readOnly className="w-full px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-700 font-medium" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">Хяналт хийсэн ээлжийн мастер</p>
              {/* Чөлөөт текст байхад нэг хүний нэр олон янзаар бичигдэж байсан
                  («Ganbaatar», «Ganbaatr», «ganbaatar»…) тул жагсаалтаас сонгоно.
                  `RoleUserSelect` нь жагсаалтад ТААРАХГҮЙ хуучин утгыг сонголт
                  болгон үлдээдэг тул өмнөх бүртгэлүүд алдагдахгүй. */}
              <RoleUserSelect
                roles={['master']}
                value={form.sigMaster || ''}
                onChange={(_id, user) => setForm((p: FactoryProcessControlPayload) => ({ ...p, sigMaster: user?.label || '' }))}
                placeholder="Мастер сонгох..."
              />
            </div>
          </div>
          {showEnvironmentChecks && (
            <EnvironmentCheckSection
              rows={(form as any).environmentChecks}
              onChange={(rows) => setForm((prev: any) => ({ ...prev, environmentChecks: rows }))}
              disabled={submitting}
            />
          )}

          <div className="flex items-center justify-end gap-3">
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
