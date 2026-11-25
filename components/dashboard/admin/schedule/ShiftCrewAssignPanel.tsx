import React, { useMemo } from 'react';
import { Users, ShieldCheck, AlertTriangle } from 'lucide-react';
import { SHIFT_GROUP_OPTIONS, shiftGroupLabel } from '@/lib/shift-crew';

import type { DashboardUser, Station } from './types';

export type CrewAssignFormState = {
  shiftGroup: string;
  /** Хоосон бол баг доторх хүн бүр ӨӨРИЙН дамжлага дээр орно. Сонговол зөвхөн тэр дамжлагатай хүмүүс. */
  stationCode: string;
  startDate: string;
  endDate: string;
  shiftTypes: string[];
};

type ShiftCrewAssignPanelProps = {
  form: CrewAssignFormState;
  setForm: React.Dispatch<React.SetStateAction<CrewAssignFormState>>;
  users: DashboardUser[];
  stations: Station[];
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
};

function stationLabel(code: string, stations: Station[]): string {
  const found = stations.find((s) => s.code === code);
  return found ? `${found.code} — ${found.name}` : code;
}

function countDays(start: string, end: string) {
  if (!start) return 0;
  const to = end || start;
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.floor((b - a) / 86400000) + 1;
}

/**
 * Ээлжийн багаар нэг дор хуваарь оноох.
 * Багийн гишүүн бүр ӨӨРИЙН станц дээр оноогдоно — станц сонгох шаардлагагүй.
 */
