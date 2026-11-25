import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { appendAuditLog } from '@/lib/audit-log';
import { HANDOVER_WINDOW_DEFAULTS, isoDateInTimeZone } from '@/lib/handover-window';

const SCHEDULE_MONTH_STORAGE_KEY = 'euroblock_admin_schedule_month';

/** localStorage-д хадгалсан сар байвал түүнийг, эс бол өнөөдрийн сарыг эхний утга болгоно. */
function initialScheduleMonth(): string {
  const fallback = new Date().toISOString().slice(0, 7);
  if (typeof window === 'undefined') return fallback;
  const saved = window.localStorage.getItem(SCHEDULE_MONTH_STORAGE_KEY);
  return saved && /^\d{4}-\d{2}$/.test(saved) ? saved : fallback;
}

/** Хуваарь хадгалсны дараах toast — bulk (created/skipped) тоог харуулна. */
function scheduleSaveMessage(created: number, skipped: number, baseMsg: string): string {
  if (created === 0 && skipped === 0) return baseMsg;
  const parts: string[] = [];
  if (created > 0) parts.push(`${created} хуваарь нэмэгдлээ`);
  if (skipped > 0) parts.push(`${skipped} өмнө нь оноогдсон тул алгассан`);
  return parts.length ? parts.join(', ') + '.' : baseMsg;
}

/** `YYYY-MM-DD` -аас `YYYY-MM` гаргана — "Одоогийн хуваарь" хүснэгтийн сарын шүүлтүүрт ашиглана. */
function monthOf(dateStr: unknown): string {
  const s = String(dateStr || '');
  return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : '';
}

