import type { ReactNode } from 'react';
import { isoDateInTimeZone } from '@/lib/handover-window';
import {
  MN_WEEKDAYS,
  dateFromIso,
  dayTitle,
  isWeekendIso,
  mnDateLabel,
} from '../dashboard-helpers';
import { ShiftSwapRequestsPanel } from '../schedule/ShiftSwapRequestsPanel';

// PC-2 production deploy хүсэлтээр түр хаасан (2026-07-09) — шинэ feature, production дээр
// хараахан танилцуулаагүй. Дахин нээхдээ зөвхөн false-г true болгоно, доор код бүрэн хэвээр.
const SHIFT_SWAP_ENABLED = false;

type OperatorScheduleView = 'month' | 'week';

type MyScheduleTabProps = {
  operatorScheduleView: OperatorScheduleView;
  setOperatorScheduleView: (view: OperatorScheduleView) => void;
  setOperatorScheduleAnchor: (anchor: string) => void;
  moveOperatorScheduleRange: (direction: -1 | 1) => void;
  operatorScheduleHeaderTitle: string;
  operatorScheduleRange: { start: string; end: string };
  operatorScheduleShiftType: string;
  setOperatorScheduleShiftType: (value: string) => void;
  operatorScheduleStationCode: string;
  setOperatorScheduleStationCode: (value: string) => void;
  operatorScheduleStationOptions: string[];
  operatorScheduleCalendarLoading: boolean;
  operatorScheduleDays: string[];
  operatorSchedulesByDate: Map<string, any[]>;
  operatorScheduleMonth: string;
  renderOperatorScheduleCard: (row: any, compact?: boolean) => ReactNode;
  operatorScheduleCalendarRows: any[];
  confirmAsync: (opts: { title: string; message: string; confirmText?: string; danger?: boolean }) => Promise<boolean>;
};

