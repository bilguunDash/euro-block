'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { AlertCircle, CheckCircle2, ChevronLeft, ClipboardList, Save } from 'lucide-react';
import { ShiftSectionImageUploader, type ShiftSectionImage } from '@/components/shift/ShiftSectionImageUploader';
import {
  normalizeY181HeatMasterHandoverPayload,
  validateY181HeatMasterHandoverPayload,
  Y181_WATER_SUPPLY_ITEMS,
  Y181_KILN_ITEMS,
  Y181_AUTOCLAVE_ITEMS,
  Y181_HEATING_ITEMS,
  type YesNoStatus,
  type Y181HeatMasterHandoverPayload,
} from '@/lib/y181-heat-master-form';
import { useToast } from '@/components/ui/ToastProvider';
import { RoleUserSelect } from '@/components/ui/RoleUserSelect';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';
import { resolveReceivingName } from '@/lib/shift-signature';

const y181Fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const Y181_WATER_SUPPLY_IMAGE_SECTION = 'y181_water_supply';
const Y181_KILN_IMAGE_SECTION = 'y181_kiln';
const Y181_AUTOCLAVE_IMAGE_SECTION = 'y181_autoclave';
const Y181_HEATING_IMAGE_SECTION = 'y181_heating';

function YesNoRadios({ value, onChange, name }: { value: YesNoStatus; onChange: (v: YesNoStatus) => void; name: string }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <label className="inline-flex items-center gap-1.5 cursor-pointer">
        <input type="radio" name={name} checked={value === 'yes'} onChange={() => onChange('yes')} />
        <span>Тийм</span>
      </label>
      <label className="inline-flex items-center gap-1.5 cursor-pointer">
        <input type="radio" name={name} checked={value === 'no'} onChange={() => onChange('no')} />
        <span>Үгүй</span>
      </label>
    </div>
  );
}

type SectionKey = 'waterSupplyRows' | 'kilnRows' | 'autoclaveRows' | 'heatingRows';