export function useDashboardAdmin({
  profile,
  activeTab,
  adminSection,
  stations,
  toast,
  confirmAsync,
}: any) {
  const [creatingOperators, setCreatingOperators] = useState(false);
  const [assigningShift, setAssigningShift] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  // Assignment Form State
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignShiftType, setAssignShiftType] = useState<'Өдрийн' | 'Шөнийн'>('Өдрийн');
  const [assignStation, setAssignStation] = useState('');
  const [assignOperatorUid, setAssignOperatorUid] = useState('');

  const [localUsers, setLocalUsers] = useState<any[]>([]);
  const [controlStructure, setControlStructure] = useState<any>({
    stations: [],
    users: [],
  });
  const [controlLoading, setControlLoading] = useState(false);

  // Ээлжийн баг
  const [crewSaving, setCrewSaving] = useState(false);
  const [crewForm, setCrewForm] = useState({
    shiftGroup: '1',
    stationCode: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    shiftTypes: ['Өдрийн'] as string[],
  });

  const isScheduleAdmin = profile?.role === 'admin';
  const isOperatorView = profile?.role === 'operator';

  const [systemSettings, setSystemSettings] = useState<Record<string, string>>({});
  const [settingsLoading, setSettingsLoading] = useState(false);

  const [opSchedulesAll, setOpSchedulesAll] = useState<any[]>([]);
  const [masterSchedulesAll, setMasterSchedulesAll] = useState<any[]>([]);
  const [scheduleView, setScheduleView] = useState<'operator' | 'master'>('master');

  const [scheduleMonth, setScheduleMonth] = useState(initialScheduleMonth); // YYYY-MM
  useEffect(() => {
    window.localStorage.setItem(SCHEDULE_MONTH_STORAGE_KEY, scheduleMonth);
  }, [scheduleMonth]);
  const [scheduleCalendarView, setScheduleCalendarView] = useState<'month' | 'week'>('month');
  const [scheduleWeekAnchor, setScheduleWeekAnchor] = useState(() => isoDateInTimeZone());
  const [scheduleFilterShiftType, setScheduleFilterShiftType] = useState<string>('');
  const [scheduleFilterStationCode, setScheduleFilterStationCode] = useState<string>('');
  const [scheduleFilterAssigneeUid, setScheduleFilterAssigneeUid] = useState<string>('');

  const controlStations = useMemo(() => {
    const rows = Array.isArray(controlStructure?.stations) ? controlStructure.stations : [];
    return rows.length > 0 ? rows : stations;
  }, [controlStructure?.stations, stations]);

  const stationsByScheduleView = useMemo(() => {
    if (scheduleView === 'operator') return controlStations.filter((s: any) => !s.isMasterStation);
    return controlStations.filter((s: any) => s.isMasterStation);
  }, [controlStations, scheduleView]);

  const [scheduleForm, setScheduleForm] = useState({
    shiftDate: new Date().toISOString().split('T')[0],
    endDate: '',
    shiftTypes: ['Өдрийн'] as string[],
    stationCode: '',
    assigneeUid: '',
  });

  const [editingSchedule, setEditingSchedule] = useState<any>(null);

  // Operator view дээр station filter/form reset
  useEffect(() => {
    if (scheduleFilterStationCode && !stationsByScheduleView.some((s: any) => s.code === scheduleFilterStationCode)) {
      setScheduleFilterStationCode('');
    }
    // Master view-д stationCode нь сонгосон мастерын өөрийн станцаас автоматаар ирдэг тул reset хийхгүй
    if (scheduleView === 'operator' && scheduleForm.stationCode && !stationsByScheduleView.some((s: any) => s.code === scheduleForm.stationCode)) {
      setScheduleForm((p: any) => ({ ...p, stationCode: '' }));
    }
  }, [scheduleView, stationsByScheduleView, scheduleFilterStationCode, scheduleForm.stationCode]);

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const r = await fetch('/api/settings', { credentials: 'include' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'Тохиргоо ачаалж чадсангүй.');
      setSystemSettings(j.settings || {});
    } catch (e: any) {
      toast.error(e?.message || 'Тохиргоо ачаалж чадсангүй.');
    } finally {
      setSettingsLoading(false);
    }
  }, [toast]);

  const saveSettings = async () => {
    const interval = Number(systemSettings.periodic_interval_hours);
    if (!Number.isFinite(interval) || interval <= 0 || interval > 24) {
      toast.warning('Давтамжит бүртгэлийн хугацаа 0-ээс их, 24 цагаас ихгүй байна.');
      return;
    }
    const times = [
      systemSettings.day_handover_start,
      systemSettings.day_handover_end,
      systemSettings.night_handover_start,
      systemSettings.night_handover_end,
    ];
    if (times.some((value) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '')))) {
      toast.warning('Ээлж хүлээлцэх цагуудыг бүрэн сонгоно уу.');
      return;
    }
    if (systemSettings.day_handover_start === systemSettings.day_handover_end) {
      toast.warning('Өдрийн ээлжийн эхлэх, дуусах цаг ижил байж болохгүй.');
      return;
    }
    if (systemSettings.night_handover_start === systemSettings.night_handover_end) {
      toast.warning('Шөнийн ээлжийн эхлэх, дуусах цаг ижил байж болохгүй.');
      return;
    }

    setSettingsLoading(true);
    try {
      const payloadSettings = {
        periodic_interval_hours: systemSettings.periodic_interval_hours ?? '2',
        shift_handover_window_strict: systemSettings.shift_handover_window_strict ?? 'false',
        day_handover_start: systemSettings.day_handover_start ?? HANDOVER_WINDOW_DEFAULTS.day_handover_start,
        day_handover_end: systemSettings.day_handover_end ?? HANDOVER_WINDOW_DEFAULTS.day_handover_end,
        night_handover_start: systemSettings.night_handover_start ?? HANDOVER_WINDOW_DEFAULTS.night_handover_start,
        night_handover_end: systemSettings.night_handover_end ?? HANDOVER_WINDOW_DEFAULTS.night_handover_end,
      } as Record<string, string>;

      const r = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ settings: payloadSettings }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'Үйлдэл амжилтгүй боллоо');
      await fetchSettings();
      toast.success('Тохиргоо хадгалагдлаа.');
    } catch (e: any) {
      toast.error('Тохиргоо хадгалахад алдаа:\n\n' + (e?.message || ''));
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOperatorView) return;
    if (activeTab !== 'dashboard') return;
    fetchSettings();
  }, [isOperatorView, activeTab, fetchSettings]);

  const fetchOperatorSchedulesAll = useCallback(async (opts?: {
    month?: string;
    shiftType?: string;
    stationCode?: string;
    operatorUid?: string;
  }) => {
    try {
      const month = opts?.month ?? scheduleMonth;
      const shiftType = opts?.shiftType ?? scheduleFilterShiftType;
      const stationCode = opts?.stationCode ?? scheduleFilterStationCode;
      const operatorUid = opts?.operatorUid ?? scheduleFilterAssigneeUid;

      const qs = new URLSearchParams({ queryType: 'all' });
      if (month) qs.set('month', month);
      if (shiftType) qs.set('shiftType', shiftType);
      if (stationCode) qs.set('stationCode', stationCode);
      if (operatorUid) qs.set('operatorUid', operatorUid);

      const r = await fetch(`/api/operator-schedules?${qs.toString()}`, { credentials: 'include' });
      const j = await r.json();
      if (j?.ok) setOpSchedulesAll(j.schedules || []);
    } catch (e) {
      console.error(e);
    }
  }, [scheduleMonth, scheduleFilterShiftType, scheduleFilterStationCode, scheduleFilterAssigneeUid]);

  const fetchMasterSchedulesAll = useCallback(async (opts?: {
    month?: string;
    shiftType?: string;
    stationCode?: string;
    masterUid?: string;
  }) => {
    try {
      const month = opts?.month ?? scheduleMonth;
      const shiftType = opts?.shiftType ?? scheduleFilterShiftType;
      const stationCode = opts?.stationCode ?? scheduleFilterStationCode;
      const masterUid = opts?.masterUid ?? scheduleFilterAssigneeUid;

      const qs = new URLSearchParams({ queryType: 'all' });
      if (month) qs.set('month', month);
      if (shiftType) qs.set('shiftType', shiftType);
      if (stationCode) qs.set('stationCode', stationCode);
      if (masterUid) qs.set('masterUid', masterUid);

      const r = await fetch(`/api/schedules?${qs.toString()}`, { credentials: 'include' });
      const j = await r.json();
      if (j?.ok) setMasterSchedulesAll(j.schedules || []);
    } catch (e) {
      console.error(e);
    }
  }, [scheduleMonth, scheduleFilterShiftType, scheduleFilterStationCode, scheduleFilterAssigneeUid]);

  // Сонгосон ээлж (Өдрийн/Шөнийн) бүрээр endpoint рүү дараалан POST хийж,
  // үүсгэсэн/алгассан тоог нэгтгэнэ. Bulk (created/skipped) болон нэг өдрийн
  // (duplicate) хариу хоёуланг зохицуулна.
  const submitScheduleForShiftTypes = async (
    endpoint: string,
    buildBody: (shiftType: string) => any,
  ): Promise<{ created: number; skipped: number }> => {
    let created = 0;
    let skipped = 0;
    for (const shiftType of scheduleForm.shiftTypes) {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(buildBody(shiftType)),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'Үйлдэл амжилтгүй боллоо');
      if (Number.isFinite(Number(j?.created))) {
        created += Number(j.created) || 0;
        skipped += Number(j.skipped) || 0;
      } else if (j?.duplicate) {
        skipped += 1;
      } else {
        created += 1;
      }
    }
    return { created, skipped };
  };

  const createOperatorSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (assigningShift) return;
    if (scheduleForm.shiftTypes.length === 0) {
      toast.error('Дор хаяж нэг ээлж (Өдрийн эсвэл Шөнийн) сонгоно уу.');
      return;
    }
    setAssigningShift(true);
    try {
      const op = localUsers.find((u: any) => u.id === scheduleForm.assigneeUid);
      const { created, skipped } = await submitScheduleForShiftTypes('/api/operator-schedules', (shiftType) => ({
        shiftDate: scheduleForm.shiftDate,
        endDate: scheduleForm.endDate || '',
        shiftType,
        stationCode: scheduleForm.stationCode,
        operatorUid: scheduleForm.assigneeUid,
        operatorName: op?.name || op?.email || null,
      }));
      // Шинээр оноосон хуваарийг шууд харуулахын тулд "Сар" шүүлтүүрийг
      // тухайн хуваарийн сар руу шилжүүлнэ — эс бол өөр сарын хуваарь
      // "Одоогийн хуваарь" хүснэгтэд ХАРАГДАХГҮЙ (гэвч DB-д хадгалагдсан хэвээр).
      const targetMonth = monthOf(scheduleForm.shiftDate);
      const monthChanged = Boolean(targetMonth) && targetMonth !== scheduleMonth;
      if (monthChanged) setScheduleMonth(targetMonth);
      await fetchOperatorSchedulesAll(targetMonth ? { month: targetMonth } : undefined);
      setScheduleForm((p: any) => ({ ...p, endDate: '' }));
      const baseMsg = monthChanged
        ? `Операторын хуваарь хадгалагдлаа. Хүснэгт ${targetMonth} сар руу шилжлээ.`
        : 'Операторын хуваарь хадгалагдлаа.';
      toast.success(scheduleSaveMessage(created, skipped, baseMsg));
    } catch (e: any) {
      toast.error('Хуваарь хадгалахад алдаа:\n\n' + (e?.message || ''));
    } finally {
      setAssigningShift(false);
    }
  };

  const createMasterSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (assigningShift) return;
    if (scheduleForm.shiftTypes.length === 0) {
      toast.error('Дор хаяж нэг ээлж (Өдрийн эсвэл Шөнийн) сонгоно уу.');
      return;
    }
    setAssigningShift(true);
    try {
      const m = localUsers.find((u: any) => u.id === scheduleForm.assigneeUid);
      const { created, skipped } = await submitScheduleForShiftTypes('/api/schedules', (shiftType) => ({
        shiftDate: scheduleForm.shiftDate,
        endDate: scheduleForm.endDate || '',
        shiftType,
        stationCode: scheduleForm.stationCode,
        masterUid: scheduleForm.assigneeUid,
        masterName: m?.name || m?.email || null,
      }));
      // Тайлбарыг createOperatorSchedule-ийн адилаас үз — сар шүүлтүүрийг зэрэгцүүлнэ.
      const targetMonth = monthOf(scheduleForm.shiftDate);
      const monthChanged = Boolean(targetMonth) && targetMonth !== scheduleMonth;
      if (monthChanged) setScheduleMonth(targetMonth);
      await fetchMasterSchedulesAll(targetMonth ? { month: targetMonth } : undefined);
      setScheduleForm((p: any) => ({ ...p, endDate: '' }));
      const baseMsg = monthChanged
        ? `Ээлжийн мастерын хуваарь хадгалагдлаа. Хүснэгт ${targetMonth} сар руу шилжлээ.`
        : 'Ээлжийн мастерын хуваарь хадгалагдлаа.';
      toast.success(scheduleSaveMessage(created, skipped, baseMsg));
    } catch (e: any) {
      toast.error('Хуваарь хадгалахад алдаа:\n\n' + (e?.message || ''));
    } finally {
      setAssigningShift(false);
    }
  };

  const deleteMasterSchedule = async (id: string, opts?: { skipConfirm?: boolean }) => {
    if (!opts?.skipConfirm) {
      const ok = await confirmAsync({
        title: 'Устгах уу?',
        message: 'Ээлжийн мастерын хуваарь устгах уу?',
        confirmText: 'Устгах',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      const r = await fetch(`/api/schedules?id=${id}`, { method: 'DELETE', credentials: 'include' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'Үйлдэл амжилтгүй боллоо');
      await fetchMasterSchedulesAll();
      toast.success('Хуваарь устлаа.');
    } catch (e: any) {
      toast.error('Устгахад алдаа:\n\n' + (e?.message || ''));
    }
  };

  const updateOperatorSchedule = async (payload: any) => {
    const r = await fetch('/api/operator-schedules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) throw new Error(j?.error || 'Үйлдэл амжилтгүй боллоо');
    if (j.schedule) {
      setOpSchedulesAll((rows: any[]) => rows.map((row: any) => (String(row.id) === String(j.schedule.id) ? j.schedule : row)));
    }
    return j.schedule;
  };

  const updateMasterSchedule = async (payload: any) => {
    const r = await fetch('/api/schedules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) throw new Error(j?.error || 'Үйлдэл амжилтгүй боллоо');
  };

  const deleteOperatorSchedule = async (id: string, opts?: { skipConfirm?: boolean }) => {
    if (!opts?.skipConfirm) {
      const ok = await confirmAsync({
        title: 'Устгах уу?',
        message: 'Операторын хуваарь устгах уу?',
        confirmText: 'Устгах',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      const r = await fetch(`/api/operator-schedules?id=${id}`, { method: 'DELETE', credentials: 'include' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'Үйлдэл амжилтгүй боллоо');
      await fetchOperatorSchedulesAll();
      toast.success('Хуваарь устлаа.');
    } catch (e: any) {
      toast.error('Устгахад алдаа:\n\n' + (e?.message || ''));
    }
  };

  const handleDeleteScheduleClick = async (schedule: any) => {
    const isOperatorSchedule = scheduleView === 'operator';
    const ok = await confirmAsync({
      title: 'Устгах уу?',
      message: `${isOperatorSchedule ? 'Операторын' : 'Ээлжийн мастерын'} хуваарийг устгах уу?\n\n${schedule.shiftDate || ''} ${schedule.shiftType || ''} ${schedule.stationCode || ''}`.trim(),
      confirmText: 'Устгах',
      danger: true,
    });
    if (!ok) return;
    if (isOperatorSchedule) {
      await deleteOperatorSchedule(schedule.id, { skipConfirm: true });
    } else {
      await deleteMasterSchedule(schedule.id, { skipConfirm: true });
    }
  };

  const saveEditingSchedule = async () => {
    if (!editingSchedule) return;
    try {
      if (String((editingSchedule as any)?.__kind || 'operator') === 'master') {
        await updateMasterSchedule({
          id: editingSchedule.id,
          shiftDate: editingSchedule.shiftDate,
          shiftType: editingSchedule.shiftType,
          stationCode: editingSchedule.stationCode,
          masterUid: (editingSchedule as any).masterUid,
          masterName: (editingSchedule as any).masterName,
        });
        await fetchMasterSchedulesAll();
      } else {
        await updateOperatorSchedule({
          id: editingSchedule.id,
          shiftDate: editingSchedule.shiftDate,
          shiftType: editingSchedule.shiftType,
          stationCode: editingSchedule.stationCode,
          operatorUid: (editingSchedule as any).operatorUid,
          operatorName: (editingSchedule as any).operatorName,
        });
        await fetchOperatorSchedulesAll();
      }
      setEditingSchedule(null);
      toast.success('Хадгаллаа.');
    } catch (e: any) {
      toast.error('Хадгалахад алдаа:\n\n' + (e?.message || ''));
    }
  };

  const [auditOnlyRoleChanges, setAuditOnlyRoleChanges] = useState(false);
  const [auditAdminRows, setAuditAdminRows] = useState<any[]>([]);
  const [auditFilterSince, setAuditFilterSince] = useState('');
  const [auditFilterUntil, setAuditFilterUntil] = useState('');
  const [auditFilterAction, setAuditFilterAction] = useState('');
  const [auditFilterEntityType, setAuditFilterEntityType] = useState('');
  const [auditFilterActorUid, setAuditFilterActorUid] = useState('');
  const [auditFilterLimit, setAuditFilterLimit] = useState(200);

  const fetchAuditAdmin = useCallback(async (opts?: { onlyRoleChanges?: boolean }) => {
    try {
      const onlyRoleChanges = opts?.onlyRoleChanges ?? auditOnlyRoleChanges;
      const qs = new URLSearchParams();
      const lim = Number.isFinite(auditFilterLimit) ? Math.min(Math.max(auditFilterLimit, 1), 500) : 200;
      qs.set('limit', String(lim));
      if (onlyRoleChanges) qs.set('onlyRoleChanges', 'true');
      if (!onlyRoleChanges && auditFilterAction) qs.set('action', auditFilterAction);
      if (!onlyRoleChanges && auditFilterEntityType) qs.set('entityType', auditFilterEntityType);
      if (!onlyRoleChanges && auditFilterActorUid) qs.set('actorUid', auditFilterActorUid);
      if (!onlyRoleChanges && auditFilterSince) {
        const d = new Date(`${auditFilterSince}T00:00:00+08:00`);
        if (Number.isFinite(d.getTime())) qs.set('since', d.toISOString());
      }
      if (!onlyRoleChanges && auditFilterUntil) {
        const d = new Date(`${auditFilterUntil}T23:59:59.999+08:00`);
        if (Number.isFinite(d.getTime())) qs.set('until', d.toISOString());
      }
      const r = await fetch(`/api/audit?${qs.toString()}`, { credentials: 'include' });
      const j = await r.json();
      if (j?.ok) setAuditAdminRows(j.logs || []);
    } catch (e) {
      console.error(e);
    }
  }, [auditOnlyRoleChanges, auditFilterLimit, auditFilterAction, auditFilterEntityType, auditFilterActorUid, auditFilterSince, auditFilterUntil]);

  useEffect(() => {
    if (activeTab !== 'admin') return;
    // Admin/Dispatcher manage full admin sections; HSE engineer only reaches the instruction centre.
    const isHse = profile?.role === 'hse_engineer';
    const isMaster = profile?.role === 'master';
    // Dispatcher: read-only "Ээлжийн хуваарь" + бүрэн эрхтэй "Зарлалын удирдлага".
    const isDispatcherSchedules = profile?.role === 'dispatcher' && adminSection === 'schedules';
    if (
      !isScheduleAdmin &&
      !isMaster &&
      !isDispatcherSchedules &&
      !(isHse && adminSection === 'instructions')
    ) return;

    if (isScheduleAdmin) {
      fetchSettings();
      fetchOperatorSchedulesAll();
      fetchMasterSchedulesAll();
      if (adminSection === 'audit') fetchAuditAdmin();
    }
    if (isDispatcherSchedules) {
      fetchOperatorSchedulesAll();
      fetchMasterSchedulesAll();
    }
  }, [activeTab, isScheduleAdmin, adminSection, fetchSettings, fetchOperatorSchedulesAll, fetchMasterSchedulesAll, fetchAuditAdmin, profile?.role]);

  const fetchUsers = useCallback(async () => {
    const isMaster = profile?.role === 'master';
    const isDispatcherSchedules = profile?.role === 'dispatcher' && adminSection === 'schedules';
    const shouldFetch =
      (activeTab === 'admin' && (isScheduleAdmin || isMaster || isDispatcherSchedules)) ||
      activeTab === 'all-entries' ||
      activeTab === 'overview';
    if (shouldFetch) {
      try {
        // Admins use /api/users for management; others use /api/user-directory for filtering/lookup
        const endpoint = isScheduleAdmin ? '/api/users' : '/api/user-directory';
        const res = await fetch(endpoint, { credentials: 'include' });
        const data = await res.json();
        if (data.ok) setLocalUsers(data.users);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    }
  }, [activeTab, isScheduleAdmin, adminSection, profile?.role]);

  const fetchControlStructure = useCallback(async () => {
    const inUserSection = activeTab === 'admin' && adminSection === 'users' && profile?.role === 'admin';
    const inScheduleSection = activeTab === 'admin' && adminSection === 'schedules' && (profile?.role === 'admin' || profile?.role === 'dispatcher');
    const inDispatcherHome = activeTab === 'dashboard' && profile?.role === 'dispatcher';
    if (!inUserSection && !inScheduleSection && !inDispatcherHome) return;
    setControlLoading(true);
    try {
      const res = await fetch('/api/stations', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Үйлдэл амжилтгүй боллоо');
      setControlStructure(data);
    } catch (error: any) {
      console.error('Error fetching stations:', error);
    } finally {
      setControlLoading(false);
    }
  }, [activeTab, adminSection, profile?.role]);

  useEffect(() => {
    fetchUsers();
    const isMaster = profile?.role === 'master';
    const isDispatcherSchedules = profile?.role === 'dispatcher' && adminSection === 'schedules';
    if (activeTab === 'admin' && (isScheduleAdmin || isMaster || isDispatcherSchedules)) {
      fetchOperatorSchedulesAll();
      fetchMasterSchedulesAll();
    }
    // Also fetch control structure when in schedules section (for master-assignment mapping)
    if (activeTab === 'admin' && adminSection === 'schedules') {
      fetchControlStructure();
    }
  }, [activeTab, adminSection, isScheduleAdmin, profile?.role, fetchUsers, fetchOperatorSchedulesAll, fetchMasterSchedulesAll, fetchControlStructure]);

  useEffect(() => {
    fetchControlStructure();
  }, [fetchControlStructure]);

  const handleApproveUser = async (userId: string, currentRole: string) => {
    if (!profile || profile.role !== 'admin') return;
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: userId,
          isApproved: true,
          role: currentRole
        }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success('Хэрэглэгч амжилттай баталгаажлаа.');
        fetchUsers();
      } else {
        toast.error('Алдаа гарлаа:\n\n' + data.error);
      }
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error('Зөвшөөрөхөд алдаа гарлаа.');
    }
  };

  /** «Баталгаажуулах хүлээгдэж буй» хэрэглэгчийн бүртгэлийн хүсэлтийг татгалзаж акаунтыг устгана. Аудитыг сервер бичнэ. */
  const handleRejectUser = async (userId: string, userEmail: string) => {
    if (!profile || profile.role !== 'admin') return;
    const ok = await confirmAsync({
      title: 'Бүртгэлийн хүсэлтийг татгалзах уу?',
      message: `${userEmail || 'Энэ хэрэглэгчийн'} бүртгэлийн хүсэлтийг татгалзаж, бүртгэлийг устгана. Тухайн хүн хүсвэл дахин бүртгүүлж болно.`,
      confirmText: 'Татгалзах',
      danger: true,
    });
    if (!ok) return;

    let failure = 'Хүсэлтийг татгалзахад алдаа гарлаа.';
    try {
      const res = await fetch('/api/users/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: userId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        // 404/409 — өөр админ аль хэдийн боловсруулсан: хуучирсан жагсаалтыг шинэчилнэ.
        if (res.status === 404 || res.status === 409) await fetchUsers();
        failure = data?.error || failure;
        throw new Error(failure);
      }
      await fetchUsers();
      toast.success('Бүртгэлийн хүсэлтийг татгалзлаа.');
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast.error(failure);
    }
  };

  const handleAssignShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !isScheduleAdmin) return;
    if (!assignDate || !assignShiftType || !assignStation || !assignOperatorUid) {
      toast.warning('Бүх талбарыг бөглөнө үү.');
      return;
    }

    setAssigningShift(true);
    try {
      const selectedOperator = localUsers.find(u => u.id === assignOperatorUid);

      const res = await fetch('/api/operator-schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          shiftDate: assignDate,
          shiftType: assignShiftType,
          stationCode: assignStation,
          operatorUid: assignOperatorUid,
          operatorName: selectedOperator?.name || selectedOperator?.email || null,
        }),
      });
      const resJson = await res.json();
      if (!res.ok || !resJson.ok) throw new Error(resJson.error || 'Failed to assign');

      await fetchOperatorSchedulesAll();

      // Notification is created server-side by /api/operator-schedules (deduped).

      // Audit Log
      await appendAuditLog({
        actorUid: profile.uid,
        actorName: profile.displayName,
        action: 'shift_assigned',
        entityType: 'operator_schedule',
        entityId: resJson.id || assignOperatorUid,
        details: `Assigned ${selectedOperator?.email} to ${assignStation} on ${assignDate} (${assignShiftType})`,
      });

      toast.success('Ээлж амжилттай оноогдлоо.');
      setAssignStation('');
      setAssignOperatorUid('');
    } catch (error) {
      console.error('Error assigning shift:', error);
      toast.error(`Ээлж онооход алдаа гарлаа.\n\n${error instanceof Error ? error.message : ''}`);
    } finally {
      setAssigningShift(false);
    }
  };

  const handleCreateOperators = async () => {
    if (!profile || profile.role !== 'admin') return;
    setCreatingOperators(true);
    try {
      for (const station of controlStations) {
        if (station.isMasterStation) continue;

        const dummyEmail = `operator.${station.code.toLowerCase().replace('үя-', '')}@euroblock.mn`;

        const createRes = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: dummyEmail,
            displayName: `${station.name} (Оператор)`,
            role: 'operator',
            stationCode: station.code,
            isApproved: true
          }),
        });
        const created = await createRes.json().catch(() => null);
        const createdId = created?.user?.id || dummyEmail;

        await appendAuditLog({
          actorUid: profile.uid,
          actorName: profile.displayName,
          action: 'user_created',
          entityType: 'user',
          entityId: createdId,
          details: `Created operator for station ${station.code}`,
        });
      }
      toast.success('15 станцын операторуудыг амжилттай үүсгэлээ.');
    } catch (error) {
      console.error('Error creating operators:', error);
      toast.error('Оператор үүсгэхэд алдаа гарлаа.');
    } finally {
      setCreatingOperators(false);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!profile || profile.role !== 'admin') return;
    if (String(profile?.uid || '') === String(userId)) {
      toast.warning('Өөрийн хэрэглэгчийг устгах боломжгүй.');
      return;
    }
    const ok = await confirmAsync({
      title: 'Устгах уу?',
      message: `${userEmail} хэрэглэгчийг устгахдаа итгэлтэй байна уу?`,
      confirmText: 'Устгах',
      danger: true,
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/users?id=${userId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('API Error');
      await appendAuditLog({
        actorUid: profile.uid,
        actorName: profile.displayName,
        action: 'user_deleted',
        entityType: 'user',
        entityId: userId,
        details: `Deleted user ${userEmail}`
      });
      await fetchUsers();
      toast.success('Хэрэглэгч амжилттай устгагдлаа.');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Хэрэглэгч устгахад алдаа гарлаа.');
    }
  };

  /** Багийн бүрэлдэхүүнийг олноор оноох. `null` = багаас хасах. */
  const assignShiftGroupMembers = async (userIds: string[], shiftGroup: string | null) => {
    if (userIds.length === 0) return;
    setCrewSaving(true);
    try {
      const res = await fetch('/api/users/shift-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userIds, shiftGroup }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Үйлдэл амжилтгүй боллоо');
      await Promise.all([fetchUsers(), fetchControlStructure()]);
      const label = shiftGroup ? `${shiftGroup}-р ээлж` : 'багаас хасагдлаа';
      toast.success(`${data.updated} хэрэглэгч ${label}.`);
    } catch (error: any) {
      toast.error('Багийн бүрэлдэхүүн засахад алдаа:\n\n' + (error?.message || ''));
    } finally {
      setCrewSaving(false);
    }
  };

  /** Багийн бүх гишүүнд нэг дор хуваарь оноох. */
  const createShiftGroupSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setCrewSaving(true);
    try {
      const res = await fetch('/api/schedules/bulk-crew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(crewForm),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Үйлдэл амжилтгүй боллоо');

      // Огнооны мужийн ЭХЛЭХ сар руу "Сар" шүүлтүүрийг шилжүүлнэ — эс бол шинээр
      // оноосон багийн хуваарь (ялангуяа маргааш өөр сар руу орох үед) "Одоогийн
      // хуваарь" хүснэгтэд ХАРАГДАХГҮЙ, гэвч DB-д зөв хадгалагдсан хэвээр байна.
      const targetMonth = monthOf(crewForm.startDate);
      const monthChanged = Boolean(targetMonth) && targetMonth !== scheduleMonth;
      if (monthChanged) setScheduleMonth(targetMonth);
      const fetchOpts = targetMonth ? { month: targetMonth } : undefined;
      await Promise.all([fetchOperatorSchedulesAll(fetchOpts), fetchMasterSchedulesAll(fetchOpts)]);

      if (data.created === 0) {
        toast.success(data.message || 'Шинээр оноох хуваарь олдсонгүй.');
      } else {
        const parts = [`${data.created} хуваарь оноогдлоо`];
        if (data.duplicates > 0) parts.push(`${data.duplicates} давхардсан`);
        if (Array.isArray(data.skipped) && data.skipped.length > 0) {
          parts.push(`${data.skipped.length} хүн алгасагдсан (дамжлагагүй)`);
        }
        if (monthChanged) parts.push(`хүснэгт ${targetMonth} сар руу шилжлээ`);
        toast.success(parts.join(' · '));
      }
    } catch (error: any) {
      toast.error('Багаар оноход алдаа:\n\n' + (error?.message || ''));
    } finally {
      setCrewSaving(false);
    }
  };

  const editableScheduleStationOptions = (scheduleRow: any) => {
    const isMasterSchedule = String(scheduleRow?.__kind || 'operator') === 'master';
    const options = controlStations
      .filter((s: any) => Boolean(s?.isMasterStation) === isMasterSchedule)
      .map((s: any) => ({ code: String(s.code || ''), name: String(s.name || s.code || '') }))
      .filter((s: { code: string }) => s.code);

    // Одоогийн станц жагсаалтад байхгүй бол (жишээ нь идэвхгүй болсон) нэмж харуулна.
    const currentCode = String(scheduleRow?.stationCode || '').trim();
    if (currentCode && !options.some((o: { code: string }) => o.code === currentCode)) {
      const st = stations.find((s: any) => String(s.code || '') === currentCode);
      options.unshift({ code: currentCode, name: st?.name || currentCode });
    }
    return options;
  };

  return {
    isScheduleAdmin,
    creatingOperators,
    assigningShift,
    editingUser,
    setEditingUser,
    assignDate,
    setAssignDate,
    assignShiftType,
    setAssignShiftType,
    assignStation,
    setAssignStation,
    assignOperatorUid,
    setAssignOperatorUid,
    localUsers,
    fetchUsers,
    controlStructure,
    controlLoading,
    crewSaving,
    crewForm,
    setCrewForm,
    assignShiftGroupMembers,
    createShiftGroupSchedule,
    systemSettings,
    setSystemSettings,
    settingsLoading,
    saveSettings,
    fetchSettings,
    opSchedulesAll,
    masterSchedulesAll,
    scheduleView,
    setScheduleView,
    scheduleMonth,
    setScheduleMonth,
    scheduleCalendarView,
    setScheduleCalendarView,
    scheduleWeekAnchor,
    setScheduleWeekAnchor,
    scheduleFilterShiftType,
    setScheduleFilterShiftType,
    scheduleFilterStationCode,
    setScheduleFilterStationCode,
    scheduleFilterAssigneeUid,
    setScheduleFilterAssigneeUid,
    stationsByScheduleView,
    scheduleForm,
    setScheduleForm,
    editingSchedule,
    setEditingSchedule,
    auditOnlyRoleChanges,
    setAuditOnlyRoleChanges,
    auditAdminRows,
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
    fetchAuditAdmin,
    fetchOperatorSchedulesAll,
    fetchMasterSchedulesAll,
    createOperatorSchedule,
    createMasterSchedule,
    handleDeleteScheduleClick,
    saveEditingSchedule,
    editableScheduleStationOptions,
    handleApproveUser,
    handleRejectUser,
    handleAssignShift,
    handleCreateOperators,
    handleDeleteUser,
  };
}
