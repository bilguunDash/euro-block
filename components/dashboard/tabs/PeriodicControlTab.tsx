import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { HorizontalPagedList } from '../HorizontalPagedList';

type PeriodicControlTabProps = {
  periodicIntervalHours: number;
  periodicControlRows: any[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedShiftType: 'Өдрийн' | 'Шөнийн';
  setSelectedShiftType: (type: 'Өдрийн' | 'Шөнийн') => void;
  periodicStation: string;
  setPeriodicStation: (station: string) => void;
  periodicQuery: string;
  setPeriodicQuery: (query: string) => void;
  stations: any[];
};

export function PeriodicControlTab({
  periodicIntervalHours,
  periodicControlRows,
  selectedDate,
  setSelectedDate,
  selectedShiftType,
  setSelectedShiftType,
  periodicStation,
  setPeriodicStation,
  periodicQuery,
  setPeriodicQuery,
  stations,
}: PeriodicControlTabProps) {
  return (
    <section className="space-y-8">
      <div>
        <h3 className="text-2xl font-bold text-gray-900">Давтамжит хяналтын бүртгэл</h3>
        <p className="text-gray-500">
          Идэвхтэй ээлжүүдийн тогтмол бүртгэлийн явцыг {periodicIntervalHours} цагийн тохиргоогоор хянана.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Нийт ээлж</p>
          <p className="mt-2 text-3xl font-black text-gray-900">{periodicControlRows.length}</p>
        </div>
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Хэвийн</p>
          <p className="mt-2 text-3xl font-black text-emerald-600">
            {periodicControlRows.filter((row) => !row.status?.isOverdue).length}
          </p>
        </div>
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Дутуу</p>
          <p className="mt-2 text-3xl font-black text-amber-600">
            {periodicControlRows.filter((row) => row.status?.isOverdue).length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Огноо</p>
            <input
              type="date"
              className="w-full px-4 py-2 rounded-xl border border-gray-200"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Ээлж</p>
            <select
              className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white"
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
              className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white"
              value={periodicStation}
              onChange={(e) => setPeriodicStation(e.target.value)}
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
          <div className="md:col-span-2">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Хайх</p>
            <input
              className="w-full px-4 py-2 rounded-xl border border-gray-200"
              value={periodicQuery}
              onChange={(e) => setPeriodicQuery(e.target.value)}
              placeholder="Оператор эсвэл дамжлага..."
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-gray-900">Идэвхтэй ээлжүүд</h4>
            <p className="text-sm text-gray-500 mt-1">Тогтмол бүртгэл нэмэгдсэн эсэхийг ээлж бүрээр харуулна.</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-black">
            Давтамж: {periodicIntervalHours} цаг
          </span>
        </div>
        <HorizontalPagedList
          items={periodicControlRows}
          renderPage={(page) => (
          <table className="w-full table-fixed text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">Дамжлага</th>
                <th className="px-6 py-4 font-bold">Оператор</th>
                <th className="px-6 py-4 font-bold">Ээлж</th>
                <th className="px-6 py-4 font-bold">Бүртгэлийн тоо</th>
                <th className="px-6 py-4 font-bold">Сүүлд бүртгэсэн</th>
                <th className="px-6 py-4 font-bold">Төлөв</th>
                <th className="px-6 py-4 font-bold">Үйлдэл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {periodicControlRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    Сонгосон нөхцөлд идэвхтэй ээлж олдсонгүй.
                  </td>
                </tr>
              ) : (
                page.map(({ shift, logs, latest, status }) => (
                  <tr key={shift.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-gray-900">{shift.stationCode}</p>
                      <p className="text-xs text-gray-500">{shift.stationName || ''}</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-800">{shift.operatorName || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {shift.shiftDate} • {shift.shiftType}
                    </td>
                    <td className="px-6 py-4 text-sm font-black text-gray-900">
                      {status?.completedCount ?? logs.length} / {status?.requiredCount ?? 0}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {latest?.createdAt
                        ? new Date(latest.createdAt).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })
                        : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {!status?.isOverdue ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Хэвийн
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-black">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {status?.missingCount || 0} дутуу
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/shift/${shift.id}#periodic`}
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-orange-700 hover:underline"
                      >
                        Нээх
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          )}
        />
      </div>
    </section>
  );
}
