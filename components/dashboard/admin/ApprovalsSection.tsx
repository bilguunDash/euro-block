'use client';

import { useMemo, useRef, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import Link from 'next/link';
import { CheckCircle2, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { approvalMaintenanceConfirmation, type ApprovalMaintenanceAction, type ApprovalRecordKind } from '@/lib/approval-maintenance';
import { approvalRecordLabel } from '@/lib/approval-record-label';
import {
  APPROVAL_HISTORY_PAGE_SIZE, MASTER_APPROVAL_STATION_BY_LOG_TYPE, approvalStationKind, pendingApprovalCounts,
  type ApprovalStationKind,
} from '@/lib/approval-history-query';
import { SHIFT_GROUP_OPTIONS } from '@/lib/shift-crew';
import { useToast } from '@/components/ui/ToastProvider';
import { HorizontalPagedList } from '../HorizontalPagedList';
import { mnDateTimeCompact } from '../dashboard-helpers';
import type { Station } from './schedule/types';

async function fetchApprovalHistory(url: string) {
  const response = await fetch(url, { credentials: 'include', cache: 'no-store' });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || 'Түүхийг ачаалж чадсангүй.');
  return data;
}

type ApprovalTab = 'operator' | 'master';
type ApprovalState = 'pending' | 'approved' | 'not_started';

type ApprovalsSectionProps = {
  adminPendingShifts: any[];
  adminApprovedShifts: any[];
  y310PendingApprovals?: any[];
  y310ApprovedLogs?: any[];
  adminPendingTotal?: number;
  adminApprovedTotal?: number;
  y310PendingTotal?: number;
  y310ApprovedTotal?: number;
  /** Хуваарьтай атлаа ээлж эхлүүлээгүй — `/api/approvals/not-started`. */
  notStartedOperator?: any[];
  notStartedMaster?: any[];
  onY310Approve?: (logId: string, action: 'approve' | 'reject') => Promise<void> | void;
  confirmAsync: (options: { title: string; message: string; confirmText?: string; danger?: boolean }) => Promise<boolean>;
  handleAdminFinalApproveClick: (shift: any) => Promise<void> | void;
  adminFinalApprovingId: string;
  stations: Station[];
  /** Ажлын баг (`shiftGroup`) нь хэрэглэгчийн бүртгэл дээр байдаг тул uid-аар хайна. */
  localUsers?: any[];
};

/** «Хийгдэж эхлээгүй» хуваарийн мөр — сервер аль хэдийн нэгтгэсэн хэлбэрээр өгнө. */
function notStartedRowView(r: any) {
  return {
    key: String(r?.id ?? ''),
    kind: (r?.kind === 'master' ? 'master_schedule' : 'operator_schedule') as ApprovalRecordKind,
    shiftDate: String(r?.shiftDate ?? ''),
    shiftType: String(r?.shiftType ?? ''),
    stationCode: String(r?.stationCode ?? ''),
    assigneeName: String(r?.assigneeName ?? ''),
    assigneeUid: String(r?.assigneeUid ?? ''),
  };
}

/** Мастерын маягтын мөрийг нэгтгэсэн хэлбэрт оруулна (шүүлт/харуулалт хоёуланд). */
function masterRowView(log: any) {
  const d = log?.data ?? {};
  return {
    key: String(log?.id ?? ''),
    kind: 'master_form' as ApprovalRecordKind,
    logId: String(log?.id ?? ''),
    shiftId: String(log?.shiftId ?? ''),
    shiftDate: String(log?.shift?.shiftDate ?? d.shiftDate ?? ''),
    shiftType: String(log?.shift?.shiftType ?? d.shiftType ?? ''),
    stationCode: String(MASTER_APPROVAL_STATION_BY_LOG_TYPE[String(log?.logType ?? '')] ?? d.stationCode ?? ''),
    handedOver: String(d.sigHandingOver || d.handedOverBy || log?.shift?.operatorName || ''),
    received: String(d.sigReceiving || d.receivedBy || ''),
    approvedBy: String(d.adminApprovedBy || ''),
    // Мастер станцын ээлжид маягт бөглөсөн мастер нь `operatorUid` болж бүртгэгддэг.
    assigneeUid: String(log?.shift?.operatorUid ?? d.operatorUid ?? ''),
  };
}

/** Ээлжийн мөрийг нэгтгэсэн хэлбэрт оруулна. */
function shiftRowView(s: any) {
  return {
    key: String(s?.id ?? ''),
    kind: 'shift' as ApprovalRecordKind,
    shiftId: String(s?.id ?? ''),
    shiftDate: String(s?.shiftDate ?? ''),
    shiftType: String(s?.shiftType ?? ''),
    stationCode: String(s?.stationCode ?? ''),
    stationName: String(s?.stationName ?? ''),
    operatorName: String(s?.operatorName ?? ''),
    masterName: String(s?.masterApprovedBy || s?.currentMasterApprovedByName || ''),
    masterAt: String(s?.masterApprovedDate || s?.currentMasterApprovedAt || ''),
    adminApprovedBy: String(s?.adminApprovedBy || ''),
    adminApprovedDate: String(s?.adminApprovedDate || ''),
    assigneeUid: String(s?.operatorUid ?? ''),
    raw: s,
  };
}

/**
 * Мастер станцын ЭЭЛЖ — «Мастер» табад мастерын маягттай нэг хүснэгтэд гарна. Ээлжийг ажилласан
 * мастер нь `operatorName` болж бүртгэгддэг тул «хүлээлгэн өгсөн», ээлжийг баталсан мастер нь «хүлээн авсан».
 */
function masterShiftRowView(s: any) {
  const row = shiftRowView(s);
  return { ...row, handedOver: row.operatorName, received: row.masterName, approvedBy: row.adminApprovedBy };
}

export function ApprovalsSection({
  adminPendingShifts,
  y310PendingApprovals,
  adminPendingTotal,
  y310PendingTotal,
  notStartedOperator,
  notStartedMaster,
  onY310Approve,
  confirmAsync,
  handleAdminFinalApproveClick,
  adminFinalApprovingId,
  stations,
  localUsers,
}: ApprovalsSectionProps) {
  const toast = useToast();
  const { mutate: refreshApprovals } = useSWRConfig();
  const decisionInFlight = useRef(false);
  const [masterDecisionId, setMasterDecisionId] = useState('');
  const [maintenanceId, setMaintenanceId] = useState('');
  const actionsBusy = Boolean(masterDecisionId || maintenanceId || adminFinalApprovingId);

  const refreshRelatedLists = () => refreshApprovals(
    (key) => typeof key === 'string' && [
      '/api/shifts', '/api/y310-approvals', '/api/approvals/not-started', '/api/schedules',
      '/api/operator-schedules', '/api/master-schedule-', '/api/dashboard', '/api/audit', '/api/shift-swap-requests', '/api/reports',
    ].some((prefix) => key.startsWith(prefix)), undefined, { revalidate: true }
  );

  const handleMaintenance = async (row: any, kind: ApprovalRecordKind, action: ApprovalMaintenanceAction) => {
    if (decisionInFlight.current || actionsBusy) return;
    decisionInFlight.current = true;
    const id = kind === 'shift' ? row.shiftId : kind === 'master_form' ? row.logId : row.key;
    setMaintenanceId(`${kind}:${id}`);
    try {
      const label = `${row.stationCode} • ${row.shiftDate} • ${row.shiftType} • ${row.operatorName || row.handedOver || row.assigneeName || ''}`;
      if (!await confirmAsync(approvalMaintenanceConfirmation(kind, action, label))) return;
      const response = await fetch('/api/approvals/manage', {
        method: action === 'cancel' ? 'PATCH' : 'DELETE',
        credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, state }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        if (response.status === 409 || response.status === 404) await refreshRelatedLists();
        throw new Error(data?.error || 'Үйлдэл хийхэд алдаа гарлаа.');
      }
      toast.success(action === 'delete' ? 'Бүртгэлийг устгалаа.' : kind.endsWith('_schedule') ? 'Хуваарийн оноолтыг цуцаллаа.' : 'Баталгаажуулалтыг цуцалж, засварт буцаалаа.');
      try { await refreshRelatedLists(); }
      catch { toast.error('Үйлдэл хадгалагдсан. Жагсаалтыг дахин ачаална уу.'); }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Үйлдэл хийхэд алдаа гарлаа.');
    } finally {
      decisionInFlight.current = false;
      setMaintenanceId('');
    }
  };

  const maintenanceButtons = (row: any, kind: ApprovalRecordKind) => (
    <>
      <button type="button" disabled={actionsBusy} onClick={() => void handleMaintenance(row, kind, 'cancel')}
        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-3 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60">
        <RotateCcw className="h-3.5 w-3.5 shrink-0" /> Цуцлах
      </button>
      <button type="button" disabled={actionsBusy} onClick={() => void handleMaintenance(row, kind, 'delete')}
        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60">
        <Trash2 className="h-3.5 w-3.5 shrink-0" /> Устгах
      </button>
    </>
  );

  // Оператор болон мастер станцын ЭЭЛЖИЙН эцсийн баталгаа (мастерын маягтын шийдвэр биш).
  const handleShiftApproval = async (row: any) => {
    if (decisionInFlight.current || actionsBusy) return;
    decisionInFlight.current = true;
    setMaintenanceId(`approve:${row.shiftId}`);
    try { await handleAdminFinalApproveClick(row.raw); }
    finally { decisionInFlight.current = false; setMaintenanceId(''); }
  };
  const handleMasterDecision = async (row: ReturnType<typeof masterRowView>, action: 'approve' | 'reject') => {
    if (!onY310Approve || decisionInFlight.current || actionsBusy) return;
    decisionInFlight.current = true;
    setMasterDecisionId(row.logId);
    try {
      const confirmed = await confirmAsync({
        title: action === 'approve' ? 'Мастерын бүртгэлийг баталгаажуулах уу?' : 'Мастерын бүртгэлийг буцаах уу?',
        message: `${row.stationCode} • ${row.shiftDate} • ${row.shiftType} бүртгэлд шийдвэр гаргана.`,
        confirmText: action === 'approve' ? 'Баталгаажуулах' : 'Буцаах',
        danger: action === 'reject',
      });
      if (!confirmed) return;
      await onY310Approve(row.logId, action);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Мастерын бүртгэлд шийдвэр гаргахад алдаа гарлаа.');
    } finally {
      decisionInFlight.current = false;
      setMasterDecisionId('');
    }
  };
  const [tab, setTab] = useState<ApprovalTab>('operator');
  const [state, setState] = useState<ApprovalState>('pending');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [station, setStation] = useState('');
  const [crew, setCrew] = useState('');
  const [query, setQuery] = useState('');
  // operator = оператор станцын ээлж, masterShift = мастер станцын ээлж, master = мастерын маягт.
  const [approvedPages, setApprovedPages] = useState({ operator: 1, masterShift: 1, master: 1 });
  const resetApprovedPages = () => setApprovedPages({ operator: 1, masterShift: 1, master: 1 });
  const changeFilter = (update: () => void) => { update(); resetApprovedPages(); };
  const historyParams = new URLSearchParams({ pageSize: String(APPROVAL_HISTORY_PAGE_SIZE) });
  for (const [key, value] of Object.entries({ since, until, station, crew, query })) {
    if (value) historyParams.set(key, value);
  }
  const historyOptions = (kind: keyof typeof approvedPages) => ({
    refreshInterval: 15000,
    onSuccess: (data: any) => setApprovedPages((pages) => pages[kind] > data.totalPages
      ? { ...pages, [kind]: data.totalPages } : pages),
  });
  const { data: operatorHistory, isLoading: operatorHistoryLoading, error: operatorHistoryError } = useSWR(
    `/api/shifts?queryType=admin_approved&stationKind=operator&page=${approvedPages.operator}&${historyParams}`,
    fetchApprovalHistory, historyOptions('operator')
  );
  const { data: masterShiftHistory, isLoading: masterShiftHistoryLoading, error: masterShiftHistoryError } = useSWR(
    `/api/shifts?queryType=admin_approved&stationKind=master&page=${approvedPages.masterShift}&${historyParams}`,
    fetchApprovalHistory, historyOptions('masterShift')
  );
  const { data: masterHistory, isLoading: masterHistoryLoading, error: masterHistoryError } = useSWR(
    `/api/y310-approvals?state=approved&page=${approvedPages.master}&${historyParams}`,
    fetchApprovalHistory, historyOptions('master')
  );

  /** uid → ажлын баг ('1' | '2' | '3'). Баг нь `users` хүснэгтэд байдаг. */
  const crewByUid = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of localUsers ?? []) {
      const uid = String(u?.id ?? '').trim();
      const group = String(u?.shiftGroup ?? '').trim();
      if (uid && group) map[uid] = group;
    }
    return map;
  }, [localUsers]);

  const hasActiveFilter =
    since !== '' || until !== '' || station !== '' || crew !== '' || query.trim() !== '';
  const clearFilters = () => {
    setSince('');
    setUntil('');
    setStation('');
    setCrew('');
    setQuery('');
    resetApprovedPages();
  };

  /** Таб солиход тухайн таб дээр байхгүй станц сонгогдсон хэвээр үлдэхээс сэргийлнэ. */
  const switchTab = (next: ApprovalTab) => {
    if (next === tab) return;
    setTab(next);
    setStation('');
    resetApprovedPages();
  };

  /**
   * «Дамжлага» сонголт. Нөгөө төрлийн станц (жишээ нь Оператор табаас ҮЯ-410) сонговол тэр станцын
   * таб руу шилжиж шүүлтээ хадгална — станцын мөрүүд зөвхөн өөрийн төрлийн табад л гардаг.
   */
  const selectStation = (code: string) => {
    const nextTab: ApprovalTab = code ? approvalStationKind(code) : tab;
    if (nextTab !== tab) setTab(nextTab);
    changeFilter(() => setStation(code));
  };

  // «Оператор» таб = оператор станцын ээлж. Мастер станцын ээлж (ҮЯ-099 гэх мэт) «Мастер» табад гарна.
  const pendingShiftList = useMemo(() => adminPendingShifts ?? [], [adminPendingShifts]);
  const operatorPending = useMemo(
    () => pendingShiftList.filter((s) => approvalStationKind(s?.stationCode) === 'operator').map(shiftRowView),
    [pendingShiftList]
  );
  const operatorApproved = useMemo(() => (operatorHistory?.shifts ?? []).map(shiftRowView), [operatorHistory?.shifts]);
  // «Мастер» таб = мастер станцын ээлж + мастерын маягт. Нэг ээлж хоёр мөрөөр гарахгүй:
  // /api/y310-approvals нь ээлж эцсийн шатандаа хүрсэн маягтыг хасдаг (PENDING_ADMIN_APPROVAL_WHERE_SQL).
  const masterShiftPending = useMemo(
    () => pendingShiftList.filter((s) => approvalStationKind(s?.stationCode) === 'master').map(masterShiftRowView),
    [pendingShiftList]
  );
  const masterFormPending = useMemo(() => (y310PendingApprovals ?? []).map(masterRowView), [y310PendingApprovals]);
  const masterPending = useMemo(
    () => [...masterShiftPending, ...masterFormPending].sort((a, b) => (a.shiftDate < b.shiftDate ? 1 : a.shiftDate > b.shiftDate ? -1 : 0)),
    [masterShiftPending, masterFormPending]
  );
  const masterShiftApproved = useMemo(() => (masterShiftHistory?.shifts ?? []).map(masterShiftRowView), [masterShiftHistory?.shifts]);
  const masterApproved = useMemo(() => (masterHistory?.approved ?? []).map(masterRowView), [masterHistory?.approved]);
  // Хуваарийг серверийн хүснэгтээр биш ДАМЖЛАГЫН төрлөөр ялгана: оператор хуваарь мастер станцад (эсвэл
  // эсрэгээр) оноогдсон байсан ч таб бүр өөрийн төрлийн станцыг л харуулна. Мөр `kind`-ээ хадгалдаг тул
  // цуцлах/устгах үйлдэл зөв хүснэгтэд хүрнэ.
  const allNotStarted = useMemo(
    () => [...(notStartedOperator ?? []), ...(notStartedMaster ?? [])].map(notStartedRowView),
    [notStartedOperator, notStartedMaster]
  );
  const operatorNotStarted = useMemo(
    () => allNotStarted.filter((r) => approvalStationKind(r.stationCode) === 'operator'),
    [allNotStarted]
  );
  const masterNotStarted = useMemo(
    () => allNotStarted.filter((r) => approvalStationKind(r.stationCode) === 'master'),
    [allNotStarted]
  );

  /** Огноо / дамжлага / ажлын баг / нэрээр шүүнэ. `names` — хайлтад хамрагдах нэрс. */
  const filterRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return <T extends { shiftDate: string; stationCode: string; assigneeUid: string }>(
      rows: T[],
      names: (row: T) => string[]
    ) =>
      rows.filter((row) => {
        const day = row.shiftDate;
        if (since && day && day < since) return false;
        if (until && day && day > until) return false;
        if (station && row.stationCode !== station) return false;
        if (crew && crewByUid[row.assigneeUid] !== crew) return false;
        if (q) {
          const hay = names(row).filter(Boolean).join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [since, until, station, crew, crewByUid, query]);

  const shownOperatorPending = useMemo(
    () => filterRows(operatorPending, (r) => [r.operatorName, r.masterName]),
    [filterRows, operatorPending]
  );
  const shownOperatorApproved = operatorApproved;
  const shownMasterPending = useMemo(
    () => filterRows(masterPending, (r) => [r.handedOver, r.received]),
    [filterRows, masterPending]
  );
  const shownMasterApproved = masterApproved;
  const shownMasterShiftApproved = masterShiftApproved;
  const shownOperatorNotStarted = useMemo(
    () => filterRows(operatorNotStarted, (r) => [r.assigneeName]),
    [filterRows, operatorNotStarted]
  );
  const shownMasterNotStarted = useMemo(
    () => filterRows(masterNotStarted, (r) => [r.assigneeName]),
    [filterRows, masterNotStarted]
  );

  /**
   * Баталгаажсан түүхийн badge, мөрүүд нэг серверийн шүүлтүүртэй хариунаас гарна.
   * Pending болон эхлээгүй жагсаалт нь одоогийн клиент шүүлтээ хэрэглэнэ. Pending badge-ийн хуваалт
   * Нүүрийн картын тоотой ижил (`pendingApprovalCounts`).
   */
  const pendingCounts = pendingApprovalCounts({
    shifts: pendingShiftList,
    shiftTotal: adminPendingTotal,
    formTotal: typeof y310PendingTotal === 'number' ? y310PendingTotal : masterFormPending.length,
  });
  const operatorPendingTotal = hasActiveFilter ? shownOperatorPending.length : pendingCounts.operator;
  const operatorApprovedTotal = operatorHistory?.total ?? 0;
  const masterPendingTotal = hasActiveFilter ? shownMasterPending.length : pendingCounts.master;
  const masterShiftApprovedTotal = masterShiftHistory?.total ?? 0;
  const masterFormApprovedTotal = masterHistory?.total ?? 0;
  const masterApprovedTotal = masterShiftApprovedTotal + masterFormApprovedTotal;

  const isOperator = tab === 'operator';
  const approvedLoading = isOperator ? operatorHistoryLoading : masterHistoryLoading || masterShiftHistoryLoading;
  const approvedError = isOperator ? operatorHistoryError : masterHistoryError || masterShiftHistoryError;
  const pendingCount = isOperator ? operatorPendingTotal : masterPendingTotal;
  const approvedCount = isOperator ? operatorApprovedTotal : masterApprovedTotal;
  const notStartedRows = isOperator ? shownOperatorNotStarted : shownMasterNotStarted;
  const notStartedCount = notStartedRows.length;

  // Хуучин түүхийн станцууд эхний хуудсанд байхгүй ч шүүлтүүрт сонгогдох ёстой.
  // Хоёр табад ч БҮХ станц төрлөөрөө бүлэглэгдэж гарна (одоогийн табынх эхэндээ). Нөгөө табын станцыг
  // сонговол `selectStation` тэр таб руу шилжүүлнэ. Өмнө нь таб бүр зөвхөн өөрийн станцыг санал болгодог
  // байсан тул хуваарьт ҮЯ-410 дээр оноогдсон мастерыг Оператор табаас хайхад ҮЯ-410 олдохгүй, оронд нь
  // ҮЯ-320 (оператор станц, «Цахилгаан автоматжуулалтын засварын бүртгэл») гарч төөрөгдүүлдэг байв.
  const stationOptionGroups = useMemo(() => {
    const source = [
      ...operatorPending, ...operatorApproved, ...operatorNotStarted,
      ...masterPending, ...masterShiftApproved, ...masterApproved, ...masterNotStarted,
    ];
    const knownCodes = [...(stations ?? []).map((station) => station.code), ...Object.values(MASTER_APPROVAL_STATION_BY_LOG_TYPE)];
    const codes = Array.from(new Set([...knownCodes, ...source.map((r) => r.stationCode)].filter(Boolean))).sort();
    const optionsOf = (kind: ApprovalStationKind) => codes
      .filter((code) => approvalStationKind(code) === kind)
      .map((code) => {
        const found = stations?.find((s) => s.code === code);
        return { code, label: found ? `${found.code} — ${found.name}` : code };
      });
    const operatorGroup = {
      kind: 'operator' as const,
      label: isOperator ? 'Операторын дамжлага' : 'Операторын дамжлага — «Оператор» таб',
      options: optionsOf('operator'),
    };
    const masterGroup = {
      kind: 'master' as const,
      label: isOperator ? 'Мастерын дамжлага — «Мастер» таб' : 'Мастерын дамжлага',
      options: optionsOf('master'),
    };
    return (isOperator ? [operatorGroup, masterGroup] : [masterGroup, operatorGroup])
      .filter((group) => group.options.length > 0);
  }, [
    isOperator,
    operatorPending,
    operatorApproved,
    operatorNotStarted,
    masterPending,
    masterShiftApproved,
    masterApproved,
    masterNotStarted,
    stations,
  ]);

  const emptyState = (title: string, hint: string) => (
    <div className="mx-auto flex max-w-sm flex-col items-center justify-center py-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-gray-400">
        <CheckCircle2 className="h-6 w-6" />
      </div>
      <p className="mt-3 font-bold text-gray-600">{title}</p>
      <p className="mt-1 text-xs text-gray-400">{hint}</p>
    </div>
  );

  const stationBadge = (code: string) => (
    <span className="inline-block rounded-lg bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-700">
      {code || '-'}
    </span>
  );

  /** Дамжлагын код + нэр. Мастерын маягтын мөр дээр нэрийн оронд маягтын бүртгэлийн нэр гарна. */
  const stationCell = (row: { stationCode: string; stationName?: string; kind?: ApprovalRecordKind }) => {
    const label = approvalRecordLabel({
      code: row.stationCode,
      stations,
      fallbackName: row.stationName,
      masterForm: row.kind === 'master_form',
    });
    return (
      <>
        {stationBadge(label.code)}
        {label.description && (
          <p className="mt-1.5 text-xs font-medium leading-snug text-gray-600">{label.description}</p>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h4 className="text-xl font-bold text-gray-900">Давхар баталгаажуулалт</h4>
        <p className="text-sm text-gray-500">
          «Оператор» — оператор станцын ээлжийн эцсийн баталгаажуулалт. «Мастер» — мастер станцын ээлжийн эцсийн баталгаажуулалт болон мастерын ээлж хүлээлцэх маягтын баталгаажуулалт.
        </p>
      </div>

      {/* ── Таб: Оператор / Мастер ── */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => switchTab('operator')}
          className={`rounded-xl px-4 py-2.5 text-sm font-black transition-colors ${
            isOperator ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Оператор
          <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${isOperator ? 'bg-white/20' : 'bg-white'}`}>
            {operatorPendingTotal}
          </span>
        </button>
        <button
          type="button"
          onClick={() => switchTab('master')}
          className={`rounded-xl px-4 py-2.5 text-sm font-black transition-colors ${
            !isOperator ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Мастер
          <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${!isOperator ? 'bg-white/20' : 'bg-white'}`}>
            {masterPendingTotal}
          </span>
        </button>
      </div>

      {/* ── Шүүлтүүр ── */}
      <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
          <div className="xl:col-span-2">
            <p className="mb-2 text-xs font-black uppercase tracking-wider text-gray-400">Эхлэх огноо</p>
            <input
              type="date"
              value={since}
              max={until || undefined}
              onChange={(e) => changeFilter(() => setSince(e.target.value))}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-50"
            />
          </div>
          <div className="xl:col-span-2">
            <p className="mb-2 text-xs font-black uppercase tracking-wider text-gray-400">Дуусах огноо</p>
            <input
              type="date"
              value={until}
              min={since || undefined}
              onChange={(e) => changeFilter(() => setUntil(e.target.value))}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-50"
            />
          </div>
          <div className="xl:col-span-3">
            <p className="mb-2 text-xs font-black uppercase tracking-wider text-gray-400">Дамжлага</p>
            <select
              value={station}
              onChange={(e) => selectStation(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-50"
            >
              <option value="">Бүгд</option>
              {stationOptionGroups.map((group) => (
                <optgroup key={group.kind} label={group.label}>
                  {group.options.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="xl:col-span-2">
            <p className="mb-2 text-xs font-black uppercase tracking-wider text-gray-400">Ээлжийн баг</p>
            <select
              value={crew}
              onChange={(e) => changeFilter(() => setCrew(e.target.value))}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-50"
            >
              <option value="">Бүгд</option>
              {SHIFT_GROUP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <p className="mb-2 text-xs font-black uppercase tracking-wider text-gray-400">Хайлт (нэрээр)</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => changeFilter(() => setQuery(e.target.value))}
                  placeholder={isOperator ? 'Оператор / мастерын нэрээр хайх...' : 'Хүлээлгэн өгсөн / хүлээн авсан нэрээр хайх...'}
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-gray-800 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-50"
                />
              </div>
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50"
                >
                  <X className="h-4 w-4" />
                  Арилгах
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Дэд таб: Хүлээгдэж буй / Баталгаажсан ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setState('pending')}
            className={`rounded-lg px-4 py-2 text-xs font-black transition-colors ${
              state === 'pending' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Хүлээгдэж буй ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setState('approved')}
            className={`rounded-lg px-4 py-2 text-xs font-black transition-colors ${
              state === 'approved' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Баталгаажсан ({approvedLoading ? '…' : approvedCount})
          </button>
          <button
            type="button"
            onClick={() => setState('not_started')}
            className={`rounded-lg px-4 py-2 text-xs font-black transition-colors ${
              state === 'not_started' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Хийгдэж эхлээгүй ({notStartedCount})
          </button>
        </div>
        {hasActiveFilter && (
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">
            Шүүлтүүр идэвхтэй
          </span>
        )}
      </div>

      {/* ── Хүснэгт ── */}
      <div className="overflow-x-auto rounded-3xl border border-gray-200 bg-white shadow-sm">
        {state === 'approved' && (approvedLoading || approvedError) && (
          <p role="status" className="px-5 py-4 text-sm text-gray-600">
            {approvedError ? approvedError.message : 'Баталгаажсан түүхийг уншиж байна…'}
          </p>
        )}
        {/* Оператор — хүлээгдэж буй */}
        {isOperator && state === 'pending' && (
          <HorizontalPagedList
            items={shownOperatorPending}
            renderPage={(page) => (
              <table className="w-full min-w-[1100px] table-fixed text-left">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-4 font-bold">Огноо</th>
                    <th className="w-44 px-5 py-4 font-bold">Дамжлага</th>
                    <th className="px-5 py-4 font-bold">Ээлж</th>
                    <th className="px-5 py-4 font-bold">Оператор</th>
                    <th className="px-5 py-4 font-bold">Мастер</th>
                    <th className="px-5 py-4 font-bold">Мастерын огноо</th>
                    <th className="w-56 px-5 py-4 text-right font-bold">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shownOperatorPending.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center">
                        {emptyState(
                          hasActiveFilter ? 'Шүүлтүүрт тохирох ээлж олдсонгүй.' : 'Баталгаажуулах ээлж одоогоор байхгүй байна.',
                          hasActiveFilter ? 'Шүүлтүүрээ өөрчилж дахин үзнэ үү.' : 'Мастер баталгаажуулсан ээлжүүд энд харагдана.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    page.map((r: any) => (
                      <tr key={r.key} className="transition-colors hover:bg-gray-50">
                        <td className="break-words px-5 py-5 text-sm font-medium text-gray-900">{r.shiftDate || '-'}</td>
                        <td className="break-words px-5 py-5">{stationCell(r)}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-600">{r.shiftType || '-'}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-800">{r.operatorName || '-'}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-600">{r.masterName || '-'}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-500">
                          {r.masterAt ? mnDateTimeCompact(r.masterAt) : '-'}
                        </td>
                        <td className="px-5 py-5 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Link
                              href={`/shift/${r.shiftId}`}
                              className="inline-block rounded-lg border border-orange-200 bg-white px-4 py-2 text-xs font-bold text-orange-700 transition-colors hover:bg-orange-50"
                            >
                              Нээх
                            </Link>
                            <button
                              type="button"
                              disabled={actionsBusy}
                              onClick={() => void handleShiftApproval(r)}
                              className="rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {adminFinalApprovingId === r.shiftId ? 'Хадгалж байна...' : 'Эцсийн баталгаажуулах'}
                            </button>
                            {maintenanceButtons(r, 'shift')}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          />
        )}

        {/* Оператор — баталгаажсан */}
        {isOperator && state === 'approved' && (
          <HorizontalPagedList
            items={shownOperatorApproved}
            pageSize={APPROVAL_HISTORY_PAGE_SIZE}
            pagination={{ page: approvedPages.operator, total: operatorApprovedTotal, onPageChange: (page) => setApprovedPages((pages) => ({ ...pages, operator: page })) }}
            renderPage={(page) => (
              <table className="w-full min-w-[1100px] table-fixed text-left">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-4 font-bold">Огноо</th>
                    <th className="w-40 px-5 py-4 font-bold">Дамжлага</th>
                    <th className="w-26 px-5 py-4 font-bold">Ээлж</th>
                    <th className="px-5 py-4 font-bold">Оператор</th>
                    <th className="px-5 py-4 font-bold">Мастер</th>
                    <th className="px-5 py-4 font-bold">Эцэслэн баталсан</th>
                    <th className="px-5 py-4 font-bold">Баталсан огноо</th>
                    <th className="w-52 px-5 py-4 text-right font-bold">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shownOperatorApproved.length === 0 && !approvedLoading && !approvedError ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center">
                        {emptyState(
                          hasActiveFilter ? 'Шүүлтүүрт тохирох бүртгэл олдсонгүй.' : 'Эцсийн баталгаажуулсан бүртгэл байхгүй байна.',
                          hasActiveFilter ? 'Шүүлтүүрээ өөрчилж дахин үзнэ үү.' : 'Админ баталсан ээлжүүдийн түүх энд нэмэгдэнэ.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    page.map((r: any) => (
                      <tr key={r.key} className="transition-colors hover:bg-gray-50">
                        <td className="break-words px-5 py-5 text-sm font-medium text-gray-900">{r.shiftDate || '-'}</td>
                        <td className="break-words px-5 py-5">{stationCell(r)}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-600">{r.shiftType || '-'}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-800">{r.operatorName || '-'}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-600">{r.masterName || '-'}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-600">{r.adminApprovedBy || '-'}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-500">
                          {r.adminApprovedDate ? mnDateTimeCompact(r.adminApprovedDate) : '-'}
                        </td>
                        <td className="px-5 py-5 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            href={`/shift/${r.shiftId}`}
                            className="inline-flex rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-gray-800"
                          >
                            Нээх
                          </Link>
                          {maintenanceButtons(r, 'shift')}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          />
        )}

        {/* Мастер — хүлээгдэж буй */}
        {!isOperator && state === 'pending' && (
          <HorizontalPagedList
            items={shownMasterPending}
            renderPage={(page) => (
              <table className="w-full min-w-[1100px] table-fixed text-left">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-4 font-bold">Огноо</th>
                    <th className="w-56 px-5 py-4 font-bold">Дамжлага</th>
                    <th className="px-5 py-4 font-bold">Ээлж</th>
                    <th className="px-5 py-4 font-bold">Хүлээлгэн өгсөн</th>
                    <th className="px-5 py-4 font-bold">Хүлээн авсан</th>
                    <th className="w-56 px-5 py-4 text-right font-bold">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shownMasterPending.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center">
                        {emptyState(
                          hasActiveFilter ? 'Шүүлтүүрт тохирох бүртгэл олдсонгүй.' : 'Батлах мастерын бүртгэл байхгүй байна.',
                          hasActiveFilter
                            ? 'Шүүлтүүрээ өөрчилж дахин үзнэ үү.'
                            : 'Мастер станцын ээлж болон дараагийн мастерын хуваарь олдоогүй бүртгэлүүд энд харагдана.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    page.map((r: any) => (
                      <tr key={`${r.kind}:${r.key}`} className="transition-colors hover:bg-gray-50">
                        <td className="break-words px-5 py-5 text-sm font-medium text-gray-900">{r.shiftDate || '-'}</td>
                        <td className="break-words px-5 py-5">{stationCell(r)}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-600">{r.shiftType || '-'}</td>
                        <td className="break-words px-5 py-5 text-sm font-medium text-gray-800">{r.handedOver || '-'}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-600">{r.received || '-'}</td>
                        <td className="px-5 py-5 text-right">
                          {r.kind === 'shift' ? (
                            // Мастер станцын ЭЭЛЖ — оператор ээлжийн адил эцсийн баталгаа.
                            <div className="flex flex-wrap justify-end gap-2">
                              <Link
                                href={`/shift/${r.shiftId}`}
                                className="inline-block rounded-lg border border-orange-200 bg-white px-4 py-2 text-xs font-bold text-orange-700 transition-colors hover:bg-orange-50"
                              >
                                Нээх
                              </Link>
                              <button
                                type="button"
                                disabled={actionsBusy}
                                onClick={() => void handleShiftApproval(r)}
                                className="rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {adminFinalApprovingId === r.shiftId ? 'Хадгалж байна...' : 'Эцсийн баталгаажуулах'}
                              </button>
                              {maintenanceButtons(r, 'shift')}
                            </div>
                          ) : (
                            <div className="flex flex-wrap justify-end gap-2">
                              <Link
                                href={`/shift/${r.shiftId}`}
                                className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50"
                              >
                                Нээх
                              </Link>
                              <button
                                type="button"
                                disabled={!onY310Approve || actionsBusy}
                                onClick={() => void handleMasterDecision(r, 'reject')}
                                className="rounded-lg border border-red-200 px-4 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {masterDecisionId === r.logId ? 'Хүлээнэ үү...' : 'Буцаах'}
                              </button>
                              <button
                                type="button"
                                disabled={!onY310Approve || actionsBusy}
                                onClick={() => void handleMasterDecision(r, 'approve')}
                                className="rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {masterDecisionId === r.logId ? 'Хүлээнэ үү...' : 'Баталгаажуулах'}
                              </button>
                              {maintenanceButtons(r, 'master_form')}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          />
        )}

        {/* Хийгдэж эхлээгүй — Оператор/Мастер хоёуланд ижил бүтэцтэй */}
        {state === 'not_started' && (
          <HorizontalPagedList
            items={notStartedRows}
            renderPage={(page) => (
              <table className="w-full min-w-[1000px] table-fixed text-left">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-4 font-bold">Огноо</th>
                    <th className="w-52 px-5 py-4 font-bold">Дамжлага</th>
                    <th className="px-5 py-4 font-bold">Ээлж</th>
                    <th className="px-5 py-4 font-bold">{isOperator ? 'Оператор' : 'Мастер'}</th>
                    <th className="px-5 py-4 font-bold">Төлөв</th>
                    <th className="w-56 px-5 py-4 text-right font-bold">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {notStartedRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center">
                        {emptyState(
                          hasActiveFilter
                            ? 'Шүүлтүүрт тохирох хуваарь олдсонгүй.'
                            : 'Эхлээгүй хуваарь байхгүй байна.',
                          hasActiveFilter
                            ? 'Шүүлтүүрээ өөрчилж дахин үзнэ үү.'
                            : 'Хуваарьт орсон хэрнээ ээлж эхлүүлээгүй ажилтнууд энд харагдана.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    page.map((r: any) => (
                      <tr key={r.key} className="transition-colors hover:bg-gray-50">
                        <td className="break-words px-5 py-5 text-sm font-medium text-gray-900">{r.shiftDate || '-'}</td>
                        <td className="break-words px-5 py-5">{stationCell(r)}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-600">{r.shiftType || '-'}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-800">{r.assigneeName || '-'}</td>
                        <td className="break-words px-5 py-5">
                          <span className="inline-block rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                            Эхлээгүй
                          </span>
                        </td>
                        <td className="px-5 py-5 text-right">
                          <div className="flex flex-wrap justify-end gap-2">{maintenanceButtons(r, r.kind)}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          />
        )}

        {/* Мастер — баталгаажсан: мастер станцын ЭЭЛЖ (эцсийн баталгаа) ба мастерын МАЯГТ нь өөр өөр
            серверийн жагсаалт тул тус тусдаа хуудаслагдана (нэг хүснэгтэд нийлүүлбэл хуудас буруу болно). */}
        {!isOperator && state === 'approved' && (
          <>
          <h5 className="px-5 pt-5 text-sm font-black text-gray-700">
            Ээлжийн эцсийн баталгаа ({approvedLoading ? '…' : masterShiftApprovedTotal})
          </h5>
          <HorizontalPagedList
            items={shownMasterShiftApproved}
            pageSize={APPROVAL_HISTORY_PAGE_SIZE}
            pagination={{ page: approvedPages.masterShift, total: masterShiftApprovedTotal, onPageChange: (page) => setApprovedPages((pages) => ({ ...pages, masterShift: page })) }}
            renderPage={(page) => (
              <table className="w-full min-w-[1100px] table-fixed text-left">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-4 font-bold">Огноо</th>
                    <th className="w-52 px-5 py-4 font-bold">Дамжлага</th>
                    <th className="px-5 py-4 font-bold">Ээлж</th>
                    <th className="px-5 py-4 font-bold">Хүлээлгэн өгсөн</th>
                    <th className="px-5 py-4 font-bold">Хүлээн авсан</th>
                    <th className="px-5 py-4 font-bold">Эцэслэн баталсан</th>
                    <th className="px-5 py-4 font-bold">Баталсан огноо</th>
                    <th className="w-52 px-5 py-4 text-right font-bold">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shownMasterShiftApproved.length === 0 && !approvedLoading && !approvedError ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center">
                        {emptyState(
                          hasActiveFilter ? 'Шүүлтүүрт тохирох бүртгэл олдсонгүй.' : 'Эцсийн баталгаажуулсан мастерын ээлж байхгүй байна.',
                          hasActiveFilter ? 'Шүүлтүүрээ өөрчилж дахин үзнэ үү.' : 'Админ баталсан мастер станцын ээлжүүд энд нэмэгдэнэ.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    page.map((r: any) => (
                      <tr key={r.key} className="transition-colors hover:bg-gray-50">
                        <td className="break-words px-5 py-5 text-sm font-medium text-gray-900">{r.shiftDate || '-'}</td>
                        <td className="break-words px-5 py-5">{stationCell(r)}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-600">{r.shiftType || '-'}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-800">{r.handedOver || '-'}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-600">{r.received || '-'}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-600">{r.adminApprovedBy || '-'}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-500">
                          {r.adminApprovedDate ? mnDateTimeCompact(r.adminApprovedDate) : '-'}
                        </td>
                        <td className="px-5 py-5 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Link
                              href={`/shift/${r.shiftId}`}
                              className="inline-flex rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-gray-800"
                            >
                              Нээх
                            </Link>
                            {maintenanceButtons(r, 'shift')}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          />
          <h5 className="border-t border-gray-100 px-5 pt-5 text-sm font-black text-gray-700">
            Мастерын маягтын баталгаа ({approvedLoading ? '…' : masterFormApprovedTotal})
          </h5>
          <HorizontalPagedList
            items={shownMasterApproved}
            pageSize={APPROVAL_HISTORY_PAGE_SIZE}
            pagination={{ page: approvedPages.master, total: masterFormApprovedTotal, onPageChange: (page) => setApprovedPages((pages) => ({ ...pages, master: page })) }}
            renderPage={(page) => (
              <table className="w-full min-w-[1100px] table-fixed text-left">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-4 font-bold">Огноо</th>
                    <th className="w-52 px-5 py-4 font-bold">Дамжлага</th>
                    <th className="px-5 py-4 font-bold">Ээлж</th>
                    <th className="px-5 py-4 font-bold">Хүлээлгэн өгсөн</th>
                    <th className="px-5 py-4 font-bold">Хүлээн авсан</th>
                    <th className="px-5 py-4 font-bold">Баталгаажуулсан</th>
                    <th className="w-56 px-5 py-4 text-right font-bold">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shownMasterApproved.length === 0 && !approvedLoading && !approvedError ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center">
                        {emptyState(
                          hasActiveFilter ? 'Шүүлтүүрт тохирох бүртгэл олдсонгүй.' : 'Баталгаажсан мастерын бүртгэл байхгүй байна.',
                          hasActiveFilter ? 'Шүүлтүүрээ өөрчилж дахин үзнэ үү.' : 'Админ баталсан мастерын маягтууд энд нэмэгдэнэ.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    page.map((r: any) => (
                      <tr key={r.key} className="transition-colors hover:bg-gray-50">
                        <td className="break-words px-5 py-5 text-sm font-medium text-gray-900">{r.shiftDate || '-'}</td>
                        <td className="break-words px-5 py-5">{stationCell(r)}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-600">{r.shiftType || '-'}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-800">{r.handedOver || '-'}</td>
                        <td className="break-words px-5 py-5 text-sm text-gray-600">{r.received || '-'}</td>
                        <td className="break-words px-5 py-5 text-xs text-gray-500">{r.approvedBy || '-'}</td>
                        <td className="px-5 py-5 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            href={`/shift/${r.shiftId}`}
                            className="inline-flex rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-gray-800"
                          >
                            Нээх
                          </Link>
                          {maintenanceButtons(r, 'master_form')}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          />
          </>
        )}
      </div>
    </div>
  );
}
