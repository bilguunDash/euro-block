'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { appendAuditLog } from '@/lib/audit-log';
import { isoDateInTimeZone } from '@/lib/handover-window';
import {
  initialDashboardClockState,
  refreshDashboardClockState,
  selectDashboardDate,
  selectDashboardShiftType,
  type DashboardShiftType,
} from '@/lib/dashboard-clock';
import { isMasterPendingOwner } from '@/lib/master-pending';
import { clearAllNotifications, markNotificationRead } from '@/lib/notifications';
import { Sidebar } from './Sidebar';
import { DashboardHeader } from './DashboardHeader';
import { DashboardContent } from './DashboardContent';
import { HseIncidentModal } from './HseIncidentModal';
import { MaintRequestModal } from './MaintRequestModal';
import { MaintDetailModal } from './MaintDetailModal';
import { useToast } from '@/components/ui/ToastProvider';

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store', credentials: 'include' });
  const json = await res.json();
  if (!res.ok || json.ok === false) throw new Error(json.error || 'Fetch error');
  return json;
};

function formatSyncTime(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(value);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day} ${byType.hour}:${byType.minute}`;
}

const STATIONS = [
  { code: 'ҮЯ-099', name: 'Ээлжийн мастер', isMasterStation: true },
  { code: 'ҮЯ-110', name: 'Цемент шахах төхөөрөмжийн оператор', isMasterStation: false },
  { code: 'ҮЯ-120', name: 'Шохойн тээрмийн оператор', isMasterStation: false },
  { code: 'ҮЯ-121', name: 'Бөмбөлөгт тээрмийн оператор', isMasterStation: false },
  { code: 'ҮЯ-190', name: 'Чанар шалгагч', isMasterStation: false },
  { code: 'ҮЯ-140', name: 'Хэв эргэлтийн оператор', isMasterStation: false },
  { code: 'ҮЯ-130', name: 'Зуурах цамхагийн оператор', isMasterStation: false },
  { code: 'ҮЯ-150', name: 'Зүсэх дамжлагын оператор', isMasterStation: false },
  { code: 'ҮЯ-160', name: 'Рам эргэлтийн оператор', isMasterStation: false },
  { code: 'ҮЯ-161', name: 'Тэргэнцэр эргэлтийн оператор', isMasterStation: false },
  { code: 'ҮЯ-170', name: 'Савлах төхөөрөмжийн оператор', isMasterStation: false },
  { code: 'ҮЯ-210', name: 'Технологийн зуухны оператор', isMasterStation: false },
  { code: 'ҮЯ-180', name: 'Автоклавын оператор', isMasterStation: false },
  { code: 'ҮЯ-181', name: 'Дулааны мастер', isMasterStation: true },
  { code: 'ҮЯ-310', name: 'Засварын мастер', isMasterStation: true },
  { code: 'ҮЯ-320', name: 'Цахилгаан автоматжуулалтын засварын бүртгэл', isMasterStation: false },
  { code: 'ҮЯ-400', name: 'Үйлдвэрийн процесст тавих хяналтын хуудас', isMasterStation: false },
  { code: 'ҮЯ-410', name: 'Цахилгаан автоматжуулалтын мастер', isMasterStation: true },
  { code: 'ОНБ', name: 'Бүтээгдэхүүний орц найрлага өөрчилсөн бүртгэл', isMasterStation: false },
  // Сорт бүртгэлийн СОРТ оператор — ҮЯ-код биш (ОНБ-тэй ижил жишиг). РАМ тал нь ҮЯ-160-г дахин ашигладаг.
  { code: 'СОРТ', name: 'Сорт бүртгэлийн оператор', isMasterStation: false },
];

function normalizeScheduleStation(row: { stationCode?: string; station?: string }) {
  return String(row.stationCode || row.station || '').trim();
}

function normDate(d: unknown): string {
  const s = String(d ?? '').trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : s.slice(0, 10);
}
function normType(t: unknown): string {
  return String(t ?? '')
    .trim()
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ');
}
function normStation(c: unknown): string {
  return String(c ?? '').trim();
}

/** Same slot key as /api/schedules (shift row vs schedule row). */
function scheduleSlotKey(shiftDate: unknown, shiftType: unknown, stationCode: unknown) {
  return `${normDate(shiftDate)}|${normType(shiftType)}|${normStation(stationCode)}`;
}

function normalizeShiftStatus(status: unknown): string {
  return String(status ?? '').trim();
}

/** Operator shift is still "open" on dashboard (not only draft). */
const IN_PROGRESS_STATUSES = new Set(['Хадгалсан', 'Ноорог']);

/** Slots where a real shift already exists — hide «Ээлж эхлүүлэх» (any status except cancelled). */
const CANCELLED_SHIFT_STATUSES = new Set(['Цуцлагдсан']);

function isDashboardActiveShift(shift: any): boolean {
  if (!IN_PROGRESS_STATUSES.has(normalizeShiftStatus(shift?.status))) return false;
  if (shift?.checkOut || shift?.operatorShiftCompleted) return false;
  const stage = String(shift?.handoverStage || '').trim();
  if (stage === 'accepted' || stage === 'returned') return false;
  if (shift?.handoverFinalAcceptedAt || shift?.masterApproved || shift?.adminApproved) return false;
  return true;
}

function dedupeSchedulesBySlot(rows: any[]): any[] {
  const byKey = new Map<string, any>();
  for (const s of rows) {
    const code = normalizeScheduleStation(s);
    const d = s?.shiftDate != null ? String(s.shiftDate) : '';
    const t = s?.shiftType != null ? String(s.shiftType) : '';
    const slotKey = d && t && code ? scheduleSlotKey(s.shiftDate, s.shiftType, code) : `__id:${s.id}`;
    
    const prev = byKey.get(slotKey);
    if (!prev) {
      byKey.set(slotKey, s);
      continue;
    }
    const cMs = new Date(s.createdAt).getTime();
    const pMs = new Date(prev.createdAt).getTime();
    if (cMs >= pMs) {
      byKey.set(slotKey, s);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => {
    const da = String(a?.shiftDate ?? '');
    const db = String(b?.shiftDate ?? '');
    if (da !== db) return da.localeCompare(db);
    const ta = String(a?.shiftType ?? '');
    const tb = String(b?.shiftType ?? '');
    if (ta !== tb) return ta.localeCompare(tb);
    return normalizeScheduleStation(a).localeCompare(normalizeScheduleStation(b));
  });
}

export function Dashboard({ profile, logout }: { profile: any; logout: () => void }) {
  const { mutate: refreshCachedApprovals } = useSWRConfig();
  const toast = useToast();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'my-shifts'
    | 'my-schedule'
    | 'my-entries'
    | 'approve'
    | 'overview'
    | 'hse'
    | 'maintenance'
    | 'hse-approval'
    | 'kpi'
    | 'audit'
    | 'admin'
    | 'all-entries'
    | 'handover-approval'
    | 'periodic-control'
    | 'notifications'
    | 'instructions'
    | 'announcements'
  >('dashboard');
  const [adminSection, setAdminSection] = useState<'users' | 'schedules' | 'audit' | 'settings' | 'instructions' | 'announcements' | 'approvals'>('users');
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showHseIncidentModal, setShowHseIncidentModal] = useState(false);
  const [showMaintCreateModal, setShowMaintCreateModal] = useState(false);
  const [maintDetail, setMaintDetail] = useState<any>(null);
  
  const [clockState, setClockState] = useState(initialDashboardClockState);
  const selectedDate = clockState.selected.date;
  const selectedShiftType = clockState.selected.shiftType;
  const todayIso = clockState.current.date;
  const setSelectedDate = useCallback((date: string) => {
    setClockState((current) => selectDashboardDate(current, date));
  }, []);
  const setSelectedShiftType = useCallback((type: DashboardShiftType) => {
    setClockState((current) => selectDashboardShiftType(current, type));
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      setClockState((current) => refreshDashboardClockState(current));
      clearTimeout(timer);
      // Midnight and both shift changes are minute boundaries in Ulaanbaatar.
      timer = setTimeout(refresh, 60_000 - (Date.now() % 60_000) + 50);
    };
    const refreshWhenVisible = () => {
      if (!document.hidden) refresh();
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  const viewMode: 'operator' | 'admin' =
    profile?.role === 'admin' || profile?.role === 'dispatcher' ? 'admin' : 'operator';

  useEffect(() => {
    // prevent operator-only tabs in admin mode
    if (viewMode === 'admin' && activeTab === 'my-shifts') setActiveTab('dashboard');
    if (viewMode === 'admin' && activeTab === 'my-entries') setActiveTab('dashboard');
  }, [viewMode, activeTab]);

  const thirtyDaysAgo = isoDateInTimeZone(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

  // Poll configuration
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const markSynced = useCallback(() => setLastSyncAt(new Date()), []);
  const pollConfig = {
    refreshInterval: profile?.role === 'dispatcher' ? 30000 : 8000,
    keepPreviousData: true,
    onSuccess: markSynced,
  };

  // Common Dashboard Data (Maintenance, HSE Logs, Docs, Notifs, Audits)
  const { data: dashboardData, mutate: mutateDashboardData } = useSWR('/api/dashboard', fetcher, pollConfig);
  const maintenanceRequests = useMemo(() => dashboardData?.maintenanceRequests ?? [], [dashboardData?.maintenanceRequests]);
  const hseLogs = useMemo(() => dashboardData?.hseLogs ?? [], [dashboardData?.hseLogs]);
  const hseChecklistLogs = useMemo(() => dashboardData?.hseChecklistLogs ?? [], [dashboardData?.hseChecklistLogs]);
  const notifications = useMemo(() => dashboardData?.notifications ?? [], [dashboardData?.notifications]);
  const auditLogs = useMemo(() => dashboardData?.auditLogs ?? [], [dashboardData?.auditLogs]);
  const auditLogCount = Number.isFinite(Number(dashboardData?.auditLogCount))
    ? Number(dashboardData?.auditLogCount)
    : auditLogs.length;

  const handleClearNotifications = async () => {
    const ok = await clearAllNotifications();
    if (!ok) {
      toast.error('Мэдэгдэл цэвэрлэхэд алдаа гарлаа.');
      return;
    }
    await mutateDashboardData(
      (current: any) => (current ? { ...current, notifications: [] } : current),
      { revalidate: false }
    );
    toast.success('Бүх мэдэгдлийг цэвэрлэлээ.');
  };

  const handleOpenNotification = async (notification: any) => {
    const notificationId = String(notification?.id || '').trim();
    if (!notificationId) return;

    if (!notification?.read) {
      const marked = await markNotificationRead(notificationId);
      if (!marked) {
        toast.error('Мэдэгдлийг уншсанаар тэмдэглэхэд алдаа гарлаа.');
      } else {
        await mutateDashboardData(
          (current: any) => {
            if (!current || !Array.isArray(current.notifications)) return current;
            return {
              ...current,
              notifications: current.notifications.map((item: any) =>
                String(item?.id) === notificationId ? { ...item, read: true } : item
              ),
            };
          },
          { revalidate: false }
        );
      }
    }

    setShowNotifPanel(false);

    const kind = String(notification?.kind || '').trim();
    const link = String(notification?.link || '').trim();

    if (link.startsWith('/shift/')) {
      window.location.assign(link);
      return;
    }

    if (kind === 'announcement' || link === '/announcements') {
      setActiveTab('announcements');
      return;
    }

    if (kind === 'shift_assigned' || kind === 'shift_schedule_removed') {
      if (profile?.role === 'operator' || profile?.role === 'master') {
        setActiveTab('my-schedule');
      } else if (profile?.role === 'admin' || profile?.role === 'dispatcher') {
        setAdminSection('schedules');
        setActiveTab('admin');
      } else {
        setActiveTab('dashboard');
      }
      return;
    }

    if (kind === 'hse_incident' || kind === 'hse_incident_critical') {
      setActiveTab('hse');
      return;
    }

    if (kind.startsWith('shift_swap_')) {
      setActiveTab('my-schedule');
      return;
    }

    if (link && link !== '/dashboard') {
      window.location.assign(link);
      return;
    }

    setActiveTab('dashboard');
  };

  // Roles that can start their own shift from "dashboard"
  const isSelfShiftView = profile?.role === 'operator' || profile?.role === 'master';
  const isOperatorView = profile?.role === 'operator';
  
  const { data: opShiftsData, isLoading: opLoading } = useSWR(
    isSelfShiftView ? `/api/shifts?queryType=operator&operatorUid=${profile.uid}` : null,
    fetcher,
    pollConfig
  );
  const opShifts = useMemo(() => opShiftsData?.shifts ?? [], [opShiftsData?.shifts]);
  const activeShift =
    opShifts.find((s: any) => isDashboardActiveShift(s)) || null;

  const occupiedScheduleSlotKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const s of opShifts) {
      if (CANCELLED_SHIFT_STATUSES.has(normalizeShiftStatus(s.status))) continue;
      const sd = normDate(s.shiftDate);
      const tt = normType(s.shiftType);
      const sc = normStation(s.stationCode);
      if (sd && tt && sc) keys.add(scheduleSlotKey(sd, tt, sc));
    }
    return keys;
  }, [opShifts]);

  // Operator/Master should see their own assignments (masterUid == session.user.id).
  // Admin can manage schedules from the Admin tab via DashboardContent.
  const schedulesQueryType =
    profile?.role === 'master'
      ? 'mine'
      : profile?.role === 'admin' || profile?.role === 'dispatcher'
        ? 'all'
        : null;
  const { data: schedulesData } = useSWR(
    schedulesQueryType ? `/api/schedules?queryType=${schedulesQueryType}` : null,
    fetcher,
    pollConfig
  );
  const allMasterSchedules = schedulesData?.schedules || [];

  const { data: operatorSchedulesData } = useSWR(
    isOperatorView ? '/api/operator-schedules?queryType=mine' : null,
    fetcher,
    pollConfig
  );
  const operatorPlannedRows = useMemo(
    () => operatorSchedulesData?.schedules || [],
    [operatorSchedulesData?.schedules]
  );

  const mySchedules = isOperatorView ? operatorPlannedRows : allMasterSchedules;

  const showHandoverApi = [
    'master',
    'admin',
    'dispatcher',
    'chief_engineer',
    'auditor',
    'hse_engineer',
    'operator',
  ].includes(profile?.role || '');
  const { data: handoverData } = useSWR(
    showHandoverApi ? '/api/shifts?queryType=handover' : null,
    fetcher,
    pollConfig
  );
  const { data: handoverContextData } = useSWR(
    profile?.role === 'operator' || profile?.role === 'master'
      ? '/api/shifts?queryType=handover_context'
      : null,
    fetcher,
    pollConfig
  );
  const handoverContextShifts = useMemo(() => handoverContextData?.shifts ?? [], [handoverContextData?.shifts]);
  const { data: adminPendingData, mutate: mutateAdminPending } = useSWR(
    (profile?.role === 'admin' || profile?.role === 'chief_engineer')
      ? '/api/shifts?queryType=admin_pending'
      : null,
    fetcher,
    pollConfig
  );
  const { data: adminApprovedData } = useSWR(
    (profile?.role === 'admin' || profile?.role === 'chief_engineer')
      ? '/api/shifts?queryType=admin_approved'
      : null,
    fetcher,
    pollConfig
  );
  const adminPendingShifts = useMemo(() => adminPendingData?.shifts ?? [], [adminPendingData?.shifts]);
  const adminApprovedShifts = useMemo(() => adminApprovedData?.shifts ?? [], [adminApprovedData?.shifts]);
  const adminPendingTotal = adminPendingData?.total;
  const adminApprovedTotal = adminApprovedData?.total;

  const { data: y310ApprovalsData } = useSWR(
    (profile?.role === 'admin' || profile?.role === 'chief_engineer')
      ? '/api/y310-approvals'
      : null,
    fetcher,
    pollConfig
  );
  const y310PendingApprovals = useMemo(() => y310ApprovalsData?.pending ?? [], [y310ApprovalsData?.pending]);
  const y310ApprovedLogs = useMemo(() => y310ApprovalsData?.approved ?? [], [y310ApprovalsData?.approved]);
  const y310PendingTotal = y310ApprovalsData?.pendingTotal;
  const y310ApprovedTotal = y310ApprovalsData?.approvedTotal;

  // «Хийгдэж эхлээгүй» — хуваарьтай атлаа ээлж үүсээгүй мөрүүд (Давхар баталгаажуулалт).
  const { data: notStartedData } = useSWR(
    (profile?.role === 'admin' || profile?.role === 'chief_engineer')
      ? '/api/approvals/not-started'
      : null,
    fetcher,
    pollConfig
  );
  const notStartedOperator = useMemo(() => notStartedData?.operator ?? [], [notStartedData?.operator]);
  const notStartedMaster = useMemo(() => notStartedData?.master ?? [], [notStartedData?.master]);

  const handleY310Approve = async (logId: string, action: 'approve' | 'reject') => {
    const res = await fetch('/api/y310-approvals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ logId, action }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      if (res.status === 409) {
        await refreshCachedApprovals((key) => typeof key === 'string' && key.startsWith('/api/y310-approvals'), undefined, { revalidate: true });
      }
      throw new Error(json?.error || 'Алдаа гарлаа.');
    }
    await refreshCachedApprovals((key) => typeof key === 'string' && key.startsWith('/api/y310-approvals'), undefined, { revalidate: true });
    toast.success(action === 'approve' ? 'Баталгаажуулалт амжилттай.' : 'Бүртгэл буцаагдлаа.');
  };
  const handleAdminFinalApprove = async (shift: any) => {
    if (!shift?.id) return;
    const payload = {
      status: 'Баталгаажсан',
      adminApproved: true,
      adminApprovedBy: profile?.displayName || profile?.name || profile?.email,
      adminApprovedDate: new Date().toISOString(),
    };
    const res = await fetch(`/api/shifts/${shift.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error || 'Эцсийн баталгаажуулалт хийхэд алдаа гарлаа.');
    }
    await Promise.all([
      mutateAdminPending(),
      refreshCachedApprovals((key) => typeof key === 'string' && key.startsWith('/api/shifts?queryType=admin_approved'), undefined, { revalidate: true }),
    ]);
    toast.success('Эцсийн баталгаажуулалт амжилттай хийгдлээ.');
  };
  const handoverQueue = useMemo(() => {
    const handoverQueueRaw = handoverData?.shifts ?? [];
    return handoverQueueRaw.filter((s: any) => {
      // Operator: only shifts handed over to me
      if (profile?.role === 'operator') {
        return (
          (s.handoverToOperatorUid && s.handoverToOperatorUid === profile.uid) ||
          (s.nextOperatorUid && s.nextOperatorUid === profile.uid)
        );
      }
      // Master: keep the dashboard scoped to the exact staged handover owner.
      if (profile?.role === 'master') {
        const stage = String(s.handoverStage || '').trim();
        const isCurrentMasterTurn = stage === 'waiting_current_master' && s.currentMasterUid === profile.uid;
        const isMasterSelfHandoverTurn =
          stage === 'waiting_next_master' &&
          !s.nextOperatorUid &&
          s.nextMasterUid === profile.uid;
        const isLegacyTurn =
          (!stage || stage === 'none') &&
          s.shiftMasterUid === profile.uid &&
          s.operatorUid !== profile.uid &&
          Boolean(s.handoverRequestedAt);
        return isCurrentMasterTurn || isMasterSelfHandoverTurn || isLegacyTurn;
      }
      // Dispatcher/Admin: see all
      if (profile?.role === 'dispatcher' || profile?.role === 'admin') return true;
      // Others: same station (exclude own shift)
      return s.stationCode && profile?.stationCode && s.stationCode === profile.stationCode && s.operatorUid !== profile.uid;
    });
  }, [handoverData?.shifts, profile]);

  const showKpiApi = ['auditor', 'admin', 'dispatcher', 'chief_engineer', 'master', 'hse_engineer'].includes(
    profile?.role || ''
  );
  const { data: kpiData } = useSWR(
    showKpiApi ? `/api/shifts?queryType=kpi&since=${thirtyDaysAgo}` : null,
    fetcher,
    pollConfig
  );
  const kpiShifts = useMemo(() => {
    const kpiShiftsRaw = kpiData?.shifts ?? [];
    return [...kpiShiftsRaw].sort((a: any, b: any) => (b.shiftDate || '').localeCompare(a.shiftDate || ''));
  }, [kpiData?.shifts]);

  const showMasterDashboard = ['master', 'dispatcher', 'chief_engineer', 'admin'].includes(profile?.role || '');
  const { data: masterOverviewData } = useSWR(
    showMasterDashboard
      ? `/api/shifts?queryType=master_overview&shiftDate=${selectedDate}&shiftType=${encodeURIComponent(selectedShiftType)}`
      : null,
    fetcher,
    pollConfig
  );
  const allShifts = masterOverviewData?.shifts || [];

  const {
    data: dispatcherComplianceData,
    isLoading: dispatcherComplianceLoading,
    error: dispatcherComplianceError,
  } = useSWR(
    profile?.role === 'dispatcher' && (activeTab === 'dashboard' || activeTab === 'overview')
      ? `/api/shifts?queryType=dispatcher_compliance&shiftDate=${selectedDate}&shiftType=${encodeURIComponent(selectedShiftType)}`
      : null,
    fetcher,
    pollConfig
  );

  const { data: masterActiveData } = useSWR(
    showMasterDashboard ? '/api/shifts?queryType=active_all' : null,
    fetcher,
    pollConfig
  );
  const masterActiveShifts = masterActiveData?.shifts || [];

  const { data: masterPendingData, isLoading: masterLoading } = useSWR(
    showMasterDashboard ? `/api/shifts?queryType=pending` : null,
    fetcher,
    pollConfig
  );
  // Master-ийн Нүүр таб дээр Огноо/Ээлж сонгох picker байхгүй тул selectedDate/selectedShiftType
  // (өнөөдөр/Өдрийн-д түгжигдсэн байдаг) хэзээ ч өөрчлөгддөггүй — pendingShifts-ийг шууд ашиглавал
  // мастер өөр огноо/шөнийн ээлжийн баталгаажуулах ёстой ээлжүүдээ огт харахгүй байх эрсдэлтэй.
  // Тиймээс огноо/ээлжийн төрлөөс үл хамааран БҮХ хүлээгдэж буй ээлжийг харуулах тусдаа хувьсагч.
  const masterPendingAllShifts = useMemo(() => {
    const rows = masterPendingData?.shifts ?? [];
    if (profile?.role !== 'master') return rows;
    return rows.filter((shift: any) => isMasterPendingOwner(shift, String(profile?.uid || '')));
  }, [masterPendingData?.shifts, profile?.role, profile?.uid]);
  const pendingShifts = useMemo(() => masterPendingAllShifts.filter((s: any) =>
    s.shiftDate === selectedDate && s.shiftType === selectedShiftType
  ), [masterPendingAllShifts, selectedDate, selectedShiftType]);

  // Derived loading state
  const loading = isOperatorView ? opLoading : false;

  // Server filters /api/schedules?queryType=mine; client also hides rows when opShifts already has that slot
  // (covers Баталгаажсан / trimmed status / SWR lag so «Ээлж эхлүүлэх» does not reappear after save).
  const operatorMySchedules = useMemo(() => {
    if (!isSelfShiftView) return [];
    return dedupeSchedulesBySlot(mySchedules).filter((row: any) => {
      const code = normalizeScheduleStation(row);
      if (!row.shiftDate || !row.shiftType || !code) return true;
      return !occupiedScheduleSlotKeys.has(scheduleSlotKey(row.shiftDate, row.shiftType, code));
    });
  }, [isSelfShiftView, mySchedules, occupiedScheduleSlotKeys]);

  const kpiStats = useMemo(() => {
    const totalShifts = kpiShifts.length;
    const approved = kpiShifts.filter((s: any) => s.status === 'Баталгаажсан').length;
    const completeRate = totalShifts ? Math.round((approved / totalShifts) * 100) : 0;
    const pendingMaster = kpiShifts.filter((s: any) => s.status === 'Хадгалсан').length;
    const completedByOp = kpiShifts.filter((s: any) => s.operatorShiftCompleted).length;
    const hseIncidents = hseLogs.reduce((n: number, log: any) => n + (log.incidents?.length || 0), 0);
    const maintOpen = maintenanceRequests.filter((m: any) => m.status === 'Open' || m.status === 'In Progress').length;
    return { totalShifts, approved, completeRate, pendingMaster, completedByOp, hseIncidents, maintOpen };
  }, [kpiShifts, hseLogs, maintenanceRequests]);

  const unreadNotifications = notifications.filter((n: any) => !n.read).length;

  const [deviceOnline, setDeviceOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
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

  const handleApproveHseLog = async (logId: string, note?: string) => {
    if (!profile || profile.role !== 'hse_engineer') return;
    try {
      const res = await fetch('/api/dashboard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approveHseLog', logId, note })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'API Error');
      await mutateDashboardData();
      toast.success('Баталгаажуулалт амжилттай!');
    } catch (e) {
      console.error(e);
      toast.error('Баталгаажуулахад алдаа гарлаа.');
    }
  };

  const handleSaveHseLogNote = async (logId: string, note: string) => {
    if (!profile || profile.role !== 'hse_engineer') return;
    try {
      const res = await fetch('/api/dashboard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateHseLogNote', logId, note })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'API Error');
      await mutateDashboardData();
      toast.success('Тэмдэглэл хадгалагдлаа.');
    } catch (e) {
      console.error(e);
      toast.error('Тэмдэглэл хадгалахад алдаа гарлаа.');
    }
  };

  const handleSaveHseChecklistNote = async (logId: string, note: string) => {
    if (!profile || profile.role !== 'hse_engineer') return;
    try {
      const res = await fetch('/api/dashboard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateHseChecklistNote', logId, note })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'API Error');
      await mutateDashboardData();
      toast.success('Тэмдэглэл хадгалагдлаа.');
    } catch (e) {
      console.error(e);
      toast.error('Тэмдэглэл хадгалахад алдаа гарлаа.');
    }
  };

  const getStationStatus = (stationCode: string) => {
    const shift = allShifts.find((s: any) => s.stationCode === stationCode);
    if (!shift) return { status: 'Бөглөөгүй', color: 'bg-gray-100 text-gray-400', id: null };

    if (
      profile?.role === 'master' &&
      shift.shiftMasterUid &&
      shift.shiftMasterUid !== profile.uid
    ) {
      return { status: 'Бусдын хяналт', color: 'bg-gray-100 text-gray-400', id: null };
    }

    if (shift.status === 'Баталгаажсан') return { status: 'Баталгаажсан', color: 'bg-emerald-100 text-emerald-700', id: shift.id };
    return { status: 'Хүлээгдэж буй', color: 'bg-amber-100 text-amber-700', id: shift.id };
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        profile={profile}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        adminSection={adminSection}
        setAdminSection={setAdminSection}
        logout={logout}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          profile={profile}
          activeTab={activeTab}
          adminSection={adminSection}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedShiftType={selectedShiftType}
          setSelectedShiftType={setSelectedShiftType}
          unreadNotifications={unreadNotifications}
          notifications={notifications}
          showNotifPanel={showNotifPanel}
          setShowNotifPanel={setShowNotifPanel}
          setActiveTab={setActiveTab}
          logout={logout}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onClearNotifications={handleClearNotifications}
          onOpenNotification={handleOpenNotification}
        />
        <DashboardContent
          profile={profile}
          activeTab={activeTab}
          adminSection={adminSection}
          setActiveTab={setActiveTab}
          setAdminSection={setAdminSection}
          todayIso={todayIso}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedShiftType={selectedShiftType}
          setSelectedShiftType={setSelectedShiftType}
          shifts={opShifts}
          activeShift={activeShift}
          maintenanceRequests={maintenanceRequests}
          openMaintenanceCount={dashboardData?.openMaintenanceCount ?? 0}
          hseLogs={hseLogs}
          hseChecklistLogs={hseChecklistLogs}
          notifications={notifications}
          handoverQueue={handoverQueue}
          handoverContextShifts={handoverContextShifts}
          pendingShifts={pendingShifts}
          masterPendingAllShifts={masterPendingAllShifts}
          adminPendingShifts={adminPendingShifts}
          adminApprovedShifts={adminApprovedShifts}
          adminPendingTotal={adminPendingTotal}
          adminApprovedTotal={adminApprovedTotal}
          onAdminFinalApprove={handleAdminFinalApprove}
          y310PendingApprovals={y310PendingApprovals}
          notStartedOperator={notStartedOperator}
          notStartedMaster={notStartedMaster}
          y310ApprovedLogs={y310ApprovedLogs}
          y310PendingTotal={y310PendingTotal}
          y310ApprovedTotal={y310ApprovedTotal}
          onY310Approve={handleY310Approve}
          allShifts={allShifts}
          dispatcherCompliance={dispatcherComplianceData}
          dispatcherComplianceLoading={dispatcherComplianceLoading}
          dispatcherComplianceError={dispatcherComplianceError}
          masterActiveShifts={masterActiveShifts}
          loading={loading}
          masterLoading={masterLoading}
          kpiStats={kpiStats}
          kpiShifts={kpiShifts}
          stations={STATIONS}
          auditLogs={auditLogs}
          auditLogCount={auditLogCount}
          mySchedules={mySchedules}
          operatorMySchedules={operatorMySchedules}
          getStationStatus={getStationStatus}
          setShowHseIncidentModal={setShowHseIncidentModal}
          setShowMaintCreateModal={setShowMaintCreateModal}
          setMaintDetail={setMaintDetail}
          handleApproveHseLog={handleApproveHseLog}
          handleSaveHseLogNote={handleSaveHseLogNote}
          handleSaveHseChecklistNote={handleSaveHseChecklistNote}
          onClearNotifications={handleClearNotifications}
          onOpenNotification={handleOpenNotification}
        />
        <footer className="mt-auto border-t border-gray-200 bg-white px-6 pb-5 pt-3 text-xs text-gray-500 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Сүүлийн шинэчлэлт: {lastSyncAt ? formatSyncTime(lastSyncAt) : '—'}
            </span>
            <span className="inline-flex items-center gap-2">
              <span>Төхөөрөмжийн төлөв:</span>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black tracking-wider ${deviceOnline ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-red-50 text-red-700 ring-1 ring-red-100'}`}>
                {deviceOnline ? 'Онлайн' : 'Офлайн'}
              </span>
            </span>
          </div>
        </footer>
      </main>
      {showHseIncidentModal && profile && (
        <HseIncidentModal profile={profile} onClose={() => setShowHseIncidentModal(false)} />
      )}
      {showMaintCreateModal && profile && (
        <MaintRequestModal profile={profile} onClose={() => setShowMaintCreateModal(false)} />
      )}
      {maintDetail && profile && (
        <MaintDetailModal
          req={maintDetail}
          profile={profile}
          onClose={() => setMaintDetail(null)}
        />
      )}
    </div>
  );
}
