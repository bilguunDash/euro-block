import Link from 'next/link';
import { HorizontalPagedList } from '../HorizontalPagedList';
import { CheckCircle2, Clock, Factory, ShieldCheck } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';

/** `users.role` → Excel/UI-д харуулах Монгол шошго. */
const ROLE_LABELS: Record<string, string> = {
  operator: 'Оператор',
  master: 'Ээлжийн мастер',
};

type EmployeeOption = { id: string; name: string; email?: string | null; role: string };

type KpiTabProps = {
  profileRole?: string | null;
  downloadKpiCsv: () => Promise<void> | void;
  reportTab: 'downtime' | 'missing';
  setReportTab: (tab: 'downtime' | 'missing') => void;
  reportSince: string;
  setReportSince: (value: string) => void;
  reportUntil: string;
  setReportUntil: (value: string) => void;
  reportShiftType: 'all' | 'Өдрийн' | 'Шөнийн';
  setReportShiftType: (value: 'all' | 'Өдрийн' | 'Шөнийн') => void;
  reportStation: string;
  setReportStation: (value: string) => void;
  reportQuery: string;
  setReportQuery: (value: string) => void;
  /** Нэгдсэн "Ажилтан" шүүлтүүр — сонгосон хүн ОПЕРАТОР эсвэл ХҮЛЭЭН БАТАЛГААЖУУЛСАН
   * ЭЭЛЖИЙН МАСТЕРААР орсон бүх бүртгэлийг оруулна (зөвхөн Admin/Dispatcher харагдац). */
  reportEmployeeUid: string;
  setReportEmployeeUid: (value: string) => void;
  employeeOptions: EmployeeOption[];
  reportMissingRows: any[];
  reportDowntimeRows: any[];
  kpiStats: any;
  stations: any[];
  /** Шүүлтүүр тавьсан үед серверээс ирэх тойм. Шүүлтүүргүй бол `null`. */
  reportSummary?: {
    totalShifts: number;
    approvedCount: number;
    completionRatePct: number;
    operatorCompletedCount: number;
  } | null;
  reportSummaryLoading?: boolean;
};

type ReportFilterProps = Pick<
  KpiTabProps,
  | 'reportSince' | 'setReportSince'
  | 'reportUntil' | 'setReportUntil'
  | 'reportShiftType' | 'setReportShiftType'
  | 'reportStation' | 'setReportStation'
  | 'reportQuery' | 'setReportQuery'
  | 'reportEmployeeUid' | 'setReportEmployeeUid' | 'employeeOptions'
  | 'stations'
> & { showOperatorSearch?: boolean; showEmployeeFilter?: boolean };

/**
 * Тайлангийн шүүлтүүр. Excel татах товч эдгээр утгыг ашигладаг тул мастер, админ
 * хоёуланд нь харагдах ёстой — өмнө нь зөвхөн мастерт байсан.
 */