function ChecklistSection({
  title,
  rows,
  sectionKey,
  patchRow,
  invalidRowKey,
  rowRefs,
}: {
  title: string;
  rows: Y181HeatMasterHandoverPayload[SectionKey];
  sectionKey: SectionKey;
  patchRow: (section: SectionKey, key: string, patch: Record<string, unknown>) => void;
  invalidRowKey: string | null;
  rowRefs: React.MutableRefObject<Record<string, HTMLTableRowElement | null>>;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-bold text-sm text-gray-800">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
              <th className="px-3 py-2 font-bold w-10">№</th>
              <th className="px-3 py-2 font-bold min-w-[260px]">Хяналт</th>
              <th className="px-3 py-2 font-bold min-w-[140px]">Тийм / Үгүй</th>
              <th className="px-3 py-2 font-bold min-w-[220px]">Нэмэлт мэдээлэл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, idx) => {
              const item = ([...Y181_WATER_SUPPLY_ITEMS, ...Y181_KILN_ITEMS, ...Y181_AUTOCLAVE_ITEMS, ...Y181_HEATING_ITEMS] as const).find(
                (i) => i.key === row.key
              );
              return (
                <tr
                  key={row.key}
                  ref={(el) => { rowRefs.current[row.key] = el; }}
                  className={`align-top hover:bg-gray-50/50 ${invalidRowKey === row.key ? 'bg-red-50 ring-2 ring-inset ring-red-400' : ''}`}
                >
                  <td className="px-3 py-3 text-gray-500">{idx + 1}</td>
                  <td className="px-3 py-3 text-gray-900 font-medium text-sm">{row.label}</td>
                  <td className="px-3 py-3">
                    {row.valueOnly ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : (
                      <YesNoRadios name={`${sectionKey}-${row.key}`} value={row.status} onChange={(v) => patchRow(sectionKey, row.key, { status: v })} />
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {item?.noteLabel || row.valueOnly ? (
                      <input
                        type="text"
                        value={row.note}
                        onChange={(e) => patchRow(sectionKey, row.key, { note: e.target.value })}
                        placeholder={item?.noteLabel || 'Утга'}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                      />
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Y181HeatMasterHandoverForm({
  shiftDate, shiftType, operatorUid, operatorName, initialPayload, shiftId, initialImages, onImagesChange, onBack, onSubmit, submitting, receivingMasterName,
}: {
  shiftDate: string; shiftType: string; operatorUid: string; operatorName: string;
  initialPayload?: Partial<Y181HeatMasterHandoverPayload> | null;
  receivingMasterName?: string | null;
  shiftId?: string;
  initialImages?: ShiftSectionImage[];
  onImagesChange?: (images: ShiftSectionImage[]) => void;
  onBack: () => void; onSubmit: (p: Y181HeatMasterHandoverPayload) => Promise<void>; submitting: boolean;
}) {
  const toast = useToast();
  const initial = React.useMemo(
    () => {
      const payload = normalizeY181HeatMasterHandoverPayload(initialPayload, { shiftDate, shiftType, operatorUid, operatorName });
      return { ...payload, sigReceiving: resolveReceivingName(payload.sigReceiving, receivingMasterName) };
    },
    [shiftDate, shiftType, operatorUid, operatorName, initialPayload, receivingMasterName]
  );
  const [form, setForm] = useState<Y181HeatMasterHandoverPayload>(() => ({ ...(initial as any) }));
  const [formShiftDate, setFormShiftDate] = useState(shiftDate);
  const [invalidRowKey, setInvalidRowKey] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const sigReceivingRef = useRef<HTMLDivElement | null>(null);

  const nextMasterUrl =
    shiftId && shiftDate && shiftType
      ? `/api/master-schedule-next?stationCode=${encodeURIComponent('ҮЯ-181')}&shiftDate=${encodeURIComponent(shiftDate)}&shiftType=${encodeURIComponent(shiftType)}`
      : null;
  const { data: nextMasterData } = useSWR(nextMasterUrl, y181Fetcher, { revalidateOnFocus: false });
  const autoMasterName: string =
    nextMasterData?.ok && nextMasterData?.found ? String(nextMasterData.schedule?.masterName || '') : '';
  const scheduleNotFound = nextMasterData !== undefined && nextMasterData?.ok && !nextMasterData?.found;

  const autoFilledRef = useRef(false);
  useEffect(() => {
    if (autoFilledRef.current || !autoMasterName) return;
    setForm((p) => {
      if (p.sigReceiving?.trim()) return p;
      autoFilledRef.current = true;
      return { ...p, sigReceiving: autoMasterName };
    });
  }, [autoMasterName]);

  const waterSupplyImageTargets = useMemo(
    () => form.waterSupplyRows.map((row, index) => ({ key: row.key, label: `${index + 1}. ${row.label}` })),
    [form.waterSupplyRows]
  );
  const kilnImageTargets = useMemo(
    () => form.kilnRows.map((row, index) => ({ key: row.key, label: `${index + 1}. ${row.label}` })),
    [form.kilnRows]
  );
  const autoclaveImageTargets = useMemo(
    () => form.autoclaveRows.map((row, index) => ({ key: row.key, label: `${index + 1}. ${row.label}` })),
    [form.autoclaveRows]
  );
  const heatingImageTargets = useMemo(
    () => form.heatingRows.map((row, index) => ({ key: row.key, label: `${index + 1}. ${row.label}` })),
    [form.heatingRows]
  );

  const focusInvalidRow = (key: string) => {
    setInvalidRowKey(key);
    rowRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const patchRow = (section: SectionKey, key: string, patch: Record<string, unknown>) => {
    setForm((p) => ({ ...p, [section]: p[section].map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
    if (invalidRowKey === key && 'status' in patch) setInvalidRowKey(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: Y181HeatMasterHandoverPayload = {
      ...form,
      shiftDate: formShiftDate,
      shiftType,
      stationCode: 'ҮЯ-181',
      operatorUid,
      operatorName,
      sigHandingOver: operatorName,
      submittedAt: new Date().toISOString(),
      ...(scheduleNotFound ? { needsAdminApproval: true } : {}),
    };

    const error = validateY181HeatMasterHandoverPayload(payload);
    if (error) {
      const badRow = [...payload.waterSupplyRows, ...payload.kilnRows, ...payload.autoclaveRows, ...payload.heatingRows].find(
        (r) => !r.valueOnly && r.status !== 'yes' && r.status !== 'no'
      );
      if (badRow) {
        focusInvalidRow(badRow.key);
      } else {
        sigReceivingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      toast.warning(error);
      return;
    }

    await onSubmit(payload);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} disabled={submitting} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-bold disabled:opacity-50">
          <ChevronLeft className="w-5 h-5" /> Буцах
        </button>
        <p className="text-xs text-gray-500 font-medium hidden sm:block">ҮЯ-181 · ДУХ-05</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-4">
          <h1 className="text-lg md:text-xl font-bold text-gray-900 leading-snug flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-600" />
            ҮЯ-181: ДУХ-н мастерын ээлж хүлээлцэх бүртгэлийн хуудас
          </h1>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Огноо</label>
              <input type="date" value={formShiftDate} onChange={(e) => setFormShiftDate(e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Ээлж (өдөр/орой)</label>
              <input type="text" value={shiftType} readOnly className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-gray-700" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Ээлж (1 / 2 / 3)</label>
              <div className="mt-1 flex gap-2">
                {(['1', '2', '3'] as const).map((n) => (
                  <label
                    key={n}
                    className={`flex-1 flex items-center justify-center py-3 rounded-xl border cursor-pointer select-none text-sm font-bold transition-all ${
                      form.crewNumber === n ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 hover:border-orange-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="crewNumber"
                      checked={form.crewNumber === n}
                      onChange={() => setForm((p) => ({ ...p, crewNumber: n }))}
                      className="sr-only"
                    />
                    {n}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <ChecklistSection title="1. Ус хангамж, бохир ус" rows={form.waterSupplyRows} sectionKey="waterSupplyRows" patchRow={patchRow} invalidRowKey={invalidRowKey} rowRefs={rowRefs} />
        <ShiftSectionImageUploader
          shiftId={shiftId}
          images={initialImages}
          onImagesChange={onImagesChange}
          section={Y181_WATER_SUPPLY_IMAGE_SECTION}
          title="Ус хангамж, бохир ус — зураг хавсаргах мөр"
          targets={waterSupplyImageTargets}
          fallbackLabel="Ус хангамж, бохир усны зураг"
        />

        <ChecklistSection title="2. Технологийн зуух" rows={form.kilnRows} sectionKey="kilnRows" patchRow={patchRow} invalidRowKey={invalidRowKey} rowRefs={rowRefs} />
        <ShiftSectionImageUploader
          shiftId={shiftId}
          images={initialImages}
          onImagesChange={onImagesChange}
          section={Y181_KILN_IMAGE_SECTION}
          title="Технологийн зуух — зураг хавсаргах мөр"
          targets={kilnImageTargets}
          fallbackLabel="Технологийн зуухны зураг"
        />

        <ChecklistSection title="3. Автоклав" rows={form.autoclaveRows} sectionKey="autoclaveRows" patchRow={patchRow} invalidRowKey={invalidRowKey} rowRefs={rowRefs} />
        <ShiftSectionImageUploader
          shiftId={shiftId}
          images={initialImages}
          onImagesChange={onImagesChange}
          section={Y181_AUTOCLAVE_IMAGE_SECTION}
          title="Автоклав — зураг хавсаргах мөр"
          targets={autoclaveImageTargets}
          fallbackLabel="Автоклавын зураг"
        />

        <ChecklistSection title="4. Халаалтын зуух, сантехникийн систем" rows={form.heatingRows} sectionKey="heatingRows" patchRow={patchRow} invalidRowKey={invalidRowKey} rowRefs={rowRefs} />
        <ShiftSectionImageUploader
          shiftId={shiftId}
          images={initialImages}
          onImagesChange={onImagesChange}
          section={Y181_HEATING_IMAGE_SECTION}
          title="Халаалтын зуух, сантехник — зураг хавсаргах мөр"
          targets={heatingImageTargets}
          fallbackLabel="Халаалтын зуух, сантехникийн зураг"
        />

        {/* ── Дараагийн ээлжинд анхаарах зүйлс ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="text-xs font-bold text-gray-600 uppercase mb-3">Дараагийн ээлжинд анхаарах зүйлс</p>
          <textarea
            value={form.attentionNotes}
            onChange={(e) => setForm((p) => ({ ...p, attentionNotes: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm min-h-[120px] focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
            placeholder="Тэмдэглэл бичих..."
          />
        </div>

        {/* ── Хийсэн ажил ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="text-xs font-bold text-gray-600 uppercase mb-3">Хийсэн ажил</p>
          <textarea
            value={form.workPerformed}
            onChange={(e) => setForm((p) => ({ ...p, workPerformed: e.target.value }))}
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
              <p className="text-xs font-bold text-gray-600 uppercase mb-2">Ээлж хүлээлгэн өгсөн</p>
              <input type="text" value={operatorName} readOnly className="w-full px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-700 font-medium" />
            </div>
            <div ref={sigReceivingRef}>
              <p className="text-xs font-bold text-gray-600 uppercase mb-2">Ээлж хүлээн авсан</p>
              <RoleUserSelect
                roles={['master']}
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
