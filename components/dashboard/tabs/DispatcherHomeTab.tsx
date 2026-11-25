import Link from 'next/link';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  FileWarning,
  Radio,
  Search,
  Users,
} from 'lucide-react';
import { MASTER_STATION_CODES } from '@/lib/master-stations';

type DispatcherHomeTabProps = {
  selectedDate: string;
  setSelectedDate: (value: string) => void;
  selectedShiftType: 'Өдрийн' | 'Шөнийн';
  setSelectedShiftType: (value: 'Өдрийн' | 'Шөнийн') => void;
  dispatcherStation: string;
  setDispatcherStation: (value: string) => void;
  dispatcherOperatorQ: string;
  setDispatcherOperatorQ: (value: string) => void;
  stations: any[];
  compliance?: any;
  complianceLoading?: boolean;
  complianceError?: unknown;
  lastSyncAt?: Date | string | null;
  deviceOnline: boolean;
  setActiveTab: (tab: any) => void;
  openSchedule: () => void;
};

type AttentionRow = {
  id: string;
  kind: 'late' | 'early' | 'missing' | 'handover' | 'pending';
  title: string;
  detail: string;
  meta: string;
  shiftId?: string | null;
};

function norm(value: unknown) {
  return String(value ?? '').trim();
}

function normDate(value: unknown) {
  return norm(value).slice(0, 10);
}

function stationCodeOf(row: any) {
  return norm(row?.stationCode || row?.station);
}

function operatorNameOf(row: any) {
  return norm(row?.operatorName || row?.assigneeName);
}

function rowMatches(
  row: any,
  selectedDate: string,
  selectedShiftType: string,
  selectedStation: string,
  operatorQuery: string
) {
  const date = normDate(row?.shiftDate);
  const shiftType = norm(row?.shiftType);
  const stationCode = stationCodeOf(row);
  const operatorName = operatorNameOf(row).toLocaleLowerCase('mn');
  return (
    date === selectedDate &&
    shiftType === selectedShiftType &&
    (selectedStation === 'all' || stationCode === selectedStation) &&
    (!operatorQuery || operatorName.includes(operatorQuery))
  );
}

function uniqueRows(rows: any[], keyOf: (row: any) => string) {
  const result = new Map<string, any>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key && !result.has(key)) result.set(key, row);
  }
  return Array.from(result.values());
}