function ReportFilters({
  reportSince,
  setReportSince,
  reportUntil,
  setReportUntil,
  reportShiftType,
  setReportShiftType,
  reportStation,
  setReportStation,
  reportQuery,
  setReportQuery,
  reportEmployeeUid,
  setReportEmployeeUid,
  employeeOptions,
  stations,
  showOperatorSearch = true,
  showEmployeeFilter = false,
}: ReportFilterProps) {
  const extraCols = (showOperatorSearch ? 1 : 0) + (showEmployeeFilter ? 1 : 0);
  const gridColsClass = extraCols === 2 ? 'md:grid-cols-6' : extraCols === 1 ? 'md:grid-cols-5' : 'md:grid-cols-4';
  return (
    <div className={`grid grid-cols-1 gap-4 ${gridColsClass}`}>
      <div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Эхлэх огноо</p>
        <input
          type="date"
          className="w-full px-4 py-2 rounded-xl border border-gray-200"
          value={reportSince}
          onChange={(e) => setReportSince(e.target.value)}
        />
      </div>
      <div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Дуусах огноо</p>
        <input
          type="date"
          className="w-full px-4 py-2 rounded-xl border border-gray-200"
          value={reportUntil}
          onChange={(e) => setReportUntil(e.target.value)}
        />
      </div>
      <div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Ээлж</p>
        <select
          className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white"
          value={reportShiftType}
          onChange={(e) => setReportShiftType(e.target.value as any)}
        >
          <option value="all">Бүгд</option>
          <option value="Өдрийн">Өдрийн</option>
          <option value="Шөнийн">Шөнийн</option>
        </select>
      </div>
      <div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Станц</p>
        <select
          className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white"
          value={reportStation}
          onChange={(e) => setReportStation(e.target.value)}
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
      {showOperatorSearch ? (
        <div>
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Оператор</p>
          <input
            className="w-full px-4 py-2 rounded-xl border border-gray-200"
            placeholder="Нэрээр хайх..."
            value={reportQuery}
            onChange={(e) => setReportQuery(e.target.value)}
          />
        </div>
      ) : null}
      {showEmployeeFilter ? (
        <div>
          <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Ажилтан</p>
          <select
            className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white"
            value={reportEmployeeUid}
            onChange={(e) => setReportEmployeeUid(e.target.value)}
          >
            <option value="all">Бүгд</option>
            {employeeOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email || u.id} ({ROLE_LABELS[u.role] || u.role})
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

export function KpiTab({
  profileRole,
  downloadKpiCsv,
  reportTab,
  setReportTab,
  reportSince,
  setReportSince,
  reportUntil,
  setReportUntil,
  reportShiftType,
  setReportShiftType,
  reportStation,
  setReportStation,
  reportQuery,
  setReportQuery,
  reportEmployeeUid,
  setReportEmployeeUid,
  employeeOptions,
  reportMissingRows,
  reportDowntimeRows,
  kpiStats,
  stations,
  reportSummary = null,
  reportSummaryLoading = false,
}: KpiTabProps) {
  const filterProps = {
    reportSince, setReportSince,
    reportUntil, setReportUntil,
    reportShiftType, setReportShiftType,
    reportStation, setReportStation,
    reportQuery, setReportQuery,
    reportEmployeeUid, setReportEmployeeUid,
    employeeOptions,
    stations,
  };

  // Шүүлтүүр тавьсан бол серверийн тоймоор, эс бол 30 хоногийн үзүүлэлтээр харуулна.
  const filtered = Boolean(reportSummary);
  const shown = reportSummary
    ? {
        totalShifts: reportSummary.totalShifts,
        approved: reportSummary.approvedCount,
        completeRate: reportSummary.completionRatePct,
        completedByOp: reportSummary.operatorCompletedCount,
      }
    : {
        totalShifts: kpiStats.totalShifts,
        approved: kpiStats.approved,
        completeRate: kpiStats.completeRate,
        completedByOp: kpiStats.completedByOp,
      };

  return profileRole === 'master' ? (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Тайлан</h3>
          <p className="text-gray-500">Сул зогсолт • Дутуу бүртгэл • Хоцролт</p>
        </div>
        <button
          type="button"
          onClick={downloadKpiCsv}
          className="px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
        >
          Excel татах
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`px-4 py-2 rounded-xl text-sm font-black ${reportTab === 'downtime' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            onClick={() => setReportTab('downtime')}
          >
            Сул зогсолт
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-xl text-sm font-black ${reportTab === 'missing' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            onClick={() => setReportTab('missing')}
          >
            Дутуу бүртгэл
          </button>

        </div>

        <div className="mt-5">
          <ReportFilters {...filterProps} />
        </div>
      </div>

      {reportTab === 'missing' && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h4 className="font-bold text-gray-900">Дутуу бүртгэл</h4>
            <span className="text-xs text-gray-500">Нийт: {reportMissingRows.length}</span>
          </div>
          <div className="p-6">
            {reportMissingRows.length === 0 ? (
              <p className="text-sm text-gray-500">Дутуу бүртгэлтэй ээлж олдсонгүй.</p>
            ) : (
              <HorizontalPagedList
                items={reportMissingRows}
                renderPage={(page) => (
              <ul className="space-y-3">
                {page.map(({ shift, missing }) => (
                  <li key={shift.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-amber-900">
                          {shift.stationCode} • {shift.shiftType} • {shift.shiftDate} — {shift.operatorName}
                        </p>
                        <p className="text-sm text-amber-900/90 mt-2">Дутуу: {missing.join(', ')}</p>
                      </div>
                      <Link href={`/shift/${shift.id}`} className="shrink-0 text-sm font-bold text-orange-700 hover:underline">
                        Нээх →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
                )}
              />
            )}
          </div>
        </div>
      )}



      {reportTab === 'downtime' && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h4 className="font-bold text-gray-900">Сул зогсолт (засварын бүртгэлээс)</h4>
            <span className="text-xs text-gray-500">Нийт: {reportDowntimeRows.length}</span>
          </div>
          <div className="p-6">
            {reportDowntimeRows.length === 0 ? (
              <p className="text-sm text-gray-500">Сул зогсолтын бичлэг олдсонгүй.</p>
            ) : (
              <HorizontalPagedList
                items={reportDowntimeRows}
                renderPage={(page) => (
              <ul className="space-y-3">
                {page.map(({ shift, unplannedHours, plannedHours }) => (
                  <li key={shift.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900">
                          {shift.stationCode} • {shift.shiftType} • {shift.shiftDate} — {shift.operatorName}
                        </p>
                        <p className="text-sm text-gray-700 mt-2">
                          Төлөвлөөгүй: {unplannedHours} цаг • Төлөвлөгөөт: {plannedHours} цаг
                        </p>
                      </div>
                      <Link href={`/shift/${shift.id}`} className="shrink-0 text-sm font-bold text-orange-700 hover:underline">
                        Нээх →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
                )}
              />
            )}
          </div>
        </div>
      )}
    </section>
  ) : (
    <section className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Тайлан / KPI</h3>
          <p className="text-gray-500">Үйлдвэрлэлийн гүйцэтгэлийн үзүүлэлтүүд</p>
        </div>
        <button
          type="button"
          onClick={downloadKpiCsv}
          className="px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
        >
          Excel татах
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
        <p className="text-sm font-bold text-gray-800 mb-1">Excel татах шүүлтүүр</p>
        <p className="text-xs leading-relaxed text-gray-500 mb-4">
          Огноо, ээлж, станцаа сонгоод «Excel татах» дарна. Хоосон орхивол сүүлийн 30 хоногийн
          бүх станцын бүртгэл татагдана.
        </p>
        <ReportFilters {...filterProps} showOperatorSearch={false} showEmployeeFilter />
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${
            filtered
              ? 'border border-orange-200 bg-orange-50 text-orange-700'
              : 'border border-gray-200 bg-gray-50 text-gray-500'
          }`}
        >
          {filtered ? 'Шүүсэн үзүүлэлт' : 'Сүүлийн 30 хоног'}
        </span>
        {reportSummaryLoading ? <span className="text-xs text-gray-400">Тооцож байна…</span> : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={filtered ? 'Нийт ээлж (шүүсэн)' : 'Нийт ээлж (30 хоног)'}
          value={String(shown.totalShifts)}
          icon={<Factory className="w-5 h-5 text-blue-600" />}
          subValue={`Баталгаажсан: ${shown.approved}`}
        />
        <StatCard
          title="Бүртгэлийн гүйцэтгэл"
          value={`${shown.completeRate}%`}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          subValue={filtered ? 'Баталгаажсан / нийт' : `Мастер хүлээгдэж: ${kpiStats.pendingMaster}`}
        />
        <StatCard
          title="Оператор дуусгасан"
          value={String(shown.completedByOp)}
          icon={<Clock className="w-5 h-5 text-orange-600" />}
          subValue="Ээлж дуусгах дарсан"
        />
        <StatCard
          title="ХАБ / Засвар"
          value={`${kpiStats.hseIncidents} / ${kpiStats.maintOpen}`}
          icon={<ShieldCheck className="w-5 h-5 text-purple-600" />}
          subValue="Осол бүртгэл / нээлттэй засвар (одоогийн)"
        />
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 text-sm text-gray-600">
        <p className="font-bold text-gray-900 mb-2">Тайлбар</p>
        <ul className="list-disc list-inside space-y-1.5 leading-relaxed">
          <li>
            <b>Нийт ээлж · Гүйцэтгэл · Оператор дуусгасан</b> —{' '}
            {filtered
              ? 'дээрх шүүлтүүрт тохирох бүх бүртгэлээс тооцогдож байна.'
              : 'шүүлтүүр тавиагүй тул сүүлийн 30 хоногоор тооцогдож байна.'}
          </li>
          <li>
            <b>ХАБ / Засвар</b> — шүүлтүүрээс хамаарахгүй, самбарын одоогийн байдлыг харуулна.
          </li>
          <li>«Excel татах» товч дээрх шүүлтүүрийг ашиглана — үзүүлэлт болон файл ижил хамрах хүрээтэй.</li>
        </ul>
      </div>
    </section>
  );
}
