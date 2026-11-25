import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isMasterStationCode } from '@/lib/master-stations';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { appendAuditLog } from '@/lib/audit-log';
import { createNotification } from '@/lib/notifications';
import { UserEditModal } from './UserEditModal';
import { ConfirmDialog } from './ConfirmDialog';
import { InstructionCenter } from './InstructionCenter';
import { AnnouncementCenter } from './AnnouncementCenter';
import { MaintenanceTab } from './tabs/MaintenanceTab';
import { PeriodicControlTab } from './tabs/PeriodicControlTab';
import { HseApprovalTab } from './tabs/HseApprovalTab';
import { AuditTab } from './tabs/AuditTab';
import { NotificationsTab } from './tabs/NotificationsTab';
import { KpiTab } from './tabs/KpiTab';
import { AllEntriesTab } from './tabs/AllEntriesTab';
import { MyEntriesTab } from './tabs/MyEntriesTab';
import { MyScheduleTab } from './tabs/MyScheduleTab';
import { MyShiftsTab } from './tabs/MyShiftsTab';
import { AdminTab } from './tabs/AdminTab';
import { HseTab } from './tabs/HseTab';
import { HandoverApprovalTab } from './tabs/HandoverApprovalTab';
import { DashboardHomeTab } from './tabs/DashboardHomeTab';
import { OverviewTab } from './tabs/OverviewTab';
import { useDashboardAdmin } from './hooks/useDashboardAdmin';
import {
  getPeriodicLogStatus,
  getShiftCompleteness,
  buildCompletenessInputFromShiftApi,
  stationUsesPeriodicLogs,
} from '@/lib/shift-completeness';
import { isoDateInTimeZone, minutesOfDayInTimeZone, isMinuteInHmWindow, resolveHandoverWindow } from '@/lib/handover-window';
import { hseDocOpenUrl } from '@/lib/hse-doc-open-url';
import { useToast } from '@/components/ui/ToastProvider';
import { countDistinctAttentionByCategory, countDistinctAttentionShifts } from '@/lib/dashboard-attention';
import { pendingApprovalCounts } from '@/lib/approval-history-query';
import {
  MN_WEEKDAYS,
  addDaysIso,
  addMonthsIso,
  auditActionTone,
  compactDayTitle,
  compareScheduleRows,
  dateFromIso,
  datesBetween,
  dayTitle,
  formatAuditWhen,
  handoverStageDisplay,
  isWeekendIso,
  mnAction,
  mnDateLabel,
  mnDateTimeCompact,
  mnDetails,
  mnEntityType,
  monthGridRange,
  monthTitle,
  startOfWeekIso,
  endOfWeekIso,
} from './dashboard-helpers';

async function shiftDetailFetcher(url: string) {
  const res = await fetch(url, { cache: 'no-store', credentials: 'include' });
  const json = await res.json();
  if (!res.ok || json.ok === false) throw new Error(json.error || 'Fetch error');
  return json;
}

function stationSelectLabel(station: { code: string; name: string }) {
  if (station.code === 'ҮЯ-320') return `${station.code}: ${station.name}`;
  return `${station.code} - ${station.name}`;
}

interface DashboardContentProps {
  profile: any;
  todayIso: string;
  activeTab: string;
  adminSection: 'users' | 'schedules' | 'audit' | 'settings' | 'instructions' | 'announcements' | 'approvals';
  setActiveTab: (tab: any) => void;
  setAdminSection: (section: 'users' | 'schedules' | 'audit' | 'settings' | 'instructions' | 'announcements' | 'approvals') => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedShiftType: 'Өдрийн' | 'Шөнийн';
  setSelectedShiftType: (type: 'Өдрийн' | 'Шөнийн') => void;
  shifts: any[];
  activeShift: any;
  maintenanceRequests: any[];
  openMaintenanceCount: number;
  hseLogs: any[];
  /** Ээлж дээрх ХАБ checklist (`production_logs` modal_hse_checklist) — зөвхөн ХАБ инженерийн dashboard-оос ирнэ. */
  hseChecklistLogs?: any[];
  notifications: any[];
  handoverQueue: any[];
  handoverContextShifts?: any[];
  pendingShifts: any[];
  masterPendingAllShifts: any[];
  adminPendingShifts: any[];
  adminApprovedShifts: any[];
  adminPendingTotal?: number;
  adminApprovedTotal?: number;
  onAdminFinalApprove?: (shift: any) => Promise<void> | void;
  y310PendingApprovals?: any[];
  y310ApprovedLogs?: any[];
  y310PendingTotal?: number;
  y310ApprovedTotal?: number;
  notStartedOperator?: any[];
  notStartedMaster?: any[];
  onY310Approve?: (logId: string, action: 'approve' | 'reject') => Promise<void>;
  allShifts: any[];
  dispatcherCompliance?: any;
  dispatcherComplianceLoading?: boolean;
  dispatcherComplianceError?: unknown;
  /** Master Home: all active (in-progress) shifts across operators. */
  masterActiveShifts: any[];
  loading: boolean;
  masterLoading: boolean;
  kpiStats: any;
  /** Master/Reports: raw shifts for filtering */
  kpiShifts: any[];
  stations: any[];
  auditLogs: any[];
  auditLogCount?: number;
  mySchedules: any[];
  /** Operator dashboard: schedules without a matching started shift. */
  operatorMySchedules: any[];
  getStationStatus: (code: string) => any;
  setShowHseIncidentModal: (show: boolean) => void;
  setShowMaintCreateModal: (show: boolean) => void;
  setMaintDetail: (req: any) => void;
  handleApproveHseLog: (id: string, note?: string) => Promise<void> | void;
  handleSaveHseLogNote: (id: string, note: string) => Promise<void> | void;
  handleSaveHseChecklistNote: (id: string, note: string) => Promise<void> | void;
  onClearNotifications?: () => Promise<void> | void;
  onOpenNotification?: (notification: any) => Promise<void> | void;
}