export function MyScheduleTab({
  operatorScheduleView,
  setOperatorScheduleView,
  setOperatorScheduleAnchor,
  moveOperatorScheduleRange,
  operatorScheduleHeaderTitle,
  operatorScheduleRange,
  operatorScheduleShiftType,
  setOperatorScheduleShiftType,
  operatorScheduleStationCode,
  setOperatorScheduleStationCode,
  operatorScheduleStationOptions,
  operatorScheduleCalendarLoading,
  operatorScheduleDays,
  operatorSchedulesByDate,
  operatorScheduleMonth,
  renderOperatorScheduleCard,
  operatorScheduleCalendarRows,
  confirmAsync,
}: MyScheduleTabProps) {
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Миний хуваарь</h3>
          <p className="text-gray-500">Сарын болон 7 хоногийн ээлжийн хуваарь</p>
        </div>
        <button
          type="button"
          onClick={() => setOperatorScheduleAnchor(isoDateInTimeZone())}
          className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50"
        >
          Өнөөдөр
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 md:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center rounded-2xl border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setOperatorScheduleView('month')}
              className={`px-4 py-2 rounded-xl text-sm font-black ${operatorScheduleView === 'month' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-600 hover:bg-white'
                }`}
            >
              Сар
            </button>
            <button
              type="button"
              onClick={() => setOperatorScheduleView('week')}
              className={`px-4 py-2 rounded-xl text-sm font-black ${operatorScheduleView === 'week' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-600 hover:bg-white'
                }`}
            >
              7 хоног
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => moveOperatorScheduleRange(-1)}
              className="h-10 w-10 rounded-xl border border-gray-200 bg-white text-gray-700 font-black hover:bg-gray-50"
              aria-label="Өмнөх"
            >
              ‹
            </button>
            <div className="min-w-[13rem] text-center">
              <p className="text-sm font-black text-gray-900">{operatorScheduleHeaderTitle}</p>
              <p className="text-xs text-gray-500">{mnDateLabel(operatorScheduleRange.start)} - {mnDateLabel(operatorScheduleRange.end)}</p>
            </div>
            <button
              type="button"
              onClick={() => moveOperatorScheduleRange(1)}
              className="h-10 w-10 rounded-xl border border-gray-200 bg-white text-gray-700 font-black hover:bg-gray-50"
              aria-label="Дараах"
            >
              ›
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Ээлж</label>
            <select
              value={operatorScheduleShiftType}
              onChange={(e) => setOperatorScheduleShiftType(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm"
            >
              <option value="">Бүгд</option>
              <option value="Өдрийн">Өдрийн</option>
              <option value="Шөнийн">Шөнийн</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Дамжлага</label>
            <select
              value={operatorScheduleStationCode}
              onChange={(e) => setOperatorScheduleStationCode(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm"
            >
              <option value="">Бүгд</option>
              {operatorScheduleStationOptions.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-end gap-3 text-xs text-gray-600">
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-orange-100 border border-orange-300" /> Миний ээлж</span>
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-gray-100 border border-gray-200" /> Амралтын өдөр</span>
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded bg-orange-600" /> Өнөөдөр</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        {operatorScheduleCalendarLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">Хуваарь уншиж байна...</div>
        ) : operatorScheduleDays.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">Хуваарь харах хугацаа олдсонгүй.</div>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-7 border-b border-gray-200 bg-gray-50">
              {MN_WEEKDAYS.map((day) => (
                <div key={day} className="px-4 py-3 text-xs font-black uppercase tracking-wider text-gray-500">
                  {day}
                </div>
              ))}
            </div>
            <div className={`hidden md:grid grid-cols-7 ${operatorScheduleView === 'week' ? 'min-h-[22rem]' : ''}`}>
              {operatorScheduleDays.map((day) => {
                const rows = operatorSchedulesByDate.get(day) || [];
                const isOutsideMonth = operatorScheduleView === 'month' && !day.startsWith(operatorScheduleMonth);
                const today = day === isoDateInTimeZone();
                const cellTone = today
                  ? 'bg-orange-50 ring-2 ring-inset ring-orange-500'
                  : isWeekendIso(day)
                    ? 'bg-gray-50'
                    : 'bg-white';
                return (
                  <div
                    key={day}
                    className={`min-h-[9.5rem] border-r border-b border-gray-100 p-3 transition-colors ${cellTone} ${isOutsideMonth ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-black ${today ? 'text-orange-700' : 'text-gray-900'}`}>
                        {dateFromIso(day).getUTCDate()}
                      </p>
                      {today ? (
                        <span className="rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-black text-white">Өнөөдөр</span>
                      ) : isWeekendIso(day) ? (
                        <span className="text-[10px] font-bold text-gray-400">Амралт</span>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-2">
                      {rows.length === 0 ? (
                        <p className="text-center text-sm font-bold text-gray-300 pt-8">-</p>
                      ) : (
                        rows.slice(0, operatorScheduleView === 'week' ? 6 : 3).map((row) => renderOperatorScheduleCard(row, true))
                      )}
                      {rows.length > (operatorScheduleView === 'week' ? 6 : 3) ? (
                        <p className="text-[11px] font-bold text-gray-500">+{rows.length - (operatorScheduleView === 'week' ? 6 : 3)} илүү</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="md:hidden divide-y divide-gray-100">
              {operatorScheduleDays.map((day) => {
                const rows = operatorSchedulesByDate.get(day) || [];
                const today = day === isoDateInTimeZone();
                return (
                  <div key={day} className={`${today ? 'bg-orange-50' : isWeekendIso(day) ? 'bg-gray-50' : 'bg-white'} p-4`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className={`font-black ${today ? 'text-orange-700' : 'text-gray-900'}`}>{dayTitle(day)}</p>
                        <p className="text-xs text-gray-500">
                          {MN_WEEKDAYS[(dateFromIso(day).getUTCDay() + 6) % 7]} {isWeekendIso(day) ? '• Амралтын өдөр' : ''}
                        </p>
                      </div>
                      {today ? <span className="rounded-full bg-orange-600 px-2 py-1 text-[10px] font-black text-white">Өнөөдөр</span> : null}
                    </div>
                    <div className="mt-3 space-y-2">
                      {rows.length === 0 ? (
                        <p className="text-sm font-bold text-gray-300">-</p>
                      ) : (
                        rows.map((row) => renderOperatorScheduleCard(row))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-4 md:p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
            <p className="text-xs font-black text-gray-500 uppercase tracking-wider">Нийт</p>
            <p className="mt-2 text-3xl font-black text-gray-900">{operatorScheduleCalendarRows.length}</p>
            <p className="text-sm text-gray-500 mt-1">Сонгосон хугацааны ээлж</p>
          </div>
          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
            <p className="text-xs font-black text-orange-700 uppercase tracking-wider">Өдрийн</p>
            <p className="mt-2 text-3xl font-black text-gray-900">
              {operatorScheduleCalendarRows.filter((row: any) => String(row.shiftType || '') === 'Өдрийн').length}
            </p>
            <p className="text-sm text-gray-600 mt-1">Өдрийн ээлжийн тоо</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-black text-slate-600 uppercase tracking-wider">Шөнийн</p>
            <p className="mt-2 text-3xl font-black text-gray-900">
              {operatorScheduleCalendarRows.filter((row: any) => String(row.shiftType || '') === 'Шөнийн').length}
            </p>
            <p className="text-sm text-gray-600 mt-1">Шөнийн ээлжийн тоо</p>
          </div>
        </div>
      </div>

      {SHIFT_SWAP_ENABLED && <ShiftSwapRequestsPanel confirmAsync={confirmAsync} />}
    </section>
  );
}
