import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, Download, Eye, Search, Settings, ShieldCheck, Trash2, X } from 'lucide-react';
import { HANDOVER_WINDOW_DEFAULTS } from '@/lib/handover-window';
import { AnnouncementCenter } from '../AnnouncementCenter';
import { InstructionCenter } from '../InstructionCenter';
import { ScheduleManagementSection } from '../admin/ScheduleManagementSection';
import { ApprovalsSection } from '../admin/ApprovalsSection';
import { HorizontalPagedList } from '../HorizontalPagedList';
import {
  AUDIT_FILTER_ACTIONS,
  AUDIT_FILTER_ENTITY_TYPES,
  dashboardRoleLabel,
  mnDateTimeCompact,
} from '../dashboard-helpers';

function TimeSelect({
  value,
  onChange,
  disabled,
  placeholder = 'HH:MM',
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  const hh = m ? String(Math.min(Math.max(parseInt(m[1], 10), 0), 23)).padStart(2, '0') : '';
  const mm = m ? String(Math.min(Math.max(parseInt(m[2], 10), 0), 59)).padStart(2, '0') : '';

  return (
    <div className="relative">
      <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="time"
        step={60}
        value={hh && mm ? `${hh}:${mm}` : ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm font-bold text-gray-800 outline-none transition-all focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20 disabled:bg-gray-50 disabled:text-gray-400"
      />
    </div>
  );
}

export function AdminTab({
  adminSection,
  profile,
  systemSettings,
  setSystemSettings,
  settingsLoading,
  saveSettings,
  auditOnlyRoleChanges,
  setAuditOnlyRoleChanges,
  fetchAuditAdmin,
  auditFilterSince,
  setAuditFilterSince,
  auditFilterUntil,
  setAuditFilterUntil,
  auditFilterAction,
  setAuditFilterAction,
  auditFilterEntityType,
  setAuditFilterEntityType,
  auditFilterActorUid,
  setAuditFilterActorUid,
  auditFilterLimit,
  setAuditFilterLimit,
  localUsers,
  auditAdminRows,
  formatAuditWhen,
  auditActionTone,
  mnAction,
  mnEntityType,
  mnDetails,
  stations,
  confirmAsync,
  adminPendingShifts,
  adminApprovedShifts,
  adminPendingTotal,
  adminApprovedTotal,
  onAdminFinalApprove,
  y310PendingApprovals,
  y310ApprovedLogs,
  y310PendingTotal,
  y310ApprovedTotal,
  notStartedOperator,
  notStartedMaster,
  onY310Approve,
  toast,
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
  scheduleForm,
  setScheduleForm,
  stationsByScheduleView,
  assigningShift,
  createOperatorSchedule,
  createMasterSchedule,
  fetchOperatorSchedulesAll,
  fetchMasterSchedulesAll,
  opSchedulesAll,
  masterSchedulesAll,
  controlStructure,
  editingSchedule,
  setEditingSchedule,
  editableScheduleStationOptions,
  handleDeleteScheduleClick,
  saveEditingSchedule,
  handleApproveUser,
  handleRejectUser,
  setEditingUser,
  handleDeleteUser,
  crewSaving,
  crewForm,
  setCrewForm,
  assignShiftGroupMembers,
  createShiftGroupSchedule,
  controlLoading,
}: any) {
  const [adminFinalApprovingId, setAdminFinalApprovingId] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStationFilter, setUserStationFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'approved' | 'pending'>('all');

  const userRoleOptions = useMemo(
    () => Array.from(
      new Set<string>((localUsers || []).map((user: any) => String(user.role || '').trim()).filter(Boolean)),
    ).sort((a, b) => dashboardRoleLabel(a).localeCompare(dashboardRoleLabel(b))),
    [localUsers],
  );

  const userStationOptions = useMemo(
    () => Array.from(
      new Set<string>([
        ...(stations || []).map((station: any) => String(station.code || '').trim()),
        ...(localUsers || []).map((user: any) => String(user.stationCode || '').trim()),
      ].filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b)),
    [localUsers, stations],
  );

  const filteredUsers = useMemo(() => {
    const query = userQuery.trim().toLocaleLowerCase('mn-MN');

    return (localUsers || []).filter((user: any) => {
      if (userRoleFilter !== 'all' && String(user.role || '') !== userRoleFilter) return false;
      if (userStationFilter !== 'all' && String(user.stationCode || '') !== userStationFilter) return false;
      if (userStatusFilter === 'approved' && !user.isApproved) return false;
      if (userStatusFilter === 'pending' && user.isApproved) return false;

      if (query) {
        const searchableText = [
          user.name,
          user.email,
          user.stationCode,
          dashboardRoleLabel(user.role),
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('mn-MN');

        if (!searchableText.includes(query)) return false;
      }

      return true;
    });
  }, [localUsers, userQuery, userRoleFilter, userStationFilter, userStatusFilter]);

  const hasUserFilters =
    Boolean(userQuery.trim()) ||
    userRoleFilter !== 'all' ||
    userStationFilter !== 'all' ||
    userStatusFilter !== 'all';

  const clearUserFilters = () => {
    setUserQuery('');
    setUserRoleFilter('all');
    setUserStationFilter('all');
    setUserStatusFilter('all');
  };

  const handleAdminFinalApproveClick = async (shift: any) => {
    if (!onAdminFinalApprove || !shift?.id) return;
    const ok = await confirmAsync({
      title: 'Эцсийн баталгаажуулах уу?',
      message: `${shift.stationCode} • ${shift.shiftDate} • ${shift.shiftType} ээлжийг эцсийн байдлаар баталгаажуулна.`,
      confirmText: 'Баталгаажуулах',
      danger: false,
    });
    if (!ok) return;
    setAdminFinalApprovingId(String(shift.id));
    try {
      await onAdminFinalApprove(shift);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Эцсийн баталгаажуулалт хийхэд алдаа гарлаа.');
    } finally {
      setAdminFinalApprovingId('');
    }
  };

  return (
        <section className="space-y-12">
          {/* removed: Admin Panel heading */}

          {adminSection === 'settings' && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-6">
              <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-5">
                <div>
                  <h4 className="font-bold text-gray-900">Системийн тохиргоо</h4>
                  <p className="text-sm text-gray-500">Давтамжит бүртгэл, албан ёсны ээлж хүлээлцэх хугацаа</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Давтамжит бүртгэлийн хугацаа (цаг)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={systemSettings.periodic_interval_hours || '2'}
                    onChange={(e) => setSystemSettings({ ...systemSettings, periodic_interval_hours: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none transition-all focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20"
                    disabled={profile?.role !== 'admin'}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">Ээлж хүлээлцэх хугацаа (хатуу горим)</label>
                  <select
                    value={systemSettings.shift_handover_window_strict || 'false'}
                    onChange={(e) => setSystemSettings({ ...systemSettings, shift_handover_window_strict: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition-all focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20"
                    disabled={profile?.role !== 'admin'}
                  >
                    <option value="false">Унтраалттай</option>
                    <option value="true">Асаалттай</option>
                  </select>
                  <p className="text-xs leading-5 text-gray-500">
                    Асаалттай үед оператор хүлээлцэх хүсэлтийг зөвхөн доорх цагийн цонхонд илгээнэ.
                    Master болон admin-ийн дараагийн баталгаажуулалт түгжигдэхгүй.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-5 space-y-4">
                  <p className="font-bold text-gray-900">Өдрийн ээлж (хүлээлцэх хугацаа)</p>
                  <p className="text-xs text-gray-500 -mt-2">Өдрийн ээлж ОРОЙ дуусаж хүлээлцдэг.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-bold text-gray-700">Эхлэх</label>
                      <TimeSelect
                        value={systemSettings.day_handover_start || HANDOVER_WINDOW_DEFAULTS.day_handover_start}
                        onChange={(v) => setSystemSettings({ ...systemSettings, day_handover_start: v })}
                        disabled={profile?.role !== 'admin'}
                        placeholder="19:30"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-bold text-gray-700">Дуусах</label>
                      <TimeSelect
                        value={systemSettings.day_handover_end || HANDOVER_WINDOW_DEFAULTS.day_handover_end}
                        onChange={(v) => setSystemSettings({ ...systemSettings, day_handover_end: v })}
                        disabled={profile?.role !== 'admin'}
                        placeholder="20:30"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-5 space-y-4">
                  <p className="font-bold text-gray-900">Шөнийн ээлж (хүлээлцэх хугацаа)</p>
                  <p className="text-xs text-gray-500 -mt-2">Шөнийн ээлж ӨГЛӨӨ дуусаж хүлээлцдэг.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-bold text-gray-700">Эхлэх</label>
                      <TimeSelect
                        value={systemSettings.night_handover_start || HANDOVER_WINDOW_DEFAULTS.night_handover_start}
                        onChange={(v) => setSystemSettings({ ...systemSettings, night_handover_start: v })}
                        disabled={profile?.role !== 'admin'}
                        placeholder="07:30"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-bold text-gray-700">Дуусах</label>
                      <TimeSelect
                        value={systemSettings.night_handover_end || HANDOVER_WINDOW_DEFAULTS.night_handover_end}
                        onChange={(v) => setSystemSettings({ ...systemSettings, night_handover_end: v })}
                        disabled={profile?.role !== 'admin'}
                        placeholder="08:30"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setSystemSettings({
                      ...systemSettings,
                      periodic_interval_hours: '2',
                      shift_handover_window_strict: 'false',
                      ...HANDOVER_WINDOW_DEFAULTS,
                    })
                  }
                  disabled={settingsLoading || profile?.role !== 'admin'}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                  title="Шаардлагын стандарт утгууд руу буцаах"
                >
                  Стандарт утга
                </button>
                <button
                  type="button"
                  onClick={saveSettings}
                  disabled={settingsLoading || profile?.role !== 'admin'}
                  className="inline-flex items-center justify-center rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  Хадгалах
                </button>
              </div>
            </div>
          )}

          {adminSection === 'audit' && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 space-y-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900">Аудит лог</h4>
                    <p className="text-xs text-gray-500 mt-1">Огноо, үйлдэл, төрөл, хэрэглэгчээр шүүж харах.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        setAuditOnlyRoleChanges(false);
                        await fetchAuditAdmin({ onlyRoleChanges: false });
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${!auditOnlyRoleChanges ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'
                        }`}
                    >
                      Бүгд
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setAuditOnlyRoleChanges(true);
                        await fetchAuditAdmin({ onlyRoleChanges: true });
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${auditOnlyRoleChanges ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'
                        }`}
                    >
                      Role өөрчлөлт
                    </button>
                  </div>
                </div>

                <div
                  className={`grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-4 md:grid-cols-2 xl:grid-cols-12 ${auditOnlyRoleChanges ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="space-y-1 xl:col-span-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Эхлэх огноо</label>
                    <input
                      type="date"
                      value={auditFilterSince}
                      onChange={(e) => setAuditFilterSince(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                      disabled={auditOnlyRoleChanges}
                    />
                  </div>
                  <div className="space-y-1 xl:col-span-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Дуусах огноо</label>
                    <input
                      type="date"
                      value={auditFilterUntil}
                      onChange={(e) => setAuditFilterUntil(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                      disabled={auditOnlyRoleChanges}
                    />
                  </div>
                  <div className="space-y-1 xl:col-span-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Үйлдэл</label>
                    <select
                      value={auditFilterAction}
                      onChange={(e) => setAuditFilterAction(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                      disabled={auditOnlyRoleChanges}
                    >
                      <option value="">Бүгд</option>
                      {AUDIT_FILTER_ACTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 xl:col-span-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Төрөл</label>
                    <select
                      value={auditFilterEntityType}
                      onChange={(e) => setAuditFilterEntityType(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                      disabled={auditOnlyRoleChanges}
                    >
                      <option value="">Бүгд</option>
                      {AUDIT_FILTER_ENTITY_TYPES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 xl:col-span-3">
                    <label className="text-xs font-bold text-gray-500 uppercase">Хэн (хэрэглэгч)</label>
                    <select
                      value={auditFilterActorUid}
                      onChange={(e) => setAuditFilterActorUid(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                      disabled={auditOnlyRoleChanges}
                    >
                      <option value="">Бүгд</option>
                      {localUsers.map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {(u.name || 'Нэргүй') + (u.email ? ` — ${u.email}` : '')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 xl:col-span-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Хязгаар (1–500)</label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={auditFilterLimit}
                      onChange={(e) => setAuditFilterLimit(parseInt(e.target.value || '200', 10))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                      disabled={auditOnlyRoleChanges}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => fetchAuditAdmin()}
                    className="px-5 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
                  >
                    Шүүх
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setAuditFilterSince('');
                      setAuditFilterUntil('');
                      setAuditFilterAction('');
                      setAuditFilterEntityType('');
                      setAuditFilterActorUid('');
                      setAuditFilterLimit(200);
                      setAuditOnlyRoleChanges(false);
                      await fetchAuditAdmin({ onlyRoleChanges: false });
                    }}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
                  >
                    Цэвэрлэх
                  </button>
                </div>
              </div>
              <HorizontalPagedList
                items={auditAdminRows}
                renderPage={(page) => (
                <table className="w-full table-fixed text-left">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="w-[9.5rem] px-5 py-4 font-bold">Хэзээ</th>
                      <th className="w-[13rem] px-5 py-4 font-bold">Хэн</th>
                      <th className="w-[12rem] px-5 py-4 font-bold">Үйлдэл</th>
                      <th className="w-[10rem] px-5 py-4 font-bold">Төрөл</th>
                      <th className="px-5 py-4 font-bold">Дэлгэрэнгүй</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditAdminRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-gray-400">Лог байхгүй байна.</td>
                      </tr>
                    ) : (
                      page.map((log: any) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-5 py-4 text-xs font-semibold text-gray-600 whitespace-nowrap">{formatAuditWhen(log.timestamp)}</td>
                          <td className="px-5 py-4 text-sm text-gray-700">
                            <p className="truncate font-semibold" title={String(log.actorName || log.actorUid || '')}>
                              {log.actorName || log.actorUid || '—'}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex max-w-full items-center rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase leading-4 ${auditActionTone(log.action)}`}>
                              {mnAction(log.action)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-500">
                            <p className="truncate" title={mnEntityType(log.entityType)}>{mnEntityType(log.entityType)}</p>
                          </td>
                          <td
                            className="px-5 py-4 text-sm text-gray-600"
                            title={mnDetails(log.action, log.details)}
                          >
                            <p className="line-clamp-2 break-words">{mnDetails(log.action, log.details)}</p>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                )}
              />
            </div>
          )}

          {/* PRD: schedules are managed from Dispatcher -> Ээлжийн хуваарь (adminSection === 'schedules') */}

          {adminSection === 'instructions' && (
            <InstructionCenter
              profile={profile}
              stations={stations}
              mode="admin"
              confirmAction={confirmAsync}
            />
          )}

          {adminSection === 'announcements' && (
            <AnnouncementCenter
              profile={profile}
              stations={stations}
              mode="admin"
              confirmAction={confirmAsync}
            />
          )}

          {adminSection === 'approvals' && (
            <ApprovalsSection
              adminPendingShifts={adminPendingShifts}
              adminApprovedShifts={adminApprovedShifts}
              adminPendingTotal={adminPendingTotal}
              adminApprovedTotal={adminApprovedTotal}
              y310PendingApprovals={y310PendingApprovals}
              y310ApprovedLogs={y310ApprovedLogs}
              y310PendingTotal={y310PendingTotal}
              y310ApprovedTotal={y310ApprovedTotal}
              notStartedOperator={notStartedOperator}
              notStartedMaster={notStartedMaster}
              onY310Approve={onY310Approve}
              handleAdminFinalApproveClick={handleAdminFinalApproveClick}
              confirmAsync={confirmAsync}
              adminFinalApprovingId={adminFinalApprovingId}
              stations={stations}
              localUsers={localUsers}
            />
          )}

          {/* Shift Assignment Section */}
          {adminSection === 'schedules' && (
            <ScheduleManagementSection
              scheduleMonth={scheduleMonth}
              setScheduleMonth={setScheduleMonth}
              scheduleFilterShiftType={scheduleFilterShiftType}
              setScheduleFilterShiftType={setScheduleFilterShiftType}
              scheduleFilterStationCode={scheduleFilterStationCode}
              setScheduleFilterStationCode={setScheduleFilterStationCode}
              scheduleFilterAssigneeUid={scheduleFilterAssigneeUid}
              setScheduleFilterAssigneeUid={setScheduleFilterAssigneeUid}
              scheduleView={scheduleView}
              setScheduleView={setScheduleView}
              scheduleCalendarView={scheduleCalendarView}
              setScheduleCalendarView={setScheduleCalendarView}
              scheduleWeekAnchor={scheduleWeekAnchor}
              setScheduleWeekAnchor={setScheduleWeekAnchor}
              scheduleForm={scheduleForm}
              setScheduleForm={setScheduleForm}
              stationsByScheduleView={stationsByScheduleView}
              localUsers={localUsers}
              assigningShift={assigningShift}
              createOperatorSchedule={createOperatorSchedule}
              createMasterSchedule={createMasterSchedule}
              fetchOperatorSchedulesAll={fetchOperatorSchedulesAll}
              fetchMasterSchedulesAll={fetchMasterSchedulesAll}
              opSchedulesAll={opSchedulesAll}
              masterSchedulesAll={masterSchedulesAll}
              controlStructure={controlStructure}
              crewForm={crewForm}
              setCrewForm={setCrewForm}
              crewSaving={crewSaving}
              assignShiftGroupMembers={assignShiftGroupMembers}
              createShiftGroupSchedule={createShiftGroupSchedule}
              stations={stations}
              editingSchedule={editingSchedule}
              setEditingSchedule={setEditingSchedule}
              editableScheduleStationOptions={editableScheduleStationOptions}
              handleDeleteScheduleClick={handleDeleteScheduleClick}
              saveEditingSchedule={saveEditingSchedule}
              readOnly={profile?.role === 'dispatcher'}
            />
          )}

          {/* User Management Section — зөвхөн админ */}
          {adminSection === 'users' && profile?.role === 'admin' && (
            <div className="space-y-8">
              <div className="flex items-center gap-2 text-orange-600">
                <ShieldCheck className="w-6 h-6" />
                <h4 className="font-bold text-xl">Хэрэглэгчийн удирдлага</h4>
              </div>

              {/* Pending Approvals Section */}
              {localUsers.filter((u: any) => !u.isApproved).length > 0 && (
                <div className="bg-orange-50 rounded-3xl border border-orange-100 overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-orange-100 flex justify-between items-center">
                    <h5 className="font-bold text-orange-900 flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Баталгаажуулах хүлээгдэж буй ({localUsers.filter((u: any) => !u.isApproved).length})
                    </h5>
                  </div>
                  <HorizontalPagedList
                    items={localUsers.filter((u: any) => !u.isApproved)}
                    renderPage={(page) => (
                    <table className="w-full table-fixed text-left">
                      <thead>
                        <tr className="bg-orange-100/50 text-orange-800 text-xs uppercase tracking-wider">
                          <th className="px-8 py-4 font-bold">Нэр / И-мэйл</th>
                          <th className="px-8 py-4 font-bold">Төрөл</th>
                          <th className="px-8 py-4 font-bold text-right">Үйлдэл</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orange-100">
                        {page.map((u: any) => (
                          <tr key={u.id}>
                            <td className="px-8 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-orange-900">{u.name || 'Нэргүй'}</span>
                                <span className="text-xs text-orange-700">{u.email}</span>
                              </div>
                            </td>
                            <td className="px-8 py-4">
                              <span className="inline-flex rounded-full border border-orange-200 bg-white px-3 py-1 text-[10px] font-black text-orange-700">
                                {dashboardRoleLabel(u.role)}
                              </span>
                            </td>
                            <td className="px-8 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleRejectUser(u.id, u.email)}
                                  className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-50"
                                >
                                  Татгалзах
                                </button>
                                <button
                                  onClick={() => handleApproveUser(u.id, u.role)}
                                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 shadow-sm"
                                >
                                  Зөвшөөрөх
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    )}
                  />
                </div>
              )}

              {/* Main User List */}
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                  <h4 className="font-bold text-gray-900">Бүх хэрэглэгчид</h4>
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold">
                    {hasUserFilters ? `Илэрц: ${filteredUsers.length} / ${localUsers.length}` : `Нийт: ${localUsers.length}`}
                  </span>
                </div>
                <div className="border-b border-gray-100 bg-gray-50/60 p-5">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.6fr)_1fr_1fr_1fr_auto]">
                    <label className="space-y-2">
                      <span className="block text-[11px] font-black uppercase text-gray-500">Нэр / И-мэйл</span>
                      <span className="relative block">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          type="search"
                          value={userQuery}
                          onChange={(event) => setUserQuery(event.target.value)}
                          placeholder="Хэрэглэгч хайх"
                          className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20"
                        />
                      </span>
                    </label>

                    <label className="space-y-2">
                      <span className="block text-[11px] font-black uppercase text-gray-500">Үүрэг</span>
                      <select
                        value={userRoleFilter}
                        onChange={(event) => setUserRoleFilter(event.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20"
                      >
                        <option value="all">Бүх үүрэг</option>
                        {userRoleOptions.map((role) => (
                          <option key={role} value={role}>{dashboardRoleLabel(role)}</option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="block text-[11px] font-black uppercase text-gray-500">Станц</span>
                      <select
                        value={userStationFilter}
                        onChange={(event) => setUserStationFilter(event.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20"
                      >
                        <option value="all">Бүх станц</option>
                        {userStationOptions.map((stationCode) => (
                          <option key={stationCode} value={stationCode}>{stationCode}</option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="block text-[11px] font-black uppercase text-gray-500">Төлөв</span>
                      <select
                        value={userStatusFilter}
                        onChange={(event) => setUserStatusFilter(event.target.value as 'all' | 'approved' | 'pending')}
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20"
                      >
                        <option value="all">Бүх төлөв</option>
                        <option value="approved">Баталгаажсан</option>
                        <option value="pending">Хүлээгдэж буй</option>
                      </select>
                    </label>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={clearUserFilters}
                        disabled={!hasUserFilters}
                        title="Шүүлтүүр цэвэрлэх"
                        aria-label="Шүүлтүүр цэвэрлэх"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <HorizontalPagedList
                  items={filteredUsers}
                  renderPage={(page) => (
                  <table className="w-full table-fixed text-left">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider">
                        <th className="w-[26%] px-5 py-4 font-bold">Нэр / И-мэйл</th>
                        <th className="w-[15%] px-5 py-4 font-bold">Үүрэг</th>
                        <th className="w-[11%] px-5 py-4 font-bold">Станц</th>
                        <th className="w-[11%] px-5 py-4 font-bold">Ээлжийн баг</th>
                        <th className="w-[18%] px-5 py-4 font-bold">Төлөв</th>
                        <th className="w-[19%] px-5 py-4 text-right font-bold">Үйлдэл</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                            {localUsers.length === 0
                              ? 'Хэрэглэгч одоогоор байхгүй байна.'
                              : 'Шүүлтүүрт тохирох хэрэглэгч олдсонгүй.'}
                          </td>
                        </tr>
                      ) : (
                        page.map((u: any) => (
                          <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-5">
                              <div className="min-w-0">
                                <span className="block truncate text-sm font-bold text-gray-900">{u.name || 'Нэргүй'}</span>
                                <span className="block truncate text-xs text-gray-500">{u.email}</span>
                              </div>
                            </td>
                            <td className="px-5 py-5">
                              <span className={`inline-flex max-w-full rounded-full border px-3 py-1 text-[10px] font-black ${u.role === 'admin' ? 'border-purple-200 bg-purple-50 text-purple-700' :
                                u.role === 'master' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                                  u.role === 'manager' ? 'border-purple-200 bg-purple-50 text-purple-700' :
                                    u.role === 'hse_engineer' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                                      'border-gray-200 bg-gray-50 text-gray-700'
                                }`}>
                                <span className="truncate">{dashboardRoleLabel(u.role)}</span>
                              </span>
                            </td>
                            <td className="px-5 py-5 text-sm font-bold text-gray-600">{u.stationCode || '-'}</td>
                            <td className="px-5 py-5">
                              {u.shiftGroup ? (
                                <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-black text-orange-700">
                                  {u.shiftGroup}-р ээлж
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-5 py-5">
                              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase ${u.isApproved ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'
                                }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${u.isApproved ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                {u.isApproved ? 'Баталгаажсан' : 'Хүлээгдэж буй'}
                              </span>
                            </td>
                            <td className="px-5 py-5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingUser({ ...u, uid: u.id, displayName: u.name, isPostgres: true })}
                                  className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                                  title="Засах"
                                >
                                  <Settings className="w-4 h-4" />
                                  Засах
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u.id, u.email)}
                                  className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100"
                                  title="Устгах"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Устгах
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  )}
                />
              </div>
            </div>
          )}

        </section>
  );
}
