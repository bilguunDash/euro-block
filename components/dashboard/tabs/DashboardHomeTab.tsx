import Link from 'next/link';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Eye,
  Factory,
  Plus,
  RotateCcw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { isoDateInTimeZone } from '@/lib/handover-window';
import { StatCard } from '@/components/ui/StatCard';
import { TableRow } from '@/components/ui/TableRow';
import { AnnouncementWidget } from '../AnnouncementCenter';
import { HorizontalPagedList } from '../HorizontalPagedList';
import { UnsentHandoverShifts } from '../UnsentHandoverShifts';
import { DispatcherHomeTab } from './DispatcherHomeTab';
import { compactDayTitle, handoverStageDisplay, mnDateLabel, mnDateTimeCompact } from '../dashboard-helpers';

export function DashboardHomeTab({
  isOperatorView,
  handoverWindowInfo,
  handoverQueue,
  activeShift,
  operatorShiftDetailLoading,
  activeShiftCompleteness,
  firstStartableTodaySchedule,
  scheduleStationLabel,
  shiftNewHref,
  operatorHomeChart,
  deviceOnline,
  operatorChartSince,
  setOperatorChartSince,
  operatorChartUntil,
  setOperatorChartUntil,
  operatorChartShiftType,
  setOperatorChartShiftType,
  operatorChartStation,
  setOperatorChartStation,
  operatorChartStationOptions,
  stations,
  todaySchedules,
  mySchedules,
  dashboardScheduleSlotKey,
  normalizeStationCode,
  firstStartableTodayScheduleKeys,
  profile,
  masterHome,
  masterDashboardChart,
  masterChartSince,
  setMasterChartSince,
  masterChartUntil,
  setMasterChartUntil,
  masterChartShiftType,
  setMasterChartShiftType,
  masterChartStation,
  setMasterChartStation,
  masterChartStationOptions,
  masterCurrentOperatorShifts,
  masterPreviousOperatorShifts,
  pendingShifts,
  masterPendingAllShifts,
  adminHome,
  selectedDate,
  setSelectedDate,
  selectedShiftType,
  setSelectedShiftType,
  openAdminSection,
  adminPendingShifts,
  allShifts,
  maintenanceRequests,
  notifications,
  hseHome,
  hseChartSince,
  setHseChartSince,
  hseChartUntil,
  setHseChartUntil,
  hseChartStation,
  setHseChartStation,
  hseChartShiftType,
  setHseChartShiftType,
  hseChartStatus,
  setHseChartStatus,
  setHseChecklistDetailId,
  setHseDecisionNote,
  setHseDetailLogId,
  setOperatorHseDetailLogId,
  hseStationLabel,
  setShowHseIncidentModal,
  dispatcherMonth,
  setActiveTab,
  dispatcherStation,
  setDispatcherStation,
  dispatcherOperatorQ,
  setDispatcherOperatorQ,
  dispatcherStations,
  dispatcherCompliance,
  dispatcherComplianceLoading,
  dispatcherComplianceError,
  masterActiveShifts,
  stats,
  operatorPreviousHandoverShifts,
  loading,
  shifts,
  lastSyncAt,
}: any) {
  const parsedLastSyncAt =
    lastSyncAt instanceof Date
      ? lastSyncAt
      : lastSyncAt
        ? new Date(lastSyncAt)
        : null;
  const lastSyncLabel =
    parsedLastSyncAt && !Number.isNaN(parsedLastSyncAt.getTime())
      ? parsedLastSyncAt.toLocaleTimeString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })
      : 'Мэдээлэл хүлээж байна';

  return (
        <div className="space-y-6">
          <AnnouncementWidget />
          <>
            {isOperatorView ? (
              <section className="space-y-6">
                <div
                  className={`rounded-3xl border p-6 md:p-8 ${handoverWindowInfo.inDay || handoverWindowInfo.inNight || handoverQueue.length > 0
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-gray-200 bg-white'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <Clock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <h4 className="font-bold text-gray-900">Ээлж хүлээлцэх хугацаа</h4>
                      <p className="text-sm text-gray-600 mt-2">
                        Өдрийн ээлж: {handoverWindowInfo.dayS} – {handoverWindowInfo.dayE}. Шөнийн ээлж:{' '}
                        {handoverWindowInfo.nightS} – {handoverWindowInfo.nightE}.
                      </p>
                      {handoverWindowInfo.inDay && (
                        <p className="mt-3 text-sm font-bold text-amber-900">
                          Өдрийн ээлж хүлээлцэх хугацааны хүрээнд байна
                        </p>
                      )}
                      {handoverWindowInfo.inNight && (
                        <p className="mt-3 text-sm font-bold text-amber-900">
                          Одоо шөнийн ээлжийн ажиллах цагийн хүрээнд байна.
                        </p>
                      )}
                      {!handoverWindowInfo.inDay && !handoverWindowInfo.inNight && (
                        <p className="mt-3 text-sm text-gray-600">Одоогоор өдрийн/шөнийн ажиллах цагийн хүрээнд биш байна.</p>
                      )}
                      {handoverQueue.length > 0 && (
                        <p className="mt-3 text-sm font-bold text-red-800">
                          Хүлээгдэж буй ээлж хүлээлцэх: {handoverQueue.length} — доорх жагсаалтаас хариу өгнө үү.
                        </p>
                      )}
                      {activeShift && !operatorShiftDetailLoading && !activeShiftCompleteness.ok && (
                        <p className="mt-2 text-sm font-bold text-amber-900">
                          Идэвхтэй ээлжинд бөглөх шаардлагатай маягт дутуу байна — доорх жагсаалтыг үзнэ үү.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {!activeShift && firstStartableTodaySchedule && (
                  <div className="rounded-3xl border border-orange-200 bg-orange-50 p-6 md:p-8 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-black text-orange-700 uppercase tracking-wider">Үндсэн үйлдэл</p>
                      <p className="font-bold text-xl text-gray-900 mt-1">Ээлж эхлүүлэх</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Өнөөдрийн дараагийн эхлэх хуваарь ({scheduleStationLabel(firstStartableTodaySchedule)}) руу шууд орно.
                      </p>
                    </div>
                    <Link
                      href={shiftNewHref(firstStartableTodaySchedule)}
                      className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-orange-600 text-white rounded-2xl text-sm font-black hover:bg-orange-700 shadow-md whitespace-nowrap"
                    >
                      <Plus className="w-5 h-5" />
                      Ээлж эхлүүлэх
                    </Link>
                  </div>
                )}

                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-gray-100 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-gray-900">Операторын хяналтын график</h4>
                      <p className="text-sm text-gray-500 mt-1">Миний хуваарь, эхлүүлсэн ээлж, бөглөлт, ХАБ бүртгэлийн нэгтгэл</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black tracking-wider ${deviceOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {deviceOnline ? 'Онлайн' : 'Офлайн'}
                      </span>
                      {activeShift ? (
                        <Link
                          href={`/shift/${activeShift.id}`}
                          className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-black hover:bg-orange-700"
                        >
                          Ээлж рүү орох →
                        </Link>
                      ) : firstStartableTodaySchedule ? (
                        <Link
                          href={shiftNewHref(firstStartableTodaySchedule)}
                          className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-black hover:bg-orange-700"
                        >
                          Ээлж эхлүүлэх →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Эхлэх огноо</p>
                        <input
                          type="date"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"
                          value={operatorChartSince}
                          onChange={(e) => setOperatorChartSince(e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Дуусах огноо</p>
                        <input
                          type="date"
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"
                          value={operatorChartUntil}
                          onChange={(e) => setOperatorChartUntil(e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Ээлж</p>
                        <select
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"
                          value={operatorChartShiftType}
                          onChange={(e) => setOperatorChartShiftType(e.target.value)}
                        >
                          <option value="all">Бүгд</option>
                          <option value="Өдрийн">Өдрийн</option>
                          <option value="Шөнийн">Шөнийн</option>
                        </select>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Дамжлага</p>
                        <select
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"
                          value={operatorChartStation}
                          onChange={(e) => setOperatorChartStation(e.target.value)}
                        >
                          <option value="all">Бүгд</option>
                          {operatorChartStationOptions.map((code: any) => {
                            const st = stations.find((s: any) => String(s.code || '') === code);
                            return (
                              <option key={code} value={code}>
                                {st ? `${st.code} — ${st.name}` : code}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => {
                            setOperatorChartSince('');
                            setOperatorChartUntil('');
                            setOperatorChartShiftType('all');
                            setOperatorChartStation('all');
                          }}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gray-900 border border-gray-900 text-white text-xs font-black hover:bg-gray-800 shadow-sm"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Цэвэрлэх
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 grid grid-cols-1 xl:grid-cols-5 gap-6">
                    <div className="xl:col-span-3 min-h-[26rem] rounded-2xl border border-gray-200 bg-gray-50 p-5 flex flex-col">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-gray-900">Хугацааны хуваарь</p>
                          <p className="text-xs text-gray-500 mt-1">Улбар шар: хуваарь, Ногоон: эхлүүлсэн ээлж</p>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-bold text-gray-700">
                          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" />Хуваарь</span>
                          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Эхэлсэн</span>
                        </div>
                      </div>
                      <div
                        className="mt-5 grid flex-1 min-h-[19rem] items-stretch gap-4 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-4"
                        style={{ gridTemplateColumns: `repeat(${Math.max(1, operatorHomeChart.trend7d.length)}, minmax(4.5rem, 1fr))` }}
                      >
                        {operatorHomeChart.trend7d.map((row: any) => {
                          const scheduleHeight = row.scheduled > 0 ? Math.max(12, Math.round((row.scheduled / operatorHomeChart.trendMax) * 220)) : 0;
                          const startedHeight = row.started > 0 ? Math.max(12, Math.round((row.started / operatorHomeChart.trendMax) * 220)) : 0;
                          return (
                            <div key={row.date} className="min-w-0 h-full flex flex-col">
                              <div className="flex-1 min-h-[16rem] flex items-end justify-center gap-2 border-b-2 border-gray-400 bg-transparent px-2">
                                {false ? (
                                  <div className="mb-12 h-8 w-8 rounded-full border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-[10px] font-black text-gray-500" title="Өгөгдөлгүй">
                                    0
                                  </div>
                                ) : (
                                  <>
                                    <div
                                      className="w-6 rounded-t-lg bg-teal-500 shadow-sm"
                                      style={{ height: `${scheduleHeight}px` }}
                                      title={`Хуваарь: ${row.scheduled}`}
                                    />
                                    <div
                                      className="w-6 rounded-t-lg bg-rose-400 shadow-sm"
                                      style={{ height: `${startedHeight}px` }}
                                      title={`Эхлүүлсэн: ${row.started}`}
                                    />
                                  </>
                                )}
                              </div>
                              <p className="mt-2 shrink-0 truncate text-center text-[11px] font-black text-gray-700">{row.label}</p>
                              <p className="shrink-0 text-center text-[10px] font-bold text-gray-600">{row.scheduled}/{row.started}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4">
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <p className="font-bold text-gray-900">Хугацааны явц</p>
                        <div className="mt-4 flex items-center gap-5">
                          <div
                            className="h-28 w-28 rounded-full"
                            style={{
                              background: `conic-gradient(#10b981 0 ${operatorHomeChart.startPct}%, #f59e0b ${operatorHomeChart.startPct}% 100%)`,
                            }}
                          >
                            <div className="m-3 flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full bg-white">
                              <span className="text-2xl font-black text-gray-900">{operatorHomeChart.startPct}%</span>
                              <span className="text-[10px] font-bold text-gray-500">эхэлсэн</span>
                            </div>
                          </div>
                          <div className="min-w-0 space-y-2 text-sm">
                            <p className="font-bold text-emerald-700">Эхлүүлсэн: {operatorHomeChart.periodStarted}</p>
                            <p className="font-bold text-amber-700">Хуваарь: {operatorHomeChart.periodScheduled}</p>
                            <p className="text-xs text-gray-500">Баталгаажсан: {operatorHomeChart.periodApproved}</p>
                          </div>
                        </div>
                      </div>

                      {operatorHomeChart.compareGroups.map((group: any) => (
                        <div key={group.key} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                          <p className="font-bold text-gray-900">
                            {group.label} <span className="text-xs font-bold text-gray-400">— их утгын хувиар ({group.max} = 100%)</span>
                          </p>
                          {group.rows.map((item: any) => {
                            const itemValue = Number(item.value || 0);
                            const pct = Math.round((itemValue / group.max) * 100);
                            const width = itemValue > 0 ? Math.max(4, pct) : 0;
                            return (
                              <div key={item.label} className="mt-3">
                                <div className="flex items-center justify-between gap-3 text-xs">
                                  <span className="font-bold text-gray-700">{item.label}</span>
                                  <span className="flex items-baseline gap-1.5">
                                    <span className="font-black text-gray-900">{item.value}</span>
                                    <span className="w-9 text-right text-[11px] font-bold text-gray-400">{pct}%</span>
                                  </span>
                                </div>
                                <div className="mt-1 h-2 rounded-full bg-white border border-gray-100 overflow-hidden">
                                  <div className={`h-full rounded-full ${group.color}`} style={{ width: `${width}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                  <div className="xl:col-span-3 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-xl text-gray-900">Өнөөдрийн ээлж</h3>
                        <p className="text-sm text-gray-500 mt-1">Танд оноогдсон өнөөдрийн ажлууд</p>
                      </div>
                      <span className="text-xs font-bold text-gray-600">{mnDateLabel(isoDateInTimeZone())}</span>
                    </div>
                    <div className="p-8 space-y-4">
                      <UnsentHandoverShifts shifts={shifts} today={isoDateInTimeZone()} />
                      {activeShift ? (
                        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-black text-orange-700 uppercase tracking-wider">Идэвхтэй</p>
                            <p className="text-lg font-black text-gray-900">
                              {activeShift.stationCode} • {activeShift.shiftType}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              Эхэлсэн:{' '}
                              {new Date(activeShift.checkIn).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })}
                            </p>
                            {activeShift.checkOut ? (
                              <p className="text-sm text-gray-600 mt-1">
                                Дууссан:{' '}
                                {new Date(activeShift.checkOut).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })}
                              </p>
                            ) : null}
                            <p className="text-sm text-gray-600 mt-1">Төлөв: {activeShift.status || '—'}</p>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <Link
                              href={`/shift/${activeShift.id}`}
                              className="px-5 py-2.5 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700"
                            >
                              Дэлгэрэнгүй
                            </Link>
                            <Link
                              href={`/shift/${activeShift.id}#station-form`}
                              className="px-5 py-2.5 rounded-xl border border-orange-200 text-orange-700 font-bold hover:bg-orange-50"
                            >
                              Ээлж хүлээлцэх
                            </Link>
                          </div>
                        </div>
                      ) : todaySchedules.length > 0 ? (
                        <div className="rounded-2xl border border-gray-200 bg-white p-5">
                          <p className="font-bold text-gray-900">Идэвхтэй ээлж байхгүй</p>
                          <p className="text-sm text-gray-600 mt-1">Доорх хуваариас боломжтой ээлжээ эхлүүлнэ үү.</p>
                        </div>
                      ) : (
                        null
                      )}

                      {activeShift && (
                        <div className="rounded-2xl border border-gray-200 bg-white p-5">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-bold text-gray-900">Бөглөх шаардлагатай маягтууд</p>
                            {activeShiftCompleteness.ok ? (
                              <span className="text-xs font-bold text-emerald-600">Бүрэн</span>
                            ) : (
                              <span className="text-xs font-bold text-amber-600">Дутуу</span>
                            )}
                          </div>
                          {operatorShiftDetailLoading ? (
                            <p className="text-sm text-gray-500 mt-3">Шалгаж байна…</p>
                          ) : !activeShiftCompleteness.ok ? (
                            <ul className="mt-3 space-y-2">
                              {activeShiftCompleteness.missing.map((m: any) => (
                                <li key={m} className="text-sm text-gray-800 flex items-start gap-2">
                                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                  <span>{m}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-500 mt-3">Одоогоор дутуу маягт байхгүй.</p>
                          )}
                          <Link
                            href={`/shift/${activeShift.id}`}
                            className="inline-block mt-4 text-sm font-bold text-orange-700 hover:underline"
                          >
                            Ээлж рүү орох
                          </Link>
                        </div>
                      )}

                      <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-bold text-gray-900">Өнөөдрийн хуваарь</p>
                        </div>
                        <div className="mt-4 space-y-2">
                          {todaySchedules.slice(0, 8).map((s: any) => {
                            const rowKey = dashboardScheduleSlotKey(
                              s.shiftDate,
                              s.shiftType,
                              normalizeStationCode(s.stationCode || s.station)
                            );
                            const canStartRow = !activeShift && firstStartableTodayScheduleKeys.has(rowKey);
                            return (
                              <div
                                key={s.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                              >
                                <div>
                                  <p className="text-sm font-bold text-gray-900">{scheduleStationLabel(s)}</p>
                                  <p className="text-xs text-gray-600">
                                    {s.shiftType} • {s.shiftDate}
                                  </p>
                                </div>
                                {canStartRow ? (
                                  <Link
                                    href={shiftNewHref(s)}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-bold rounded-xl hover:bg-orange-700 whitespace-nowrap"
                                  >
                                    <Plus className="w-4 h-4" />
                                    Ээлж эхлүүлэх
                                  </Link>
                                ) : (
                                  <span className="inline-flex items-center px-4 py-2 rounded-xl bg-gray-100 text-xs font-bold text-gray-500">
                                    Дарааллаар эхлүүлнэ
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {todaySchedules.length === 0 && (
                            <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm font-medium text-gray-600">
                              Өнөөдрийн хуваарь байхгүй. Шаардлагатай бол мастертай холбогдоно уу.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="xl:col-span-2 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-gray-100 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-xl text-gray-900">Хүлээгдэж буй ээлж хүлээлцэх</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {handoverQueue.length === 0 ? 'Ирсэн хүсэлтүүд энд харагдана.' : `Нийт ${handoverQueue.length} хүсэлт`}
                        </p>
                      </div>
                      {handoverQueue.length > 0 && (
                        <span className="shrink-0 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-black">
                          {handoverQueue.length}
                        </span>
                      )}
                    </div>
                    <div className="p-8">
                      {handoverQueue.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm font-medium text-gray-600">
                          Хүлээгдэж буй ээлж хүлээлцэх хүсэлт байхгүй.
                        </p>
                      ) : (
                        <ul className="space-y-3">
                          {handoverQueue.slice(0, 6).map((s: any) => (
                            <li key={s.id} className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                              <p className="font-bold text-blue-900">
                                {s.stationCode} • {s.shiftType}
                              </p>
                              <p className="text-sm text-blue-900/80 mt-1">Өмнөх оператор: {s.operatorName}</p>
                              {s.handoverRequestedAt ? (
                                <p className="text-xs text-blue-900/70 mt-1">
                                  Илгээсэн:{' '}
                                  {new Date(s.handoverRequestedAt).toLocaleString('mn-MN', {
                                    timeZone: 'Asia/Ulaanbaatar',
                                  })}
                                </p>
                              ) : null}
                              <Link href={`/shift/${s.id}`} className="inline-block mt-3 text-orange-700 font-bold hover:underline">
                                Нээж хариу өгөх
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <>
                {profile?.role === 'master' ? (
                  <section className="space-y-6">
                    <div
                      className={`rounded-3xl border p-6 md:p-8 ${masterHome.nowInHandoverWindow || handoverQueue.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <Clock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <h4 className="font-bold text-gray-900">Ээлж хүлээлцэх цагийн цонх</h4>
                          <p className="text-sm text-gray-600 mt-2">
                            Өдрийн: {masterHome.dayWindow.start} – {masterHome.dayWindow.end}. Шөнийн: {masterHome.nightWindow.start} – {masterHome.nightWindow.end}.
                          </p>
                          {masterHome.nowInHandoverWindow ? (
                            <p className="mt-3 text-sm font-bold text-amber-900">Одоогоор ээлж хүлээлцэх цагийн цонхонд байна.</p>
                          ) : (
                            <p className="mt-3 text-sm text-gray-600">Одоогоор ээлж хүлээлцэх цагийн цонхонд биш байна.</p>
                          )}
                          {handoverQueue.length > 0 && (
                            <p className="mt-2 text-sm font-bold text-red-800">
                              Хүлээгдэж буй ээлж хүлээлцэх: {handoverQueue.length}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Мастерын ӨӨРИЙН дамжлагын ээлж: дуусгасан ч дараагийн мастерт илгээгээгүй / буцаагдсан. */}
                    <UnsentHandoverShifts shifts={shifts} today={isoDateInTimeZone()} ownMasterShift />

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
                        <p className="mt-2 text-3xl font-black text-gray-900">{masterHome.active.length}</p>
                        <p className="text-sm font-bold text-gray-700 mt-1">Идэвхтэй ээлжүүд</p>
                        <a href="#master-active-shifts" className="inline-block mt-3 text-sm font-bold text-orange-700 hover:underline">
                          Дэлгэрэнгүй →
                        </a>
                      </div>

                      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
                        <p className="mt-2 text-3xl font-black text-gray-900">{masterHome.missing.length}</p>
                        <p className="text-sm font-bold text-gray-700 mt-1">Дутуу бүртгэл</p>
                        <a href="#master-missing-logs" className="inline-block mt-3 text-sm font-bold text-orange-700 hover:underline">
                          Харах →
                        </a>
                      </div>

                      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
                        <p className="mt-2 text-3xl font-black text-gray-900">{masterPendingAllShifts.length}</p>
                        <p className="text-sm font-bold text-gray-700 mt-1">Баталгаажуулах ээлж</p>
                        <a href="#master-pending-approvals" className="inline-block mt-3 text-sm font-bold text-orange-700 hover:underline">
                          Харах →
                        </a>
                      </div>

                      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
                        <p className="mt-2 text-3xl font-black text-gray-900">{handoverQueue.length}</p>
                        <p className="text-sm font-bold text-gray-700 mt-1">Хүлээлцэх</p>
                        <a href="#master-pending-handover" className="inline-block mt-3 text-sm font-bold text-orange-700 hover:underline">
                          Харах →
                        </a>
                      </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="p-6 md:p-8 border-b border-gray-100 flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="font-bold text-xl text-gray-900">Мастерын хяналтын график</h3>
                          <p className="mt-2 text-sm text-gray-500">
                            Сүүлийн 7 хоногийн ээлж, баталгаажуулалт, дутуу бүртгэлийн нэгтгэл
                          </p>
                        </div>
                        <div className="hidden">
                          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-gray-400" />Нийт</span>
                          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Баталгаажсан</span>
                          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Хүлээгдэж буй</span>
                        </div>
                      </div>

                      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Эхлэх огноо</p>
                            <input
                              type="date"
                              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"
                              value={masterChartSince}
                              onChange={(e) => setMasterChartSince(e.target.value)}
                            />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Дуусах огноо</p>
                            <input
                              type="date"
                              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"
                              value={masterChartUntil}
                              onChange={(e) => setMasterChartUntil(e.target.value)}
                            />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Ээлж</p>
                            <select
                              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"
                              value={masterChartShiftType}
                              onChange={(e) => setMasterChartShiftType(e.target.value)}
                            >
                              <option value="all">Бүгд</option>
                              <option value="Өдрийн">Өдрийн</option>
                              <option value="Шөнийн">Шөнийн</option>
                            </select>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Дамжлага</p>
                            <select
                              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"
                              value={masterChartStation}
                              onChange={(e) => setMasterChartStation(e.target.value)}
                            >
                              <option value="all">Бүгд</option>
                              {masterChartStationOptions.map((code: any) => {
                                const st = stations.find((s: any) => String(s.code || '') === code);
                                return (
                                  <option key={code} value={code}>
                                    {st ? `${st.code} - ${st.name}` : code}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => {
                                setMasterChartSince('');
                                setMasterChartUntil('');
                                setMasterChartShiftType('all');
                                setMasterChartStation('all');
                              }}
                              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gray-900 border border-gray-900 text-white text-xs font-black hover:bg-gray-800 shadow-sm"
                            >
                              <RotateCcw className="h-4 w-4" />
                              Цэвэрлэх
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 grid grid-cols-1 xl:grid-cols-5 gap-6">
                        <div className="xl:col-span-3 min-h-[26rem] rounded-2xl border border-gray-200 bg-gray-50 p-5 flex flex-col">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-bold text-gray-900">Хугацааны хуваарь</p>
                              <p className="mt-1 text-sm text-gray-500">Өдөр бүрийн нийт болон төлөвийн харьцуулалт</p>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] font-bold text-gray-700">
                              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-teal-500" />Нийт</span>
                              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" />Баталгаажсан</span>
                            </div>
                            <span className="hidden">
                              7 хоног
                            </span>
                          </div>

                          {false ? (
                            <div className="mt-5 flex min-h-44 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center">
                              <div>
                                <p className="text-sm font-black text-gray-700">Графикт харуулах өгөгдөл алга</p>
                                <p className="mt-1 text-xs font-medium text-gray-500">Шүүлтүүрээ өөрчлөх эсвэл ээлж бүртгэгдсэний дараа график автоматаар харагдана.</p>
                              </div>
                            </div>
                          ) : (
                          <div
                            className="mt-5 grid flex-1 min-h-[19rem] items-stretch gap-4 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-4"
                            style={{ gridTemplateColumns: `repeat(${Math.max(1, masterDashboardChart.trend.length)}, minmax(4.5rem, 1fr))` }}
                          >
                            {masterDashboardChart.trend.map((row: any) => {
                              const approvedHeight = row.approved > 0 ? Math.max(12, Math.round((row.approved / masterDashboardChart.trendMax) * 220)) : 0;
                              const pendingHeight = row.pending > 0 ? Math.max(12, Math.round((row.pending / masterDashboardChart.trendMax) * 220)) : 0;
                              const hasBoth = approvedHeight > 0 && pendingHeight > 0;
                              return (
                                <div key={row.date} className="min-w-0 h-full flex flex-col">
                                  <div className="flex-1 min-h-[16rem] flex items-end justify-center border-b-2 border-gray-400 bg-transparent px-2">
                                    {row.total === 0 ? (
                                      <div className="hidden" title="Өгөгдөлгүй">
                                        0
                                      </div>
                                    ) : (
                                      <div className="w-7 flex flex-col-reverse items-stretch overflow-hidden rounded-t-lg shadow-sm" title={`Баталгаажсан: ${row.approved} · Хүлээгдэж буй: ${row.pending}`}>
                                        <div className="bg-emerald-500" style={{ height: `${approvedHeight}px` }} />
                                        {hasBoth && <div className="h-0.5 bg-white" />}
                                        <div className="bg-orange-500" style={{ height: `${pendingHeight}px` }} />
                                      </div>
                                    )}
                                  </div>
                                  <p className="mt-2 shrink-0 truncate text-center text-[11px] font-black text-gray-700">{row.label}</p>
                                  <p className="shrink-0 text-center text-[10px] font-bold text-gray-600">{row.total} нийт</p>
                                </div>
                              );
                            })}
                          </div>
                          )}
                        </div>

                        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4">
                          <button
                            type="button"
                            onClick={() => setActiveTab('handover-approval')}
                            className="w-full flex items-center gap-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-left transition-colors hover:bg-red-100"
                          >
                            <span className="text-3xl font-black leading-none text-red-600">{masterDashboardChart.attentionCount}</span>
                            <span className="flex-1">
                              <span className="block text-sm font-black text-red-800">Анхаарал шаардлагатай зүйл</span>
                              <span className="block text-xs font-bold text-red-700/80">Нэг ээлжийг нэг удаа тоолсон · Ээлж хүлээлцэх баталгаажуулалт руу очих →</span>
                            </span>
                            <ChevronRight className="h-5 w-5 text-red-500" />
                          </button>

                          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                            <p className="font-bold text-gray-900">Хугацааны явц</p>
                            <div className="mt-4 flex items-center gap-5">
                            <div
                              className="h-28 w-28 rounded-full"
                              style={{
                                background: masterDashboardChart.hasTrendData
                                  ? `conic-gradient(#10b981 0 ${masterDashboardChart.approvalPct}%, #f59e0b ${masterDashboardChart.approvalPct}% 100%)`
                                  : 'conic-gradient(#e5e7eb 0 100%)',
                              }}
                            >
                              <div className="m-3 flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full bg-white">
                                {masterDashboardChart.hasTrendData ? (
                                  <>
                                    <span className="text-2xl font-black text-gray-900">{masterDashboardChart.approvalPct}%</span>
                                    <span className="text-[10px] font-bold text-gray-500">баталгаажсан</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-2xl font-black text-gray-500">0%</span>
                                    <span className="text-[10px] font-bold text-gray-500">баталгаажсан</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="min-w-0 space-y-2 text-sm">
                              <p className="font-bold text-blue-700">Сүүлийн 7 хоног нийт: {masterDashboardChart.recentTotal}</p>
                              <p className="font-bold text-emerald-700">Баталгаажсан ээлж: {masterDashboardChart.recentApproved}</p>
                              <p className="font-bold text-amber-700">Хүлээгдэж буй ээлж: {masterDashboardChart.recentPending}</p>
                            </div>
                            </div>
                          </div>

                          {masterDashboardChart.compareGroups.map((group: any) => (
                            <div key={group.key} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                              <p className="font-bold text-gray-900">
                                {group.label} <span className="text-xs font-bold text-gray-400">— их утгын хувиар ({group.max} = 100%)</span>
                              </p>
                              <div className="mt-3 space-y-3">
                                {group.rows.map((item: any) => {
                                  const itemValue = Number(item.value || 0);
                                  const pct = Math.round((itemValue / group.max) * 100);
                                  const width = itemValue > 0 ? Math.max(4, pct) : 0;
                                  return (
                                    <div key={item.label}>
                                      <div className="flex items-center justify-between gap-3 text-xs">
                                        <span className="font-bold text-gray-700">{item.label}</span>
                                        <span className="flex items-baseline gap-1.5">
                                          <span className="font-black text-gray-900">{item.value}</span>
                                          <span className="w-9 text-right text-[11px] font-bold text-gray-400">{pct}%</span>
                                        </span>
                                      </div>
                                      <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                                        <div className={`h-full rounded-full ${group.color}`} style={{ width: `${width}%` }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                          <h3 className="font-bold text-lg text-gray-900">Одоогийн оператор бүртгэлүүд</h3>
                          <p className="text-sm text-gray-500 mt-1">Таны хянах идэвхтэй оператор ээлжүүд</p>
                        </div>
                        <div className="p-6 space-y-3">
                          {masterCurrentOperatorShifts.length === 0 ? (
                            <p className="text-sm text-gray-500">Одоогоор идэвхтэй оператор бүртгэл алга.</p>
                          ) : (
                            masterCurrentOperatorShifts.map((s: any) => (
                              <div key={s.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="font-bold text-gray-900">{s.stationCode} • {s.shiftType}</p>
                                  <p className="text-sm text-gray-600 mt-1">Оператор: {s.operatorName || '—'}</p>
                                  <p className="text-xs text-gray-500 mt-1">{s.shiftDate} • {s.status || '—'}</p>
                                </div>
                                <Link href={`/shift/${s.id}`} className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800">
                                  Бүртгэл харах →
                                </Link>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                          <h3 className="font-bold text-lg text-gray-900">Өмнөх оператор бүртгэлүүд</h3>
                          <p className="text-sm text-gray-500 mt-1">Хүлээлцэхээр илгээсэн эсвэл дууссан оператор бүртгэлүүд</p>
                        </div>
                        <div className="p-6 space-y-3">
                          {masterPreviousOperatorShifts.length === 0 ? (
                            <p className="text-sm text-gray-500">Одоогоор өмнөх оператор бүртгэл алга.</p>
                          ) : (
                            masterPreviousOperatorShifts.map((s: any) => (
                              <div key={s.id} className="rounded-2xl border border-blue-200 bg-blue-50 p-4 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="font-bold text-blue-900">{s.stationCode} • {s.shiftType}</p>
                                  <p className="text-sm text-blue-900/80 mt-1">
                                    {s.operatorName || '—'} → {s.handoverToOperatorName || s.nextOperatorName || '—'}
                                  </p>
                                  <p className="text-xs text-blue-900/70 mt-1">{s.shiftDate} • Төлөв: {handoverStageDisplay(s.handoverStage, s.status)}</p>
                                </div>
                                <Link href={`/shift/${s.id}`} className="px-4 py-2 rounded-xl bg-white border border-blue-200 text-blue-800 text-xs font-bold hover:bg-blue-100">
                                  Бүртгэл харах →
                                </Link>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div id="master-active-shifts" className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="p-8 border-b border-gray-100">
                        <h3 className="font-bold text-xl text-gray-900">Идэвхтэй ээлжийн жагсаалт</h3>
                      </div>
                      <div className="p-8">
                        {masterHome.active.length === 0 ? (
                          <p className="text-sm text-gray-500">Одоогоор идэвхтэй ээлж байхгүй.</p>
                        ) : (
                          <ul className="space-y-3">
                            {masterHome.active.slice(0, 20).map((s: any) => (
                              <li key={s.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-bold text-gray-900">
                                    {s.stationCode} • {s.shiftType}
                                  </p>
                                  <p className="text-sm text-gray-600 mt-1">Оператор: {s.operatorName || '—'}</p>
                                  <p className="text-xs text-gray-500 mt-1">Төлөв: {s.status || '—'}</p>
                                </div>
                                <Link
                                  href={`/shift/${s.id}`}
                                  className="shrink-0 px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200 transition-colors"
                                >
                                  Нээх →
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div id="master-missing-logs" className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="p-8 border-b border-gray-100">
                        <h3 className="font-bold text-xl text-gray-900">Дутуу бүртгэлийн жагсаалт</h3>
                      </div>
                      <div className="p-8">
                        {masterHome.missing.length === 0 ? (
                          <p className="text-sm text-gray-500">Одоогоор дутуу бүртгэл илрээгүй.</p>
                        ) : (
                          <ul className="space-y-3">
                            {masterHome.missing.slice(0, 20).map(({ shift, missing }: any) => (
                              <li key={shift.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="font-bold text-amber-900">
                                      {shift.stationCode} • {shift.shiftType} — {shift.operatorName || '—'}
                                    </p>
                                    <p className="text-sm text-amber-900/80 mt-2">
                                      Дутуу: {missing.join(', ')}
                                    </p>
                                  </div>
                                  <Link
                                    href={`/shift/${shift.id}`}
                                    className="shrink-0 px-4 py-2 rounded-xl bg-amber-200 text-amber-900 text-sm font-bold hover:bg-amber-300 transition-colors"
                                  >
                                    Нээж шалгах →
                                  </Link>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div id="master-pending-handover" className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="p-8 border-b border-gray-100">
                        <h3 className="font-bold text-xl text-gray-900">Хүлээгдэж буй хүлээлцэх</h3>
                      </div>
                      <div className="p-8">
                        {handoverQueue.length === 0 ? (
                          <p className="text-sm text-gray-500">Одоогоор хүлээгдэж буй хүлээлцэх байхгүй.</p>
                        ) : (
                          <ul className="space-y-3">
                            {handoverQueue.slice(0, 20).map((s: any) => (
                              <li key={s.id} className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="font-bold text-blue-900">
                                      {s.stationCode} • {s.shiftType}
                                    </p>
                                    <p className="text-sm text-blue-900/80 mt-1">
                                      {s.operatorName || '—'} → {s.handoverToOperatorName || '—'}
                                    </p>
                                    <p className="text-xs text-blue-900/70 mt-1">
                                      Төлөв: Хүлээгдэж буй
                                    </p>
                                  </div>
                                  <Link href={`/shift/${s.id}`} className="shrink-0 text-sm font-bold text-orange-700 hover:underline">
                                    Нээх →
                                  </Link>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </section>
                ) : profile?.role === 'admin' ? (
                  <section className="space-y-6">
                    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="p-6 md:p-8 border-b border-gray-100 flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-black text-orange-600 uppercase tracking-wider">Админ хяналтын самбар</p>
                          <h2 className="mt-2 text-2xl font-black text-gray-900">Нүүр</h2>
                          <p className="mt-2 text-sm text-gray-500">
                            Ээлжийн явц, баталгаажуулалт, дутуу бүртгэл, системийн идэвхийг нэг дор харуулна.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <input
                            type="date"
                            className="px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-700"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                          />
                          <select
                            className="px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-700"
                            value={selectedShiftType}
                            onChange={(e) => setSelectedShiftType(e.target.value as any)}
                          >
                            <option value="Өдрийн">Өдрийн</option>
                            <option value="Шөнийн">Шөнийн</option>
                          </select>
                        </div>
                      </div>

                      <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-4xl font-black leading-none text-emerald-900">{adminHome.activeCount}</p>
                              <p className="mt-3 text-sm font-black text-emerald-800">Идэвхтэй ээлж</p>
                            </div>
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                              <Factory className="h-6 w-6" />
                            </span>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-4xl font-black leading-none text-blue-900">{adminHome.adminPendingCount}</p>
                              <p className="mt-3 text-sm font-black text-blue-800">Админ баталгаажуулах</p>
                              <p className="mt-1 text-xs font-bold text-blue-700/80">
                                Оператор {adminHome.adminPendingOperatorCount} · Мастер {adminHome.adminPendingMasterCount} · бүх огноо
                              </p>
                            </div>
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
                              <ShieldCheck className="h-6 w-6" />
                            </span>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-4xl font-black leading-none text-amber-900">{adminHome.missingCount}</p>
                              <p className="mt-3 text-sm font-black text-amber-800">Дутуу бүртгэл</p>
                            </div>
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
                              <AlertTriangle className="h-6 w-6" />
                            </span>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-4xl font-black leading-none text-gray-900">{adminHome.auditCount}</p>
                              <p className="mt-3 text-sm font-black text-gray-700">Системийн үйлдэл</p>
                            </div>
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-gray-700 shadow-sm">
                              <Eye className="h-6 w-6" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                      <div className="xl:col-span-3 bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-lg text-gray-900">Сүүлийн 7 хоногийн ээлжийн график</h3>
                            <p className="mt-1 text-sm text-gray-500">Багана бүрийн нийт өндөр = Баталгаажсан + Хүлээгдэж буй</p>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] font-bold text-gray-600">
                            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Баталгаажсан</span>
                            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" />Хүлээгдэж буй</span>
                          </div>
                        </div>
                        <div
                          className="mt-6 grid gap-3 overflow-x-auto pb-1"
                          style={{ gridTemplateColumns: `repeat(${Math.max(1, adminHome.trend.length)}, minmax(4.5rem, 1fr))` }}
                        >
                          {adminHome.trend.map((row: any) => {
                            const approvedHeight = row.approved > 0 ? Math.max(8, Math.round((row.approved / adminHome.trendMax) * 260)) : 0;
                            const pendingHeight = row.pending > 0 ? Math.max(8, Math.round((row.pending / adminHome.trendMax) * 260)) : 0;
                            const hasBoth = approvedHeight > 0 && pendingHeight > 0;
                            return (
                              <div key={row.date} className="min-w-0">
                                <div className="h-80 flex items-end justify-center rounded-2xl bg-gray-50 border border-gray-100 px-2 py-4">
                                  <div className="w-5 flex flex-col-reverse items-stretch overflow-hidden rounded-md" title={`Баталгаажсан: ${row.approved} · Хүлээгдэж буй: ${row.pending}`}>
                                    <div className="bg-emerald-500" style={{ height: `${approvedHeight}px` }} />
                                    {hasBoth && <div className="h-0.5 bg-gray-50" />}
                                    <div className="bg-orange-500" style={{ height: `${pendingHeight}px` }} />
                                  </div>
                                </div>
                                <p className="mt-2 truncate text-center text-[11px] font-bold text-gray-500">{row.label}</p>
                                <p className="text-center text-[10px] text-gray-400">{row.total} нийт{row.approved > 0 ? ` · ${row.approved} баталгаажсан` : ''}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="xl:col-span-2 bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
                        <h3 className="font-bold text-lg text-gray-900">Ерөнхий төлөв</h3>

                        {/* Доорх мөрүүд жагсаалт тус бүрийн тоо; ижил ээлжүүд тэдгээрт
                            давхцаж болох ч нийт дүнд нэг удаа орно. Өмнө нь ганц товч
                            байсан бөгөөс «Давхар баталгаажуулалт» руу хөтөлдөг байсан —
                            гэтэл тэдгээрийн зөвхөн НЭГ нь (Админ баталгаажуулах) тэнд
                            харагддаг тул «6 гэж бичээд хоосон гарна» гэсэн төөрөгдөл
                            үүсдэг байв. Одоо задалж, хариуцагчийг нь зааж өгнө. */}
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
                          <div className="flex items-center gap-4">
                            <span className="text-3xl font-black leading-none text-red-600">{adminHome.attentionCount}</span>
                            <span className="flex-1">
                              <span className="block text-sm font-black text-red-800">Анхаарал шаардлагатай зүйл</span>
                              <span className="block text-xs font-bold text-red-700/80">
                                Нэг ээлжийг нэг удаа тоолсон · админы баталгаа, засвар бүх огноо
                              </span>
                            </span>
                          </div>

                          <div className="mt-3 space-y-1.5 border-t border-red-200/70 pt-3">
                            <button
                              type="button"
                              onClick={() => openAdminSection('approvals')}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-red-100"
                            >
                              <span className="w-7 shrink-0 text-sm font-black text-red-700">{adminHome.attentionBreakdown.admin}</span>
                              <span className="flex-1 text-xs font-bold text-red-900">
                                Админ баталгаажуулах <span className="font-medium text-red-700/70">· бүх огноо</span>
                              </span>
                              <span className="shrink-0 text-[11px] font-bold text-red-700">Нээх →</span>
                            </button>

                            {[
                              { value: adminHome.attentionBreakdown.missing, label: 'Дутуу бүртгэл', who: 'оператор нөхнө' },
                              { value: adminHome.attentionBreakdown.master, label: 'Мастер баталгаажуулах', who: 'мастер хийнэ' },
                              { value: adminHome.attentionBreakdown.handover, label: 'Хүлээлцэх хүсэлт', who: 'ээлж хүлээлцэнэ' },
                              { value: adminHome.attentionBreakdown.maintenance, label: 'Нээлттэй засвар', who: 'бүх огноо' },
                            ].map((row) => (
                              <div key={row.label} className="flex items-center gap-2 px-2 py-1.5">
                                <span className="w-7 shrink-0 text-sm font-black text-red-700">{row.value}</span>
                                <span className="flex-1 text-xs font-bold text-red-900">{row.label}</span>
                                <span className="shrink-0 text-[11px] font-medium text-red-700/70">{row.who}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-5 flex items-center gap-4 rounded-2xl bg-gray-50 px-5 py-4">
                          <div
                            className="h-14 w-14 shrink-0 rounded-full"
                            style={{
                              background: adminHome.hasHealthData
                                ? `conic-gradient(#10b981 0 ${adminHome.healthRate}%, #e5e7eb ${adminHome.healthRate}% 100%)`
                                : 'conic-gradient(#e5e7eb 0 100%)',
                            }}
                          >
                            <div className="m-1.5 flex h-11 w-11 flex-col items-center justify-center rounded-full bg-white">
                              <span className={`text-xs font-black ${adminHome.hasHealthData ? 'text-gray-900' : 'text-gray-500'}`}>
                                {adminHome.hasHealthData ? `${adminHome.healthRate}%` : '—'}
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-600">
                            <p className="font-bold text-gray-900">Баталгаажилт (7 хоног)</p>
                            <p className="mt-0.5">
                              {adminHome.recentApproved} / {adminHome.recentTotal} ээлж баталгаажсан ·{' '}
                              {adminHome.openMaintenance} засварын хүсэлт, {adminHome.unreadNotifications} уншаагүй мэдэгдэл
                            </p>
                          </div>
                        </div>

                        {adminHome.compareGroups.map((group: any) => (
                          <div key={group.key}>
                            <p className="mt-6 text-[11px] font-black uppercase tracking-wider text-gray-400">
                              {group.label} <span className="font-bold normal-case tracking-normal">— хамгийн их утгын хувиар ({group.max} = 100%)</span>
                            </p>
                            <div className="mt-3 space-y-3">
                              {group.rows.map((item: any) => {
                                const itemValue = Number(item.value || 0);
                                const pct = Math.round((itemValue / group.max) * 100);
                                const width = itemValue > 0 ? Math.max(4, pct) : 0;
                                return (
                                  <div key={item.label}>
                                    <div className="flex items-center justify-between gap-3 text-xs">
                                      <span className="font-bold text-gray-700">{item.label}</span>
                                      <span className="flex items-baseline gap-1.5">
                                        <span className="font-black text-gray-900">{item.value}</span>
                                        <span className="w-9 text-right text-[11px] font-bold text-gray-400">{pct}%</span>
                                      </span>
                                    </div>
                                    <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                      <div className={`h-full rounded-full ${group.color}`} style={{ width: `${width}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                      <div className="xl:col-span-2 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                          <h3 className="font-bold text-lg text-gray-900">Түргэн үйлдэл</h3>
                          <p className="mt-1 text-sm text-gray-500">Admin-ийн хамгийн их ашиглах хэсгүүд рүү шууд орно.</p>
                        </div>
                        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {[
                            { label: 'Баталгаажуулалт', desc: `${adminHome.adminPendingCount} хүлээгдэж байна`, section: 'approvals' as const, icon: <ShieldCheck className="w-5 h-5" />, tone: 'bg-blue-50 text-blue-800 border-blue-100 hover:bg-blue-100' },
                            { label: 'Хэрэглэгч удирдах', desc: 'Эрх, үүрэг, төлөв', section: 'users' as const, icon: <ClipboardCheck className="w-5 h-5" />, tone: 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-gray-100' },
                            { label: 'Ээлжийн хуваарь', desc: 'Мастер, операторын хуваарь', section: 'schedules' as const, icon: <Calendar className="w-5 h-5" />, tone: 'bg-orange-50 text-orange-800 border-orange-100 hover:bg-orange-100' },
                            { label: 'Аудит лог', desc: `${adminHome.auditCount} үйлдэл`, section: 'audit' as const, icon: <Eye className="w-5 h-5" />, tone: 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100' },
                            { label: 'Системийн тохиргоо', desc: 'Ерөнхий тохиргоо', section: 'settings' as const, icon: <Settings className="w-5 h-5" />, tone: 'bg-emerald-50 text-emerald-800 border-emerald-100 hover:bg-emerald-100' },
                            { label: 'Заавар, ХАБ баримт', desc: 'Заавар, аюулгүй ажиллагааны баримт', section: 'instructions' as const, icon: <BookOpen className="w-5 h-5" />, tone: 'bg-amber-50 text-amber-800 border-amber-100 hover:bg-amber-100' },
                          ].map((item: any) => (
                            <button
                              key={item.section}
                              type="button"
                              onClick={() => openAdminSection(item.section)}
                              className={`min-h-28 rounded-2xl border p-4 text-left transition-colors ${item.tone}`}
                            >
                              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/80">
                                {item.icon}
                              </span>
                              <span className="mt-3 block font-black text-sm">{item.label}</span>
                              <span className="mt-1 block text-xs font-bold opacity-80">{item.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-lg text-gray-900">Дутуу бүртгэл</h3>
                            <p className="mt-1 text-sm text-gray-500">Операторын бөглөлтөөс дутуу үлдсэн зүйлс</p>
                          </div>
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">{adminHome.missingCount}</span>
                        </div>
                        <div className="p-6 space-y-3">
                          {masterHome.missing.length === 0 ? (
                            <p className="text-sm text-gray-500">Одоогоор дутуу бүртгэл илрээгүй.</p>
                          ) : (
                            masterHome.missing.slice(0, 5).map(({ shift, missing }: any) => (
                              <div key={shift.id} className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="font-bold text-amber-950">{shift.stationCode || '—'} • {shift.shiftType || '—'}</p>
                                    <p className="mt-1 text-sm text-amber-900/80">{shift.operatorName || 'Оператор'} • {shift.shiftDate || '—'}</p>
                                  </div>
                                  <Link href={`/shift/${shift.id}`} className="shrink-0 text-xs font-black text-amber-900 hover:underline">
                                    Шалгах
                                  </Link>
                                </div>
                                <p className="mt-3 line-clamp-2 text-xs font-bold text-amber-900/80">
                                  {missing.join(', ')}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                  </section>
                ) : profile?.role === 'dispatcher' ? (
                  <DispatcherHomeTab
                    selectedDate={selectedDate}
                    setSelectedDate={setSelectedDate}
                    selectedShiftType={selectedShiftType}
                    setSelectedShiftType={setSelectedShiftType}
                    dispatcherStation={dispatcherStation}
                    setDispatcherStation={setDispatcherStation}
                    dispatcherOperatorQ={dispatcherOperatorQ}
                    setDispatcherOperatorQ={setDispatcherOperatorQ}
                    stations={dispatcherStations}
                    compliance={dispatcherCompliance}
                    complianceLoading={dispatcherComplianceLoading}
                    complianceError={dispatcherComplianceError}
                    lastSyncAt={lastSyncAt}
                    deviceOnline={deviceOnline}
                    setActiveTab={setActiveTab}
                    openSchedule={() => openAdminSection('schedules')}
                  />
                ) : profile?.role === 'dispatcher_legacy' ? (
                  <section className="space-y-6">
                    {(() => {
                      const q = String(dispatcherOperatorQ || '').trim().toLowerCase();
                      const stationOk = (code: any) => dispatcherStation === 'all' || String(code || '') === dispatcherStation;
                      const opOk = (name: any) => !q || String(name || '').toLowerCase().includes(q);
                      const sameSlot = (s: any) =>
                        s?.shiftDate === selectedDate && s?.shiftType === selectedShiftType && stationOk(s?.stationCode) && opOk(s?.operatorName);

                      const slotAll = (Array.isArray(allShifts) ? allShifts : []).filter(sameSlot);
                      const active = (Array.isArray(masterActiveShifts) ? masterActiveShifts : []).filter(sameSlot);
                      const pending = (Array.isArray(pendingShifts) ? pendingShifts : []).filter(sameSlot);
                      const handovers = (Array.isArray(handoverQueue) ? handoverQueue : []).filter(sameSlot);
                      const lateOrMissing = (Array.isArray(masterHome?.missing) ? masterHome.missing : []).filter((r: any) => sameSlot(r?.shift));
                      const latePeople = slotAll
                        .filter((shift: any) => {
                          const timing = String(shift?.handoverTimingStatus || '').toLowerCase();
                          return timing.includes('late') || timing.includes('хоцор');
                        })
                        .map((shift: any) => ({
                          shift,
                          reason: shift?.handoverTimingReason || shift?.handoverTimingStatus || 'Хоцорсон ээлж хүлээлцэх',
                        }));

                      const statusCounts = slotAll.reduce(
                        (acc: any, s: any) => {
                          const st = String(s?.status || '');
                          if (st === 'Баталгаажсан') acc.approved += 1;
                          else if (st === 'Хадгалсан') acc.saved += 1;
                          else if (st === 'Ноорог') acc.draft += 1;
                          else acc.other += 1;
                          return acc;
                        },
                        { approved: 0, saved: 0, draft: 0, other: 0 }
                      );

                      const scheduleRows = (Array.isArray(mySchedules) ? mySchedules : []).filter((r: any) => {
                        const d = String(r.shiftDate || '').slice(0, 10);
                        const t = String(r.shiftType || '');
                        const sc = String(r.stationCode || r.station || '').trim();
                        const opName = String(r.operatorName || '').trim();
                        if (d !== selectedDate) return false;
                        if (t !== selectedShiftType) return false;
                        if (!stationOk(sc)) return false;
                        if (!opOk(opName)) return false;
                        return true;
                      });

                      const asArray = (value: any) => (Array.isArray(value) ? value : []);
                      const isMeaningfulValue = (value: any): boolean => {
                        if (value == null) return false;
                        if (Array.isArray(value)) return value.some(isMeaningfulValue);
                        if (typeof value === 'object') return hasRowData(value);
                        return String(value).trim().length > 0;
                      };
                      const hasRowData = (row: any): boolean => {
                        if (!row || typeof row !== 'object') return isMeaningfulValue(row);
                        return Object.entries(row).some(([key, value]: any) => {
                          if (['id', 'shiftId', 'sortOrder', 'createdAt', 'updatedAt', 'key', 'itemKey', 'label', 'labelMn', 'labelEn'].includes(key)) return false;
                          return isMeaningfulValue(value);
                        });
                      };
                      const countRows = (rows: any) => asArray(rows).filter(hasRowData).length;
                      const payloadOf = (shift: any) =>
                        shift?.y120HandoverForm ||
                        shift?.y121HandoverForm ||
                        shift?.y130HandoverForm ||
                        shift?.y140HandoverForm ||
                        shift?.y150HandoverForm ||
                        shift?.y170HandoverForm ||
                        shift?.y170PackingOperatorForm ||
                        shift?.y180AutoclaveOperatorForm ||
                        shift?.y190HandoverForm ||
                        shift?.y210TechnologyKilnOperatorForm ||
                        shift?.y310RepairMasterForm ||
                        shift?.y320ElectricalAutomationRepairForm ||
                        shift?.factoryProcessControlForm ||
                        shift?.cah02ElectricalControlForm ||
                        shift?.ingredientChangeRecordForm ||
                        {};
                      const shiftCode = (shift: any) => String(shift?.stationCode || '');
                      const scheduleCode = (schedule: any) => String(schedule?.stationCode || schedule?.station || '');
                      const scheduledByCodes = (codes: string[]) => scheduleRows.filter((row: any) => codes.includes(scheduleCode(row))).length;
                      const shiftsByCodes = (codes: string[]) => slotAll.filter((shift: any) => codes.includes(shiftCode(shift)));
                      const latestFor = (rows: any[]) => {
                        const latest = rows
                          .map((shift: any) => shift?.submittedAt || shift?.createdAt || shift?.checkIn || '')
                          .filter(Boolean)
                          .sort()
                          .pop();
                        return latest ? new Date(latest).toLocaleTimeString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' }) : '—';
                      };
                      const statusTone = (done: number, expected: number, warning = 0) => {
                        if (warning > 0) return { label: 'Анхаарах', className: 'bg-amber-50 text-amber-700 border-amber-200' };
                        if (done > 0) return { label: 'Хэвийн', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
                        if (expected > 0) return { label: 'Дутуу', className: 'bg-red-50 text-red-700 border-red-200' };
                        return { label: 'Мэдээлэлгүй', className: 'bg-gray-50 text-gray-600 border-gray-200' };
                      };
                      const openMaintenanceCount = maintenanceRequests.filter((m: any) => ['Open', 'In Progress'].includes(String(m?.status || ''))).length;
                      const buildIndicator = (label: string, codes: string[], countData: (shift: any) => number, detail: string, warning = 0) => {
                        const shifts = shiftsByCodes(codes);
                        const expected = scheduledByCodes(codes);
                        const done = shifts.reduce((sum: number, shift: any) => sum + countData(shift), 0);
                        const status = statusTone(done, expected, warning);
                        return {
                          label,
                          value: done > 0 ? `${done} мөр` : `${shifts.length}/${expected || shifts.length || 0}`,
                          chartValue: done || shifts.length,
                          expected,
                          sub: `Ээлж: ${shifts.length} / Хуваарь: ${expected}`,
                          detail: `${detail} • Сүүлд: ${latestFor(shifts)}`,
                          status,
                          toneColor:
                            status.label === 'Анхаарах' ? 'bg-amber-500' :
                              status.label === 'Дутуу' ? 'bg-red-500' :
                                status.label === 'Мэдээлэлгүй' ? 'bg-gray-400' : 'bg-emerald-500',
                        };
                      };
                      const productionIndicators = [
                        buildIndicator(
                          'Түүхий эдийн бэлтгэл',
                          ['ҮЯ-120', 'ҮЯ-121', 'ҮЯ-130', 'ОНБ'],
                          (shift) => {
                            const p = payloadOf(shift);
                            return countRows(p.milledMaterials) + countRows(p.flowMetrics) + countRows(p.indicators) + countRows(p.ingredientRecords || p.rows);
                          },
                          'Зуурах, тээрмийн үзүүлэлт, орц найрлага'
                        ),
                        buildIndicator(
                          'Цутгалт',
                          ['ҮЯ-140'],
                          (shift) => countRows(payloadOf(shift).castingLog),
                          'Цутгалтын бүртгэлийн мөр'
                        ),
                        buildIndicator(
                          'Зүсэлт',
                          ['ҮЯ-150'],
                          (shift) => countRows(payloadOf(shift).cuttingLog),
                          'Зүсэлтийн бүртгэлийн мөр'
                        ),
                        buildIndicator(
                          'Бэлэн бүтээгдэхүүн гаралт',
                          ['ҮЯ-161', 'ҮЯ-170', 'ҮЯ-190'],
                          (shift) => {
                            const p = payloadOf(shift);
                            return countRows(p.productLog) + countRows(p.productSummary);
                          },
                          'Бүтээгдэхүүн, чанарын нэгтгэл'
                        ),
                        buildIndicator(
                          'Автоклав',
                          ['ҮЯ-180'],
                          (shift) => countRows(payloadOf(shift).timeRows),
                          'Автоклавын цагийн мөр'
                        ),
                        {
                          label: 'Ирц',
                          value: `${active.length}/${scheduleRows.length || 0}`,
                          chartValue: active.length,
                          expected: scheduleRows.length,
                          sub: `Идэвхтэй: ${active.length} / Хуваарь: ${scheduleRows.length}`,
                          detail: `Баталгаажсан: ${statusCounts.approved} • Хадгалсан: ${statusCounts.saved}`,
                          status: statusTone(active.length, scheduleRows.length, scheduleRows.length > 0 && active.length < scheduleRows.length ? 1 : 0),
                          toneColor: scheduleRows.length > 0 && active.length < scheduleRows.length ? 'bg-amber-500' : 'bg-emerald-500',
                        },
                        {
                          label: 'Сул зогсолт',
                          value: openMaintenanceCount,
                          chartValue: openMaintenanceCount,
                          expected: 0,
                          sub: 'Нээлттэй / ажиллаж буй засвар',
                          detail: 'Maintenance request болон засварын төлөв',
                          status: statusTone(0, 0, openMaintenanceCount),
                          toneColor: openMaintenanceCount > 0 ? 'bg-amber-500' : 'bg-gray-400',
                        },
                      ];
                      const productionMax = Math.max(
                        1,
                        ...productionIndicators.map((item: any) => Math.max(Number(item.chartValue || 0), Number(item.expected || 0)))
                      );
                      const dispatcherApprovedPct = slotAll.length > 0 ? Math.round((statusCounts.approved / slotAll.length) * 100) : 0;
                      const dispatcherCompareRows = [
                        { label: 'Идэвхтэй ээлж', value: active.length, color: 'bg-emerald-500' },
                        { label: 'Хүлээгдэж буй', value: pending.length + handovers.length, color: 'bg-blue-500' },
                        { label: 'Дутуу бүртгэл', value: lateOrMissing.length, color: 'bg-amber-500' },
                        { label: 'Хоцролт', value: latePeople.length, color: 'bg-red-500' },
                        { label: 'Нээлттэй засвар', value: openMaintenanceCount, color: 'bg-orange-500' },
                      ];
                      const dispatcherCompareMax = Math.max(1, ...dispatcherCompareRows.map((item: any) => Number(item.value || 0)));

                      return (
                        <>
                          <div>
                            <h3 className="text-2xl font-bold text-gray-900">Нүүр</h3>
                            <p className="text-gray-500">Бүх ээлжийн ерөнхий төлөв, хоцролт/дутуу бүртгэл, хүлээгдэж буй хүлээлцэх</p>
                          </div>

                          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[9rem_10rem_9rem_1.4fr_1.2fr]">
                              <div>
                                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Сар</p>
                                <input
                                  type="month"
                                  className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-800 shadow-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                                  value={dispatcherMonth}
                                  onChange={(e) => {
                                    const m = String(e.target.value || '').trim();
                                    if (!m) return;
                                    setSelectedDate(`${m}-01`);
                                  }}
                                />
                              </div>
                              <div>
                                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Огноо</p>
                                <div className="relative">
                                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm text-gray-800 shadow-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                                    placeholder="2026-06-03"
                                  value={selectedDate}
                                    onChange={(e) => {
                                      const value = e.target.value.trim();
                                      if (/^\d{0,4}(-\d{0,2}){0,2}$/.test(value)) setSelectedDate(value);
                                    }}
                                />
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Ээлж</p>
                                <select
                                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-800 shadow-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                                  value={selectedShiftType}
                                  onChange={(e) => setSelectedShiftType(e.target.value as any)}
                                >
                                  <option value="Өдрийн">Өдрийн</option>
                                  <option value="Шөнийн">Шөнийн</option>
                                </select>
                              </div>
                              <div>
                                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Дамжлага</p>
                                <select
                                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-800 shadow-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                                  value={dispatcherStation}
                                  onChange={(e) => setDispatcherStation(e.target.value)}
                                >
                                  <option value="all">Бүгд</option>
                                  {stations
                                    .filter((s: any) => String(s.code || '').startsWith('ҮЯ-'))
                                    .map((s: any) => (
                                      <option key={s.code} value={s.code}>
                                        {s.code} — {s.name}
                                      </option>
                                    ))}
                                </select>
                              </div>
                              <div>
                                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Оператор</p>
                                <input
                                  className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-800 shadow-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                                  placeholder="Нэрээр хайх..."
                                  value={dispatcherOperatorQ}
                                  onChange={(e) => setDispatcherOperatorQ(e.target.value)}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex flex-wrap items-start justify-between gap-4">
                              <div>
                                <h4 className="font-bold text-gray-900">Диспетчерийн хяналтын график</h4>
                                <p className="text-sm text-gray-500 mt-1">
                                  Сонгосон огноо, ээлж, дамжлагын хуваарь, бүртгэл, ээлжийн төлөвийн нэгтгэл
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full px-3 py-1 text-[10px] font-black tracking-wider ${deviceOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                  {deviceOnline ? 'Онлайн' : 'Офлайн'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('overview')}
                                  className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-black hover:bg-orange-700"
                                >
                                  Ээлжийн хяналт →
                                </button>
                              </div>
                            </div>
                            <div className="p-6 grid grid-cols-1 xl:grid-cols-5 gap-6">
                              <div className="xl:col-span-3 rounded-2xl border border-gray-100 bg-gray-50 p-5">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="font-bold text-gray-900">Үйлдвэрлэлийн үзүүлэлт</p>
                                    <p className="text-xs text-gray-500 mt-1">Ногоон: бүртгэл, Улбар шар: хуваарь</p>
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] font-bold text-gray-600">
                                    <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Бүртгэл</span>
                                    <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" />Хуваарь</span>
                                  </div>
                                </div>
                                <div className="mt-5 grid grid-cols-7 gap-3">
                                  {productionIndicators.map((item: any) => {
                                    const doneValue = Number(item.chartValue || 0);
                                    const expectedValue = Number(item.expected || 0);
                                    const doneHeight = doneValue > 0 ? Math.max(6, Math.round((doneValue / productionMax) * 70)) : 0;
                                    const expectedHeight = expectedValue > 0 ? Math.max(6, Math.round((expectedValue / productionMax) * 70)) : 0;
                                    const hasValue = doneValue > 0 || expectedValue > 0;
                                    return (
                                      <div key={item.label} className="min-w-0">
                                        <div className={`h-80 flex items-end justify-center gap-1.5 rounded-xl border px-2 py-2 ${hasValue ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-100/70'}`}>
                                          <div
                                            className={`w-3 rounded-t-md ${item.toneColor || 'bg-emerald-500'}`}
                                            style={{ height: `${doneHeight}px` }}
                                            title={`Бүртгэл: ${doneValue}`}
                                          />
                                          <div
                                            className="w-3 rounded-t-md bg-orange-500"
                                            style={{ height: `${expectedHeight}px` }}
                                            title={`Хуваарь: ${expectedValue}`}
                                          />
                                        </div>
                                        <p className="mt-2 min-h-[2rem] text-center text-[11px] font-bold leading-4 text-gray-600" title={item.label}>{item.label}</p>
                                        <p className="text-center text-[10px] text-gray-400">{doneValue}/{expectedValue}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4">
                                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                                  <p className="font-bold text-gray-900">Ээлжийн баталгаажуулалт</p>
                                  <div className="mt-4 flex items-center gap-5">
                                    <div
                                      className="h-28 w-28 rounded-full"
                                      style={{
                                        background: slotAll.length > 0
                                          ? `conic-gradient(#10b981 0 ${dispatcherApprovedPct}%, #f59e0b ${dispatcherApprovedPct}% 100%)`
                                          : 'conic-gradient(#e5e7eb 0 100%)',
                                      }}
                                    >
                                      <div className="m-3 flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full bg-white">
                                        <span className="text-2xl font-black text-gray-900">{dispatcherApprovedPct}%</span>
                                        <span className="text-[10px] font-bold text-gray-500">баталгаажсан</span>
                                      </div>
                                    </div>
                                    <div className="min-w-0 space-y-2 text-sm">
                                      <p className="font-bold text-emerald-700">Баталгаажсан: {statusCounts.approved}</p>
                                      <p className="font-bold text-amber-700">Баталгаажаагүй: {Math.max(0, slotAll.length - statusCounts.approved)}</p>
                                      <p className="text-xs text-gray-500">Нийт ээлжийн бүртгэл: {slotAll.length}</p>
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6">
                                  <p className="font-bold text-gray-900">Үзүүлэлтийн харьцуулалт</p>
                                  {dispatcherCompareRows.map((item: any) => {
                                    const itemValue = Number(item.value || 0);
                                    const width = itemValue > 0 ? Math.max(4, Math.round((itemValue / dispatcherCompareMax) * 100)) : 0;
                                    return (
                                      <div key={item.label} className="mt-3">
                                        <div className="flex items-center justify-between gap-3 text-xs">
                                          <span className="font-bold text-gray-700">{item.label}</span>
                                          <span className="font-black text-gray-900">{item.value}</span>
                                        </div>
                                        <div className="mt-1 h-2 rounded-full bg-white border border-gray-100 overflow-hidden">
                                          <div className={`h-full rounded-full ${item.color}`} style={{ width: `${width}%` }} />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
                              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Ерөнхий</p>
                              <p className="mt-2 text-3xl font-black text-gray-900">{slotAll.length}</p>
                              <p className="text-sm font-bold text-gray-700 mt-1">Нийт ээлж (сонгосон)</p>
                              <p className="text-xs text-gray-500 mt-2">
                                Баталгаажсан: <span className="font-bold text-emerald-700">{statusCounts.approved}</span> • Хадгалсан:{' '}
                                <span className="font-bold text-amber-700">{statusCounts.saved}</span> • Ноорог:{' '}
                                <span className="font-bold text-gray-700">{statusCounts.draft}</span>
                              </p>
                            </div>
                            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
                              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Идэвхтэй</p>
                              <p className="mt-2 text-3xl font-black text-gray-900">{active.length}</p>
                              <p className="text-sm font-bold text-gray-700 mt-1">Идэвхтэй ээлж</p>
                            </div>
                            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
                              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Дутуу</p>
                              <p className="mt-2 text-3xl font-black text-gray-900">{lateOrMissing.length}</p>
                              <p className="text-sm font-bold text-gray-700 mt-1">Дутуу/хоцорсон бүртгэл</p>
                              <button
                                type="button"
                                onClick={() => setActiveTab('overview')}
                                className="inline-flex mt-3 text-sm font-bold text-orange-700 hover:underline"
                              >
                                Харах →
                              </button>
                            </div>
                            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
                              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Хүлээлцэх</p>
                              <p className="mt-2 text-3xl font-black text-gray-900">{handovers.length}</p>
                              <p className="text-sm font-bold text-gray-700 mt-1">Хүлээгдэж буй хүлээлцэх</p>
                            </div>
                          </div>

                          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <h4 className="font-bold text-gray-900">Бодит цагийн үйлдвэрлэлийн үзүүлэлтүүд</h4>
                                <p className="text-sm text-gray-500 mt-1">Сүүлийн синк: {lastSyncLabel}</p>
                              </div>
                              <span className={`rounded-full px-3 py-1 text-[10px] font-black tracking-wider ${deviceOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                {deviceOnline ? 'Онлайн' : 'Офлайн'}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 divide-x divide-y divide-gray-100">
                              {productionIndicators.map((item: any) => (
                                <div key={item.label} className="p-5">
                                  <div className="flex items-start justify-between gap-3">
                                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider leading-tight">{item.label}</p>
                                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${item.status.className}`}>
                                      {item.status.label}
                                    </span>
                                  </div>
                                  <p className="mt-3 text-2xl font-black text-gray-900">{item.value}</p>
                                  <p className="mt-1 text-xs font-bold text-gray-600">{item.sub}</p>
                                  <p className="mt-2 text-xs text-gray-500 leading-relaxed">{item.detail}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                              <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-3">
                                <div>
                                  <h4 className="font-bold text-gray-900">Өнөөдрийн хуваарь (хурдан харагдац)</h4>
                                  <p className="text-sm text-gray-500 mt-1">Сонгосон огноо/ээлжийн хуваарь</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('admin')}
                                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-800 text-xs font-black hover:bg-gray-200"
                                >
                                  Хуваарь руу →
                                </button>
                              </div>
                              <div className="p-6">
                                {scheduleRows.length === 0 ? (
                                  <p className="text-sm text-gray-500">Сонгосон шүүлтүүрт хуваарь олдсонгүй.</p>
                                ) : (
                                  <ul className="space-y-3">
                                    {scheduleRows.slice(0, 14).map((r: any) => (
                                      <li
                                        key={String(r.id || `${r.shiftDate}:${r.shiftType}:${r.stationCode || r.station}:${r.operatorUid || r.operatorName}`)}
                                        className="rounded-2xl border border-gray-200 bg-gray-50 p-4 flex flex-wrap items-start justify-between gap-3"
                                      >
                                        <div className="min-w-0">
                                          <p className="font-bold text-gray-900">
                                            {String(r.stationCode || r.station || '—')} • {String(r.shiftType || '—')}
                                          </p>
                                          <p className="text-sm text-gray-700 mt-1">{String(r.operatorName || 'Оператор тодорхойгүй')}</p>
                                          <p className="text-xs text-gray-500 mt-1">{String(r.shiftDate || '').slice(0, 10) || '—'}</p>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>

                            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                              <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-3">
                                <div>
                                  <h4 className="font-bold text-gray-900">Хэн хоцорсон</h4>
                                  <p className="text-sm text-gray-500 mt-1">Хоцорсон (тооцоолсон) бүртгэлтэй операторууд</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('overview')}
                                  className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-black hover:bg-gray-800"
                                >
                                  Дэлгэрэнгүй →
                                </button>
                              </div>
                              <div className="p-6">
                                {latePeople.length === 0 ? (
                                  <p className="text-sm text-gray-500">Хоцорсон оператор илрээгүй.</p>
                                ) : (
                                  <ul className="space-y-3">
                                    {latePeople.slice(0, 12).map((r: any) => (
                                      <li key={String(r.shift?.id)} className="rounded-2xl border border-red-200 bg-red-50 p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="font-bold text-red-900">
                                              {r.shift?.stationCode} • {r.shift?.shiftType} — {r.shift?.operatorName || '—'}
                                            </p>
                                            <p className="text-sm text-red-900/80 mt-2">{r.reason || 'Хоцорсон ээлж хүлээлцэх'}</p>
                                          </div>
                                          <Link href={`/shift/${r.shift?.id}`} className="shrink-0 text-sm font-bold text-orange-700 hover:underline">
                                            Нээх →
                                          </Link>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                                <div>
                                  <h4 className="font-bold text-gray-900">Идэвхтэй ээлж</h4>
                                  <p className="text-sm text-gray-500 mt-1">Хэн идэвхтэй ажиллаж байна</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('overview')}
                                  className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-black hover:bg-gray-800"
                                >
                                  Ээлжийн хяналт →
                                </button>
                              </div>
                              <div className="p-6">
                                {active.length === 0 ? (
                                  <p className="text-sm text-gray-500">Идэвхтэй ээлж олдсонгүй.</p>
                                ) : (
                                  <ul className="space-y-3">
                                    {active.slice(0, 12).map((s: any) => (
                                      <li
                                        key={s.id}
                                        className="rounded-2xl border border-gray-200 bg-gray-50 p-4 flex flex-wrap items-center justify-between gap-3"
                                      >
                                        <div className="min-w-0">
                                          <p className="font-bold text-gray-900">
                                            {s.stationCode} • {s.shiftType}
                                          </p>
                                          <p className="text-sm text-gray-600 mt-1">Оператор: {s.operatorName || '—'}</p>
                                          <p className="text-xs text-gray-500 mt-1">Төлөв: {s.status || '—'}</p>
                                        </div>
                                        <Link href={`/shift/${s.id}`} className="shrink-0 text-sm font-bold text-orange-700 hover:underline">
                                          Нээх →
                                        </Link>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>

                            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                              <div className="p-6 border-b border-gray-100">
                                <h4 className="font-bold text-gray-900">Хүлээгдэж буй ээлж хүлээлцэх</h4>
                                <p className="text-sm text-gray-500 mt-1">Ээлж хүлээлцэх хүлээгдэж буй</p>
                              </div>
                              <div className="p-6">
                                {handovers.length === 0 ? (
                                  <p className="text-sm text-gray-500">Хүлээгдэж буй ээлж хүлээлцэх байхгүй.</p>
                                ) : (
                                  <ul className="space-y-3">
                                    {handovers.slice(0, 12).map((s: any) => (
                                      <li key={s.id} className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="font-bold text-blue-900">
                                              {s.stationCode} • {s.shiftType}
                                            </p>
                                            <p className="text-sm text-blue-900/80 mt-1">
                                              {s.operatorName || '—'} → {s.handoverToOperatorName || '—'}
                                            </p>
                                          </div>
                                          <Link href={`/shift/${s.id}`} className="shrink-0 text-sm font-bold text-orange-700 hover:underline">
                                            Нээх →
                                          </Link>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                              <div>
                                <h4 className="font-bold text-gray-900">Дутуу / Хүлээгдэж буй бүртгэл</h4>
                                <p className="text-sm text-gray-500 mt-1">Шалгаж баталгаажуулах шаардлагатай бичлэгүүд</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('all-entries')}
                                  className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-black hover:bg-gray-800"
                                >
                                  Тэмдэглэл харах →
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('overview')}
                                  className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-black hover:bg-orange-700"
                                >
                                  Хяналт руу →
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('all-entries')}
                                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-800 text-xs font-black hover:bg-gray-200"
                                >
                                  Бүх бүртгэл →
                                </button>
                              </div>
                            </div>
                            <div className="p-6">
                              {pending.length === 0 ? (
                                <p className="text-sm text-gray-500">Дутуу/хүлээгдэж буй бүртгэл олдсонгүй.</p>
                              ) : (
                                <ul className="space-y-3">
                                  {pending.slice(0, 15).map((s: any) => (
                                    <li key={s.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                      <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="font-bold text-amber-900">
                                            {s.stationCode} • {s.shiftType} — {s.operatorName || '—'}
                                          </p>
                                          <p className="text-xs text-amber-900/70 mt-2">Төлөв: {s.status || '—'}</p>
                                        </div>
                                        <Link href={`/shift/${s.id}`} className="shrink-0 text-sm font-bold text-orange-700 hover:underline">
                                          Нээх →
                                        </Link>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </section>
                ) : profile?.role === 'hse_engineer' ? (
                  <section className="space-y-6">
                    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-gray-100 flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h4 className="font-bold text-gray-900">ХАБ хяналтын график</h4>
                          <p className="text-sm text-gray-500 mt-1">Сүүлийн 7 хоногийн осол/зөрчил, хяналтын хуудас, баталгаажуулалтын төлөв</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('hse')}
                          className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-black hover:bg-orange-700"
                        >
                          Дэлгэрэнгүй бүртгэл →
                        </button>
                      </div>
                      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.35fr_0.9fr_1fr_auto]">
                          <div>
                            <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-gray-500">Эхлэх огноо</p>
                            <div className="relative">
                              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                              type="date"
                                className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 shadow-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                              value={hseChartSince}
                              onChange={(e) => setHseChartSince(e.target.value)}
                            />
                            </div>
                          </div>
                          <div>
                            <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-gray-500">Дуусах огноо</p>
                            <div className="relative">
                              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                              type="date"
                                className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 shadow-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                              value={hseChartUntil}
                              onChange={(e) => setHseChartUntil(e.target.value)}
                            />
                            </div>
                          </div>
                          <div>
                            <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-gray-500">Дамжлага</p>
                            <select
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                              value={hseChartStation}
                              onChange={(e) => setHseChartStation(e.target.value)}
                            >
                              <option value="all">Бүгд</option>
                              {stations.map((s: any) => (
                                <option key={s.code} value={s.code}>
                                  {s.code} — {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-gray-500">Ээлж</p>
                            <select
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                              value={hseChartShiftType}
                              onChange={(e) => setHseChartShiftType(e.target.value)}
                            >
                              <option value="all">Бүгд</option>
                              <option value="Өдрийн">Өдрийн</option>
                              <option value="Шөнийн">Шөнийн</option>
                            </select>
                          </div>
                          <div>
                            <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-gray-500">Төлөв</p>
                            <select
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                              value={hseChartStatus}
                              onChange={(e) => setHseChartStatus(e.target.value as any)}
                            >
                              <option value="all">Бүгд</option>
                              <option value="pending">Хүлээгдэж буй</option>
                              <option value="approved">Баталгаажсан / илгээсэн</option>
                            </select>
                          </div>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => {
                                setHseChartSince('');
                                setHseChartUntil('');
                                setHseChartStation('all');
                                setHseChartShiftType('all');
                                setHseChartStatus('all');
                              }}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-900 bg-gray-900 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-gray-800 xl:w-auto"
                            >
                              <RotateCcw className="h-4 w-4" />
                              Цэвэрлэх
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 grid grid-cols-1 xl:grid-cols-5 gap-6">
                        <div className="xl:col-span-3 rounded-2xl border border-gray-100 bg-gray-50 p-5">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-bold text-gray-900">Хугацааны үзүүлэлт</p>
                              <p className="text-xs text-gray-500 mt-1">Улбар шар: осол/зөрчил, Ногоон: хяналтын хуудас</p>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] font-bold text-gray-600">
                              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" />Осол</span>
                              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Хуудас</span>
                            </div>
                          </div>
                          {(() => {
                            const maxValue = Math.max(
                              1,
                              ...hseHome.trend7d.map((row: any) => Math.max(Number(row.incidents || 0), Number(row.checklists || 0)))
                            );
                            return (
                              <div
                                className="mt-5 grid gap-3 overflow-x-auto pb-1"
                                style={{ gridTemplateColumns: `repeat(${Math.max(1, hseHome.trend7d.length)}, minmax(4.5rem, 1fr))` }}
                              >
                                {hseHome.trend7d.map((row: any) => {
                                  const incidentValue = Number(row.incidents || 0);
                                  const checklistValue = Number(row.checklists || 0);
                                  const incidentHeight = incidentValue > 0 ? Math.max(8, Math.round((incidentValue / maxValue) * 204)) : 0;
                                  const checklistHeight = checklistValue > 0 ? Math.max(8, Math.round((checklistValue / maxValue) * 204)) : 0;
                                  return (
                                    <div key={row.date} className="min-w-0">
                                      <div className="flex h-70 items-end justify-center gap-2 rounded-xl border border-gray-100 bg-white px-2 py-3">
                                        <div
                                          className="w-4 rounded-t-lg bg-orange-500"
                                          style={{ height: `${incidentHeight}px` }}
                                          title={`Осол/зөрчил: ${row.incidents}`}
                                        />
                                        <div
                                          className="w-4 rounded-t-lg bg-emerald-500"
                                          style={{ height: `${checklistHeight}px` }}
                                          title={`Хяналтын хуудас: ${row.checklists}`}
                                        />
                                      </div>
                                      <p className="mt-2 truncate text-center text-[11px] font-bold text-gray-500">{row.label}</p>
                                      <p className="text-center text-[10px] text-gray-400">{row.incidents}/{row.checklists}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>

                        <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4">
                          {(() => {
                            const total = Math.max(0, Number(hseHome.totalLogs || 0));
                            const approved = Math.max(0, Number(hseHome.approvedCount || 0));
                            const pending = Math.max(0, total - approved);
                            const approvedPct = total > 0 ? Math.round((approved / total) * 100) : 0;
                            const chartDataTotal = hseHome.trend7d.reduce(
                              (sum: number, row: any) => sum + Number(row.incidents || 0) + Number(row.checklists || 0),
                              0
                            );
                            const hasChartData = chartDataTotal > 0;
                            return (
                              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                                <p className="font-bold text-gray-900">Баталгаажуулалтын төлөв</p>
                                <div className="mt-4 flex flex-wrap items-center gap-5">
                                  <div
                                    className="h-28 w-28 rounded-full"
                                    style={{
                                      background: hasChartData
                                        ? `conic-gradient(#10b981 0 ${approvedPct}%, #f59e0b ${approvedPct}% 100%)`
                                        : 'conic-gradient(#e5e7eb 0 100%)',
                                    }}
                                  >
                                    <div className="m-3 flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full bg-white">
                                      {hasChartData ? (
                                        <>
                                          <span className="text-2xl font-black text-gray-900">{approvedPct}%</span>
                                          <span className="text-[10px] font-bold text-gray-500">баталгаа</span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="text-center text-[11px] font-black leading-4 text-gray-500">Өгөгдөл</span>
                                          <span className="text-center text-[11px] font-black leading-4 text-gray-500">байхгүй</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="min-w-0 space-y-2 text-sm">
                                    <p className="font-bold text-emerald-700">Баталгаажсан: {approved}</p>
                                    <p className="font-bold text-amber-700">Хүлээгдэж буй: {pending}</p>
                                    <p className="text-xs text-gray-500">Нийт ХАБ бүртгэл: {total}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                            <p className="font-bold text-gray-900">Үзүүлэлтийн харьцуулалт</p>
                            {[
                              { label: 'Хүлээгдэж буй', value: hseHome.pendingCount, color: 'bg-amber-500' },
                              { label: '24 цагийн анхааруулга', value: hseHome.critical24h, color: 'bg-red-500' },
                              { label: 'Хугацааны осол/зөрчил', value: hseHome.incidents7d, color: 'bg-orange-500' },
                              { label: 'Хугацааны хяналтын хуудас', value: hseHome.checklist7d, color: 'bg-emerald-500' },
                            ].map((item: any) => {
                              const max = Math.max(1, hseHome.pendingCount, hseHome.critical24h, hseHome.incidents7d, hseHome.checklist7d);
                              const itemValue = Number(item.value || 0);
                              const width = itemValue > 0 ? Math.max(4, Math.round((itemValue / max) * 100)) : 0;
                              return (
                                <div key={item.label} className="mt-3">
                                  <div className="flex items-center justify-between gap-3 text-xs">
                                    <span className="font-bold text-gray-700">{item.label}</span>
                                    <span className="font-black text-gray-900">{item.value}</span>
                                  </div>
                                  <div className="mt-1 h-2 rounded-full bg-white border border-gray-100 overflow-hidden">
                                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${width}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white rounded-3xl border border-gray-200 p-6 text-center shadow-sm">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-400">Хүлээгдэж буй</p>
                        <p className="mt-3 text-4xl font-black text-gray-900">{hseHome.pendingCount}</p>
                        <p className="mt-2 text-sm font-bold text-gray-700">Шалгах ХАБ бүртгэл</p>
                        <p className="mx-auto mt-2 max-w-56 text-xs text-gray-500">Баталгаажуулаагүй / шалгах шаардлагатай</p>
                      </div>
                      <div className="bg-white rounded-3xl border border-gray-200 p-6 text-center shadow-sm">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-400">Анхааруулга</p>
                        <p className="mt-3 text-4xl font-black text-gray-900">{hseHome.critical24h}</p>
                        <p className="mt-2 text-sm font-bold text-gray-700">Анхааруулга (24 цаг)</p>
                        <p className="mx-auto mt-2 max-w-56 text-xs text-gray-500">Өндөр эсвэл онц ноцтой гэж тэмдэглэсэн</p>
                      </div>
                      <div className="bg-white rounded-3xl border border-gray-200 p-6 text-center shadow-sm">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-400">Осол, зөрчил</p>
                        <p className="mt-3 text-4xl font-black text-gray-900">{hseHome.incidentsToday}</p>
                        <p className="mt-2 text-sm font-bold text-gray-700">Осол, зөрчил (өнөөдөр)</p>
                        <p className="mt-2 text-xs text-gray-500">
                          Хугацаа: {hseHome.incidents7d} • 30 хоног: {hseHome.incidents30d}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white rounded-3xl border border-gray-200 p-6 text-center shadow-sm">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-400">Хяналтын хуудас</p>
                        <p className="mt-3 text-4xl font-black text-gray-900">{hseHome.checklist7d}</p>
                        <p className="mt-2 text-sm font-bold text-gray-700">ХАБ хяналтын хуудас (хугацаа)</p>
                        <p className="mt-2 text-xs text-gray-500">Ээлж дээрх үзүүлэлт</p>
                      </div>
                      <div className="rounded-3xl border border-orange-200 bg-orange-50/50 p-6 text-center shadow-sm">
                        <p className="text-xs font-black uppercase tracking-widest text-orange-800">Хяналтын анхааруулга</p>
                        <p className="mt-3 text-4xl font-black text-orange-900">{hseHome.checklistAttention24h}</p>
                        <p className="mx-auto mt-2 max-w-72 text-sm font-bold text-gray-800">24 цаг (сөрөг хариу эсвэл тэмдэглэлтэй)</p>
                      </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-gray-900">Сүүлийн ХАБ хяналтын хуудас</h4>
                          <p className="text-sm text-gray-500 mt-1">Ээлжийн хяналтын хуудас — дамжлага, оператор</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('hse')}
                          className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-black hover:bg-orange-700"
                        >
                          Бүртгэл рүү →
                        </button>
                      </div>
                      <div className="p-6">
                        {hseHome.recentChecklists.length === 0 ? (
                          <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 px-6 py-8 text-center">
                            <ClipboardCheck className="h-9 w-9 text-gray-300" />
                            <p className="mt-3 text-sm font-bold text-gray-700">Хяналтын хуудасны бүртгэл олдсонгүй.</p>
                            <p className="mt-1 text-xs text-gray-500">Огноо, дамжлага эсвэл төлөвийн шүүлтүүрийг өөрчилж дахин шалгана уу.</p>
                          </div>
                        ) : (
                          <ul className="space-y-3">
                            {hseHome.recentChecklists.map((row: any) => {
                              const d = row?.data && typeof row.data === 'object' ? row.data : {};
                              const submitted = !!(d as any).submittedAt;
                              return (
                                <li key={row.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="font-bold text-gray-900">{hseStationLabel(row.stationCode)}</p>
                                    <p className="text-sm text-gray-700 mt-1">{row.operatorName || '—'}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {row.createdAt ? new Date(row.createdAt).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' }) : '—'}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    <span
                                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${submitted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                        }`}
                                    >
                                      {submitted ? 'Илгээсэн' : 'Ноорог'}
                                    </span>
                                    <Link
                                      href={`/shift/${row.shiftId}`}
                                      className="text-xs font-bold text-orange-700 hover:underline"
                                    >
                                      Ээлж →
                                    </Link>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-gray-900">Сүүлийн ХАБ бүртгэлүүд</h4>
                            <p className="text-sm text-gray-500 mt-1">Дамжлага, оператор, цаг, төлөв</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab('hse')}
                            className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-black hover:bg-orange-700"
                          >
                            Харах →
                          </button>
                        </div>
                        <div className="p-6">
                          {hseHome.recent.length === 0 ? (
                            <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 px-6 py-8 text-center">
                              <ShieldAlert className="h-9 w-9 text-gray-300" />
                              <p className="mt-3 text-sm font-bold text-gray-700">Одоогоор ХАБ бүртгэл байхгүй.</p>
                              <p className="mt-1 text-xs text-gray-500">Шинэ бүртгэл үүсэх үед энд сүүлийн мэдээлэл харагдана.</p>
                            </div>
                          ) : (
                            <ul className="space-y-3">
                              {hseHome.recent.map((l: any) => (
                                <li key={l.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="font-bold text-gray-900">{hseStationLabel(l.stationCode)}</p>
                                      <p className="text-sm text-gray-700 mt-1">{l.operatorName || '—'}</p>
                                      <p className="text-xs text-gray-500 mt-1">
                                        {l.createdAt ? new Date(l.createdAt).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' }) : '—'}
                                      </p>
                                    </div>
                                    <span
                                      className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${l.hseEngineerApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                        }`}
                                    >
                                      {l.hseEngineerApproved ? 'Баталгаажсан' : 'Хүлээгдэж буй'}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-gray-900">Шийдвэр хүлээж буй</h4>
                            <p className="text-sm text-gray-500 mt-1">Баталгаажуулах шаардлагатай бичлэгүүд</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab('hse')}
                            className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-black hover:bg-orange-700"
                          >
                            Баталгаажуулах →
                          </button>
                        </div>
                        <div className="p-6">
                          {hseHome.pending.length === 0 ? (
                            <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 px-6 py-8 text-center">
                              <CheckCircle2 className="h-9 w-9 text-gray-300" />
                              <p className="mt-3 text-sm font-bold text-gray-700">Хүлээгдэж буй бичлэг байхгүй.</p>
                              <p className="mt-1 text-xs text-gray-500">Одоогоор баталгаажуулах шаардлагатай ХАБ бүртгэл алга.</p>
                            </div>
                          ) : (
                            <ul className="space-y-3">
                              {hseHome.pending.map((l: any) => (
                                <li key={l.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                  <p className="font-bold text-amber-900">{hseStationLabel(l.stationCode)}</p>
                                  <p className="text-sm text-amber-900/90 mt-1">{l.operatorName || '—'}</p>
                                  <p className="text-xs text-amber-900/70 mt-1">
                                    {l.createdAt ? new Date(l.createdAt).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' }) : '—'}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <button
                        type="button"
                        onClick={() => setActiveTab('hse')}
                        className="text-left bg-white rounded-3xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
                      >
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Quick action</p>
                        <p className="mt-2 text-lg font-black text-gray-900">ХАБ бүртгэл рүү орох</p>
                        <p className="text-sm text-gray-600 mt-1">ХАБ хяналтын хуудас болон осол/зөрчлийн бүртгэлүүд</p>
                      </button>
                    </div>
                  </section>
                ) : (
                  <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                      <h3 className="font-bold text-gray-900 mb-2">Бодит цагийн хяналт</h3>
                      <p className="text-sm text-gray-600">Идэвхтэй ээлж, дутуу бүртгэл, хүлээлцэх хүсэлтүүдийг хянах.</p>
                    </div>
                    <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                      <h3 className="font-bold text-gray-900 mb-2">Тайлан / KPI</h3>
                      <p className="text-sm text-gray-600">KPI хэсгээс CSV татаж тайлан гаргана.</p>
                    </div>
                    <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                      <h3 className="font-bold text-gray-900 mb-2">Системийн удирдлага</h3>
                      <p className="text-sm text-gray-600">Хуваарь, хэрэглэгчийн эрх, тохиргоо.</p>
                    </div>
                  </section>
                )}
              </>
            )}

            {profile?.role === 'master' && masterPendingAllShifts.length > 0 && (
              <section className="bg-amber-50 rounded-3xl border border-amber-100 shadow-sm overflow-hidden">
                <div id="master-pending-approvals" className="p-8 border-b border-amber-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-xl text-amber-900 flex items-center gap-2">
                      <ShieldCheck className="w-6 h-6" />
                      Баталгаажуулах хүлээгдэж буй ({masterPendingAllShifts.length})
                    </h3>
                    <p className="text-sm text-amber-700 mt-1">Операторуудын ирүүлсэн шинэ бүртгэлүүд — бүх огноо, ээлж</p>
                  </div>
                </div>
                <HorizontalPagedList
                  items={masterPendingAllShifts}
                  renderPage={(page) => (
                  <table className="w-full table-fixed text-left">
                    <thead>
                      <tr className="bg-amber-100/50 text-amber-800 text-xs uppercase tracking-wider">
                        <th className="px-8 py-5 font-bold">Огноо</th>
                        <th className="px-8 py-5 font-bold">Ээлж</th>
                        <th className="px-8 py-5 font-bold">Дамжлага</th>
                        <th className="px-8 py-5 font-bold">Оператор</th>
                        <th className="px-8 py-5 font-bold">Үйлдэл</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {page.map((shift: any) => (
                        <tr key={shift.id} className="hover:bg-amber-100/30 transition-colors">
                          <td className="px-8 py-6 text-sm text-amber-900 font-medium">{shift.shiftDate}</td>
                          <td className="px-8 py-6 text-sm text-amber-900 font-medium">{shift.shiftType}</td>
                          <td className="px-8 py-6 text-sm text-amber-900 font-bold">{shift.stationCode}</td>
                          <td className="px-8 py-6 text-sm text-amber-800 font-medium">{shift.operatorName}</td>
                          <td className="px-8 py-6">
                            <Link
                              href={`/shift/${shift.id || (shift as any)._id}`}
                              className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-black hover:bg-amber-700 transition-all shadow-md active:scale-95"
                            >
                              Хянах
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  )}
                />
              </section>
            )}

            {isOperatorView && (
              <section>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <StatCard
                    title="Миний нийт бүртгэл"
                    value={stats.total.toString()}
                    icon={<Clock className="w-5 h-5 text-orange-600" />}
                    subValue="Сүүлийн 10 бүртгэл"
                  />
                  <StatCard
                    title="Баталгаажсан"
                    value={stats.approved.toString()}
                    icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                    subValue={`${Math.round((stats.approved / (stats.total || 1)) * 100)}% амжилттай`}
                  />
                  <StatCard
                    title="Хүлээгдэж буй"
                    value={stats.pending.toString()}
                    icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
                    subValue="Мастерын хяналтанд"
                  />
                </div>

                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden mb-8">
                  <div className="p-8 border-b border-gray-200 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-xl text-gray-900">Өмнөх операторын ээлжийн бүртгэл</h3>
                      <p className="text-sm text-gray-500 mt-1">Танд хүлээлцүүлэхээр илгээсэн өмнөх операторын бүртгэлийг эндээс нээнэ</p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-black">
                      Нийт: {operatorPreviousHandoverShifts.length}
                    </span>
                  </div>
                  <div className="p-8">
                    {operatorPreviousHandoverShifts.length === 0 ? (
                      <p className="text-sm text-gray-500">Одоогоор танд хүлээлцүүлсэн өмнөх операторын бүртгэл алга.</p>
                    ) : (
                      <HorizontalPagedList
                        items={operatorPreviousHandoverShifts}
                        renderPage={(page) => (
                      <div className="space-y-3">
                      {page.map((s: any) => {
                        const shiftId = s.id || s._id;
                        return (
                          <div
                            key={shiftId || `${s.stationCode}-${s.shiftDate}-${s.shiftType}`}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-emerald-900">{s.stationCode} • {s.shiftType}</p>
                              <p className="text-sm text-emerald-900/80 mt-1">Өмнөх оператор: {s.operatorName || '—'}</p>
                              <p className="text-xs text-emerald-900/70 mt-1">{s.shiftDate} • Төлөв: {handoverStageDisplay(s.handoverStage, s.status)}</p>
                            </div>
                            {shiftId ? (
                              <Link
                                href={`/shift/${shiftId}`}
                                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                              >
                                {s.handoverStage === 'waiting_next_operator' ? 'Хүлээн авах / харах' : 'Бүртгэл харах'}
                              </Link>
                            ) : null}
                          </div>
                        );
                      })}
                      </div>
                        )}
                      />
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-8 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-xl text-gray-900">Миний сүүлийн үеийн бүртгэлүүд</h3>
                      {/* helper copy removed */}
                    </div>
                  </div>
                  <HorizontalPagedList
                    items={loading ? [] : shifts}
                    renderPage={(page) => (
                    <table className="w-full table-fixed text-left">
                      <colgroup>
                        <col className="w-[12%]" />
                        <col className="w-[17%]" />
                        <col className="w-[10%]" />
                        <col className="w-[14%]" />
                        <col className="w-[17%]" />
                        <col className="w-[17%]" />
                        <col className="w-[13%]" />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                          <th className="px-4 py-5 font-bold lg:px-5">Огноо</th>
                          <th className="px-4 py-5 font-bold lg:px-5">Дамжлага</th>
                          <th className="px-4 py-5 font-bold lg:px-5">Ээлж</th>
                          <th className="px-4 py-5 font-bold lg:px-5">Төлөв</th>
                          <th className="px-4 py-5 font-bold lg:px-5">Эхэлсэн</th>
                          <th className="px-4 py-5 font-bold lg:px-5">Дууссан</th>
                          <th className="px-4 py-5 text-right font-bold lg:px-5">Үйлдэл</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {loading ? (
                          <tr>
                            <td colSpan={7} className="px-8 py-12 text-center text-gray-400">Уншиж байна...</td>
                          </tr>
                        ) : shifts.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-8 py-12 text-center text-gray-400">Бүртгэл одоогоор байхгүй байна.</td>
                          </tr>
                        ) : (
                          page.map((shift: any) => (
                            <TableRow
                              key={shift.id}
                              id={shift.id}
                              date={shift.shiftDate}
                              station={shift.stationCode}
                              stationName={shift.stationName}
                              type={shift.shiftType}
                              status={shift.status}
                              checkIn={shift.checkIn ?? null}
                              checkOut={shift.checkOut ?? null}
                            />
                          ))
                        )}
                      </tbody>
                    </table>
                    )}
                  />
                </div>
              </section>
            )}
          </>
        </div>
  );
}
