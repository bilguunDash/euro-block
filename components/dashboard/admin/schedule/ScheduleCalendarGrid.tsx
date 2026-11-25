import React from 'react';
import type { DashboardUser, ScheduleCalendarView, ScheduleView, Station } from './types';

const MN_WEEKDAYS = ['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Ням'];

function dateFromIso(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function isoFromDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDaysIso(value: string, days: number) {
  const d = dateFromIso(value);
  d.setUTCDate(d.getUTCDate() + days);
  return isoFromDate(d);
}

function startOfWeekIso(value: string) {
  const d = dateFromIso(value);
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  return isoFromDate(d);
}

function endOfWeekIso(value: string) {
  return addDaysIso(startOfWeekIso(value), 6);
}

function monthGridRange(month: string) {
  const [yearRaw, monthRaw] = month.split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  return {
    start: startOfWeekIso(isoFromDate(first)),
    end: endOfWeekIso(isoFromDate(last)),
  };
}

function datesBetween(startIso: string, endIso: string) {
  const days: string[] = [];
  for (let d = startIso; d <= endIso; d = addDaysIso(d, 1)) {
    days.push(d);
  }
  return days;
}

function isWeekendIso(value: string) {
  const day = dateFromIso(value).getUTCDay();
  return day === 0 || day === 6;
}

function dayTitle(value: string) {
  return String(dateFromIso(value).getUTCDate());
}

function todayIso() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });
}

type ScheduleCalendarGridProps = {
  scheduleView: ScheduleView;
  calendarView: ScheduleCalendarView;
  scheduleMonth: string;
  weekAnchor: string;
  opSchedulesAll: any[];
  masterSchedulesAll: any[];
  controlStructure: any;
  stations: Station[];
  localUsers: DashboardUser[];
};

export function ScheduleCalendarGrid({
  scheduleView,
  calendarView,
  scheduleMonth,
  weekAnchor,
  opSchedulesAll,
  masterSchedulesAll,
  controlStructure,
  stations,
  localUsers,
}: ScheduleCalendarGridProps) {
  const visibleSchedules = scheduleView === 'operator' ? opSchedulesAll : masterSchedulesAll;
  const today = todayIso();
  const range =
    calendarView === 'week'
      ? { start: startOfWeekIso(weekAnchor), end: endOfWeekIso(weekAnchor) }
      : monthGridRange(scheduleMonth);
  const days = datesBetween(range.start, range.end);
  const rowsByDay = new Map<string, any[]>();

  for (const row of visibleSchedules) {
    const date = String(row?.shiftDate || '').slice(0, 10);
    if (!date || date < range.start || date > range.end) continue;
    const list = rowsByDay.get(date) || [];
    list.push(row);
    rowsByDay.set(date, list);
  }

  for (const rows of rowsByDay.values()) {
    rows.sort((a: any, b: any) => {
      const dateDiff = String(a.shiftDate || '').localeCompare(String(b.shiftDate || ''));
      if (dateDiff !== 0) return dateDiff;
      return String(a.shiftType || '').localeCompare(String(b.shiftType || ''), 'mn');
    });
  }

  const userName = (uid: string, fallback?: string | null) => {
    const user = localUsers.find((u) => String(u.id || '') === String(uid || ''));
    return String(fallback || user?.name || user?.email || '').trim();
  };

  const stationLabel = (code: string) => {
    const station = stations.find((s) => String(s.code || '') === String(code || ''));
    return station ? `${station.code} — ${station.name}` : code || 'Дамжлагагүй';
  };

  const linkedAssignmentFor = (row: any) =>
    scheduleView === 'master'
      ? (Array.isArray(controlStructure?.assignments) ? controlStructure.assignments : []).find(
          (a: any) =>
            a.isActive &&
            String(a.masterUid || '') === String(row.masterUid || '') &&
            String(a.stationCode || '') === String(row.stationCode || '')
        )
      : null;

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[1120px]">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-white">
            {MN_WEEKDAYS.map((day) => (
              <div key={day} className="px-4 py-4 text-[11px] font-black uppercase tracking-wider text-gray-500">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const rows = rowsByDay.get(day) || [];
              const outsideMonth = calendarView === 'month' && !day.startsWith(scheduleMonth);
              const showLimit = calendarView === 'week' ? 8 : 4;
              const isToday = day === today;
              return (
                <div
                  key={day}
                  className={`relative min-h-48 border-r border-b border-gray-100 p-4 ${
                    outsideMonth ? 'bg-gray-50/40 text-gray-400' : 'bg-white'
                  } ${calendarView === 'week' ? 'min-h-[28rem]' : ''} ${isToday ? 'ring-2 ring-orange-600 ring-inset z-10' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-black ${isToday ? 'text-orange-600' : outsideMonth ? 'text-gray-400' : 'text-gray-900'}`}>
                      {dayTitle(day)}
                    </p>
                    {isWeekendIso(day) ? <span className="text-[10px] font-black text-gray-400">Амралт</span> : null}
                  </div>
                  <div className="mt-3 space-y-2">
                    {rows.length === 0 ? <p className="text-xs text-gray-400">Хуваарьгүй</p> : null}
                    {rows.slice(0, showLimit).map((row: any, index: number) => {
                      const linked = linkedAssignmentFor(row);
                      const name =
                        scheduleView === 'operator'
                          ? userName(row.operatorUid, row.operatorName) || 'Оператор тодорхойгүй'
                          : userName(row.masterUid, row.masterName) || 'Мастер тодорхойгүй';
                      const approvedLike = Boolean(row.existingShiftId || linked?.isActive);
                      const tone =
                        approvedLike || index % 2 === 1
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                          : 'border-orange-200 bg-orange-50 text-orange-950';
                      return (
                        <div
                          key={String(row.id || `${row.shiftDate}:${row.shiftType}:${row.stationCode}:${row.operatorUid || row.masterUid}`)}
                          className={`rounded-xl border p-3 shadow-sm ${tone}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-black uppercase">
                              {scheduleView === 'operator' ? 'Операторын ээлж' : 'Мастерын ээлж'}
                            </p>
                          </div>
                          <p className="mt-1 text-xs font-black">{row.shiftType || 'Ээлжгүй'}</p>
                          <p className="mt-1 text-[11px] font-semibold leading-snug text-gray-700">{stationLabel(String(row.stationCode || ''))}</p>
                          <p className="mt-1 text-[11px] text-gray-600">{name}</p>
                          {scheduleView === 'master' && linked?.operatorName ? (
                            <p className="mt-1 text-[11px] text-gray-500">Оператор: {linked.operatorName}</p>
                          ) : null}
                          {approvedLike ? (
                            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-black text-white">Бүртгэгдсэн</span>
                          ) : null}
                        </div>
                      );
                    })}
                    {rows.length > showLimit ? (
                      <p className="text-[11px] font-bold text-gray-500">+{rows.length - showLimit} илүү</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
