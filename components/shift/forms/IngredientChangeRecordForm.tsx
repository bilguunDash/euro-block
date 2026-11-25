'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, Save, AlertTriangle, ClipboardList } from 'lucide-react';
import { ShiftSectionImageUploader, type ShiftSectionImage } from '@/components/shift/ShiftSectionImageUploader';
import {
  type IngredientChangeRecordPayload,
  createEmptyIngredientChangeRecordPayload,
  INGREDIENT_CHANGE_ATTENTION,
} from '@/lib/ingredient-change-record-form';
import { useToast } from '@/components/ui/ToastProvider';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

const INGREDIENT_CHANGE_IMAGE_SECTION = 'ingredient_change_record';
const INGREDIENT_CHANGE_IMAGE_COLUMNS = [
  { key: 'originalValue', label: '1. Орц' },
  { key: 'changedValue', label: '2. Өөрчилсөн орц' },
  { key: 'explanation', label: '3. Тайлбар' },
];

export function IngredientChangeRecordForm({
  shiftDate,
  shiftType,
  operatorName,
  operatorUid,
  initialPayload,
  shiftId,
  initialImages,
  onImagesChange,
  onBack,
  onSubmit,
  submitting,
}: {
  shiftDate: string;
  shiftType: string;
  operatorName: string;
  operatorUid: string;
  initialPayload?: Partial<IngredientChangeRecordPayload> | null;
  shiftId?: string;
  initialImages?: ShiftSectionImage[];
  onImagesChange?: (images: ShiftSectionImage[]) => void;
  onBack: () => void;
  onSubmit: (payload: IngredientChangeRecordPayload) => Promise<void>;
  submitting: boolean;
}) {
  const toast = useToast();
  const initial = useMemo(() => {
    const empty = createEmptyIngredientChangeRecordPayload({ shiftDate, shiftType, operatorUid, operatorName });
    const p = initialPayload ?? null;
    return p
      ? ({
          ...empty,
          ...p,
          rows: Array.isArray(p.rows) && p.rows.length > 0 ? p.rows : empty.rows,
        } as any)
      : empty;
  }, [shiftDate, shiftType, operatorUid, operatorName, initialPayload]);

  const [form, setForm] = useState(() => ({ ...(initial as any) }));
  const [formShiftDate, setFormShiftDate] = useState(shiftDate);
  const ingredientImageTargets = useMemo(
    () =>
      form.rows.map((row: any, index: number) => ({
        key: row.key,
        label: `${index + 1}. ${row.label}`,
      })),
    [form.rows]
  );

  const patchRow = (key: string, field: 'originalValue' | 'changedValue', value: string) => {
    setForm((f: IngredientChangeRecordPayload) => ({
      ...f,
      rows: f.rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Талбарууд ХООСОН БАЙЖ БОЛНО — «заавал бөглөх» шалгалтыг хэрэглэгчийн
    // хүсэлтээр авав. Дутуу бөглөсөн маягтыг ч хадгална.
    const payload: IngredientChangeRecordPayload = {
      ...form,
      sigOperator: operatorName,
      shiftDate: formShiftDate,
      shiftType,
      stationCode: 'ОНБ',
      operatorUid,
      operatorName,
      submittedAt: new Date().toISOString(),
    };
    await onSubmit(payload);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-bold disabled:opacity-50"
        >
          <ChevronLeft className="w-5 h-5" />
          Буцах
        </button>
        <p className="text-xs text-gray-500 font-medium hidden sm:block">ОНБ</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-4">
          <h1 className="text-lg md:text-xl font-bold text-gray-900 leading-snug flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-600" />
            Бүтээгдэхүүний орц найрлага өөрчилсөн бүртгэл
          </h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Огноо</label>
              <input
                type="date"
                value={formShiftDate}
                onChange={(e) => setFormShiftDate(e.target.value)}
                className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Ээлж</label>
              <input
                type="text"
                value={shiftType}
                readOnly
                className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-gray-700"
              />
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Системд нэвтэрсэн: <span className="font-bold text-gray-900">{operatorName}</span>
          </p>
        </div>


        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[640px]">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-3 py-2 font-bold w-10">д/д</th>
                  <th className="px-3 py-2 font-bold min-w-[180px]">Түүхий эд</th>
                  <th className="px-3 py-2 font-bold min-w-[120px]">Орц</th>
                  <th className="px-3 py-2 font-bold min-w-[120px]">Өөрчилсөн орц</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.rows.map((row: any, idx: number) => (
                  <tr key={row.key} className="align-top hover:bg-gray-50/50">
                    <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-2 text-gray-900">{row.label}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.originalValue}
                        onChange={(e) => patchRow(row.key, 'originalValue', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.changedValue}
                        onChange={(e) => patchRow(row.key, 'changedValue', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                      />
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
          section={INGREDIENT_CHANGE_IMAGE_SECTION}
          title="Бүтээгдэхүүний орц найрлага өөрчилсөн бүртгэлийн зураг хавсаргах төрөл"
          targets={ingredientImageTargets}
          columns={INGREDIENT_CHANGE_IMAGE_COLUMNS}
          fallbackLabel="Бүтээгдэхүүний орц найрлага өөрчилсөн бүртгэлийн зураг"
        />

        <div
          className="rounded-2xl border border-amber-200 bg-amber-50/90 px-5 py-4 shadow-sm flex gap-3 items-start"
          role="status"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 border border-amber-200/80">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800/90 mb-1">Анхаарах</p>
            <p className="text-sm text-amber-950 leading-relaxed">{INGREDIENT_CHANGE_ATTENTION}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-6">
          <label className="font-bold text-gray-900">Тайлбар</label>
          <textarea
            value={form.explanation}
            onChange={(e) => setForm((f: IngredientChangeRecordPayload) => ({ ...f, explanation: e.target.value }))}
            rows={5}
            className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
            placeholder="Шалтгаан, процессын нөлөө гэх мэт"
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-6 space-y-6">
          <p className="font-bold text-gray-900 text-sm">Орц найрлага өөрчилсөн</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Оператор</label>
              <p className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 font-medium min-h-[2.5rem] flex items-center">
                {operatorName || '—'}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">Нэвтэрсэн бүртгэлээс автоматаар оруулна</p>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Технологич инженер</label>
              <input
                type="text"
                value={form.sigTechnologistEngineer}
                onChange={(e) => setForm((f: IngredientChangeRecordPayload) => ({ ...f, sigTechnologistEngineer: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
              />
            </div>
          </div>

          <p className="font-bold text-gray-900 text-sm pt-2 border-t border-gray-100">Хянасан</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Ерөнхий технологич</label>
              <input
                type="text"
                value={form.sigChiefTechnologist}
                onChange={(e) => setForm((f: IngredientChangeRecordPayload) => ({ ...f, sigChiefTechnologist: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Чанарын мэргэжилтэн</label>
              <input
                type="text"
                value={form.sigQualitySpecialist}
                onChange={(e) => setForm((f: IngredientChangeRecordPayload) => ({ ...f, sigQualitySpecialist: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
              />
            </div>
          </div>
        </div>

        <EnvironmentCheckSection
          rows={(form as any).environmentChecks}
          onChange={(rows) => setForm((prev: any) => ({ ...prev, environmentChecks: rows }))}
          disabled={submitting}
        />

        <div className="flex flex-wrap gap-4 justify-end">
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="px-6 py-3 rounded-xl border-2 border-gray-200 font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Цуцлах
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-8 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 disabled:opacity-50 shadow-lg shadow-orange-100"
          >
            {submitting ? (
              <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Хадгалах
          </button>
        </div>
      </form>
    </div>
  );
}
