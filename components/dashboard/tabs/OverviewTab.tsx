import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  FileWarning,
  RotateCcw,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { resolveHandoverWindow } from '@/lib/handover-window';
import { currentDashboardSlot } from '@/lib/dashboard-clock';
import { mnDateTimeCompact } from '../dashboard-helpers';
import { HorizontalPagedList } from '../HorizontalPagedList';

export function OverviewTab({
  profile,
  selectedDate,
  setSelectedDate,
  selectedShiftType,
  setSelectedShiftType,
  overviewStation,
  setOverviewStation,
  overviewStatus,
  setOverviewStatus,
  overviewOperator,
  setOverviewOperator,
  overviewQuery,
  setOverviewQuery,
  overviewOperatorOptions,
  overviewRows,
  stations,
  masterHome,
  allShifts,
  dispatcherCompliance,
  dispatcherComplianceLoading,
  handoverQueue,
  pendingShifts,
  systemSettings,
}: any) {
  const dispatcherOperatorOptions = (() => {
    if (profile?.role !== 'dispatcher') return overviewOperatorOptions;
    const byUid = new Map<string, string>();
    const source = Array.isArray(dispatcherCompliance?.summary?.operatorRows)
      ? dispatcherCompliance.summary.operatorRows
      : [
          ...(Array.isArray(dispatcherCompliance?.lateRows) ? dispatcherCompliance.lateRows : []),
          ...(Array.isArray(dispatcherCompliance?.missingRows) ? dispatcherCompliance.missingRows : []),
        ];
    for (const row of source) {
      const uid = String(row?.operatorUid || '').trim();
      const name = String(row?.operatorName || '').trim();
      if (uid && name && !byUid.has(uid)) byUid.set(uid, name);
    }
    return Array.from(byUid, ([uid, name]) => ({ uid, name })).sort((a, b) => a.name.localeCompare(b.name));
  })();
  const dispatcherStationOptions = (() => {
    if (profile?.role !== 'dispatcher') return stations;
    const rows = Array.isArray(dispatcherCompliance?.summary?.stationRows)
      ? dispatcherCompliance.summary.stationRows
      : [];
    return rows
      .map((row: any) => ({
        code: String(row?.stationCode || '').trim(),
        name: String(row?.stationName || '').trim(),
      }))
      .filter((row: any) => row.code);
  })();

  return (
          <section className="space-y-8">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                {profile?.role === 'dispatcher' ? 'Хоцролт, дутуу бүртгэл' : 'Ээлжийн хяналт'}
              </h3>
              <p className="text-gray-500">
                {profile?.role === 'dispatcher'
                  ? 'Хоцролт болон дутуу бүртгэлийг ялган хянах'
                  : 'Аль оператор ямар ээлж дээр байгаа, төлөв, цагийн мэдээлэл'}
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4">
                <div className="xl:col-span-2">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Огноо</p>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
                <div className="xl:col-span-2">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Ээлж</p>
                  <select
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800"
                    value={selectedShiftType}
                    onChange={(e) => setSelectedShiftType(e.target.value as any)}
                  >
                    <option value="Өдрийн">Өдрийн</option>
                    <option value="Шөнийн">Шөнийн</option>
                  </select>
                </div>
                <div className="xl:col-span-3">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Хэсэг / Станц</p>
                  <select
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800"
                    value={overviewStation}
                    onChange={(e) => setOverviewStation(e.target.value)}
                  >
                    <option value="all">Бүгд</option>
                    {dispatcherStationOptions
                      .filter((s: any) => String(s.code || '').startsWith('ҮЯ-'))
                      .map((s: any) => (
                        <option key={s.code} value={s.code}>
                          {s.code} — {s.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="xl:col-span-2">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Төлөв</p>
                  <select
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800"
                    value={overviewStatus}
                    onChange={(e) => setOverviewStatus(e.target.value)}
                  >
                    <option value="all">Бүгд</option>
                    <option value="Ноорог">Ноорог</option>
                    <option value="Хадгалсан">Хадгалсан</option>
                    <option value="Баталгаажсан">Баталгаажсан</option>
                    <option value="Цуцлагдсан">Цуцлагдсан</option>
                    {profile?.role === 'dispatcher' ? <option value="Бүртгэл үүсгээгүй">Бүртгэл үүсгээгүй</option> : null}
                  </select>
                </div>
                <div className="xl:col-span-3">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Оператороор шүүх</p>
                  <select
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800"
                    value={overviewOperator}
                    onChange={(e) => setOverviewOperator(e.target.value)}
                  >
                    <option value="all">Бүх оператор</option>
                    {dispatcherOperatorOptions.map((op: any) => (
                      <option key={op.uid} value={op.uid}>
                        {op.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 xl:col-span-5">
                  {/* Хайлт нь оператор, дамжлагын код/нэр, төлөв, ээлжийн төрлөөр
                      явагддаг тул шошгыг зөвхөн «операторын нэр» гэж хязгаарлахгүй. */}
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Хайх</p>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-gray-800 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-50"
                      value={overviewQuery}
                      onChange={(e) => setOverviewQuery(e.target.value)}
                      placeholder="Оператор, дамжлага, төлөвөөр хайх..."
                    />
                  </div>
                </div>
                <div className="flex items-end md:col-span-2 xl:col-span-2">
                  <button
                    type="button"
                    onClick={() => {
                      // «Цэвэрлэх» нь энэ самбарын БҮХ шүүлтүүрийг анхны утга руу
                      // буцаана. Урьд нь Огноо/Ээлж хоёрыг орхидог байсан тул
                      // хэрэглэгч «цэвэрлэсэн» гэж бодоод өчигдрийн/шөнийн
                      // ээлжийн жагсаалтыг харсаар үлддэг байв.
                      const current = currentDashboardSlot();
                      setSelectedDate(current.date);
                      setSelectedShiftType(current.shiftType);
                      setOverviewStation('all');
                      setOverviewStatus('all');
                      setOverviewOperator('all');
                      setOverviewQuery('');
                    }}
                    className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 text-sm font-black text-gray-700 transition hover:bg-gray-200"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Цэвэрлэх
                  </button>
                </div>
              </div>
            </div>

            {profile?.role === 'dispatcher' ? (
              (() => {
                const sameSlot = (s: any) => s?.shiftDate === selectedDate && s?.shiftType === selectedShiftType;
                const parseHmToMinutes = (value: any) => {
                  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
                  if (!match) return null;
                  const hour = Number(match[1]);
                  const minute = Number(match[2]);
                  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
                  return hour * 60 + minute;
                };
                const localDateParts = (value: any) => {
                  const date = new Date(String(value || ''));
                  if (!Number.isFinite(date.getTime())) return null;
                  const parts = new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Asia/Ulaanbaatar',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  }).formatToParts(date);
                  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
                  return {
                    year: pick('year'),
                    month: pick('month'),
                    day: pick('day'),
                    hour: pick('hour'),
                    minute: pick('minute'),
                  };
                };
                const lateMinutesFor = (shift: any) => {
                  const resolvedMinutes = Number(shift?.timingDeviationMinutes);
                  if (Number.isFinite(resolvedMinutes) && resolvedMinutes >= 0) return resolvedMinutes;
                  const recordedAt = shift?.handoverTimingRecordedAt || shift?.submittedAt || shift?.checkOut || shift?.checkIn || shift?.createdAt;
                  const local = localDateParts(recordedAt);
                  const shiftDate = String(shift?.shiftDate || '').slice(0, 10);
                  const [sy, sm, sd] = shiftDate.split('-').map(Number);
                  if (!local || !sy || !sm || !sd) return null;
                  const endText = resolveHandoverWindow(shift?.shiftType, systemSettings).end;
                  const endMinutes = parseHmToMinutes(endText);
                  if (endMinutes == null) return null;
                  const shiftDayMs = Date.UTC(sy, sm - 1, sd);
                  const localDayMs = Date.UTC(local.year, local.month - 1, local.day);
                  const dayDiff = Math.round((localDayMs - shiftDayMs) / (24 * 60 * 60 * 1000));
                  return Math.max(0, dayDiff * 1440 + local.hour * 60 + local.minute - endMinutes);
                };
                const lateDurationLabel = (minutes: number | null) => {
                  if (minutes == null) return 'Тооцоолох боломжгүй';
                  if (minutes <= 0) return '0 минут';
                  const hours = Math.floor(minutes / 60);
                  const rest = minutes % 60;
                  if (hours <= 0) return `${rest} минут`;
                  if (rest <= 0) return `${hours} цаг`;
                  return `${hours} цаг ${rest} минут`;
                };
                const timingDeviationLabel = (row: any) => {
                  const duration = lateDurationLabel(row?.lateMinutes);
                  return row?.shift?.timingDirection === 'early' ? `${duration} эрт` : `${duration} хоцорсон`;
                };
                const lateRecordedAtLabel = (shift: any) => {
                  const recordedAt = shift?.handoverTimingRecordedAt || shift?.submittedAt || shift?.checkOut || shift?.checkIn || shift?.createdAt;
                  const date = new Date(String(recordedAt || ''));
                  return Number.isFinite(date.getTime())
                    ? date.toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })
                    : '—';
                };
                const matchesFilters = (row: any) => {
                  if (overviewStation !== 'all' && String(row?.stationCode || '') !== overviewStation) return false;
                  if (overviewStatus !== 'all' && String(row?.status || '') !== overviewStatus) return false;
                  if (overviewOperator !== 'all') {
                    const uid = String(row?.operatorUid || '').trim();
                    const name = String(row?.operatorName || '').trim();
                    if (uid !== overviewOperator && name !== overviewOperator) return false;
                  }
                  const query = overviewQuery.trim().toLowerCase();
                  if (query) {
                    const hay = [
                      row?.operatorName,
                      row?.stationCode,
                      row?.stationName,
                      row?.status,
                      ...(Array.isArray(row?.missing) ? row.missing : []),
                    ]
                      .filter(Boolean)
                      .join(' ')
                      .toLowerCase();
                    if (!hay.includes(query)) return false;
                  }
                  return true;
                };
                const late = (Array.isArray(dispatcherCompliance?.lateRows) ? dispatcherCompliance.lateRows : [])
                  .filter(matchesFilters)
                  .map((shift: any) => ({
                    shift,
                    formLabel: `${shift?.stationCode || '—'}${shift?.stationName ? ` — ${shift.stationName}` : ''}`,
                    lateMinutes: lateMinutesFor(shift),
                    reason: shift?.handoverTimingReason || shift?.handoverTimingStatus || 'Хоцорсон ээлж хүлээлцэх',
                    recordedAtLabel: lateRecordedAtLabel(shift),
                  }));
                const early = (Array.isArray(dispatcherCompliance?.earlyRows) ? dispatcherCompliance.earlyRows : [])
                  .filter(matchesFilters)
                  .map((shift: any) => ({
                    shift,
                    formLabel: `${shift?.stationCode || '—'}${shift?.stationName ? ` — ${shift.stationName}` : ''}`,
                    lateMinutes: lateMinutesFor(shift),
                    reason:
                      shift?.handoverTimingReason ||
                      shift?.handoverTimingStatus ||
                      'Стандарт хугацаанаас эрт бүртгэл үүсгэсэн',
                    recordedAtLabel: lateRecordedAtLabel(shift),
                  }));
                const timingRows = [...late, ...early].sort((a: any, b: any) =>
                  String(b.shift?.handoverTimingRecordedAt || b.shift?.createdAt || '').localeCompare(
                    String(a.shift?.handoverTimingRecordedAt || a.shift?.createdAt || '')
                  )
                );
                const missingOnly = (Array.isArray(dispatcherCompliance?.missingRows) ? dispatcherCompliance.missingRows : [])
                  .filter(matchesFilters);

                const summaryRows = (Array.isArray(dispatcherCompliance?.summary?.operatorRows)
                  ? dispatcherCompliance.summary.operatorRows
                  : []
                ).filter(matchesFilters);
                const handovers = summaryRows.filter((row: any) => row?.pendingHandover === true);
                const pending = summaryRows.filter((row: any) => row?.pendingApproval === true);

                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      {[
                        { label: 'Хоцролт', value: late.length, detail: 'Хоцорсон бүртгэл', icon: Clock3, iconClass: 'bg-red-50 text-red-700' },
                        { label: 'Эрт эхэлсэн', value: early.length, detail: 'Цагаас эрт эхэлсэн', icon: AlertTriangle, iconClass: 'bg-cyan-50 text-cyan-700' },
                        { label: 'Дутуу', value: missingOnly.length, detail: 'Дутуу бүртгэл', icon: FileWarning, iconClass: 'bg-amber-50 text-amber-700' },
                        { label: 'Батлах', value: pending.length, detail: 'Баталгаажуулалт хүлээж буй', icon: Send, iconClass: 'bg-violet-50 text-violet-700' },
                        { label: 'Хүлээлцэх', value: handovers.length, detail: 'Хүлээн авах хүлээлт', icon: Users, iconClass: 'bg-blue-50 text-blue-700' },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <div key={item.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-wider text-gray-500">{item.label}</p>
                                <p className="mt-2 text-3xl font-black text-gray-950">{item.value}</p>
                              </div>
                              <span className={`rounded-xl p-2.5 ${item.iconClass}`}>
                                <Icon className="h-5 w-5" />
                              </span>
                            </div>
                            <p className="mt-3 text-xs font-bold text-gray-500">{item.detail}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
                      <div className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
                        <div className="flex items-start justify-between gap-3 border-b border-red-100 bg-red-50/40 px-5 py-4">
                          <div>
                            <h4 className="font-black text-gray-950">Цагийн зөрүүтэй бүртгэл</h4>
                            <p className="mt-1 text-sm text-gray-500">Хоцорсон болон эрт эхэлсэн бүртгэл</p>
                          </div>
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">{timingRows.length}</span>
                        </div>
                        {dispatcherComplianceLoading ? (
                          <div className="px-5 py-10 text-center text-sm font-semibold text-gray-500">Мэдээлэл шалгаж байна...</div>
                        ) : timingRows.length === 0 ? (
                          <div className="flex flex-col items-center px-6 py-12 text-center">
                            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                            <p className="mt-3 font-black text-gray-900">Цагийн зөрүү илрээгүй</p>
                            <p className="mt-1 text-sm text-gray-500">Сонгосон нөхцөлд бүртгэл хэвийн байна.</p>
                          </div>
                        ) : (
                          <HorizontalPagedList
                            items={timingRows}
                            pageSize={6}
                            renderPage={(page) => (
                              <ul className="divide-y divide-gray-100">
                                {page.map((r: any) => {
                                  const isEarly = r.shift?.timingDirection === 'early';
                                  return (
                                    <li key={`${r.shift?.id}:${r.shift?.timingDirection}`} className="px-5 py-4">
                                      <div className="flex items-start gap-3">
                                        <span className={`mt-0.5 rounded-xl p-2 ${isEarly ? 'bg-cyan-50 text-cyan-700' : 'bg-red-50 text-red-700'}`}>
                                          <Clock3 className="h-4 w-4" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-black text-gray-950">{r.shift?.operatorName || 'Операторгүй'}</p>
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${isEarly ? 'bg-cyan-50 text-cyan-700' : 'bg-red-50 text-red-700'}`}>
                                              {isEarly ? 'Эрт эхэлсэн' : 'Хоцорсон'}
                                            </span>
                                          </div>
                                          <p className="mt-1 text-sm font-semibold text-gray-600">{r.formLabel}</p>
                                          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                                            <div>
                                              <dt className="font-black text-gray-400">Хугацааны зөрүү</dt>
                                              <dd className="mt-0.5 font-bold text-gray-800">{timingDeviationLabel(r)}</dd>
                                            </div>
                                            <div>
                                              <dt className="font-black text-gray-400">Бүртгэсэн цаг</dt>
                                              <dd className="mt-0.5 font-bold text-gray-800">{r.recordedAtLabel}</dd>
                                            </div>
                                          </dl>
                                          <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
                                            <span className="font-black text-gray-800">Шалтгаан:</span> {r.reason || 'Тайлбаргүй'}
                                          </div>
                                        </div>
                                        <Link href={`/shift/${r.shift?.id}`} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-xs font-black text-gray-700 transition hover:bg-gray-200">
                                          Нээх
                                          <ChevronRight className="h-3.5 w-3.5" />
                                        </Link>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          />
                        )}
                      </div>

                      <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
                        <div className="flex items-start justify-between gap-3 border-b border-amber-100 bg-amber-50/40 px-5 py-4">
                          <div>
                            <h4 className="font-black text-gray-950">Дутуу бүртгэл</h4>
                            <p className="mt-1 text-sm text-gray-500">Бөглөөгүй маягт болон давтамжит бүртгэл</p>
                          </div>
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">{missingOnly.length}</span>
                        </div>
                        {dispatcherComplianceLoading ? (
                          <div className="px-5 py-10 text-center text-sm font-semibold text-gray-500">Мэдээлэл шалгаж байна...</div>
                        ) : missingOnly.length === 0 ? (
                          <div className="flex flex-col items-center px-6 py-12 text-center">
                            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                            <p className="mt-3 font-black text-gray-900">Дутуу бүртгэл илрээгүй</p>
                            <p className="mt-1 text-sm text-gray-500">
                              {dispatcherCompliance?.slotElapsed === false
                                ? `Шалгах хугацаа ${dispatcherCompliance?.window?.label || ''} хүртэл үргэлжилнэ.`
                                : 'Сонгосон нөхцөлд бүртгэл бүрэн байна.'}
                            </p>
                          </div>
                        ) : (
                          <HorizontalPagedList
                            items={missingOnly}
                            pageSize={6}
                            renderPage={(page) => (
                              <ul className="divide-y divide-gray-100">
                                {page.map((r: any) => (
                                  <li key={r.id} className="px-5 py-4">
                                    <div className="flex items-start gap-3">
                                      <span className="mt-0.5 rounded-xl bg-amber-50 p-2 text-amber-700">
                                        <FileWarning className="h-4 w-4" />
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="font-black text-gray-950">{r.operatorName || 'Операторгүй'}</p>
                                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">
                                            {r.status || 'Дутуу'}
                                          </span>
                                        </div>
                                        <p className="mt-1 text-sm font-semibold text-gray-600">
                                          {r.stationCode || '—'}{r.stationName ? ` · ${r.stationName}` : ''} · {r.shiftType || '—'}
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          {(Array.isArray(r.missing) ? r.missing : ['Тодорхойгүй бүртгэл']).map((label: string) => (
                                            <span key={label} className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                                              {label}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                      {r.shiftId ? (
                                        <Link href={`/shift/${r.shiftId}`} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-xs font-black text-gray-700 transition hover:bg-gray-200">
                                          Нээх
                                          <ChevronRight className="h-3.5 w-3.5" />
                                        </Link>
                                      ) : null}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-gray-900">Илэрц</h4>
                    <p className="text-sm text-gray-500">Нийт: {overviewRows.length}</p>
                  </div>
                </div>
                <HorizontalPagedList
                  items={overviewRows}
                  renderPage={(page) => (
                  <table className="w-full table-fixed text-left">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider">
                        <th className="px-6 py-4 font-bold">Дамжлага</th>
                        <th className="px-6 py-4 font-bold">Оператор</th>
                        <th className="px-6 py-4 font-bold">Ээлж</th>
                        <th className="px-6 py-4 font-bold">Төлөв</th>
                        <th className="px-6 py-4 font-bold">Эхэлсэн цаг</th>
                        <th className="px-6 py-4 font-bold">Дууссан цаг</th>
                        <th className="px-6 py-4 font-bold">Хэн эхлүүлсэн</th>
                        <th className="px-6 py-4 font-bold">Хэн дуусгасан</th>
                        <th className="w-[10.5rem] px-4 py-4 text-right font-bold">Үйлдэл</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {page.map((s: any) => {
                        const startedBy = s.operatorName || '—';
                        const endedBy = s.checkOut ? (s.operatorName || '—') : '—';
                        const checkInLabel = mnDateTimeCompact(s.checkIn);
                        const checkOutLabel = mnDateTimeCompact(s.checkOut);
                        const status = String(s.status || '—');
                        const statusLower = status.toLowerCase();
                        const statusClass =
                          statusLower.includes('баталгааж') || statusLower.includes('approved')
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : statusLower.includes('хүлээгд') || statusLower.includes('pending') || statusLower.includes('хадгал')
                              ? 'border-amber-200 bg-amber-50 text-amber-700'
                              : statusLower.includes('цуц') || statusLower.includes('cancel')
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : 'border-gray-200 bg-gray-50 text-gray-700';
                        return (
                          <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-sm text-gray-900 font-bold">{s.stationCode || '—'}</td>
                            <td className="px-6 py-4 text-sm text-gray-700">{s.operatorName || '—'}</td>
                            <td className="px-6 py-4 text-sm text-gray-700">{s.shiftType || '—'}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${statusClass}`}>
                                {status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-600">{checkInLabel}</td>
                            <td className="px-6 py-4 text-xs text-gray-600">{checkOutLabel}</td>
                            <td className="px-6 py-4 text-sm text-gray-700">{startedBy}</td>
                            <td className="px-6 py-4 text-sm text-gray-700">{endedBy}</td>
                            <td className="px-4 py-4 text-right">
                              <Link href={`/shift/${s.id}`} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black text-orange-700 transition hover:bg-orange-100">
                                <Eye className="h-3.5 w-3.5 shrink-0" />
                                Дэлгэрэнгүй
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                      {overviewRows.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-6 py-10 text-center text-gray-400">
                            Таарах мэдээлэл олдсонгүй.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  )}
                />
              </div>
            )}
          </section>
  );
}