export function ShiftCrewAssignPanel({ form, setForm, users, stations, submitting, onSubmit }: ShiftCrewAssignPanelProps) {
  const crewMembers = useMemo(
    () => users.filter((u) => String(u.shiftGroup || '') === form.shiftGroup && (u.role === 'operator' || u.role === 'master')),
    [users, form.shiftGroup]
  );

  // Тухайн багт байгаа өвөрмөц дамжлагууд — станц шүүлтүүрийн сонголт.
  const stationOptions = useMemo(() => {
    const codes = Array.from(
      new Set(crewMembers.map((u) => String(u.stationCode || '').trim()).filter(Boolean))
    );
    return codes.sort().map((code) => ({ code, label: stationLabel(code, stations) }));
  }, [crewMembers, stations]);

  const preview = useMemo(() => {
    const members = form.stationCode
      ? crewMembers.filter((u) => String(u.stationCode || '').trim() === form.stationCode)
      : crewMembers;
    const withStation = members.filter((u) => String(u.stationCode || '').trim());
    const skipped = members.filter((u) => !String(u.stationCode || '').trim());
    const operators = withStation.filter((u) => u.role === 'operator');
    const masters = withStation.filter((u) => u.role === 'master');
    const days = countDays(form.startDate, form.endDate);
    const slots = days * form.shiftTypes.length;

    // Багийн аль ч мастер аль ч операторыг хариуцна (станцын харьяалалгүй) — тиймээс
    // "мастер алга" эрсдэлийг БҮХ багаар шалгана, станцаар шүүсэн дэд жагсаалтаар биш.
    const crewHasMaster = crewMembers.some((u) => u.role === 'master' && String(u.stationCode || '').trim());
    const noMaster = operators.length > 0 && !crewHasMaster;

    return {
      members,
      operators,
      masters,
      skipped,
      days,
      rows: withStation.length * slots,
      noMaster,
    };
  }, [crewMembers, form.stationCode, form.startDate, form.endDate, form.shiftTypes]);

  const canSubmit =
    Boolean(form.shiftGroup) &&
    Boolean(form.startDate) &&
    form.shiftTypes.length > 0 &&
    preview.rows > 0 &&
    !submitting;

  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-orange-600">
          <Users className="w-5 h-5 shrink-0" />
          <h4 className="font-bold text-lg">Ээлжийн багаар оноох</h4>
        </div>
        <p className="text-sm leading-relaxed text-gray-500">
          Баг сонгоод нэг товшилтоор бүх гишүүнд хуваарь оноогдоно. Хүн бүр өөрийн дамжлага дээр орно.
          Хэрэв багт өөр өөр дамжлагатай хүмүүс байгаа бол доор тодорхой дамжлага сонгож зөвхөн тэднийг л оноож болно.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Ээлжийн баг</label>
          <div className="grid grid-cols-3 gap-3">
            {SHIFT_GROUP_OPTIONS.map((option) => {
              const active = form.shiftGroup === option.value;
              const count = users.filter(
                (u) => String(u.shiftGroup || '') === option.value && (u.role === 'operator' || u.role === 'master')
              ).length;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, shiftGroup: option.value, stationCode: '' }))}
                  className={`rounded-xl border px-3 py-3 text-sm transition-all ${
                    active
                      ? 'border-orange-500 bg-orange-50 text-orange-700 font-black'
                      : 'border-gray-200 text-gray-600 hover:border-orange-200'
                  }`}
                >
                  <span className="block">{option.label}</span>
                  <span className="block text-[11px] font-bold text-gray-400 mt-0.5">{count} хүн</span>
                </button>
              );
            })}
          </div>
        </div>

        {stationOptions.length > 0 ? (
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Дамжлага (заавал биш)</label>
            <select
              value={form.stationCode}
              onChange={(e) => setForm((p) => ({ ...p, stationCode: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
            >
              <option value="">Бүгд (хүн бүр өөрийн дамжлага дээр)</option>
              {stationOptions.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Эхлэх огноо</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Дуусах огноо</label>
            <input
              type="date"
              value={form.endDate}
              min={form.startDate || undefined}
              onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Ээлж</label>
          <div className="flex gap-3">
            {['Өдрийн', 'Шөнийн'].map((type) => {
              const checked = form.shiftTypes.includes(type);
              return (
                <label
                  key={type}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border cursor-pointer select-none transition-all ${
                    checked
                      ? 'border-orange-500 bg-orange-50 text-orange-700 font-bold'
                      : 'border-gray-200 text-gray-600 hover:border-orange-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        shiftTypes: e.target.checked
                          ? [...p.shiftTypes, type]
                          : p.shiftTypes.filter((t) => t !== type),
                      }))
                    }
                    className="sr-only"
                  />
                  {type}
                </label>
              );
            })}
          </div>
        </div>

        {form.shiftGroup ? (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Урьдчилсан харагдац</p>
            {preview.members.length === 0 ? (
              <p className="text-sm text-amber-700">
                {shiftGroupLabel(form.shiftGroup)}-д гишүүн алга. Доорх бүрэлдэхүүн засварлагчаас нэмнэ үү.
              </p>
            ) : (
              <>
                <p className="text-sm text-gray-700">
                  <b>{preview.operators.length}</b> оператор, <b>{preview.masters.length}</b> мастер ×{' '}
                  <b>{preview.days}</b> өдөр × <b>{form.shiftTypes.length}</b> ээлж ={' '}
                  <b className="text-orange-600">{preview.rows}</b> мөр
                </p>
                {preview.skipped.length > 0 ? (
                  <div className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Дамжлага тодорхойлогдоогүй тул <b>{preview.skipped.length}</b> хүн алгасагдана:{' '}
                      {preview.skipped.map((u) => u.name || u.email).join(', ')}
                    </span>
                  </div>
                ) : null}
                {preview.noMaster ? (
                  <div className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Энэ багт <b>мастер алга</b>. Хуваарь оноогдох ч ээлжийг баталгаажуулах
                      хүн олдохгүй — багт дор хаяж нэг мастер нэмнэ үү.
                    </span>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-black text-white shadow-sm transition-colors hover:bg-orange-700 disabled:opacity-50"
        >
          <ShieldCheck className="h-4 w-4" />
          {submitting ? 'Оноож байна...' : 'Багаар оноох'}
        </button>
      </form>
    </div>
  );
}