function syncLabel(value: DispatcherHomeTabProps['lastSyncAt']) {
  const parsed = value instanceof Date ? value : value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return 'Синк хүлээгдэж байна';
  return parsed.toLocaleString('mn-MN', {
    timeZone: 'Asia/Ulaanbaatar',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: unknown) {
  const value = norm(status);
  return value || 'Төлөвгүй';
}

export function DispatcherHomeTab({
  selectedDate,
  setSelectedDate,
  selectedShiftType,
  setSelectedShiftType,
  dispatcherStation,
  setDispatcherStation,
  dispatcherOperatorQ,
  setDispatcherOperatorQ,
  stations,
  compliance,
  complianceLoading = false,
  complianceError,
  lastSyncAt,
  deviceOnline,
  setActiveTab,
  openSchedule,
}: DispatcherHomeTabProps) {
  const operatorQuery = norm(dispatcherOperatorQ).toLocaleLowerCase('mn');
  const matches = (row: any) =>
    rowMatches(row, selectedDate, selectedShiftType, dispatcherStation, operatorQuery);
  const filteredOperatorRows = uniqueRows(
    (Array.isArray(compliance?.summary?.operatorRows) ? compliance.summary.operatorRows : []).filter(matches),
    (row) => norm(row?.id)
  );
  const missingRows = (Array.isArray(compliance?.missingRows) ? compliance.missingRows : []).filter(matches);
  const lateRows = (Array.isArray(compliance?.lateRows) ? compliance.lateRows : []).filter(matches);
  const earlyRows = (Array.isArray(compliance?.earlyRows) ? compliance.earlyRows : []).filter(matches);
  const filteredPending = filteredOperatorRows.filter((row) => row?.pendingApproval === true);
  const filteredHandovers = filteredOperatorRows.filter((row) => row?.pendingHandover === true);
  const scheduledCount = filteredOperatorRows.filter((row) => row?.scheduled === true).length;
  const startedCount = filteredOperatorRows.filter((row) => row?.started === true).length;
  const activeCount = filteredOperatorRows.filter((row) => row?.active === true).length;
  const approvedCount = filteredOperatorRows.filter((row) => row?.approved === true).length;
  const notStartedCount = filteredOperatorRows.filter((row) => row?.notStarted === true).length;
  const completionPct =
    startedCount > 0 ? Math.round((approvedCount / startedCount) * 100) : 0;

  const stationOptions = (() => {
    const byCode = new Map<string, string>();
    for (const station of Array.isArray(stations) ? stations : []) {
      if (station?.isActive === false) continue;
      const code = norm(station?.code);
      if (code) byCode.set(code, norm(station?.name) || code);
    }
    for (const row of [
      ...(Array.isArray(compliance?.summary?.stationRows) ? compliance.summary.stationRows : []),
      ...filteredOperatorRows,
      ...missingRows,
      ...lateRows,
      ...earlyRows,
    ]) {
      const code = stationCodeOf(row);
      if (code && !byCode.has(code)) byCode.set(code, norm(row?.stationName) || code);
    }
    return Array.from(byCode, ([code, name]) => ({ code, name })).sort((a, b) =>
      a.code.localeCompare(b.code, 'mn')
    );
  })();

  const masterCodes = new Set<string>(MASTER_STATION_CODES as readonly string[]);
  const masterShiftRows: any[] = Array.isArray(compliance?.summary?.masterShiftRows)
    ? compliance.summary.masterShiftRows
    : [];

  const stationRows = stationOptions
    .filter((station) => !masterCodes.has(station.code))
    .map((station) => {
      const byStation = (row: any) => stationCodeOf(row) === station.code;
      const operatorRows = filteredOperatorRows.filter(byStation);
      const operatorNames = Array.from(
        new Set(
          operatorRows.map(operatorNameOf).filter(Boolean)
        )
      );
      const scheduledCount = operatorRows.filter((row) => row?.scheduled === true).length;
      const startedCount = operatorRows.filter((row) => row?.started === true).length;
      const activeCount = operatorRows.filter((row) => row?.active === true).length;
      const approvedCount = operatorRows.filter((row) => row?.approved === true).length;
      const missingCount = operatorRows.filter((row) => row?.missing === true).length;
      const lateCount = operatorRows.filter((row) => row?.late === true).length;
      const earlyCount = operatorRows.filter((row) => row?.early === true).length;
      const pendingApprovalCount = operatorRows.filter((row) => row?.pendingApproval === true).length;
      const pendingHandoverCount = operatorRows.filter((row) => row?.pendingHandover === true).length;
      const coveragePct =
        scheduledCount > 0
          ? Math.min(100, Math.round((startedCount / scheduledCount) * 100))
          : startedCount > 0
            ? 100
            : 0;
      const attentionCount = missingCount + lateCount + earlyCount;
      const state =
        attentionCount > 0
          ? { label: 'Анхаарах', className: 'border-red-200 bg-red-50 text-red-700' }
          : activeCount > 0
            ? { label: 'Идэвхтэй', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
            : startedCount > 0
              ? { label: 'Бүртгэлтэй', className: 'border-blue-200 bg-blue-50 text-blue-700' }
              : scheduledCount > 0
                ? { label: 'Эхлээгүй', className: 'border-amber-200 bg-amber-50 text-amber-700' }
                : { label: 'Мэдээлэлгүй', className: 'border-gray-200 bg-gray-50 text-gray-500' };

      return {
        ...station,
        scheduledCount,
        startedCount,
        activeCount,
        approvedCount,
        missingCount,
        lateCount,
        earlyCount,
        pendingApprovalCount,
        pendingHandoverCount,
        coveragePct,
        operatorNames,
        state,
      };
    })
    .filter(
      (row) =>
        dispatcherStation !== 'all'
          ? row.code === dispatcherStation
          : row.scheduledCount > 0 ||
            row.startedCount > 0 ||
            row.missingCount > 0 ||
            row.lateCount > 0 ||
            row.earlyCount > 0 ||
            row.pendingHandoverCount > 0
    );

  const attentionRows: AttentionRow[] = [
    ...lateRows.map((row: any) => ({
      id: `late:${norm(row?.id || row?.shiftId)}`,
      kind: 'late' as const,
      title: `${stationCodeOf(row) || 'Дамжлагагүй'} · ${operatorNameOf(row) || 'Операторгүй'}`,
      detail:
        norm(row?.handoverTimingReason || row?.handoverTimingStatus) ||
        'Ээлжийн бүртгэлийн хугацааны зөрүү илэрсэн.',
      meta:
        row?.timingDeviationMinutes != null
          ? `${Number(row.timingDeviationMinutes)} минутын зөрүү`
          : statusLabel(row?.status),
      shiftId: norm(row?.shiftId) || null,
    })),
    ...earlyRows.map((row: any) => ({
      id: `early:${norm(row?.id || row?.shiftId)}`,
      kind: 'early' as const,
      title: `${stationCodeOf(row) || 'Дамжлагагүй'} · ${operatorNameOf(row) || 'Операторгүй'}`,
      detail:
        norm(row?.handoverTimingReason || row?.handoverTimingStatus) ||
        'Ээлжийн бүртгэлийг стандарт хугацаанаас эрт үүсгэсэн.',
      meta:
        row?.timingDeviationMinutes != null
          ? `${Number(row.timingDeviationMinutes)} минут эрт`
          : statusLabel(row?.status),
      shiftId: norm(row?.shiftId) || null,
    })),
    ...missingRows.map((row: any) => ({
      id: `missing:${norm(row?.id || row?.shiftId || row?.scheduleId)}`,
      kind: 'missing' as const,
      title: `${stationCodeOf(row) || 'Дамжлагагүй'} · ${operatorNameOf(row) || 'Операторгүй'}`,
      detail: (Array.isArray(row?.missing) ? row.missing : []).join(', ') || statusLabel(row?.status),
      meta: statusLabel(row?.status),
      shiftId: norm(row?.shiftId) || null,
    })),
    ...filteredHandovers.map((row: any) => ({
      id: `handover:${norm(row?.shiftId || row?.id)}`,
      kind: 'handover' as const,
      title: `${stationCodeOf(row) || 'Дамжлагагүй'} · ${operatorNameOf(row) || 'Операторгүй'}`,
      detail: `Хүлээлцэх: ${operatorNameOf(row) || '—'} → ${norm(row?.handoverToOperatorName) || 'Хүлээн авагчгүй'}`,
      meta: statusLabel(row?.handoverStage || row?.status),
      shiftId: norm(row?.shiftId) || null,
    })),
    ...filteredPending.map((row: any) => ({
      id: `pending:${norm(row?.shiftId || row?.id)}`,
      kind: 'pending' as const,
      title: `${stationCodeOf(row) || 'Дамжлагагүй'} · ${operatorNameOf(row) || 'Операторгүй'}`,
      detail: 'Бүртгэл баталгаажуулалт хүлээж байна.',
      meta: statusLabel(row?.status),
      shiftId: norm(row?.shiftId) || null,
    })),
  ];

  const attentionTone = {
    late: {
      icon: Clock3,
      iconClass: 'bg-red-100 text-red-700',
      badgeClass: 'bg-red-50 text-red-700',
      label: 'Хоцролт',
    },
    early: {
      icon: Clock3,
      iconClass: 'bg-cyan-100 text-cyan-700',
      badgeClass: 'bg-cyan-50 text-cyan-700',
      label: 'Эрт эхэлсэн',
    },
    missing: {
      icon: FileWarning,
      iconClass: 'bg-amber-100 text-amber-700',
      badgeClass: 'bg-amber-50 text-amber-700',
      label: 'Дутуу',
    },
    handover: {
      icon: Users,
      iconClass: 'bg-blue-100 text-blue-700',
      badgeClass: 'bg-blue-50 text-blue-700',
      label: 'Хүлээлцэх',
    },
    pending: {
      icon: CircleDot,
      iconClass: 'bg-violet-100 text-violet-700',
      badgeClass: 'bg-violet-50 text-violet-700',
      label: 'Хүлээгдэж буй',
    },
  };

  const summaryCards = [
    {
      label: 'Хуваарьтай',
      value: scheduledCount,
      detail: notStartedCount > 0 ? `${notStartedCount} ээлж эхлээгүй` : 'Хуваарийн мөр',
      icon: CalendarDays,
      iconClass: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Идэвхтэй',
      value: activeCount,
      detail: 'Одоо ажиллаж буй ээлж',
      icon: Radio,
      iconClass: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Баталгаажсан',
      value: approvedCount,
      detail: `${completionPct}% гүйцэтгэл`,
      icon: CheckCircle2,
      iconClass: 'bg-teal-50 text-teal-700',
    },
    {
      label: 'Дутуу бүртгэл',
      value: missingRows.length,
      detail: compliance?.slotElapsed === false ? 'Шалгах хугацаа үргэлжилж байна' : 'Засварлуулах шаардлагатай',
      icon: FileWarning,
      iconClass: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Хоцролт',
      value: lateRows.length,
      detail: `${filteredHandovers.length} хүлээлцэх хүлээгдэж байна`,
      icon: AlertTriangle,
      iconClass: 'bg-red-50 text-red-700',
    },
  ];
  const chartMax = Math.max(
    1,
    ...stationRows.map((row) =>
      Math.max(
        row.scheduledCount,
        row.startedCount,
        row.activeCount,
        row.approvedCount,
        row.missingCount,
        row.lateCount,
        row.earlyCount,
        row.pendingHandoverCount
      )
    )
  );
  const chartBarHeight = (value: number) =>
    value > 0 ? Math.max(8, Math.round((value / chartMax) * 144)) : 0;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">
            Диспетчерийн хяналт
          </p>
          <h2 className="mt-1 text-2xl font-black text-gray-950">Ээлжийн нэгдсэн төлөв</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Хуваарь, идэвхтэй ээлж, хоцролт, дутуу бүртгэл болон хүлээлцэх хүсэлтийг нэг дор хянана.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 ${
              deviceOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${deviceOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {deviceOnline ? 'Онлайн' : 'Офлайн'}
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-2 text-gray-600">
            Сүүлийн синк: {syncLabel(lastSyncAt)}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[11rem_10rem_minmax(15rem,1fr)_minmax(15rem,1fr)_auto]">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-500">
              Огноо
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-500">
              Ээлж
            </span>
            <select
              value={selectedShiftType}
              onChange={(event) =>
                setSelectedShiftType(event.target.value as DispatcherHomeTabProps['selectedShiftType'])
              }
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            >
              <option value="Өдрийн">Өдрийн</option>
              <option value="Шөнийн">Шөнийн</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-500">
              Дамжлага
            </span>
            <select
              value={dispatcherStation}
              onChange={(event) => setDispatcherStation(event.target.value)}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            >
              <option value="all">Бүх дамжлага</option>
              {stationOptions.map((station) => (
                <option key={station.code} value={station.code}>
                  {station.code} · {station.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-gray-500">
              Оператор
            </span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={dispatcherOperatorQ}
                onChange={(event) => setDispatcherOperatorQ(event.target.value)}
                placeholder="Нэрээр хайх"
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm font-semibold text-gray-800 outline-none transition placeholder:font-normal focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </span>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setDispatcherStation('all');
                setDispatcherOperatorQ('');
              }}
              disabled={dispatcherStation === 'all' && !dispatcherOperatorQ}
              className="h-11 w-full rounded-xl bg-gray-100 px-4 text-sm font-black text-gray-700 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-45 xl:w-auto"
            >
              Цэвэрлэх
            </button>
          </div>
        </div>
      </div>

      {complianceError ? (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-black">Хоцролт, дутуу бүртгэлийн мэдээлэл ачаалсангүй.</p>
            <p className="mt-1 text-red-700">Бусад ээлжийн мэдээлэл хэвийн харагдана.</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-gray-500">{card.label}</p>
                  <p className="mt-2 text-3xl font-black text-gray-950">
                    {complianceLoading && (card.label === 'Дутуу бүртгэл' || card.label === 'Хоцролт')
                      ? '...'
                      : card.value}
                  </p>
                </div>
                <span className={`rounded-xl p-2.5 ${card.iconClass}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-3 text-xs font-semibold text-gray-500">{card.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-black text-gray-950">Дамжлагын хяналтын график</h3>
            <p className="mt-1 text-sm text-gray-500">
              Сонгосон нөхцөл дэх хуваарь, эхэлсэн болон идэвхтэй ээлж, илэрсэн зөрчлийн харьцуулалт
            </p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-black text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              Хуваарь
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
              Эхэлсэн
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Идэвхтэй
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
              Баталгаажсан
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              Дутуу
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              Хоцролт
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
              Эрт
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
              Хүлээлцэх
            </span>
          </div>
        </div>
        {stationRows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm font-semibold text-gray-500">
            График харуулах өгөгдөл алга.
          </div>
        ) : (
          <div className="overflow-x-auto px-5 pb-5 pt-6">
            <div
              className="grid min-w-max items-end gap-3"
              style={{
                gridTemplateColumns: `repeat(${stationRows.length}, minmax(88px, 1fr))`,
                width: `max(100%, ${stationRows.length * 104}px)`,
              }}
            >
              {stationRows.map((row) => {
                const values = [
                  { label: 'Хуваарь', value: row.scheduledCount, className: 'bg-blue-500' },
                  { label: 'Эхэлсэн', value: row.startedCount, className: 'bg-violet-500' },
                  { label: 'Идэвхтэй', value: row.activeCount, className: 'bg-emerald-500' },
                  { label: 'Баталгаажсан', value: row.approvedCount, className: 'bg-teal-500' },
                  { label: 'Дутуу', value: row.missingCount, className: 'bg-amber-500' },
                  { label: 'Хоцролт', value: row.lateCount, className: 'bg-red-500' },
                  { label: 'Эрт', value: row.earlyCount, className: 'bg-cyan-500' },
                  { label: 'Хүлээлцэх', value: row.pendingHandoverCount, className: 'bg-orange-500' },
                ];
                return (
                  <div key={row.code} className="min-w-0">
                    <div className="flex h-44 items-end justify-center gap-1 rounded-xl border border-gray-100 bg-gray-50 px-2 pb-2 pt-4">
                      {values.map((item) => (
                        <div key={item.label} className="flex h-full w-3 flex-col items-center justify-end">
                          <span className="mb-1 text-[9px] font-black text-gray-500">{item.value}</span>
                          <div
                            className={`w-full rounded-t ${item.className} transition-[height]`}
                            style={{ height: `${chartBarHeight(item.value)}px` }}
                            title={`${row.code} · ${item.label}: ${item.value}`}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 truncate text-center text-xs font-black text-gray-800" title={`${row.code} · ${row.name}`}>
                      {row.code}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-black text-gray-950">Бүртгэлийн гүйцэтгэл</h3>
              <p className="mt-1 text-sm text-gray-500">Сонгосон ээлжийн баталгаажуулалтын төлөв</p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-700">
              {startedCount} бүртгэл
            </span>
          </div>
          <div className="mt-6">
            <div className="flex items-end justify-between gap-4">
              <p className="text-4xl font-black text-gray-950">{completionPct}%</p>
              <p className="text-right text-xs font-bold text-gray-500">
                {approvedCount} баталгаажсан
                <br />
                {Math.max(0, startedCount - approvedCount)} баталгаажаагүй
              </p>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width]"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className="rounded-xl bg-orange-600 px-4 py-3 text-sm font-black text-white transition hover:bg-orange-700"
            >
              Хоцролт, дутуу
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all-entries')}
              className="rounded-xl bg-gray-100 px-4 py-3 text-sm font-black text-gray-800 transition hover:bg-gray-200"
            >
              Бүх бүртгэл
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div>
              <h3 className="font-black text-gray-950">Анхаарах зүйл</h3>
              <p className="mt-1 text-sm text-gray-500">
                Хоцролт, дутуу бүртгэл, хүлээлцэх болон баталгаажуулалт
              </p>
            </div>
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
              {attentionRows.length}
            </span>
          </div>
          <div className="max-h-[24rem] divide-y divide-gray-100 overflow-y-auto">
            {complianceLoading ? (
              <div className="p-8 text-center text-sm font-semibold text-gray-500">
                Хяналтын мэдээлэл ачаалж байна...
              </div>
            ) : attentionRows.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                <p className="mt-3 font-black text-gray-900">Анхаарах бүртгэл алга</p>
                <p className="mt-1 text-sm text-gray-500">Сонгосон нөхцөлд ээлжийн явц хэвийн байна.</p>
              </div>
            ) : (
              attentionRows.map((row) => {
                const tone = attentionTone[row.kind];
                const Icon = tone.icon;
                const content = (
                  <>
                    <span className={`mt-0.5 rounded-xl p-2 ${tone.iconClass}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-gray-900">{row.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${tone.badgeClass}`}>
                          {tone.label}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-gray-600">{row.detail}</span>
                      <span className="mt-1 block text-xs font-semibold text-gray-400">{row.meta}</span>
                    </span>
                    {row.shiftId ? <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-gray-400" /> : null}
                  </>
                );
                return row.shiftId ? (
                  <Link
                    key={row.id}
                    href={`/shift/${row.shiftId}`}
                    className="flex items-start gap-3 px-5 py-4 transition hover:bg-gray-50"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={row.id} className="flex items-start gap-3 px-5 py-4">
                    {content}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Master station forms section */}
      <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
        <div className="px-5 py-4 border-b border-blue-100 bg-blue-50/50">
          <h3 className="font-black text-gray-950">Мастерын ээлж хүлээлцэх бүртгэл</h3>
          <p className="mt-1 text-sm text-gray-500">ҮЯ-099, ҮЯ-310, ҮЯ-410 мастерын ээлж хүлээлцэх маягтын төлөв</p>
        </div>
        <div className="divide-y divide-gray-100">
          {complianceLoading ? (
            <div className="px-5 py-6 text-sm text-gray-500">Уншиж байна...</div>
          ) : masterShiftRows.length === 0 ? (
            <div className="px-5 py-6 text-sm text-gray-500">Мэдээлэл олдсонгүй.</div>
          ) : (
            masterShiftRows.map((row: any) => (
              <div key={row.stationCode} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-black text-gray-950">{row.stationCode}</p>
                  <p className="text-xs text-gray-500 truncate">{row.stationName}</p>
                  {row.masterName ? (
                    <p className="mt-1 text-sm font-semibold text-gray-700">{row.masterName}</p>
                  ) : (
                    <p className="mt-1 text-xs text-amber-600">Мастер оноогдоогүй</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${
                    row.approved
                      ? 'border-teal-200 bg-teal-50 text-teal-700'
                      : row.formFilled
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : row.started
                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : row.scheduled
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-gray-50 text-gray-500'
                  }`}>
                    {row.approved
                      ? 'Баталгаажсан'
                      : row.formFilled
                        ? 'Маягт бүртгэсэн'
                        : row.started
                          ? 'Маягт дутуу'
                          : row.scheduled
                            ? 'Эхлээгүй'
                            : 'Мэдээлэлгүй'}
                  </span>
                  {row.shiftId ? (
                    <Link
                      href={`/shift/${row.shiftId}`}
                      className="text-xs font-bold text-orange-600 hover:underline whitespace-nowrap"
                    >
                      Нээх
                    </Link>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-black text-gray-950">Дамжлагын бодит цагийн төлөв</h3>
            <p className="mt-1 text-sm text-gray-500">
              Хуваарь, эхэлсэн ээлж, оператор болон хяналтын зөрчлийг дамжлагаар нэгтгэв.
            </p>
          </div>
          <button
            type="button"
            onClick={openSchedule}
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-gray-100 px-4 py-2 text-xs font-black text-gray-800 transition hover:bg-gray-200"
          >
            Ээлжийн хуваарь
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left">
            <thead>
              <tr className="bg-gray-50 text-[11px] font-black uppercase tracking-wider text-gray-500">
                <th className="px-5 py-3">Дамжлага</th>
                <th className="px-5 py-3">Оператор</th>
                <th className="px-5 py-3">Хуваарь / эхэлсэн</th>
                <th className="px-5 py-3">Идэвхтэй</th>
                <th className="px-5 py-3">Баталгаажсан</th>
                <th className="px-5 py-3">Дутуу / цагийн зөрүү</th>
                <th className="px-5 py-3">Хүлээгдэж буй</th>
                <th className="px-5 py-3">Төлөв</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stationRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm font-semibold text-gray-500">
                    Сонгосон нөхцөлд дамжлагын мэдээлэл олдсонгүй.
                  </td>
                </tr>
              ) : (
                stationRows.map((row) => (
                  <tr key={row.code} className="align-top transition hover:bg-gray-50/80">
                    <td className="px-5 py-4">
                      <p className="font-black text-gray-950">{row.code}</p>
                      <p className="mt-1 max-w-[16rem] text-xs text-gray-500">{row.name}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="max-w-[16rem] text-sm font-semibold text-gray-700">
                        {row.operatorNames.length > 0 ? row.operatorNames.join(', ') : 'Оператор оноогдоогүй'}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-black text-gray-900">
                        {row.scheduledCount} / {row.startedCount}
                      </p>
                      <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${row.coveragePct}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-black text-emerald-700">{row.activeCount}</td>
                    <td className="px-5 py-4 text-sm font-black text-teal-700">{row.approvedCount}</td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-black text-red-700">
                        {row.missingCount + row.lateCount + row.earlyCount}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Дутуу {row.missingCount} · Хоцролт {row.lateCount} · Эрт {row.earlyCount}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-black text-orange-700">
                        {row.pendingApprovalCount + row.pendingHandoverCount}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Батлах {row.pendingApprovalCount} · Хүлээлцэх {row.pendingHandoverCount}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${row.state.className}`}>
                        {row.state.label}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