export function DashboardContent({
  profile,
  todayIso,
  activeTab,
  adminSection,
  setActiveTab,
  setAdminSection,
  selectedDate,
  setSelectedDate,
  selectedShiftType,
  setSelectedShiftType,
  shifts,
  activeShift,
  maintenanceRequests,
  openMaintenanceCount,
  hseLogs,
  hseChecklistLogs = [],
  notifications,
  handoverQueue,
  handoverContextShifts = [],
  pendingShifts,
  masterPendingAllShifts,
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
  allShifts,
  dispatcherCompliance,
  dispatcherComplianceLoading = false,
  dispatcherComplianceError,
  masterActiveShifts,
  loading,
  masterLoading,
  kpiStats,
  kpiShifts,
  stations,
  auditLogs,
  auditLogCount,
  mySchedules,
  operatorMySchedules,
  getStationStatus,
  setShowHseIncidentModal,
  setShowMaintCreateModal,
  setMaintDetail,
  handleApproveHseLog,
  handleSaveHseLogNote,
  handleSaveHseChecklistNote,
  onClearNotifications,
  onOpenNotification,
}: DashboardContentProps) {
  const toast = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmText: string;
    danger?: boolean;
  }>({ open: false, title: '', message: '', confirmText: 'Тийм', danger: true });
  const confirmResolveRef = useRef<((v: boolean) => void) | null>(null);
  const confirmAsync = useCallback(
    (opts: { title: string; message: string; confirmText?: string; danger?: boolean }) => {
      return new Promise<boolean>((resolve) => {
        confirmResolveRef.current = resolve;
        setConfirmDialog({
          open: true,
          title: opts.title,
          message: opts.message,
          confirmText: opts.confirmText || 'Устгах',
          danger: opts.danger ?? true,
        });
      });
    },
    []
  );
  const [dispatcherStation, setDispatcherStation] = useState<string>('all');
  const [dispatcherOperatorQ, setDispatcherOperatorQ] = useState<string>('');
  const dispatcherMonth = useMemo(() => String(selectedDate || todayIso).slice(0, 7), [selectedDate, todayIso]);

  // Master: "Бүх операторын бүртгэл" filters
  const [allEntriesSince, setAllEntriesSince] = useState<string>('');
  const [allEntriesUntil, setAllEntriesUntil] = useState<string>('');
  const [allEntriesShiftType, setAllEntriesShiftType] = useState<'all' | 'Өдрийн' | 'Шөнийн'>('all');
  const [allEntriesStatus, setAllEntriesStatus] = useState<'all' | 'Ноорог' | 'Хадгалсан' | 'Баталгаажсан' | 'Цуцлагдсан'>('all');
  // PRD "Role-оор" гэдгийг дамжлагын role/job (station) гэж авч үзэв.
  const [allEntriesRole, setAllEntriesRole] = useState<string>('all'); // stationCode
  const [allEntriesEntryType, setAllEntriesEntryType] = useState<
    'all' | 'shift' | 'equipment' | 'production' | 'repair' | 'ingredient' | 'measurement'
  >('all');
  const [allEntriesQuery, setAllEntriesQuery] = useState<string>('');
  const [allEntriesMasterUid, setAllEntriesMasterUid] = useState<string>('all');

  type MasterEntryRow = {
    id: string;
    shiftId: string;
    operatorName: string;
    stationCode: string;
    stationName: string;
    shiftType: string;
    entryTypeKey: 'shift' | 'equipment' | 'production' | 'repair' | 'ingredient' | 'measurement';
    entryTypeLabel: string;
    equipmentText: string;
    timestampIso: string; // for display/filter
    statusLabel: string;
    masterUid: string;
    masterName: string;
    adminApproved?: boolean;
  };

  const masterAllEntries = useMemo((): MasterEntryRow[] => {
    if (!['master', 'dispatcher', 'chief_engineer'].includes(profile?.role || '')) return [];
    const shifts0 = Array.isArray(kpiShifts) ? kpiShifts : [];
    const rows: MasterEntryRow[] = [];
    const safeIso = (d: any) => {
      const dt = d instanceof Date ? d : new Date(String(d || ''));
      return Number.isFinite(dt.getTime()) ? dt.toISOString() : '';
    };
    const stationNameOf = (code: string, fallback?: string) => {
      const st = stations.find((s: any) => String(s.code || '') === String(code || ''));
      return (st?.name as string) || String(fallback || '') || String(code || '');
    };
    const push = (r: MasterEntryRow) => {
      if (!r.id) r.id = `${r.shiftId}:${r.entryTypeKey}:${Math.random().toString(36).slice(2)}`;
      rows.push(r);
    };

    for (const s of shifts0) {
      const shiftId = String(s.id || '');
      const stationCode = String(s.stationCode || '');
      const stationName = stationNameOf(stationCode, s.stationName);
      const operatorName = String(s.operatorName || '');
      const shiftType = String(s.shiftType || '');
      const shiftDate = String(s.shiftDate || '').slice(0, 10);
      const shiftTs = safeIso(s.createdAt || s.checkIn || `${shiftDate}T00:00:00.000Z`);
      const shiftStatus = String(s.status || '');

      // Determine master info for filtering
      // If it's a Y099 shift, the operator is the master.
      // Otherwise, we check who approved it or the assigned masterUid.
      const masterUid = stationCode === 'ҮЯ-099' ? String(s.operatorUid || '') : String(s.handoverAcceptedByUid || s.shiftMasterUid || '');
      const masterName = stationCode === 'ҮЯ-099' ? String(s.operatorName || '') : String(s.handoverAcceptedByName || '');

      // Shift-level entry
      push({
        id: `${shiftId}:shift`,
        shiftId,
        operatorName,
        stationCode,
        stationName,
        shiftType,
        entryTypeKey: 'shift',
        entryTypeLabel: 'Ээлжийн бүртгэл',
        equipmentText: '',
        timestampIso: shiftTs,
        statusLabel: shiftStatus || '—',
        masterUid,
        masterName,
        adminApproved: !!s.adminApproved,
      });

      // Equipment inspections (no createdAt in schema) -> use shift timestamp
      const insps = Array.isArray(s.equipmentInspections) ? s.equipmentInspections : [];
      for (const insp of insps) {
        const label = String(insp.itemLabel || insp.labelMn || insp.itemKey || '').trim();
        const comment = String(insp.comment || '').trim();
        const equipmentText = [label, comment].filter(Boolean).join(' — ');
        const st = String(insp.status || '').trim();
        push({
          id: `${shiftId}:equipment:${insp.id || insp.sortOrder || label}`,
          shiftId,
          operatorName,
          stationCode,
          stationName,
          shiftType,
          entryTypeKey: 'equipment',
          entryTypeLabel: 'Тоног төхөөрөмжийн шалгалт',
          equipmentText,
          timestampIso: shiftTs,
          statusLabel: st || shiftStatus || '—',
          masterUid,
          masterName,
        });
      }

      // Production logs (has createdAt)
      const prod = Array.isArray(s.productionLogs) ? s.productionLogs : [];
      for (const pl of prod) {
        const lt = String(pl.logType || '').trim();
        const typeLabel =
          lt === 'casting' ? 'Цутгалтын үзүүлэлт' :
            lt === 'cutting' ? 'Зүсэлтийн бүртгэл' :
              lt === 'product' ? 'Бүтээгдэхүүний бүртгэл' :
                lt === 'flow_metric' ? 'Урсгалын үзүүлэлт' :
                  lt === 'product_summary' ? 'Бүтээгдэхүүний дүн' :
                    lt === 'indicator' ? 'Үзүүлэлт' :
                      lt ? `Үйлдвэрлэлийн бүртгэл (${lt})` : 'Үйлдвэрлэлийн бүртгэл';
        push({
          id: `${shiftId}:production:${pl.id || pl.sortOrder || lt}`,
          shiftId,
          operatorName,
          stationCode,
          stationName,
          shiftType,
          entryTypeKey: 'production',
          entryTypeLabel: typeLabel,
          equipmentText: '',
          timestampIso: safeIso(pl.createdAt) || shiftTs,
          statusLabel: shiftStatus || '—',
          masterUid,
          masterName,
        });
      }

      // Repair entries (no createdAt) -> use shift timestamp
      const repairs = Array.isArray(s.repairEntries) ? s.repairEntries : [];
      for (const re of repairs) {
        const label = String(re.labelMn || re.itemLabel || re.itemKey || '').trim();
        const comment = String(re.comment || re.repairWorkDone || '').trim();
        const equipmentText = [label, comment].filter(Boolean).join(' — ');
        push({
          id: `${shiftId}:repair:${re.id || re.sortOrder || label}`,
          shiftId,
          operatorName,
          stationCode,
          stationName,
          shiftType,
          entryTypeKey: 'repair',
          entryTypeLabel: 'Засварын бүртгэл',
          equipmentText,
          timestampIso: shiftTs,
          statusLabel: shiftStatus || '—',
          masterUid,
          masterName,
        });
      }

      // Ingredient records (no createdAt) -> use shift timestamp
      const ing = Array.isArray(s.ingredientRecords) ? s.ingredientRecords : [];
      for (const ir of ing) {
        const label = String(ir.label || ir.itemKey || '').trim();
        const equipmentText = label;
        push({
          id: `${shiftId}:ingredient:${ir.id || ir.sortOrder || label}`,
          shiftId,
          operatorName,
          stationCode,
          stationName,
          shiftType,
          entryTypeKey: 'ingredient',
          entryTypeLabel: 'Орц найрлага өөрчилсөн бүртгэл',
          equipmentText,
          timestampIso: shiftTs,
          statusLabel: shiftStatus || '—',
          masterUid,
          masterName,
        });
      }

      // Measurement rows (no createdAt) -> use shift timestamp
      const meas = Array.isArray(s.measurementRows) ? s.measurementRows : [];
      if (meas.length > 0) {
        push({
          id: `${shiftId}:measurement`,
          shiftId,
          operatorName,
          stationCode,
          stationName,
          shiftType,
          entryTypeKey: 'measurement',
          entryTypeLabel: 'Хэмжилтийн бүртгэл',
          equipmentText: '',
          timestampIso: shiftTs,
          statusLabel: shiftStatus || '—',
          masterUid,
          masterName,
        });
      }
    }

    // Sort newest first by timestamp
    return rows.sort((a, b) => (b.timestampIso || '').localeCompare(a.timestampIso || ''));
  }, [profile?.role, kpiShifts, stations]);

  const masterAllEntriesFiltered = useMemo(() => {
    const q = String(allEntriesQuery || '').trim().toLowerCase();
    return masterAllEntries.filter((r) => {
      const d = String(r.timestampIso || '').slice(0, 10) || '';
      if (allEntriesSince && d && d < allEntriesSince) return false;
      if (allEntriesUntil && d && d > allEntriesUntil) return false;
      if (allEntriesShiftType !== 'all' && String(r.shiftType || '') !== allEntriesShiftType) return false;
      if (allEntriesStatus !== 'all' && String(r.statusLabel || '') !== allEntriesStatus) return false;
      if (allEntriesRole !== 'all' && String(r.stationCode || '') !== allEntriesRole) return false;
      if (allEntriesEntryType !== 'all' && r.entryTypeKey !== allEntriesEntryType) return false;
      if (allEntriesMasterUid !== 'all' && r.masterUid !== allEntriesMasterUid) return false;
      if (q) {
        const hay = [
          r.operatorName,
          r.stationName,
          r.stationCode,
          r.entryTypeLabel,
          r.equipmentText,
          r.masterName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    masterAllEntries,
    allEntriesSince,
    allEntriesUntil,
    allEntriesShiftType,
    allEntriesStatus,
    allEntriesRole,
    allEntriesEntryType,
    allEntriesMasterUid,
    allEntriesQuery,
  ]);

  // Master: "Ээлжийн хяналт" filters (overview tab)
  const [overviewStation, setOverviewStation] = useState<string>('all');
  const [overviewStatus, setOverviewStatus] = useState<string>('all');
  const [overviewOperator, setOverviewOperator] = useState<string>('all');
  const [overviewQuery, setOverviewQuery] = useState<string>('');

  const overviewOperatorOptions = useMemo(() => {
    const rows = Array.isArray(allShifts) ? allShifts : [];
    const map = new Map<string, string>();
    for (const s of rows) {
      const name = String(s?.operatorName || '').trim();
      const uid = String(s?.operatorUid || name || '').trim();
      if (name && uid && !map.has(uid)) map.set(uid, name);
    }
    return Array.from(map, ([uid, name]) => ({ uid, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allShifts]);

  const overviewRows = useMemo(() => {
    const rows = Array.isArray(allShifts) ? allShifts : [];
    const q = String(overviewQuery || '').trim().toLowerCase();
    return rows.filter((s: any) => {
      if (overviewStation !== 'all' && String(s.stationCode || '') !== overviewStation) return false;
      if (overviewStatus !== 'all' && String(s.status || '') !== overviewStatus) return false;
      if (overviewOperator !== 'all') {
        const uid = String(s.operatorUid || '').trim();
        const name = String(s.operatorName || '').trim();
        if (uid !== overviewOperator && name !== overviewOperator) return false;
      }
      if (q) {
        const hay = [s.operatorName, s.stationCode, s.stationName, s.status, s.shiftType].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allShifts, overviewStation, overviewStatus, overviewOperator, overviewQuery]);
  const isOperatorView = profile?.role === 'operator';
  const isMasterView = profile?.role === 'master';
  // Оператор ба мастер хоёулаа өөрсдийн хуваарийн календарийг («Миний хуваарь») харна —
  // эх сурвалж нь роль тус бүрт өөр (operator_schedules vs master_schedules).
  const isSelfShiftView = isOperatorView || isMasterView;
  const {
    isScheduleAdmin,
    editingUser,
    setEditingUser,
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
    assigningShift,
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
    handleDeleteUser,
  } = useDashboardAdmin({
    profile,
    activeTab,
    adminSection,
    stations,
    toast,
    confirmAsync,
  });
  const dispatcherStations = useMemo(
    () =>
      (Array.isArray(controlStructure?.stations) ? controlStructure.stations : [])
        .filter((station: any) => station?.isActive !== false)
        .map((station: any) => ({
          code: String(station?.code || '').trim(),
          name: String(station?.name || '').trim(),
          isMasterStation: Boolean(station?.isMasterStation),
          isActive: station?.isActive !== false,
        }))
        .filter((station: any) => station.code),
    [controlStructure?.stations]
  );
  const [operatorScheduleView, setOperatorScheduleView] = useState<'month' | 'week'>('month');
  const [operatorScheduleAnchor, setOperatorScheduleAnchor] = useState(() => isoDateInTimeZone());
  const [operatorScheduleShiftType, setOperatorScheduleShiftType] = useState('');
  const [operatorScheduleStationCode, setOperatorScheduleStationCode] = useState('');

  const { data: operatorShiftDetailData, isLoading: operatorShiftDetailLoading } = useSWR(
    isOperatorView && (activeTab === 'dashboard' || activeTab === 'my-entries') && activeShift?.id ? `/api/shifts/${activeShift.id}` : null,
    shiftDetailFetcher,
    { refreshInterval: 15000 }
  );

  const activeShiftCompleteness = useMemo(() => {
    if (!isOperatorView || !operatorShiftDetailData?.ok || !operatorShiftDetailData.shift) {
      return { ok: true as const, missing: [] as string[] };
    }
    const raw = parseFloat(String(systemSettings.periodic_interval_hours ?? '2'));
    const periodicIntervalHours = Number.isFinite(raw) && raw > 0 ? raw : 2;
    const input = buildCompletenessInputFromShiftApi(operatorShiftDetailData.shift, periodicIntervalHours);
    return getShiftCompleteness(input);
  }, [isOperatorView, operatorShiftDetailData, systemSettings.periodic_interval_hours]);

  const periodicIntervalHours = useMemo(() => {
    const raw = parseFloat(String(systemSettings.periodic_interval_hours ?? '2'));
    return Number.isFinite(raw) && raw > 0 ? raw : 2;
  }, [systemSettings.periodic_interval_hours]);

  const masterHome = useMemo(() => {
    const dayWindow = resolveHandoverWindow('Өдрийн', systemSettings);
    const nightWindow = resolveHandoverWindow('Шөнийн', systemSettings);
    if (!['master', 'dispatcher', 'chief_engineer', 'admin'].includes(profile?.role || '')) {
      return { active: [], missing: [], nowInHandoverWindow: false, dayWindow, nightWindow };
    }
    const nowM = minutesOfDayInTimeZone();
    const nowInHandoverWindow =
      isMinuteInHmWindow(nowM, dayWindow.start, dayWindow.end) ||
      isMinuteInHmWindow(nowM, nightWindow.start, nightWindow.end);

    const active = Array.isArray(masterActiveShifts) ? masterActiveShifts : [];

    const missing = active
      .map((shift: any) => {
        const input = buildCompletenessInputFromShiftApi(shift, periodicIntervalHours);
        const comp = getShiftCompleteness(input);
        return { shift, missing: comp.missing };
      })
      .filter((x) => x.missing.length > 0);

    return { active, missing, nowInHandoverWindow, dayWindow, nightWindow };
  }, [profile?.role, masterActiveShifts, periodicIntervalHours, systemSettings.day_handover_start, systemSettings.day_handover_end, systemSettings.night_handover_start, systemSettings.night_handover_end]);

  const approvedSlotParams = new URLSearchParams({
    queryType: 'admin_approved', since: selectedDate, until: selectedDate,
    shiftType: selectedShiftType, pageSize: '1',
  });
  const { data: approvedSlotData } = useSWR(
    ['admin', 'chief_engineer'].includes(profile?.role || '')
      ? `/api/shifts?${approvedSlotParams}` : null,
    shiftDetailFetcher, { refreshInterval: 15000 }
  );

  // 7 хоногийн графикийг серверт бүтэн тоолно — `kpiShifts` нь 400-аар хязгаарлагдсан тул
  // өдөрт олон ээлж орох үед дутуу гардаг байсан.
  const { data: adminTrendData } = useSWR(
    profile?.role === 'admin'
      ? `/api/shifts?queryType=kpi_trend&until=${encodeURIComponent(selectedDate || isoDateInTimeZone())}` : null,
    shiftDetailFetcher, { refreshInterval: 15000 }
  );

  const adminHome = useMemo(() => {
    const anchorDate = selectedDate || isoDateInTimeZone();
    const serverTrend = new Map<string, any>(
      (Array.isArray(adminTrendData?.trend) ? adminTrendData.trend : []).map((row: any) => [row.date, row])
    );
    const trend = datesBetween(addDaysIso(anchorDate, -6), anchorDate).map((date) => ({
      date,
      label: dayTitle(date),
      total: Number(serverTrend.get(date)?.total || 0),
      approved: Number(serverTrend.get(date)?.approved || 0),
      pending: Number(serverTrend.get(date)?.pending || 0),
    }));

    // Ерөнхий төлөв-ийн тоонууд толгой хэсгийн Огноо/Ээлж сонголтод яг тохирсон
    // shift-үүдийг л тоолно (Мастер баталгаажуулах-ын адил горим — sameSlot).
    const sameSlot = (s: any) => s?.shiftDate === selectedDate && s?.shiftType === selectedShiftType;

    const activeCount = (Array.isArray(masterActiveShifts) ? masterActiveShifts : []).filter(sameSlot).length;
    const pendingCount = Array.isArray(pendingShifts) ? pendingShifts.length : 0;
    // «Админ баталгаажуулах» нь Давхар баталгаажуулалтын «Оператор» + «Мастер» badge-тэй ИЖИЛ
    // эх сурвалжаас (бүх огноо). Өмнө нь зөвхөн сонгосон slot-ийн операторын ээлжийг тоолж,
    // «Нээх →» дарахад тэнд огт өөр тоо харагддаг байв.
    // Оператор = оператор станцын ээлж; Мастер = мастер станцын ээлж + мастерын маягт
    // (хуваалт нь Давхар баталгаажуулалтын табтай ижил — `pendingApprovalCounts`).
    const adminPendingShiftTotal =
      typeof adminPendingTotal === 'number' ? adminPendingTotal : (Array.isArray(adminPendingShifts) ? adminPendingShifts.length : 0);
    const adminPendingFormTotal = typeof y310PendingTotal === 'number' ? y310PendingTotal : 0;
    const { operator: adminPendingOperatorCount, master: adminPendingMasterCount } = pendingApprovalCounts({
      shifts: Array.isArray(adminPendingShifts) ? adminPendingShifts : [],
      shiftTotal: adminPendingShiftTotal,
      formTotal: adminPendingFormTotal,
    });
    const adminPendingCount = adminPendingOperatorCount + adminPendingMasterCount;
    const adminApprovedCount = approvedSlotData?.total ?? 0;
    const slotHandovers = (Array.isArray(handoverQueue) ? handoverQueue : []).filter(sameSlot);
    const slotMissing = (Array.isArray(masterHome.missing) ? masterHome.missing : []).filter((x: any) => sameSlot(x?.shift));
    const handoverCount = slotHandovers.length;
    const missingCount = slotMissing.length;
    const auditCount = Number.isFinite(Number(auditLogCount))
      ? Number(auditLogCount)
      : Array.isArray(auditLogs)
        ? auditLogs.length
        : 0;
    const recentTotal = trend.reduce((sum, row) => sum + row.total, 0);
    const recentApproved = trend.reduce((sum, row) => sum + row.approved, 0);
    const recentPending = trend.reduce((sum, row) => sum + row.pending, 0);
    const unreadNotifications = (Array.isArray(notifications) ? notifications : []).filter((n: any) => !n?.read).length;
    const openMaintenance = openMaintenanceCount;

    // Give each shift to its first visible action row so the breakdown adds up
    // while preserving the one-shift-one-count rule.
    const [assignedAdmin, assignedMissing, assignedMaster, assignedHandover] = countDistinctAttentionByCategory([
      [...adminPendingShifts, ...(y310PendingApprovals ?? [])],
      slotMissing,
      pendingShifts,
      slotHandovers,
    ]);
    const unloadedOperatorApprovals = Math.max(0, adminPendingShiftTotal - adminPendingShifts.length);
    const unloadedMasterApprovals = Math.max(0, adminPendingFormTotal - (y310PendingApprovals?.length ?? 0));
    const attentionBreakdown = {
      admin: assignedAdmin + unloadedOperatorApprovals + unloadedMasterApprovals,
      missing: assignedMissing,
      master: assignedMaster,
      handover: assignedHandover,
      maintenance: openMaintenance,
    };
    const attentionCount = Object.values(attentionBreakdown).reduce((sum, count) => sum + count, 0);

    // Хуучин: 6 мөр 1 нийтлэг масштабтай — "Идэвхтэй ээлж"(9) ба "Мастер баталгаажуулах"(1)
    // зэрэг өөр агуулгатай тоог зэрэгцүүлэн харьцуулах нь төөрөгдүүлдэг байсан. Одоо
    // "Шаардлагатай арга хэмжээ" (хүлээгдэж буй/дутуу зүйлс) ба "Ерөнхий тойм" (идэвхтэй/
    // баталгаажсан төлөв) гэж 2 бүлэгт хувааж, бүлэг тус бүрдээ өөрийн масштаб (%) тооцно.
    const compareGroups = [
      {
        key: 'action' as const,
        label: 'Шаардлагатай арга хэмжээ',
        color: 'bg-amber-500',
        rows: [
          { label: 'Хүлээлцэх хүсэлт', value: attentionBreakdown.handover },
          { label: 'Дутуу бүртгэл', value: attentionBreakdown.missing },
          { label: 'Админ баталгаажуулах', value: attentionBreakdown.admin },
          { label: 'Мастер баталгаажуулах', value: attentionBreakdown.master },
          { label: 'Нээлттэй засвар', value: attentionBreakdown.maintenance },
        ],
      },
      {
        key: 'overview' as const,
        label: 'Ерөнхий тойм',
        color: 'bg-emerald-500',
        rows: [
          { label: 'Баталгаажсан', value: adminApprovedCount },
          { label: 'Идэвхтэй ээлж', value: activeCount },
        ],
      },
    ].map((group) => ({
      ...group,
      max: Math.max(1, ...group.rows.map((row) => Number(row.value || 0))),
    }));

    const healthBase = recentTotal + attentionCount;
    const hasHealthData = healthBase > 0;
    const healthRate = hasHealthData ? Math.max(0, Math.round(((healthBase - attentionCount) / healthBase) * 100)) : 0;

    return {
      trend,
      trendMax: Math.max(1, ...trend.map((row) => Math.max(row.total, row.approved, row.pending))),
      compareGroups,
      activeCount,
      pendingCount,
      adminPendingCount,
      adminPendingOperatorCount,
      adminPendingMasterCount,
      adminApprovedCount,
      handoverCount,
      missingCount,
      auditCount,
      recentTotal,
      recentApproved,
      recentPending,
      attentionCount,
      attentionBreakdown,
      hasHealthData,
      unreadNotifications,
      openMaintenance,
      hseCount: (Array.isArray(hseLogs) ? hseLogs.length : 0) + (Array.isArray(hseChecklistLogs) ? hseChecklistLogs.length : 0),
      healthRate,
    };
  }, [
    adminTrendData?.trend,
    masterActiveShifts,
    pendingShifts,
    adminPendingShifts,
    adminPendingTotal,
    y310PendingApprovals,
    y310PendingTotal,
    approvedSlotData?.total,
    handoverQueue,
    masterHome.missing,
    selectedDate,
    selectedShiftType,
    auditLogs,
    auditLogCount,
    notifications,
    openMaintenanceCount,
    hseLogs,
    hseChecklistLogs,
  ]);

  const [masterChartSince, setMasterChartSince] = useState<string>('');
  const [masterChartUntil, setMasterChartUntil] = useState<string>('');
  const [masterChartShiftType, setMasterChartShiftType] = useState<string>('all');
  const [masterChartStation, setMasterChartStation] = useState<string>('all');

  const masterChartStationOptions = useMemo(() => {
    const sourceShifts =
      Array.isArray(kpiShifts) && kpiShifts.length > 0
        ? kpiShifts
        : Array.isArray(allShifts)
          ? allShifts
          : [];
    const set = new Set<string>();
    for (const row of sourceShifts) {
      const code = String(row?.stationCode || row?.station || '').trim();
      if (code) set.add(code);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allShifts, kpiShifts]);

  const masterDashboardChart = useMemo(() => {
    const today = todayIso;
    const defaultStartKey = addDaysIso(today, -6);
    const requestedStartKey = masterChartSince || (masterChartUntil ? addDaysIso(masterChartUntil, -6) : defaultStartKey);
    const requestedEndKey = masterChartUntil || (masterChartSince ? addDaysIso(masterChartSince, 6) : today);
    const rangeStart = requestedStartKey <= requestedEndKey ? requestedStartKey : requestedEndKey;
    const rangeEnd = requestedStartKey <= requestedEndKey ? requestedEndKey : requestedStartKey;
    const trend = datesBetween(rangeStart, rangeEnd).map((date) => ({
      date,
      label: compactDayTitle(date),
      total: 0,
      approved: 0,
      pending: 0,
    }));
    const trendByDate = new Map(trend.map((row) => [row.date, row]));
    const sourceShifts =
      Array.isArray(kpiShifts) && kpiShifts.length > 0
        ? kpiShifts
        : Array.isArray(allShifts)
          ? allShifts
          : [];

    for (const shift of sourceShifts) {
      const date = String(shift?.shiftDate || shift?.createdAt || '').slice(0, 10);
      if (date < rangeStart || date > rangeEnd) continue;
      const shiftTypeOk = masterChartShiftType === 'all' || String(shift?.shiftType || '') === masterChartShiftType;
      const stationOk = masterChartStation === 'all' || String(shift?.stationCode || shift?.station || '') === masterChartStation;
      if (!shiftTypeOk || !stationOk) continue;
      const row = trendByDate.get(date);
      if (!row) continue;
      row.total += 1;
      const status = String(shift?.status || '').toLowerCase();
      const approved =
        status.includes('баталгаажсан') ||
        status.includes('approved') ||
        Boolean(shift?.masterApproved) ||
        Boolean(shift?.adminApproved);
      if (approved) row.approved += 1;
      else row.pending += 1;
    }

    const activeCount = Array.isArray(masterHome.active) ? masterHome.active.length : 0;
    const missingCount = Array.isArray(masterHome.missing) ? masterHome.missing.length : 0;
    // Мастерын Нүүр таб дээр Огноо/Ээлж picker байхгүй тул selectedDate-ээр шүүгдсэн pendingShifts
    // биш, бүх огноо/ээлжийн pending-г харуулах masterPendingAllShifts ашиглана.
    const pendingCount = Array.isArray(masterPendingAllShifts) ? masterPendingAllShifts.length : 0;
    const handoverCount = Array.isArray(handoverQueue) ? handoverQueue.length : 0;
    const recentTotal = trend.reduce((sum, row) => sum + row.total, 0);
    const recentApproved = trend.reduce((sum, row) => sum + row.approved, 0);
    const recentPending = trend.reduce((sum, row) => sum + row.pending, 0);
    const attentionCount = countDistinctAttentionShifts([
      masterHome.missing,
      masterPendingAllShifts,
      handoverQueue,
    ]);
    const hasTrendData = recentTotal > 0;
    const approvalPct = hasTrendData ? Math.round((recentApproved / recentTotal) * 100) : 0;
    const compareGroups = [
      {
        key: 'action' as const,
        label: 'Шаардлагатай арга хэмжээ',
        color: 'bg-amber-500',
        rows: [
          { label: 'Хүлээлцэх хүсэлт', value: handoverCount },
          { label: 'Дутуу бүртгэл', value: missingCount },
          { label: 'Мастер баталгаажуулах', value: pendingCount },
        ],
      },
      {
        key: 'overview' as const,
        label: 'Ерөнхий тойм',
        color: 'bg-emerald-500',
        rows: [
          { label: '7 хоногийн баталгаажсан', value: recentApproved },
          { label: 'Идэвхтэй ээлж', value: activeCount },
        ],
      },
    ].map((group) => ({
      ...group,
      max: Math.max(1, ...group.rows.map((row) => Number(row.value || 0))),
    }));

    return {
      trend,
      trendMax: Math.max(1, ...trend.map((row) => Math.max(row.total, row.approved, row.pending))),
      compareGroups,
      recentTotal,
      recentApproved,
      recentPending,
      attentionCount,
      approvalPct,
      hasTrendData,
    };
  }, [
    allShifts,
    handoverQueue,
    kpiShifts,
    masterChartShiftType,
    masterChartSince,
    masterChartStation,
    masterChartUntil,
    masterHome.active,
    masterHome.missing,
    masterPendingAllShifts,
    todayIso,
  ]);

  const openAdminSection = useCallback(
    (section: DashboardContentProps['adminSection']) => {
      setAdminSection(section);
      setActiveTab('admin');
    },
    [setAdminSection, setActiveTab]
  );


  const operatorPreviousHandoverShifts = useMemo(() => {
    if (profile?.role !== 'operator') return [];
    return (Array.isArray(handoverContextShifts) ? handoverContextShifts : [])
      .filter((s: any) => {
        if (String(s?.operatorUid || '') === String(profile?.uid || '')) return false;
        return (
          String(s?.nextOperatorUid || '') === String(profile?.uid || '') ||
          String(s?.handoverToOperatorUid || '') === String(profile?.uid || '')
        );
      })
      .sort((a: any, b: any) => String(b?.handoverRequestedAt || b?.createdAt || '').localeCompare(String(a?.handoverRequestedAt || a?.createdAt || '')));
  }, [handoverContextShifts, profile?.role, profile?.uid]);

  const masterRelatedOperatorShifts = useMemo(() => {
    if (profile?.role !== 'master') return [];
    const rows = Array.isArray(handoverContextShifts) ? handoverContextShifts : [];
    return rows
      .filter((s: any) => String(s?.operatorUid || '') !== String(profile?.uid || ''))
      .sort((a: any, b: any) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')));
  }, [handoverContextShifts, profile?.role, profile?.uid]);

  const masterCurrentOperatorShifts = useMemo(
    () => masterRelatedOperatorShifts.filter((s: any) => ['Хадгалсан', 'Ноорог'].includes(String(s?.status || '').trim())).slice(0, 20),
    [masterRelatedOperatorShifts]
  );

  // Master-ийн өөрийн дууссан master-station (ҮЯ-099/310/410) shift-үүд — operatorUid===master тул
  // masterRelatedOperatorShifts-аас шүүгдэж байдаг тул тусад нь тооцно.
  const masterOwnCompletedMasterShifts = useMemo(() => {
    if (profile?.role !== 'master') return [];
    const rows = Array.isArray(handoverContextShifts) ? handoverContextShifts : [];
    return rows
      .filter((s: any) => {
        if (String(s?.operatorUid || '') !== String(profile?.uid || '')) return false;
        if (!isMasterStationCode(s?.stationCode)) return false;
        return Boolean(s?.handoverRequestedAt) || Boolean(s?.operatorShiftCompleted) || Boolean(s?.handoverFinalAcceptedAt);
      })
      .sort((a: any, b: any) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')));
  }, [handoverContextShifts, profile?.role, profile?.uid]);

  const masterPreviousOperatorShifts = useMemo(
    () =>
      [
        ...masterRelatedOperatorShifts.filter(
          (s: any) => Boolean(s?.handoverRequestedAt) || Boolean(s?.operatorShiftCompleted) || Boolean(s?.handoverFinalAcceptedAt)
        ),
        ...masterOwnCompletedMasterShifts,
      ]
        .sort((a: any, b: any) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')))
        .slice(0, 20),
    [masterRelatedOperatorShifts, masterOwnCompletedMasterShifts]
  );

  // Master: Reports (Тайлан) — PRD 6
  const [reportTab, setReportTab] = useState<'downtime' | 'missing'>('downtime');
  const [reportSince, setReportSince] = useState<string>('');
  const [reportUntil, setReportUntil] = useState<string>('');
  const [reportShiftType, setReportShiftType] = useState<'all' | 'Өдрийн' | 'Шөнийн'>('all');
  const [reportStation, setReportStation] = useState<string>('all');
  const [reportQuery, setReportQuery] = useState<string>('');
  // Нэгдсэн "Ажилтан" шүүлтүүр (Admin/Dispatcher Тайлан/KPI): оператор эсвэл
  // мастер аль нь ч байсан сонгож болно — /api/reports/kpi-д operatorUid ЭСВЭЛ
  // хүлээн баталгаажуулсан мастерын uid-аар шүүнэ.
  const [reportEmployeeUid, setReportEmployeeUid] = useState<string>('all');
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ id: string; name: string; email?: string | null; role: string }>>([]);
  const [periodicStation, setPeriodicStation] = useState<string>('all');
  const [periodicQuery, setPeriodicQuery] = useState<string>('');

  /**
   * Шүүлтүүрт тохирох бүртгэлийн тойм. Дээрх үзүүлэлтийн картууд өмнө нь ЗӨВХӨН
   * сүүлийн 30 хоногийг харуулдаг байсан тул шүүлтүүр сонгоход тоо өөрчлөгддөггүй,
   * хэрэглэгчийг төөрөгдүүлдэг байв. Одоо шүүлтүүр тавимагц энэ тоймоор солигдоно.
   */
  const [reportSummary, setReportSummary] = useState<null | {
    totalShifts: number;
    approvedCount: number;
    completionRatePct: number;
    operatorCompletedCount: number;
  }>(null);
  const [reportSummaryLoading, setReportSummaryLoading] = useState(false);

  const hasReportFilter =
    Boolean(reportSince) || Boolean(reportUntil) || (Boolean(reportStation) && reportStation !== 'all') ||
    (Boolean(reportEmployeeUid) && reportEmployeeUid !== 'all');

  // Тайлан/KPI-ийн "Ажилтан" dropdown-г нэг л удаа ачаална (оператор + мастер).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/user-directory?roles=operator,master', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.ok) setEmployeeOptions(j.users || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasReportFilter) {
      setReportSummary(null);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams();
    if (reportSince) params.set('since', reportSince);
    if (reportUntil) params.set('until', reportUntil);
    if (reportStation && reportStation !== 'all') params.set('stationCode', reportStation);
    if (reportEmployeeUid && reportEmployeeUid !== 'all') params.set('employeeUid', reportEmployeeUid);

    setReportSummaryLoading(true);
    fetch(`/api/reports/kpi?${params.toString()}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.ok) setReportSummary(j.summary ?? null);
      })
      .catch(() => {
        if (!cancelled) setReportSummary(null);
      })
      .finally(() => {
        if (!cancelled) setReportSummaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasReportFilter, reportSince, reportUntil, reportStation, reportEmployeeUid]);

  const reportBaseShifts = useMemo(() => {
    const rows = Array.isArray(kpiShifts) ? kpiShifts : [];
    const q = String(reportQuery || '').trim().toLowerCase();
    return rows.filter((s: any) => {
      const d = String(s.shiftDate || '').slice(0, 10);
      if (reportSince && d && d < reportSince) return false;
      if (reportUntil && d && d > reportUntil) return false;
      if (reportShiftType !== 'all' && String(s.shiftType || '') !== reportShiftType) return false;
      if (reportStation !== 'all' && String(s.stationCode || '') !== reportStation) return false;
      if (q) {
        const hay = [s.operatorName, s.stationCode, s.stationName].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [kpiShifts, reportSince, reportUntil, reportShiftType, reportStation, reportQuery]);

  const reportMissingRows = useMemo(() => {
    const rows: Array<{ shift: any; missing: string[] }> = [];
    for (const s of reportBaseShifts) {
      const input = buildCompletenessInputFromShiftApi(s, periodicIntervalHours);
      const comp = getShiftCompleteness(input);
      if (comp.missing && comp.missing.length > 0) rows.push({ shift: s, missing: comp.missing });
    }
    return rows;
  }, [reportBaseShifts, periodicIntervalHours]);

  const periodicControlRows = useMemo(() => {
    const q = periodicQuery.trim().toLowerCase();
    return (Array.isArray(masterActiveShifts) ? masterActiveShifts : [])
      .filter((shift: any) => {
        if (!stationUsesPeriodicLogs(shift.stationCode)) return false;
        if (String(shift.shiftDate || '').slice(0, 10) !== selectedDate) return false;
        if (String(shift.shiftType || '') !== selectedShiftType) return false;
        if (periodicStation !== 'all' && String(shift.stationCode || '') !== periodicStation) return false;
        if (q) {
          const hay = [shift.operatorName, shift.stationCode, shift.stationName].filter(Boolean).join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .map((shift: any) => {
        const modalLogs = Array.isArray(shift.modalLogs) ? shift.modalLogs : [];
        const logs = modalLogs
          .filter((log: any) => String(log?.logType || '') === 'modal_periodic_logs')
          .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        const entries = logs.map((log: any) => ({
          id: log.id,
          createdAt: log.createdAt,
          ...((log.data as Record<string, unknown> | null) || {}),
        }));
        const status = getPeriodicLogStatus({
          stationCode: shift.stationCode,
          periodicLogs: entries,
          checkInIso: shift.checkIn,
          checkOutIso: shift.checkOut,
          periodicIntervalHours,
        });
        return {
          shift,
          logs: entries,
          latest: logs[0] || null,
          status,
        };
      });
  }, [masterActiveShifts, periodicIntervalHours, periodicQuery, periodicStation, selectedDate, selectedShiftType]);



  const [hseChartSince, setHseChartSince] = useState<string>('');
  const [hseChartUntil, setHseChartUntil] = useState<string>('');
  const [hseChartStation, setHseChartStation] = useState<string>('all');
  const [hseChartShiftType, setHseChartShiftType] = useState<string>('all');
  const [hseChartStatus, setHseChartStatus] = useState<'all' | 'pending' | 'approved'>('all');

  const reportDowntimeRows = useMemo(() => {
    const parseNum = (v: any) => {
      const n = parseFloat(String(v ?? '').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };
    return reportBaseShifts
      .map((s: any) => {
        const repairs = Array.isArray(s.repairEntries) ? s.repairEntries : [];
        const unplanned = repairs.reduce((sum: number, r: any) => sum + parseNum(r.unplannedTime), 0);
        const planned = repairs.reduce((sum: number, r: any) => sum + parseNum(r.plannedTime), 0);
        return { shift: s, unplannedHours: unplanned, plannedHours: planned };
      })
      .filter((r) => r.unplannedHours > 0 || r.plannedHours > 0);
  }, [reportBaseShifts]);

  const hseHome = useMemo(() => {
    if (profile?.role !== 'hse_engineer') {
      return {
        pendingCount: 0,
        critical24h: 0,
        incidentsToday: 0,
        incidents7d: 0,
        incidents30d: 0,
        recent: [] as any[],
        pending: [] as any[],
        checklist7d: 0,
        checklistAttention24h: 0,
        recentChecklists: [] as any[],
        totalLogs: 0,
        approvedCount: 0,
        trend7d: [] as Array<{ date: string; label: string; incidents: number; checklists: number; attention: number }>,
      };
    }
    const rows = Array.isArray(hseLogs) ? hseLogs : [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const since24h = now - dayMs;
    const since30d = now - 30 * dayMs;

    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });
    const dateKey = (value: any) => {
      const t = new Date(String(value || '')).getTime();
      return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' }) : '';
    };
    const addDays = (key: string, days: number) => {
      const d = new Date(`${key}T00:00:00+08:00`);
      d.setDate(d.getDate() + days);
      return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });
    };
    const defaultStartKey = new Date(now - 6 * dayMs).toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });
    const requestedStartKey = hseChartSince || (hseChartUntil ? addDays(hseChartUntil, -6) : defaultStartKey);
    const requestedEndKey = hseChartUntil || (hseChartSince ? addDays(hseChartSince, 6) : todayKey);
    const startKey = requestedStartKey <= requestedEndKey ? requestedStartKey : requestedEndKey;
    const endKey = requestedStartKey <= requestedEndKey ? requestedEndKey : requestedStartKey;
    const trend7d: Array<{ date: string; label: string; incidents: number; checklists: number; attention: number }> = [];
    for (let key = startKey, guard = 0; key <= endKey && guard < 31; key = addDays(key, 1), guard += 1) {
      const d = new Date(`${key}T00:00:00+08:00`);
      trend7d.push({
        date: key,
        label: `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`,
        incidents: 0,
        checklists: 0,
        attention: 0,
      });
    }
    const trendByDate = new Map(trend7d.map((row) => [row.date, row]));
    const dateFilterActive = Boolean(hseChartSince || hseChartUntil);
    const dateOk = (value: any) => {
      if (!dateFilterActive) return true;
      const key = dateKey(value);
      if (!key) return false;
      return key >= startKey && key <= endKey;
    };
    const stationOk = (value: any) => hseChartStation === 'all' || String(value || '').trim() === hseChartStation;
    const shiftTypeOk = (value: any) => hseChartShiftType === 'all' || String(value || '').trim() === hseChartShiftType;

    const parseIncidents = (log: any): any[] => {
      const v = log?.incidents;
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') {
        try {
          const p = JSON.parse(v);
          return Array.isArray(p) ? p : [];
        } catch {
          return [];
        }
      }
      return [];
    };
    const isCriticalIncident = (inc: any) => {
      const s = String(inc?.severity || inc?.level || inc?.priority || '').toLowerCase();
      if (s === 'critical' || s === 'high') return true;
      if (String(inc?.severity || '').includes('Өндөр')) return true;
      if (inc?.critical === true) return true;
      return false;
    };
    const logStatusOk = (log: any) => {
      if (hseChartStatus === 'all') return true;
      if (hseChartStatus === 'approved') return !!log?.hseEngineerApproved;
      return !log?.hseEngineerApproved;
    };
    const checklistPayload = (row: any) => {
      const d = row?.data;
      return d && typeof d === 'object' ? d : {};
    };
    const checklistStatusOk = (row: any) => {
      if (hseChartStatus === 'all') return true;
      const submitted = !!checklistPayload(row).submittedAt;
      if (hseChartStatus === 'approved') return submitted;
      return !submitted;
    };
    const filteredRows = rows.filter((log: any) =>
      dateOk(log?.createdAt || log?.timestamp) &&
      stationOk(log?.stationCode) &&
      shiftTypeOk(log?.shiftType) &&
      logStatusOk(log)
    );

    let critical24h = 0;
    let incidentsToday = 0;
    let incidents7d = 0;
    let incidents30d = 0;

    const pending = filteredRows.filter((x: any) => !x.hseEngineerApproved);
    const sorted = [...filteredRows].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    for (const log of filteredRows) {
      const t = new Date(String(log?.createdAt || log?.timestamp || '')).getTime();
      if (!Number.isFinite(t)) continue;
      const inc = parseIncidents(log);
      const n = inc.length;
      if (n === 0) continue;
      const dKey = new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });
      if (t >= since30d) incidents30d += n;
      if (trendByDate.has(dKey)) incidents7d += n;
      if (dKey === todayKey) incidentsToday += n;
      if (t >= since24h) critical24h += inc.filter(isCriticalIncident).length;
      const trendRow = trendByDate.get(dKey);
      if (trendRow) trendRow.incidents += n;
    }

    const clRows = (Array.isArray(hseChecklistLogs) ? hseChecklistLogs : []).filter((row: any) =>
      dateOk(row?.createdAt) &&
      stationOk(row?.stationCode) &&
      shiftTypeOk(row?.shiftType) &&
      checklistStatusOk(row)
    );
    const checklistNeedsAttention = (data: any) => {
      for (const k of ['ppeComplete', 'workplaceClean', 'guardsInPlace', 'fireSafetyOk'] as const) {
        if (data[k] === false) return true;
      }
      if (String(data.remarks || '').trim()) return true;
      return false;
    };
    let checklist7d = 0;
    let checklistAttention24h = 0;
    for (const row of clRows) {
      const t = new Date(String(row?.createdAt || '')).getTime();
      if (!Number.isFinite(t)) continue;
      const dKey = new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });
      const needsAttention = checklistNeedsAttention(checklistPayload(row));
      const trendRow = trendByDate.get(dKey);
      if (trendRow) {
        trendRow.checklists += 1;
        if (needsAttention) trendRow.attention += 1;
      }
      if (trendByDate.has(dKey)) checklist7d += 1;
      if (t >= since24h && needsAttention) checklistAttention24h += 1;
    }
    const recentChecklists = [...clRows]
      .sort((a: any, b: any) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
      .slice(0, 8);

    return {
      pendingCount: pending.length,
      critical24h,
      incidentsToday,
      incidents7d,
      incidents30d,
      recent: sorted.slice(0, 10),
      pending: pending
        .slice()
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10),
      checklist7d,
      checklistAttention24h,
      recentChecklists,
      totalLogs: filteredRows.length,
      approvedCount: filteredRows.filter((x: any) => x.hseEngineerApproved).length,
      trend7d,
    };
  }, [profile?.role, hseLogs, hseChecklistLogs, hseChartSince, hseChartUntil, hseChartStation, hseChartShiftType, hseChartStatus]);

  // HSE engineer: log approval detail drawer
  const [hseDetailLogId, setHseDetailLogId] = useState<string | null>(null);
  const [hseDecisionNote, setHseDecisionNote] = useState<string>('');
  const [hseApproving, setHseApproving] = useState(false);
  const [hseNoteSaving, setHseNoteSaving] = useState(false);
  const selectedHseLog = useMemo(
    () => (Array.isArray(hseLogs) ? hseLogs : []).find((l: any) => String(l.id) === String(hseDetailLogId)) || null,
    [hseLogs, hseDetailLogId]
  );

  const [operatorHseDetailLogId, setOperatorHseDetailLogId] = useState<string | null>(null);
  const selectedOperatorHseLog = useMemo(
    () => (Array.isArray(hseLogs) ? hseLogs : []).find((l: any) => String(l.id) === String(operatorHseDetailLogId)) || null,
    [hseLogs, operatorHseDetailLogId]
  );

  // HSE engineer: filters + derived list
  const [hseFilterSince, setHseFilterSince] = useState<string>('');
  const [hseFilterUntil, setHseFilterUntil] = useState<string>('');
  const [hseFilterStation, setHseFilterStation] = useState<string>('all');
  const [hseFilterStatus, setHseFilterStatus] = useState<'all' | 'pending' | 'approved'>('all');
  const [hseFilterQuery, setHseFilterQuery] = useState<string>('');

  const hseStationLabel = useCallback((code: unknown, fallbackName?: unknown) => {
    const stationCode = String(code || '').trim();
    if (!stationCode) return 'Дамжлага тодорхойгүй';
    const match = stations.find((s: any) => String(s.code || '') === stationCode);
    const stationName = String(match?.name || fallbackName || '').trim();
    return stationName && stationName !== stationCode ? `${stationCode} — ${stationName}` : stationCode;
  }, [stations]);

  const hseFilteredLogs = useMemo(() => {
    const rows = Array.isArray(hseLogs) ? hseLogs : [];
    const q = String(hseFilterQuery || '').trim().toLowerCase();
    return rows
      .filter((l: any) => {
        const d = String(l.createdAt || l.timestamp || '').slice(0, 10);
        if (hseFilterSince && d && d < hseFilterSince) return false;
        if (hseFilterUntil && d && d > hseFilterUntil) return false;
        if (hseFilterStation !== 'all' && String(l.stationCode || '') !== hseFilterStation) return false;
        if (hseFilterStatus === 'pending' && !!l.hseEngineerApproved) return false;
        if (hseFilterStatus === 'approved' && !l.hseEngineerApproved) return false;
        if (q) {
          const hay = [l.operatorName, l.stationCode, hseStationLabel(l.stationCode), l.generalComment].filter(Boolean).join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a: any, b: any) => new Date(b.createdAt || b.timestamp).getTime() - new Date(a.createdAt || a.timestamp).getTime());
  }, [hseLogs, hseFilterSince, hseFilterUntil, hseFilterStation, hseFilterStatus, hseFilterQuery, hseStationLabel]);

  const hseChecklistFiltered = useMemo(() => {
    const rows = Array.isArray(hseChecklistLogs) ? hseChecklistLogs : [];
    const q = String(hseFilterQuery || '').trim().toLowerCase();
    return rows
      .filter((row: any) => {
        const d = String(row.createdAt || '').slice(0, 10);
        if (hseFilterSince && d && d < hseFilterSince) return false;
        if (hseFilterUntil && d && d > hseFilterUntil) return false;
        if (hseFilterStation !== 'all' && String(row.stationCode || '') !== hseFilterStation) return false;
        if (hseFilterStatus !== 'all') {
          const data = row?.data && typeof row.data === 'object' ? row.data : {};
          const submitted = !!(data as any).submittedAt;
          if (hseFilterStatus === 'approved' && !submitted) return false;
          if (hseFilterStatus === 'pending' && submitted) return false;
        }
        if (q) {
          const hay = [row.operatorName, row.stationCode, hseStationLabel(row.stationCode), String((row.data as any)?.remarks || '')]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a: any, b: any) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
  }, [hseChecklistLogs, hseFilterSince, hseFilterUntil, hseFilterStation, hseFilterStatus, hseFilterQuery, hseStationLabel]);

  const [hseChecklistDetailId, setHseChecklistDetailId] = useState<string | null>(null);
  const [hseChecklistNote, setHseChecklistNote] = useState<string>('');
  const [hseChecklistNoteSaving, setHseChecklistNoteSaving] = useState(false);
  const selectedHseChecklist = useMemo(() => {
    const rows = Array.isArray(hseChecklistLogs) ? hseChecklistLogs : [];
    return rows.find((r: any) => String(r.id) === String(hseChecklistDetailId)) || null;
  }, [hseChecklistLogs, hseChecklistDetailId]);
  useEffect(() => {
    if (!selectedHseChecklist) return;
    const data = selectedHseChecklist.data && typeof selectedHseChecklist.data === 'object' ? selectedHseChecklist.data : {};
    setHseChecklistNote(String((data as any).hseEngineerNote || ''));
  }, [selectedHseChecklist]);
  const selectedHseChecklistAttachmentPayload = useMemo(() => {
    if (!selectedHseChecklist) return {};
    const data = selectedHseChecklist.data && typeof selectedHseChecklist.data === 'object' ? selectedHseChecklist.data : {};
    const dataImages = Array.isArray((data as any).images) ? (data as any).images : [];
    const shiftImages = Array.isArray(selectedHseChecklist.images) ? selectedHseChecklist.images : [];
    return {
      ...data,
      images: [...dataImages, ...shiftImages],
    };
  }, [selectedHseChecklist]);

  // Master: handover approval detail drawer
  const [handoverDetailId, setHandoverDetailId] = useState<string | null>(null);
  const [handoverDecisionNote, setHandoverDecisionNote] = useState<string>('');
  const [handoverSubmitting, setHandoverSubmitting] = useState(false);
  const [handoverExpandedLogId, setHandoverExpandedLogId] = useState<string | null>(null);
  const { data: handoverDetailData, isLoading: handoverDetailLoading } = useSWR(
    handoverDetailId ? `/api/shifts/${handoverDetailId}` : null,
    shiftDetailFetcher
  );
  const handoverDetailShift = (handoverDetailData as any)?.shift || null;

  function compactObj(v: any): any {
    if (v == null) return null;
    if (Array.isArray(v)) return v.map(compactObj).filter((x) => x != null && x !== '');
    if (typeof v !== 'object') return v;
    const out: any = {};
    for (const k of Object.keys(v)) {
      const val = (v as any)[k];
      if (val == null) continue;
      if (typeof val === 'string' && val.trim() === '') continue;
      const c = compactObj(val);
      if (c == null) continue;
      if (Array.isArray(c) && c.length === 0) continue;
      if (typeof c === 'object' && !Array.isArray(c) && Object.keys(c).length === 0) continue;
      out[k] = c;
    }
    return out;
  }

  function mnIncidentSeverity(v: any): string {
    const s = String(v ?? '').trim().toLowerCase();
    if (!s) return '—';
    if (s === 'critical') return 'Онц ноцтой';
    if (s === 'high') return 'Өндөр';
    if (s === 'medium') return 'Дунд';
    if (s === 'low') return 'Бага';
    return String(v);
  }

  function formatIncidentTime(v: any): string {
    const d = new Date(String(v ?? ''));
    if (!Number.isFinite(d.getTime())) return '—';
    return d.toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' });
  }

  function incidentKeyValueRows(inc: any): Array<{ k: string; v: string }> {
    const obj = inc && typeof inc === 'object' ? inc : {};
    const skip = new Set([
      'description',
      'severity',
      'reportedAt',
      'reported_at',
      'createdAt',
      'created_at',
      'critical',
      'violation',
      'attachments',
      'images',
      'files',
    ]);
    const rows: Array<{ k: string; v: string }> = [];
    for (const k of Object.keys(obj)) {
      if (skip.has(k)) continue;
      const v = (obj as any)[k];
      if (v == null) continue;
      const sv = typeof v === 'string' ? v.trim() : JSON.stringify(v);
      if (!sv || sv === '""' || sv === 'null') continue;
      rows.push({ k, v: sv });
    }
    return rows.slice(0, 12);
  }

  function isDisplayImage(file: { name?: string; url?: string; mimeType?: string }) {
    const mime = String(file.mimeType || '').toLowerCase();
    if (mime.startsWith('image/')) return true;
    const target = `${String(file.name || '')} ${String(file.url || '')}`.toLowerCase().split('?')[0];
    return /\.(png|jpe?g|gif|webp|svg)$/i.test(target);
  }

  function incidentAttachmentRows(inc: any): Array<{ id: string; name: string; url: string; mimeType?: string; sizeBytes?: number }> {
    const out: Array<{ id: string; name: string; url: string; mimeType?: string; sizeBytes?: number }> = [];
    const seen = new Set<string>();
    const add = (raw: any) => {
      if (!Array.isArray(raw)) return;
      for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const url = String(item.url || item.publicUrl || '').trim();
        const name = String(item.name || item.filename || item.rowLabel || item.caption || 'Хавсралт').trim();
        if (!url || seen.has(url)) continue;
        seen.add(url);
        out.push({
          id: String(item.id || url),
          name,
          url,
          mimeType: String(item.mimeType || '').trim() || undefined,
          sizeBytes: Number.isFinite(Number(item.sizeBytes)) ? Number(item.sizeBytes) : undefined,
        });
      }
    };
    add(inc?.attachments);
    add(inc?.images);
    add(inc?.files);
    return out.slice(0, 20);
  }

  function renderIncidentAttachments(inc: any) {
    const rows = incidentAttachmentRows(inc);
    if (rows.length === 0) return null;
    return (
      <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-3">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Хавсралт</p>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {rows.map((file) => {
            const isImage = isDisplayImage(file);
            return (
              <a
                key={file.id}
                href={hseDocOpenUrl(file.url)}
                target="_blank"
                rel="noreferrer"
                className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 text-xs font-bold text-gray-800 hover:bg-orange-50 hover:text-orange-700"
              >
                {isImage ? (
                  <Image
                    src={hseDocOpenUrl(file.url)}
                    alt={file.name}
                    width={420}
                    height={220}
                    unoptimized
                    className="h-32 w-full object-cover bg-white"
                  />
                ) : null}
                <span className="block truncate px-3 pt-2">{isImage ? 'Зураг: ' : 'Файл: '}{file.name}</span>
                {file.sizeBytes ? <span className="block px-3 pb-2 pt-0.5 text-[10px] text-gray-500">{Math.round(file.sizeBytes / 1024)}KB</span> : <span className="block pb-2" />}
              </a>
            );
          })}
        </div>
      </div>
    );
  }

  const mnModalLogType = (t: any) => {
    const s = String(t || '').trim().toLowerCase().replace(/^modal_/, '');
    const map: Record<string, string> = {
      hse_checklist: 'ХАБЭА-н хяналтын хуудас',
      equipment_checks: 'Тоног төхөөрөмжийн үзлэг',
      periodic_logs: `Тогтмол бүртгэл (${periodicIntervalHours} цаг)`,
      handovers: 'Ээлж хүлээлцэх бүртгэл',
      mix_logs: 'Цутгалтын үзүүлэлт',
      production_logs: 'Үйлдвэрлэлийн бүртгэл',
      autoclave_logs: 'Автоклавын бүртгэл',
      quality_logs: 'Чанарын хяналтын бүртгэл',
      process_checks: 'Процессын шалгалт',
      recipe_changes: 'Жорын өөрчлөлт',
      repairs: 'Засварын бүртгэл',
    };
    return map[s] || (s ? s.replace(/_/g, ' ') : '—');
  };

  const handoverDetailMissing = useMemo(() => {
    if (!handoverDetailShift) return [];
    const input = buildCompletenessInputFromShiftApi(handoverDetailShift, periodicIntervalHours);
    const comp = getShiftCompleteness(input);
    return comp.missing || [];
  }, [handoverDetailShift, periodicIntervalHours]);

  const handleMasterHandoverDecision = async (mode: 'accept' | 'return') => {
    if (!profile?.uid) return;
    if (!handoverDetailId) return;
    const ok = await confirmAsync({
      title: mode === 'accept' ? 'Баталгаажуулах уу?' : 'Буцаах уу?',
      message: mode === 'accept' ? 'Ээлжийг баталгаажуулах уу?' : 'Ээлжийг буцаах уу?',
      confirmText: mode === 'accept' ? 'Баталгаажуулах' : 'Буцаах',
      danger: mode !== 'accept',
    });
    if (!ok) return;
    setHandoverSubmitting(true);
    try {
      const payload =
        mode === 'accept'
          ? {
            handoverAwaitingAcceptance: false,
            handoverAcceptedByUid: profile.uid,
            handoverAcceptedByName: profile.displayName,
            handoverAcceptedAt: new Date().toISOString(),
            attentionNotes: handoverDecisionNote || '',
            handoverTimingReason: handoverDecisionNote || '',
          }
          : {
            handoverAwaitingAcceptance: false,
            attentionNotes: handoverDecisionNote || '',
            handoverTimingReason: handoverDecisionNote || '',
          };
      const r = await fetch(`/api/shifts/${handoverDetailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'Үйлдэл амжилтгүй боллоо');
      await appendAuditLog({
        actorUid: profile.uid,
        actorName: profile.displayName,
        action: mode === 'accept' ? 'shift_handover_accepted' : 'shift_handover_returned',
        entityType: 'shift',
        entityId: handoverDetailId,
      });
      setHandoverDecisionNote('');
      setHandoverDetailId(null);
      toast.success(mode === 'accept' ? 'Баталгаажууллаа.' : 'Буцаалаа.');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || (mode === 'accept' ? 'Баталгаажуулахад алдаа гарлаа.' : 'Буцаахад алдаа гарлаа.'));
    } finally {
      setHandoverSubmitting(false);
    }
  };

  const [operatorHomeClock, setOperatorHomeClock] = useState(0);
  useEffect(() => {
    if (!isOperatorView || activeTab !== 'dashboard') return;
    const id = window.setInterval(() => setOperatorHomeClock((c) => c + 1), 30000);
    return () => window.clearInterval(id);
  }, [isOperatorView, activeTab]);

  const [lastSyncAt, setLastSyncAt] = useState<Date>(() => new Date());
  const [deviceOnline, setDeviceOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  useEffect(() => {
    setLastSyncAt(new Date());
  }, [
    activeTab,
    allShifts.length,
    masterActiveShifts.length,
    pendingShifts.length,
    handoverQueue.length,
    mySchedules.length,
    kpiShifts.length,
    dispatcherCompliance,
  ]);
  useEffect(() => {
    const on = () => setDeviceOnline(true);
    const off = () => setDeviceOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const handoverWindowInfo = useMemo(() => {
    const { start: dayS, end: dayE } = resolveHandoverWindow('Өдрийн', systemSettings);
    const { start: nightS, end: nightE } = resolveHandoverWindow('Шөнийн', systemSettings);
    const nowM = minutesOfDayInTimeZone();
    const inDay = isMinuteInHmWindow(nowM, dayS, dayE);
    const inNight = isMinuteInHmWindow(nowM, nightS, nightE);
    const strict = String(systemSettings.shift_handover_window_strict || '').toLowerCase() === 'true';
    return { dayS, dayE, nightS, nightE, inDay, inNight, strict };
  }, [systemSettings]);

  /** Legacy schedule rows may include either station or stationCode. */
  const normalizeStationCode = useCallback((raw: unknown): string => {
    const s = String(raw || '').trim();
    if (!s) return '';
    // Accept either pure code (ҮЯ-120) or a label (ҮЯ-120 — Шохойн тээрмийн оператор)
    const m = s.match(/(ҮЯ-\d{3}|ОНБ)/);
    return m ? m[1] : s.split('—')[0].trim();
  }, []);
  const dashboardScheduleSlotKey = useCallback(
    (shiftDate: unknown, shiftType: unknown, stationCode: unknown) =>
      `${String(shiftDate || '').slice(0, 10)}|${String(shiftType || '').trim()}|${normalizeStationCode(stationCode)}`,
    [normalizeStationCode]
  );

  const occupiedOperatorScheduleSlotKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const shift of Array.isArray(shifts) ? shifts : []) {
      if (String(shift?.status || '').trim() === 'Цуцлагдсан') continue;
      const stationCode = normalizeStationCode(shift?.stationCode);
      if (shift?.shiftDate && shift?.shiftType && stationCode) {
        keys.add(dashboardScheduleSlotKey(shift.shiftDate, shift.shiftType, stationCode));
      }
    }
    return keys;
  }, [dashboardScheduleSlotKey, normalizeStationCode, shifts]);
  const occupiedOperatorScheduleSlots = useMemo(() => {
    const map = new Map<string, any>();
    for (const shift of Array.isArray(shifts) ? shifts : []) {
      if (String(shift?.status || '').trim() === 'Цуцлагдсан') continue;
      const stationCode = normalizeStationCode(shift?.stationCode);
      if (shift?.shiftDate && shift?.shiftType && stationCode) {
        map.set(dashboardScheduleSlotKey(shift.shiftDate, shift.shiftType, stationCode), shift);
      }
    }
    return map;
  }, [dashboardScheduleSlotKey, normalizeStationCode, shifts]);

  const todaySchedules = useMemo(() => {
    const t = isoDateInTimeZone();
    return operatorMySchedules
      .filter((s: any) => String(s.shiftDate || '').slice(0, 10) === t)
      .slice()
      .sort(compareScheduleRows);
  }, [operatorMySchedules]);

  const firstStartableTodayScheduleKeys = useMemo(() => {
    const keys = new Set<string>();
    const rowsByStation = new Map<string, any[]>();
    for (const row of todaySchedules) {
      const stationCode = normalizeStationCode(row.stationCode || row.station);
      if (!stationCode) continue;
      const rows = rowsByStation.get(stationCode) || [];
      rows.push(row);
      rowsByStation.set(stationCode, rows);
    }

    for (const rows of rowsByStation.values()) {
      const firstOpen = rows.find((s: any) => {
        const stationCode = normalizeStationCode(s.stationCode || s.station);
        const slotKey = dashboardScheduleSlotKey(s.shiftDate, s.shiftType, stationCode);
        return !s.existingShiftId && !occupiedOperatorScheduleSlots.has(slotKey);
      });
      if (firstOpen) {
        keys.add(
          dashboardScheduleSlotKey(
            firstOpen.shiftDate,
            firstOpen.shiftType,
            normalizeStationCode(firstOpen.stationCode || firstOpen.station)
          )
        );
      }
    }
    return keys;
  }, [dashboardScheduleSlotKey, normalizeStationCode, occupiedOperatorScheduleSlots, todaySchedules]);

  const firstStartableTodayScheduleKey = useMemo(() => {
    const row = todaySchedules.find((s: any) =>
      firstStartableTodayScheduleKeys.has(
        dashboardScheduleSlotKey(s.shiftDate, s.shiftType, normalizeStationCode(s.stationCode || s.station))
      )
    );
    return row
      ? dashboardScheduleSlotKey(row.shiftDate, row.shiftType, normalizeStationCode(row.stationCode || row.station))
      : null;
  }, [dashboardScheduleSlotKey, firstStartableTodayScheduleKeys, normalizeStationCode, todaySchedules]);

  const firstStartableTodaySchedule = useMemo(() => {
    if (!firstStartableTodayScheduleKey) return null;
    return (
      todaySchedules.find((s: any) =>
        dashboardScheduleSlotKey(s.shiftDate, s.shiftType, normalizeStationCode(s.stationCode || s.station)) ===
        firstStartableTodayScheduleKey
      ) || null
    );
  }, [dashboardScheduleSlotKey, firstStartableTodayScheduleKey, normalizeStationCode, todaySchedules]);

  const [operatorChartSince, setOperatorChartSince] = useState<string>('');
  const [operatorChartUntil, setOperatorChartUntil] = useState<string>('');
  const [operatorChartShiftType, setOperatorChartShiftType] = useState<string>('all');
  const [operatorChartStation, setOperatorChartStation] = useState<string>('all');

  const operatorChartStationOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const row of Array.isArray(operatorMySchedules) ? operatorMySchedules : []) {
      const code = normalizeStationCode(row?.stationCode || row?.station);
      if (code) codes.add(code);
    }
    return Array.from(codes).sort();
  }, [normalizeStationCode, operatorMySchedules]);

  const operatorHomeChart = useMemo(() => {
    const todayKey = isoDateInTimeZone();
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const dateKey = (value: any) => {
      const t = new Date(String(value || '')).getTime();
      return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' }) : '';
    };
    const addDays = (key: string, days: number) => {
      const d = new Date(`${key}T00:00:00+08:00`);
      d.setDate(d.getDate() + days);
      return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });
    };
    const defaultStartKey = new Date(now - 6 * dayMs).toLocaleDateString('en-CA', { timeZone: 'Asia/Ulaanbaatar' });
    const requestedStartKey = operatorChartSince || (operatorChartUntil ? addDays(operatorChartUntil, -6) : defaultStartKey);
    const requestedEndKey = operatorChartUntil || (operatorChartSince ? addDays(operatorChartSince, 6) : todayKey);
    const startKey = requestedStartKey <= requestedEndKey ? requestedStartKey : requestedEndKey;
    const endKey = requestedStartKey <= requestedEndKey ? requestedEndKey : requestedStartKey;
    const inDateRange = (value: any) => {
      const key = dateKey(value);
      if (!key) return false;
      return key >= startKey && key <= endKey;
    };
    const stationOk = (value: any) => operatorChartStation === 'all' || normalizeStationCode(value) === operatorChartStation;
    const shiftTypeOk = (value: any) => operatorChartShiftType === 'all' || String(value || '') === operatorChartShiftType;
    const scheduleShift = (row: any) => {
      const stationCode = normalizeStationCode(row?.stationCode || row?.station);
      const slotKey = dashboardScheduleSlotKey(row?.shiftDate, row?.shiftType, stationCode);
      return row?.existingShiftId
        ? { id: row.existingShiftId, status: row.existingShiftStatus }
        : occupiedOperatorScheduleSlots.get(slotKey);
    };
    const filteredSchedules = (Array.isArray(operatorMySchedules) ? operatorMySchedules : []).filter((row: any) =>
      inDateRange(row?.shiftDate) &&
      shiftTypeOk(row?.shiftType) &&
      stationOk(row?.stationCode || row?.station)
    );
    const trend7d = [];
    for (let key = startKey, guard = 0; key <= endKey && guard < 31; key = addDays(key, 1), guard += 1) {
      const d = new Date(`${key}T00:00:00+08:00`);
      const rows = filteredSchedules.filter((row: any) => dateKey(row?.shiftDate) === key);
      const started = rows.filter((row: any) => Boolean(scheduleShift(row))).length;
      trend7d.push({
        date: key,
        label: mnDateLabel(key),
        scheduled: rows.length,
        started,
      });
    }
    const periodStarted = filteredSchedules.filter((row: any) => Boolean(scheduleShift(row))).length;
    const periodApproved = filteredSchedules.filter((row: any) => String(scheduleShift(row)?.status || '') === 'Баталгаажсан').length;
    const operatorName = String(profile?.displayName || profile?.email || '').trim().toLowerCase();
    const ownHseLogs = (Array.isArray(hseLogs) ? hseLogs : []).filter((row: any) => {
      const uidOk = String(row?.operatorUid || '') === String(profile?.uid || '');
      const nameOk = operatorName && String(row?.operatorName || '').trim().toLowerCase() === operatorName;
      return (uidOk || nameOk) && inDateRange(row?.createdAt || row?.timestamp) && stationOk(row?.stationCode);
    });
    const ownHseChecklistLogs = (Array.isArray(hseChecklistLogs) ? hseChecklistLogs : []).filter((row: any) => {
      const uidOk = String(row?.operatorUid || '') === String(profile?.uid || '');
      const nameOk = operatorName && String(row?.operatorName || '').trim().toLowerCase() === operatorName;
      return (uidOk || nameOk) && inDateRange(row?.createdAt) && stationOk(row?.stationCode);
    });
    const hse7d = ownHseLogs.length;
    const checklist7d = ownHseChecklistLogs.length;
    const activeShiftInFilter = activeShift
      ? inDateRange(activeShift?.shiftDate || activeShift?.checkIn || activeShift?.createdAt) &&
        shiftTypeOk(activeShift?.shiftType) &&
        stationOk(activeShift?.stationCode)
      : false;
    const filteredHandovers = (Array.isArray(handoverQueue) ? handoverQueue : []).filter((row: any) =>
      inDateRange(row?.shiftDate || row?.handoverRequestedAt || row?.createdAt) &&
      shiftTypeOk(row?.shiftType) &&
      stationOk(row?.stationCode)
    );
    const missingForms = activeShiftInFilter ? activeShiftCompleteness.missing.length : 0;
    const startPct = filteredSchedules.length > 0 ? Math.round((periodStarted / filteredSchedules.length) * 100) : activeShiftInFilter ? 100 : 0;
    const compareGroups = [
      {
        key: 'action' as const,
        label: 'Шаардлагатай анхаарал',
        color: 'bg-amber-500',
        rows: [
          { label: 'Дутуу маягт', value: missingForms },
          { label: 'Хүлээлцэх хүсэлт', value: filteredHandovers.length },
          { label: 'ХАБ бүртгэл', value: hse7d + checklist7d },
        ],
      },
      {
        key: 'overview' as const,
        label: 'Ерөнхий тойм',
        color: 'bg-emerald-500',
        rows: [
          { label: 'Хугацааны хуваарь', value: filteredSchedules.length },
          { label: 'Эхлүүлсэн ээлж', value: periodStarted },
          { label: 'Баталгаажсан', value: periodApproved },
        ],
      },
    ].map((group) => ({
      ...group,
      max: Math.max(1, ...group.rows.map((row) => Number(row.value || 0))),
    }));
    const trendMax = Math.max(1, ...trend7d.map((row) => Math.max(row.scheduled, row.started)));

    return {
      trend7d,
      trendMax,
      periodScheduled: filteredSchedules.length,
      periodStarted,
      periodApproved,
      startPct,
      missingForms,
      hse7d,
      checklist7d,
      compareGroups,
    };
  }, [
    activeShift,
    activeShiftCompleteness.missing,
    dashboardScheduleSlotKey,
    handoverQueue,
    hseChecklistLogs,
    hseLogs,
    normalizeStationCode,
    occupiedOperatorScheduleSlots,
    operatorChartShiftType,
    operatorChartSince,
    operatorChartStation,
    operatorChartUntil,
    operatorMySchedules,
    profile?.displayName,
    profile?.email,
    profile?.uid,
  ]);

  const operatorScheduleMonth = operatorScheduleAnchor.slice(0, 7);
  const operatorScheduleRange = useMemo(() => {
    if (operatorScheduleView === 'week') {
      return {
        start: startOfWeekIso(operatorScheduleAnchor),
        end: endOfWeekIso(operatorScheduleAnchor),
      };
    }
    return monthGridRange(operatorScheduleMonth);
  }, [operatorScheduleAnchor, operatorScheduleMonth, operatorScheduleView]);
  const operatorScheduleDays = useMemo(
    () => datesBetween(operatorScheduleRange.start, operatorScheduleRange.end),
    [operatorScheduleRange.end, operatorScheduleRange.start]
  );
  const { data: operatorScheduleCalendarData, isLoading: operatorScheduleCalendarLoading } = useSWR(
    isSelfShiftView && activeTab === 'my-schedule'
      ? `${isOperatorView ? '/api/operator-schedules' : '/api/schedules'}?queryType=mine_calendar&from=${operatorScheduleRange.start}&to=${operatorScheduleRange.end}`
      : null,
    shiftDetailFetcher,
    { refreshInterval: 15000 }
  );
  const operatorScheduleCalendarRows = useMemo(() => {
    const rows = Array.isArray(operatorScheduleCalendarData?.schedules) ? operatorScheduleCalendarData.schedules : [];
    return rows.filter((row: any) => {
      const date = String(row.shiftDate || '').slice(0, 10);
      const shiftType = String(row.shiftType || '');
      const stationCode = String(row.stationCode || row.station || '').trim();
      if (date < operatorScheduleRange.start || date > operatorScheduleRange.end) return false;
      if (operatorScheduleShiftType && shiftType !== operatorScheduleShiftType) return false;
      if (operatorScheduleStationCode && stationCode !== operatorScheduleStationCode) return false;
      return true;
    });
  }, [
    operatorScheduleCalendarData?.schedules,
    operatorScheduleRange.end,
    operatorScheduleRange.start,
    operatorScheduleShiftType,
    operatorScheduleStationCode,
  ]);
  const operatorSchedulesByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const row of operatorScheduleCalendarRows) {
      const date = String(row.shiftDate || '').slice(0, 10);
      if (!date) continue;
      const current = map.get(date) || [];
      current.push(row);
      map.set(date, current);
    }
    for (const rows of map.values()) {
      rows.sort(compareScheduleRows);
    }
    return map;
  }, [operatorScheduleCalendarRows]);
  const nextStartableOperatorScheduleKeys = useMemo(() => {
    return firstStartableTodayScheduleKeys;
  }, [firstStartableTodayScheduleKeys]);
  const operatorScheduleStationOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const row of Array.isArray(operatorScheduleCalendarData?.schedules) ? operatorScheduleCalendarData.schedules : []) {
      const code = String(row.stationCode || row.station || '').trim();
      if (code) codes.add(code);
    }
    return Array.from(codes).sort((a, b) => a.localeCompare(b, 'mn'));
  }, [operatorScheduleCalendarData?.schedules]);

  const kpiSince = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }, []);

  // Excel татах товч нь ижил хуудсан дээрх Тайлангийн Эхлэх/Дуусах огноо, Дамжлага
  // шүүлтүүрийг ашиглана (өмнө нь тусдаа, шүүлтүүргүй сүүлийн 30 хоногийг л татдаг байсан) —
  // тухайн дамжлагын оператор бүтэн жилийн бүртгэлээ шүүж татах боломжтой болгоно.
  const downloadKpiCsv = async () => {
    try {
      const params = new URLSearchParams({ format: 'excel', since: reportSince || kpiSince });
      if (reportUntil) params.set('until', reportUntil);
      if (reportStation && reportStation !== 'all') params.set('stationCode', reportStation);
      if (reportEmployeeUid && reportEmployeeUid !== 'all') params.set('employeeUid', reportEmployeeUid);
      const r = await fetch(`/api/reports/kpi?${params.toString()}`, { credentials: 'include' });
      if (!r.ok) throw new Error('Excel татахад алдаа');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stationSuffix = reportStation && reportStation !== 'all' ? `-${reportStation}` : '';
      const employee = employeeOptions.find((u) => u.id === reportEmployeeUid);
      const employeeSuffix = employee ? `-${employee.name || employee.id}` : '';
      a.download = `kpi-shifts${stationSuffix}${employeeSuffix}-${reportSince || kpiSince}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      // Таг мөрдсөн бол чимээгүй дутуу өгөхгүй — хэрэглэгчид мэдэгдэнэ.
      const matched = Number(r.headers.get('X-Total-Matched') || 0);
      const returned = Number(r.headers.get('X-Rows-Returned') || 0);
      if (matched > returned && returned > 0) {
        toast.warning(
          `Нийт ${matched} бүртгэлээс эхний ${returned}-г татлаа. ` +
          'Огнооны мужаа богиносгох эсвэл станцаа сонгож дахин татна уу.'
        );
      } else {
        toast.success(`${returned} бүртгэл татагдлаа.`);
      }
    } catch (e) {
      console.error(e);
      toast.error('Excel татахад алдаа гарлаа.');
    }
  };

  const stats = {
    total: shifts.length,
    approved: shifts.filter(s => s.status === 'Баталгаажсан').length,
    pending: shifts.filter(s => s.status === 'Хадгалсан').length,
  };

  const scheduleStationLabel = (scheduleRow: { stationCode?: string; station?: string }) => {
    const code = normalizeStationCode(scheduleRow.stationCode || scheduleRow.station);
    if (!code) return '—';
    const st = stations.find((x) => x.code === code);
    return st ? `${st.code} — ${st.name}` : code;
  };

  const shiftNewHref = (s: {
    stationCode?: string;
    station?: string;
    shiftType?: string;
    shiftDate?: string;
  }) => {
    const stationCode = normalizeStationCode(s.stationCode || s.station);
    const shiftType = String(s.shiftType || '');
    const shiftDate = String(s.shiftDate || '');
    const q = new URLSearchParams({ auto: '1', stationCode, shiftType, shiftDate });
    return `/shift/new?${q.toString()}`;
  };

  const moveOperatorScheduleRange = (direction: -1 | 1) => {
    setOperatorScheduleAnchor((current) =>
      operatorScheduleView === 'month' ? addMonthsIso(current, direction) : addDaysIso(current, direction * 7)
    );
  };

  const operatorScheduleHeaderTitle =
    operatorScheduleView === 'month'
      ? monthTitle(operatorScheduleMonth)
      : `${dayTitle(operatorScheduleRange.start)} - ${dayTitle(operatorScheduleRange.end)}`;

  const renderOperatorScheduleCard = (row: any, compact = false) => {
    const date = String(row.shiftDate || '').slice(0, 10);
    const today = date === isoDateInTimeZone();
    const stationCode = normalizeStationCode(row.stationCode || row.station);
    const slotKey = dashboardScheduleSlotKey(row.shiftDate, row.shiftType, stationCode);
    const existingShift = row.existingShiftId
      ? { id: row.existingShiftId, status: row.existingShiftStatus }
      : occupiedOperatorScheduleSlots.get(slotKey);
    const existingShiftStatus = String(existingShift?.status || '').trim();
    const hasExistingShift = Boolean(existingShift);
    const isApprovedShift = existingShiftStatus === 'Баталгаажсан';
    const isNextStartable = nextStartableOperatorScheduleKeys.has(slotKey);
    const canStart = today && !activeShift && !hasExistingShift && isNextStartable;
    return (
      <div
        key={String(row.id || `${row.shiftDate}:${row.shiftType}:${row.stationCode}`)}
        className={`rounded-xl border ${isApprovedShift ? 'bg-emerald-50/80 border-emerald-200' : 'bg-orange-50/70 border-orange-200'} ${compact ? 'p-2.5' : 'p-4'} shadow-sm`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`text-[11px] font-black uppercase tracking-wide ${isApprovedShift ? 'text-emerald-700' : 'text-orange-700'}`}>Миний ээлж</p>
            <p className={`${compact ? 'text-xs' : 'text-sm'} font-bold text-gray-900 mt-1 truncate`}>
              {String(row.shiftType || '—')}
            </p>
          </div>
        </div>
        <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-gray-700 mt-2 line-clamp-2`}>
          {scheduleStationLabel(row)}
        </p>
        {canStart ? (
          <Link
            href={shiftNewHref(row)}
            className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-orange-600 px-3 py-2 text-xs font-black text-white hover:bg-orange-700"
          >
            Ээлж эхлүүлэх
          </Link>
        ) : today && !hasExistingShift && !activeShift ? (
          <p className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-center text-[11px] font-bold text-gray-500">
            Өмнөх хуваарь эхэлсний дараа
          </p>
        ) : null}
        {isApprovedShift ? (
          <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">Баталгаажсан</span>
        ) : today ? (
          <span className="shrink-0 rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-black text-white">Өнөөдөр</span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-12">
      <ConfirmDialog
        confirmDialog={confirmDialog}
        setConfirmDialog={setConfirmDialog}
        confirmResolveRef={confirmResolveRef}
      />
      {activeTab === 'overview' &&
        ['master', 'dispatcher', 'chief_engineer'].includes(profile?.role || '') && (
          <OverviewTab
            profile={profile}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedShiftType={selectedShiftType}
            setSelectedShiftType={setSelectedShiftType}
            overviewStation={overviewStation}
            setOverviewStation={setOverviewStation}
            overviewStatus={overviewStatus}
            setOverviewStatus={setOverviewStatus}
            overviewOperator={overviewOperator}
            setOverviewOperator={setOverviewOperator}
            overviewQuery={overviewQuery}
            setOverviewQuery={setOverviewQuery}
            overviewOperatorOptions={overviewOperatorOptions}
            overviewRows={overviewRows}
            stations={stations}
            masterHome={masterHome}
            allShifts={allShifts}
            dispatcherCompliance={dispatcherCompliance}
            dispatcherComplianceLoading={dispatcherComplianceLoading}
            handoverQueue={handoverQueue}
            pendingShifts={pendingShifts}
            systemSettings={systemSettings}
          />
        )}
      {activeTab === 'dashboard' && (
        <DashboardHomeTab
          isOperatorView={isOperatorView}
          handoverWindowInfo={handoverWindowInfo}
          handoverQueue={handoverQueue}
          activeShift={activeShift}
          operatorShiftDetailLoading={operatorShiftDetailLoading}
          activeShiftCompleteness={activeShiftCompleteness}
          firstStartableTodaySchedule={firstStartableTodaySchedule}
          scheduleStationLabel={scheduleStationLabel}
          shiftNewHref={shiftNewHref}
          operatorHomeChart={operatorHomeChart}
          deviceOnline={deviceOnline}
          operatorChartSince={operatorChartSince}
          setOperatorChartSince={setOperatorChartSince}
          operatorChartUntil={operatorChartUntil}
          setOperatorChartUntil={setOperatorChartUntil}
          operatorChartShiftType={operatorChartShiftType}
          setOperatorChartShiftType={setOperatorChartShiftType}
          operatorChartStation={operatorChartStation}
          setOperatorChartStation={setOperatorChartStation}
          operatorChartStationOptions={operatorChartStationOptions}
          stations={stations}
          todaySchedules={todaySchedules}
          mySchedules={mySchedules}
          dashboardScheduleSlotKey={dashboardScheduleSlotKey}
          normalizeStationCode={normalizeStationCode}
          firstStartableTodayScheduleKeys={firstStartableTodayScheduleKeys}
          profile={profile}
          masterHome={masterHome}
          masterDashboardChart={masterDashboardChart}
          masterChartSince={masterChartSince}
          setMasterChartSince={setMasterChartSince}
          masterChartUntil={masterChartUntil}
          setMasterChartUntil={setMasterChartUntil}
          masterChartShiftType={masterChartShiftType}
          setMasterChartShiftType={setMasterChartShiftType}
          masterChartStation={masterChartStation}
          setMasterChartStation={setMasterChartStation}
          masterChartStationOptions={masterChartStationOptions}
          masterCurrentOperatorShifts={masterCurrentOperatorShifts}
          masterPreviousOperatorShifts={masterPreviousOperatorShifts}
          pendingShifts={pendingShifts}
          masterPendingAllShifts={masterPendingAllShifts}
          adminHome={adminHome}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedShiftType={selectedShiftType}
          setSelectedShiftType={setSelectedShiftType}
          openAdminSection={openAdminSection}
          adminPendingShifts={adminPendingShifts}
          allShifts={allShifts}
          maintenanceRequests={maintenanceRequests}
          auditLogs={auditLogs}
          mnAction={mnAction}
          mnDetails={mnDetails}
          formatAuditWhen={formatAuditWhen}
          notifications={notifications}
          hseHome={hseHome}
          hseChartSince={hseChartSince}
          setHseChartSince={setHseChartSince}
          hseChartUntil={hseChartUntil}
          setHseChartUntil={setHseChartUntil}
          hseChartStation={hseChartStation}
          setHseChartStation={setHseChartStation}
          hseChartShiftType={hseChartShiftType}
          setHseChartShiftType={setHseChartShiftType}
          hseChartStatus={hseChartStatus}
          setHseChartStatus={setHseChartStatus}
          setHseChecklistDetailId={setHseChecklistDetailId}
          setHseDecisionNote={setHseDecisionNote}
          setHseDetailLogId={setHseDetailLogId}
          setOperatorHseDetailLogId={setOperatorHseDetailLogId}
          hseStationLabel={hseStationLabel}
          setShowHseIncidentModal={setShowHseIncidentModal}
          dispatcherMonth={dispatcherMonth}
          setActiveTab={setActiveTab}
          dispatcherStation={dispatcherStation}
          setDispatcherStation={setDispatcherStation}
          dispatcherOperatorQ={dispatcherOperatorQ}
          setDispatcherOperatorQ={setDispatcherOperatorQ}
          dispatcherStations={dispatcherStations}
          dispatcherCompliance={dispatcherCompliance}
          dispatcherComplianceLoading={dispatcherComplianceLoading}
          dispatcherComplianceError={dispatcherComplianceError}
          masterActiveShifts={masterActiveShifts}
          stats={stats}
          operatorPreviousHandoverShifts={operatorPreviousHandoverShifts}
           loading={loading}
           shifts={shifts}
           lastSyncAt={lastSyncAt}
           operatorScheduleShiftType={operatorScheduleShiftType}
          setOperatorScheduleShiftType={setOperatorScheduleShiftType}
          operatorScheduleStationCode={operatorScheduleStationCode}
          setOperatorScheduleStationCode={setOperatorScheduleStationCode}
          operatorScheduleStationOptions={operatorScheduleStationOptions}
          operatorScheduleCalendarLoading={operatorScheduleCalendarLoading}
          operatorScheduleDays={operatorScheduleDays}
          operatorSchedulesByDate={operatorSchedulesByDate}
          operatorScheduleMonth={operatorScheduleMonth}
          renderOperatorScheduleCard={renderOperatorScheduleCard}
          operatorScheduleCalendarRows={operatorScheduleCalendarRows}
        />
      )}

      {activeTab === 'my-shifts' && isOperatorView && (
        <MyShiftsTab
          isOperatorView={isOperatorView}
          activeShift={activeShift}
          todaySchedules={todaySchedules}
          firstStartableTodaySchedule={firstStartableTodaySchedule}
          shiftNewHref={shiftNewHref}
          operatorPreviousHandoverShifts={operatorPreviousHandoverShifts}
          loading={loading}
          shifts={shifts}
        />
      )}

      {activeTab === 'my-schedule' && isSelfShiftView && (
        <MyScheduleTab
          operatorScheduleView={operatorScheduleView}
          setOperatorScheduleView={setOperatorScheduleView}
          setOperatorScheduleAnchor={setOperatorScheduleAnchor}
          moveOperatorScheduleRange={moveOperatorScheduleRange}
          operatorScheduleHeaderTitle={operatorScheduleHeaderTitle}
          operatorScheduleRange={operatorScheduleRange}
          operatorScheduleShiftType={operatorScheduleShiftType}
          setOperatorScheduleShiftType={setOperatorScheduleShiftType}
          operatorScheduleStationCode={operatorScheduleStationCode}
          setOperatorScheduleStationCode={setOperatorScheduleStationCode}
          operatorScheduleStationOptions={operatorScheduleStationOptions}
          operatorScheduleCalendarLoading={operatorScheduleCalendarLoading}
          operatorScheduleDays={operatorScheduleDays}
          operatorSchedulesByDate={operatorSchedulesByDate}
          operatorScheduleMonth={operatorScheduleMonth}
          renderOperatorScheduleCard={renderOperatorScheduleCard}
          operatorScheduleCalendarRows={operatorScheduleCalendarRows}
          confirmAsync={confirmAsync}
        />
      )}

      {activeTab === 'my-entries' && isOperatorView && (
        <MyEntriesTab
          activeShift={activeShift}
          todaySchedules={todaySchedules}
          loading={loading}
          shifts={shifts}
          operatorPreviousHandoverShifts={operatorPreviousHandoverShifts}
          selectedShiftType={selectedShiftType}
          selectedDate={selectedDate}
        />
      )}

      {activeTab === 'hse' && (
        <HseTab
          profile={profile}
          setShowHseIncidentModal={setShowHseIncidentModal}
          hseFilterSince={hseFilterSince}
          setHseFilterSince={setHseFilterSince}
          hseFilterUntil={hseFilterUntil}
          setHseFilterUntil={setHseFilterUntil}
          hseFilterStation={hseFilterStation}
          setHseFilterStation={setHseFilterStation}
          hseFilterStatus={hseFilterStatus}
          setHseFilterStatus={setHseFilterStatus}
          hseFilterQuery={hseFilterQuery}
          setHseFilterQuery={setHseFilterQuery}
          stations={stations}
          hseChecklistFiltered={hseChecklistFiltered}
          hseStationLabel={hseStationLabel}
          setHseChecklistDetailId={setHseChecklistDetailId}
          hseFilteredLogs={hseFilteredLogs}
          setHseDetailLogId={setHseDetailLogId}
          hseDetailLogId={hseDetailLogId}
          hseApproving={hseApproving}
          setHseApproving={setHseApproving}
          selectedHseLog={selectedHseLog}
          renderIncidentAttachments={renderIncidentAttachments}
          hseDecisionNote={hseDecisionNote}
          setHseDecisionNote={setHseDecisionNote}
          hseNoteSaving={hseNoteSaving}
          setHseNoteSaving={setHseNoteSaving}
          handleSaveHseLogNote={handleSaveHseLogNote}
          handleApproveHseLog={handleApproveHseLog}
          hseChecklistDetailId={hseChecklistDetailId}
          selectedHseChecklist={selectedHseChecklist}
          selectedHseChecklistAttachmentPayload={selectedHseChecklistAttachmentPayload}
          hseChecklistNote={hseChecklistNote}
          setHseChecklistNote={setHseChecklistNote}
          hseChecklistNoteSaving={hseChecklistNoteSaving}
          setHseChecklistNoteSaving={setHseChecklistNoteSaving}
          handleSaveHseChecklistNote={handleSaveHseChecklistNote}
          hseLogs={hseLogs}
          setOperatorHseDetailLogId={setOperatorHseDetailLogId}
          operatorHseDetailLogId={operatorHseDetailLogId}
          selectedOperatorHseLog={selectedOperatorHseLog}
          mnIncidentSeverity={mnIncidentSeverity}
          formatIncidentTime={formatIncidentTime}
          incidentKeyValueRows={incidentKeyValueRows}
        />
      )}

      {activeTab === 'maintenance' && (
        <MaintenanceTab
          maintenanceRequests={maintenanceRequests}
          setShowMaintCreateModal={setShowMaintCreateModal}
          setMaintDetail={setMaintDetail}
        />
      )}

      {activeTab === 'instructions' && (
        <InstructionCenter
          profile={profile}
          stations={stations}
          mode={profile?.role === 'admin' || profile?.role === 'hse_engineer' ? 'admin' : 'user'}
          confirmAction={confirmAsync}
        />
      )}

      {activeTab === 'announcements' && (
        <AnnouncementCenter
          profile={profile}
          stations={stations}
          mode={['admin', 'master', 'dispatcher'].includes(profile?.role || '') ? 'admin' : 'user'}
          confirmAction={confirmAsync}
        />
      )}

      {activeTab === 'periodic-control' && profile?.role === 'master' && (
        <PeriodicControlTab
          periodicIntervalHours={periodicIntervalHours}
          periodicControlRows={periodicControlRows}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedShiftType={selectedShiftType}
          setSelectedShiftType={setSelectedShiftType}
          periodicStation={periodicStation}
          setPeriodicStation={setPeriodicStation}
          periodicQuery={periodicQuery}
          setPeriodicQuery={setPeriodicQuery}
          stations={stations}
        />
      )}

      {activeTab === 'hse-approval' && (
        <HseApprovalTab
          hseLogs={hseLogs}
          profileRole={profile?.role}
          handleApproveHseLog={handleApproveHseLog}
        />
      )}

      {activeTab === 'audit' &&
        (profile?.role === 'admin' ||
          profile?.role === 'auditor' ||
          profile?.role === 'dispatcher' ||
          profile?.role === 'chief_engineer') && (
          <AuditTab auditLogs={auditLogs} />
        )}

      {(activeTab === 'admin' && (isScheduleAdmin || profile?.role === 'master' || (profile?.role === 'hse_engineer' && adminSection === 'instructions') || (profile?.role === 'chief_engineer' && adminSection === 'approvals') || (profile?.role === 'dispatcher' && (adminSection === 'schedules' || adminSection === 'announcements')))) && (
        <AdminTab
          adminSection={adminSection}
          profile={profile}
          systemSettings={systemSettings}
          setSystemSettings={setSystemSettings}
          settingsLoading={settingsLoading}
          saveSettings={saveSettings}
          auditOnlyRoleChanges={auditOnlyRoleChanges}
          setAuditOnlyRoleChanges={setAuditOnlyRoleChanges}
          fetchAuditAdmin={fetchAuditAdmin}
          auditFilterSince={auditFilterSince}
          setAuditFilterSince={setAuditFilterSince}
          auditFilterUntil={auditFilterUntil}
          setAuditFilterUntil={setAuditFilterUntil}
          auditFilterAction={auditFilterAction}
          setAuditFilterAction={setAuditFilterAction}
          auditFilterEntityType={auditFilterEntityType}
          setAuditFilterEntityType={setAuditFilterEntityType}
          auditFilterActorUid={auditFilterActorUid}
          setAuditFilterActorUid={setAuditFilterActorUid}
          auditFilterLimit={auditFilterLimit}
          setAuditFilterLimit={setAuditFilterLimit}
          localUsers={localUsers}
          auditAdminRows={auditAdminRows}
          formatAuditWhen={formatAuditWhen}
          auditActionTone={auditActionTone}
          mnAction={mnAction}
          mnEntityType={mnEntityType}
          mnDetails={mnDetails}
          stations={stations}
          confirmAsync={confirmAsync}
          adminPendingShifts={adminPendingShifts}
          adminApprovedShifts={adminApprovedShifts}
          adminPendingTotal={adminPendingTotal}
          adminApprovedTotal={adminApprovedTotal}
          onAdminFinalApprove={onAdminFinalApprove}
          y310PendingApprovals={y310PendingApprovals ?? []}
          y310ApprovedLogs={y310ApprovedLogs ?? []}
          y310PendingTotal={y310PendingTotal}
          y310ApprovedTotal={y310ApprovedTotal}
          notStartedOperator={notStartedOperator ?? []}
          notStartedMaster={notStartedMaster ?? []}
          onY310Approve={onY310Approve}
          toast={toast}
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
          editingSchedule={editingSchedule}
          setEditingSchedule={setEditingSchedule}
          editableScheduleStationOptions={editableScheduleStationOptions}
          handleDeleteScheduleClick={handleDeleteScheduleClick}
          saveEditingSchedule={saveEditingSchedule}
          handleApproveUser={handleApproveUser}
          handleRejectUser={handleRejectUser}
          setEditingUser={setEditingUser}
          handleDeleteUser={handleDeleteUser}
          controlLoading={controlLoading}
        />
      )}

      {editingUser && (
        <UserEditModal
          user={editingUser}
          stations={stations}
          onClose={() => setEditingUser(null)}
          onSaved={fetchUsers}
          adminProfile={profile}
        />
      )}

      {activeTab === 'all-entries' && ['master', 'dispatcher', 'chief_engineer'].includes(profile?.role || '') && (
        <AllEntriesTab
          profileRole={profile?.role}
          allEntriesSince={allEntriesSince}
          setAllEntriesSince={setAllEntriesSince}
          allEntriesUntil={allEntriesUntil}
          setAllEntriesUntil={setAllEntriesUntil}
          allEntriesShiftType={allEntriesShiftType}
          setAllEntriesShiftType={setAllEntriesShiftType}
          allEntriesStatus={allEntriesStatus}
          setAllEntriesStatus={setAllEntriesStatus}
          allEntriesRole={allEntriesRole}
          setAllEntriesRole={setAllEntriesRole}
          allEntriesMasterUid={allEntriesMasterUid}
          setAllEntriesMasterUid={setAllEntriesMasterUid}
          allEntriesEntryType={allEntriesEntryType}
          setAllEntriesEntryType={setAllEntriesEntryType}
          allEntriesQuery={allEntriesQuery}
          setAllEntriesQuery={setAllEntriesQuery}
          stations={stations}
          localUsers={localUsers}
          masterAllEntriesFiltered={masterAllEntriesFiltered}
        />
      )}

      {activeTab === 'handover-approval' && profile?.role === 'master' && (
        <HandoverApprovalTab
          handoverQueue={handoverQueue}
          setHandoverDecisionNote={setHandoverDecisionNote}
          setHandoverDetailId={setHandoverDetailId}
          handoverDetailId={handoverDetailId}
          handoverSubmitting={handoverSubmitting}
          handoverDetailLoading={handoverDetailLoading}
          handoverDetailShift={handoverDetailShift}
          handoverDetailMissing={handoverDetailMissing}
          handoverExpandedLogId={handoverExpandedLogId}
          setHandoverExpandedLogId={setHandoverExpandedLogId}
          compactObj={compactObj}
          mnModalLogType={mnModalLogType}
          handoverDecisionNote={handoverDecisionNote}
          handleMasterHandoverDecision={handleMasterHandoverDecision}
        />
      )}





      {/* Мэдэгдэл нь хэрэглэгч тус бүрийн өөрийн мөрүүд (`/api/dashboard` нь userId-ээр
          шүүдэг) тул role-оор хязгаарлах шаардлагагүй — бүх role өөрийнхөө мэдэгдлийг харна. */}
      {activeTab === 'notifications' && (
        <NotificationsTab
          notifications={notifications}
          onClearNotifications={onClearNotifications}
          onOpenNotification={onOpenNotification}
        />
      )}

      {activeTab === 'kpi' && (
        <KpiTab
          profileRole={profile?.role}
          downloadKpiCsv={downloadKpiCsv}
          reportTab={reportTab}
          setReportTab={setReportTab}
          reportSince={reportSince}
          setReportSince={setReportSince}
          reportUntil={reportUntil}
          setReportUntil={setReportUntil}
          reportShiftType={reportShiftType}
          setReportShiftType={setReportShiftType}
          reportStation={reportStation}
          setReportStation={setReportStation}
          reportQuery={reportQuery}
          setReportQuery={setReportQuery}
          reportEmployeeUid={reportEmployeeUid}
          setReportEmployeeUid={setReportEmployeeUid}
          employeeOptions={employeeOptions}
          reportMissingRows={reportMissingRows}
          reportDowntimeRows={reportDowntimeRows}
          kpiStats={kpiStats}
          reportSummary={reportSummary}
          reportSummaryLoading={reportSummaryLoading}
          stations={stations}
        />
      )}
    </div>
  );
}
