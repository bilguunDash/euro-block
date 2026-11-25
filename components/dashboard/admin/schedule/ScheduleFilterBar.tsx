import React from 'react';
import type { DashboardUser, ScheduleCalendarView, ScheduleView, Station } from './types';

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

function weekLabel(value: string) {
  const start = startOfWeekIso(value);
  const end = addDaysIso(start, 6);
  return `${start} - ${end}`;
}

type ScheduleFilterBarProps = {
  scheduleMonth: string;
  setScheduleMonth: (value: string) => void;
  scheduleFilterShiftType: string;
  setScheduleFilterShiftType: (value: string) => void;
  scheduleFilterStationCode: string;
  setScheduleFilterStationCode: (value: string) => void;
  scheduleFilterAssigneeUid: string;
  setScheduleFilterAssigneeUid: (value: string) => void;
  scheduleView: ScheduleView;
  setScheduleView: (value: ScheduleView) => void;
  scheduleCalendarView: ScheduleCalendarView;
  setScheduleCalendarView: (value: ScheduleCalendarView) => void;
  scheduleWeekAnchor: string;
  setScheduleWeekAnchor: (value: string) => void;
  stationsByScheduleView: Station[];
  scheduleStationOptions: string[];
  localUsers: DashboardUser[];
  fetchOperatorSchedulesAll: (opts?: {
    month?: string;
    shiftType?: string;
    stationCode?: string;
    operatorUid?: string;
  }) => Promise<void>;
  fetchMasterSchedulesAll: (opts?: {
    month?: string;
    shiftType?: string;
    stationCode?: string;
    masterUid?: string;
  }) => Promise<void>;
};

export function ScheduleFilterBar({
  scheduleMonth,
  setScheduleMonth,
  scheduleFilterShiftType,
  setScheduleFilterShiftType,
  scheduleFilterStationCode,
  setScheduleFilterStationCode,
  scheduleFilterAssigneeUid,
  setScheduleFilterAssigneeUid,
  scheduleView,
  setScheduleView,
  scheduleCalendarView,
  setScheduleCalendarView,
  scheduleWeekAnchor,
  setScheduleWeekAnchor,
  stationsByScheduleView,
  scheduleStationOptions,
  localUsers,
  fetchOperatorSchedulesAll,
  fetchMasterSchedulesAll,
}: ScheduleFilterBarProps) {
  const switchScheduleView = (next: ScheduleView) => {
    if (next === scheduleView) return;
    setScheduleView(next);
    setScheduleFilterStationCode('');
    setScheduleFilterAssigneeUid('');
    if (next === 'operator') {
      fetchOperatorSchedulesAll({
        month: scheduleMonth,
        shiftType: scheduleFilterShiftType,
        stationCode: '',
        operatorUid: '',
      });
    } else {
      fetchMasterSchedulesAll({
        month: scheduleMonth,
        shiftType: scheduleFilterShiftType,
        stationCode: '',
        masterUid: '',
      });
    }
  };

  const moveWeek = (delta: number) => {
    const next = addDaysIso(scheduleWeekAnchor, delta * 7);
    setScheduleWeekAnchor(next);
    setScheduleMonth(next.slice(0, 7));
  };

  const selectWeekAnchor = (value: string) => {
    if (!value) return;
    setScheduleWeekAnchor(value);
    setScheduleMonth(value.slice(0, 7));
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm pt-4 px-6 pb-6">
      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div>
          <h4 className="font-bold text-gray-900 leading-tight">Сарын хуваарь</h4>
          <p className="text-sm text-gray-500 leading-tight mt-1">
            Сараар / ээлжээр / дамжлагаар / оператораар шүүх
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => switchScheduleView('operator')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-colors ${
                scheduleView === 'operator' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Операторын хуваарь
            </button>
            <button
              type="button"
              onClick={() => switchScheduleView('master')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-colors ${
                scheduleView === 'master' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Мастерын хуваарь
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="pl-2 text-[10px] font-bold text-gray-500 uppercase">Харагдац</label>
            <div className="flex rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setScheduleCalendarView('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black ${
                  scheduleCalendarView === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Сар
              </button>
              <button
                type="button"
                onClick={() => setScheduleCalendarView('week')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black ${
                  scheduleCalendarView === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                7 хоног
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="pl-2 text-[10px] font-bold text-gray-500 uppercase">Сар</label>
            <input
              type="month"
              value={scheduleMonth}
              onChange={(e) => setScheduleMonth(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm"
            />
          </div>
          {scheduleCalendarView === 'week' ? (
            <div className="flex flex-col gap-1">
              <label className="pl-2 text-[10px] font-bold text-gray-500 uppercase">7 хоног</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveWeek(-1)}
                  className="px-3 py-2 rounded-xl bg-gray-100 text-sm font-black text-gray-700 hover:bg-gray-200"
                >
                  ‹
                </button>
                <input
                  type="date"
                  value={scheduleWeekAnchor}
                  onChange={(e) => selectWeekAnchor(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm"
                  title={weekLabel(scheduleWeekAnchor)}
                />
                <button
                  type="button"
                  onClick={() => moveWeek(1)}
                  className="px-3 py-2 rounded-xl bg-gray-100 text-sm font-black text-gray-700 hover:bg-gray-200"
                >
                  ›
                </button>
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <label className="pl-2 text-[10px] font-bold text-gray-500 uppercase">Ээлж</label>
            <select
              value={scheduleFilterShiftType}
              onChange={(e) => setScheduleFilterShiftType(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm"
            >
              <option value="">Бүгд</option>
              <option value="Өдрийн">Өдрийн</option>
              <option value="Шөнийн">Шөнийн</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="pl-2 text-[10px] font-bold text-gray-500 uppercase">Дамжлага</label>
            <select
              value={scheduleFilterStationCode}
              onChange={(e) => setScheduleFilterStationCode(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm"
            >
              <option value="">Бүгд</option>
              {scheduleStationOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="pl-2 text-[10px] font-bold text-gray-500 uppercase">
              {scheduleView === 'operator' ? 'Оператор' : 'Ээлжийн мастер'}
            </label>
            <select
              value={scheduleFilterAssigneeUid}
              onChange={(e) => setScheduleFilterAssigneeUid(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm"
            >
              <option value="">Бүгд</option>
              {localUsers
                .filter((u) => (scheduleView === 'operator' ? u.role === 'operator' : u.role === 'master'))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() =>
              scheduleView === 'operator'
                ? fetchOperatorSchedulesAll({
                    month: scheduleMonth,
                    shiftType: scheduleFilterShiftType,
                    stationCode: scheduleFilterStationCode,
                    operatorUid: scheduleFilterAssigneeUid,
                  })
                : fetchMasterSchedulesAll({
                    month: scheduleMonth,
                    shiftType: scheduleFilterShiftType,
                    stationCode: scheduleFilterStationCode,
                    masterUid: scheduleFilterAssigneeUid,
                  })
            }
            className="px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
          >
            Шүүх
          </button>
        </div>
      </div>
    </div>
  );
}
