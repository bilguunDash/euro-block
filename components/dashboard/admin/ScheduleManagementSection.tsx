import React, { useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { ScheduleAssignmentForm } from './schedule/ScheduleAssignmentForm';
import { ScheduleEditModal } from './schedule/ScheduleEditModal';
import { CurrentScheduleTable } from './schedule/CurrentScheduleTable';
import { ScheduleExcelImport } from './schedule/ScheduleExcelImport';
import { ShiftCrewAssignPanel, type CrewAssignFormState } from './schedule/ShiftCrewAssignPanel';
import { ShiftCrewManager } from './schedule/ShiftCrewManager';
import type { DashboardUser, ScheduleCalendarView, ScheduleFormState, ScheduleStateSetter, ScheduleView, Station } from './schedule/types';

const EXCEL_IMPORT_ENABLED = false;

type ScheduleManagementSectionProps = {
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
  scheduleForm: ScheduleFormState;
  setScheduleForm: ScheduleStateSetter<ScheduleFormState>;
  stationsByScheduleView: Station[];
  localUsers: DashboardUser[];
  crewForm: CrewAssignFormState;
  setCrewForm: ScheduleStateSetter<CrewAssignFormState>;
  crewSaving: boolean;
  assignShiftGroupMembers: (userIds: string[], shiftGroup: string | null) => void | Promise<void>;
  createShiftGroupSchedule: (e: React.FormEvent) => void;
  assigningShift: boolean;
  createOperatorSchedule: (e: React.FormEvent) => void;
  createMasterSchedule: (e: React.FormEvent) => void;
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
  opSchedulesAll: any[];
  masterSchedulesAll: any[];
  controlStructure: any;
  stations: Station[];
  editingSchedule: any;
  setEditingSchedule: ScheduleStateSetter<any>;
  editableScheduleStationOptions: (scheduleRow: any) => Station[];
  handleDeleteScheduleClick: (schedule: any) => Promise<void>;
  saveEditingSchedule: () => Promise<void>;
  readOnly?: boolean;
};

export function ScheduleManagementSection({
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
  scheduleForm,
  setScheduleForm,
  stationsByScheduleView,
  localUsers,
  crewForm,
  setCrewForm,
  crewSaving,
  assignShiftGroupMembers,
  createShiftGroupSchedule,
  assigningShift,
  createOperatorSchedule,
  createMasterSchedule,
  fetchOperatorSchedulesAll,
  fetchMasterSchedulesAll,
  opSchedulesAll,
  masterSchedulesAll,
  controlStructure,
  stations,
  editingSchedule,
  setEditingSchedule,
  editableScheduleStationOptions,
  handleDeleteScheduleClick,
  saveEditingSchedule,
  readOnly = false,
}: ScheduleManagementSectionProps) {

  const applyFilters = useCallback(() => {
    if (scheduleView === 'master') {
      void fetchMasterSchedulesAll();
    } else {
      void fetchOperatorSchedulesAll();
    }
  }, [scheduleView, fetchMasterSchedulesAll, fetchOperatorSchedulesAll]);

  const switchScheduleView = useCallback(
    (next: ScheduleView) => {
      if (next === scheduleView) return;
      setScheduleView(next);
      setScheduleFilterStationCode('');
      setScheduleFilterAssigneeUid('');
      if (next === 'operator') {
        void fetchOperatorSchedulesAll({ month: scheduleMonth, shiftType: scheduleFilterShiftType, stationCode: '', operatorUid: '' });
      } else {
        void fetchMasterSchedulesAll({ month: scheduleMonth, shiftType: scheduleFilterShiftType, stationCode: '', masterUid: '' });
      }
    },
    [scheduleView, setScheduleView, setScheduleFilterStationCode, setScheduleFilterAssigneeUid, scheduleMonth, scheduleFilterShiftType, fetchOperatorSchedulesAll, fetchMasterSchedulesAll]
  );

  const resetFilters = useCallback(() => {
    const nowMonth = new Date().toISOString().slice(0, 7);
    setScheduleMonth(nowMonth);
    setScheduleFilterShiftType('');
    setScheduleFilterStationCode('');
    setScheduleFilterAssigneeUid('');
    if (scheduleView === 'master') {
      void fetchMasterSchedulesAll({ month: nowMonth, shiftType: '', stationCode: '', masterUid: '' });
    } else {
      void fetchOperatorSchedulesAll({ month: nowMonth, shiftType: '', stationCode: '', operatorUid: '' });
    }
  }, [scheduleView, setScheduleMonth, setScheduleFilterShiftType, setScheduleFilterStationCode, setScheduleFilterAssigneeUid, fetchMasterSchedulesAll, fetchOperatorSchedulesAll]);

  // Багийн UI-д stationCode / shiftGroup хэрэгтэй — /api/stations-ийн users илүү бүрэн.
  const crewUsers: DashboardUser[] = Array.isArray(controlStructure?.users) && controlStructure.users.length > 0
    ? controlStructure.users
    : localUsers;

  const assigneeOptions = scheduleView === 'master'
    ? localUsers.filter((u) => u.role === 'master')
    : localUsers.filter((u) => u.role === 'operator');

  const hasActiveFilter =
    scheduleFilterShiftType !== '' ||
    scheduleFilterStationCode !== '' ||
    scheduleFilterAssigneeUid !== '';

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5">
        <div className="flex flex-wrap items-end gap-3">
          {/* View switch */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Харагдац</label>
            <div className="flex rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => switchScheduleView('operator')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${
                  scheduleView === 'operator' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Оператор
              </button>
              <button
                type="button"
                onClick={() => switchScheduleView('master')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${
                  scheduleView === 'master' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Мастер
              </button>
            </div>
          </div>

          {/* Month */}
          <div className="flex flex-col gap-1 min-w-[9rem]">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Сар</label>
            <input
              type="month"
              value={scheduleMonth}
              onChange={(e) => setScheduleMonth(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          {/* Shift type */}
          <div className="flex flex-col gap-1 min-w-[9rem]">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Ээлж</label>
            <select
              value={scheduleFilterShiftType}
              onChange={(e) => setScheduleFilterShiftType(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 bg-white"
            >
              <option value="">Бүгд</option>
              <option value="Өдрийн">Өдрийн</option>
              <option value="Шөнийн">Шөнийн</option>
            </select>
          </div>

          {/* Station */}
          <div className="flex flex-col gap-1 min-w-[12rem]">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Дамжлага</label>
            <select
              value={scheduleFilterStationCode}
              onChange={(e) => setScheduleFilterStationCode(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 bg-white"
            >
              <option value="">Бүгд</option>
              {stations.map((st) => (
                <option key={st.code} value={st.code}>{st.code} — {st.name}</option>
              ))}
            </select>
          </div>

          {/* Assignee */}
          <div className="flex flex-col gap-1 min-w-[11rem]">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              {scheduleView === 'master' ? 'Мастер' : 'Оператор'}
            </label>
            <select
              value={scheduleFilterAssigneeUid}
              onChange={(e) => setScheduleFilterAssigneeUid(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 bg-white"
            >
              <option value="">Бүгд</option>
              {assigneeOptions.map((u) => (
                <option key={u.id} value={u.id}>{u.name || u.email}</option>
              ))}
            </select>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 pb-0.5">
            <button
              type="button"
              onClick={applyFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 transition-colors"
            >
              <Search size={14} />
              Хайх
            </button>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <X size={14} />
                Арилгах
              </button>
            )}
            {!readOnly && EXCEL_IMPORT_ENABLED && (
              <ScheduleExcelImport
                defaultMonth={scheduleMonth}
                onCommitted={(importedMonth) => {
                  // Импортолсон сар нь одоогийн шүүлтүүрээс өөр байж болох тул шинэчилж,
                  // хүснэгтэд шинээр орсон мөрүүд шууд харагдахаар болгоно.
                  setScheduleMonth(importedMonth);
                  setScheduleFilterShiftType('');
                  setScheduleFilterStationCode('');
                  setScheduleFilterAssigneeUid('');
                  void fetchOperatorSchedulesAll({ month: importedMonth, shiftType: '', stationCode: '', operatorUid: '' });
                  void fetchMasterSchedulesAll({ month: importedMonth, shiftType: '', stationCode: '', masterUid: '' });
                }}
              />
            )}
          </div>
        </div>
      </div>

      {!readOnly && (
        <div className="space-y-7">
          <ShiftCrewAssignPanel
            form={crewForm}
            setForm={setCrewForm}
            users={crewUsers}
            stations={stations}
            submitting={crewSaving}
            onSubmit={createShiftGroupSchedule}
          />
          <ShiftCrewManager users={crewUsers} saving={crewSaving} onAssign={assignShiftGroupMembers} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-7
">
        {!readOnly && (
          <ScheduleAssignmentForm
            scheduleView={scheduleView}
            scheduleForm={scheduleForm}
            setScheduleForm={setScheduleForm}
            stationsByScheduleView={stationsByScheduleView}
            localUsers={localUsers}
            assigningShift={assigningShift}
            createOperatorSchedule={createOperatorSchedule}
            createMasterSchedule={createMasterSchedule}
          />
        )}

        <CurrentScheduleTable
          scheduleView={scheduleView}
          opSchedulesAll={opSchedulesAll}
          masterSchedulesAll={masterSchedulesAll}
          stations={stations}
          localUsers={localUsers}
          setEditingSchedule={setEditingSchedule}
          handleDeleteScheduleClick={handleDeleteScheduleClick}
          readOnly={readOnly}
          scheduleMonth={scheduleMonth}
        />
      </div>

      {!readOnly && (
        <ScheduleEditModal
          editingSchedule={editingSchedule}
          setEditingSchedule={setEditingSchedule}
          editableScheduleStationOptions={editableScheduleStationOptions}
          localUsers={localUsers}
          saveEditingSchedule={saveEditingSchedule}
        />
      )}
    </div>
  );
}
