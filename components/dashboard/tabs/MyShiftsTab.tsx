import Link from 'next/link';
import { ClipboardCheck, Clock } from 'lucide-react';
import { TableRow } from '@/components/ui/TableRow';
import { isoDateInTimeZone } from '@/lib/handover-window';
import { HorizontalPagedList } from '../HorizontalPagedList';
import { UnsentHandoverShifts } from '../UnsentHandoverShifts';

type ShiftStartSchedule = {
  stationCode?: string;
  station?: string;
  shiftType?: string;
  shiftDate?: string;
};

type MyShiftsTabProps = {
  isOperatorView: boolean;
  activeShift: any;
  todaySchedules: any[];
  firstStartableTodaySchedule: any;
  shiftNewHref: (schedule: ShiftStartSchedule) => string;
  operatorPreviousHandoverShifts: any[];
  loading: boolean;
  shifts: any[];
};

export function MyShiftsTab({
  isOperatorView,
  activeShift,
  todaySchedules,
  firstStartableTodaySchedule,
  shiftNewHref,
  operatorPreviousHandoverShifts,
  loading,
  shifts,
}: MyShiftsTabProps) {
  return (
    <section className="space-y-8">
      {/* «Идэвхтэй ээлж байхгүй» гэж харагдах үед оператор шинэ ээлж эхлүүлэх гэдэг — илгээгээгүй ээлжийг нь энд сануулна. */}
      <UnsentHandoverShifts shifts={shifts} today={isoDateInTimeZone()} />
      {isOperatorView && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-200">
              <h3 className="font-bold text-xl text-gray-900">Одоогийн ажиллаж буй ээлж</h3>
              <p className="text-sm text-gray-500 mt-1">Аль дамжлага дээр ажиллаж буй, ээлжийн цаг, төлөв</p>
            </div>
            <div className="p-8">
              {activeShift ? (
                <div className="rounded-3xl border border-orange-200 bg-orange-50 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black text-orange-700 uppercase tracking-wider">Идэвхтэй</p>
                      <p className="text-2xl font-black text-gray-900 mt-1">
                        {activeShift.stationCode} • {activeShift.shiftType}
                      </p>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <div className="rounded-2xl bg-white border border-orange-100 px-4 py-3">
                          <p className="text-[10px] font-black text-gray-400 uppercase">Дамжлага</p>
                          <p className="font-bold text-gray-900 mt-1">{activeShift.stationCode}</p>
                        </div>
                        <div className="rounded-2xl bg-white border border-orange-100 px-4 py-3">
                          <p className="text-[10px] font-black text-gray-400 uppercase">Эхэлсэн</p>
                          <p className="font-bold text-gray-900 mt-1">
                            {activeShift.checkIn ? new Date(activeShift.checkIn).toLocaleString('mn-MN') : '—'}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white border border-orange-100 px-4 py-3">
                          <p className="text-[10px] font-black text-gray-400 uppercase">Төлөв</p>
                          <p className="font-bold text-gray-900 mt-1">{activeShift.status || '—'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/shift/${activeShift.id}`}
                        className="px-6 py-3 bg-white border border-orange-200 text-orange-700 rounded-2xl text-sm font-bold hover:bg-orange-50"
                      >
                        Ээлж дуусгах
                      </Link>
                    </div>
                  </div>
                  <p className="text-xs text-orange-900/80 mt-4">
                    Тайлбар: “Ээлж дуусгах” үйлдэл нь ээлжийн дэлгэрэнгүй дээр дутуу бүртгэлийг шалгасны дараа идэвхжинэ.
                  </p>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 flex flex-col items-center justify-center text-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-sm">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-700">Идэвхтэй ээлж байхгүй</p>
                    <p className="text-sm text-gray-500 mt-1 max-w-md">
                      {todaySchedules.length > 0
                        ? 'Өнөөдрийн хуваариас боломжтой ээлжээ эхлүүлнэ үү.'
                        : 'Өнөөдрийн ээлжийн хуваарь оноогдоогүй байна.'}
                    </p>
                  </div>
                  {firstStartableTodaySchedule && (
                    <Link
                      href={shiftNewHref(firstStartableTodaySchedule)}
                      className="px-6 py-3 bg-orange-600 text-white rounded-2xl text-sm font-bold hover:bg-orange-700"
                    >
                      Ээлж эхлэх
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-200">
              <h3 className="font-bold text-xl text-gray-900">Ээлж хүлээлцэх</h3>
              <p className="text-sm text-gray-500 mt-1">Хүлээн авах / буцаах / тайлбар</p>
            </div>
            <div className="p-8">
              {operatorPreviousHandoverShifts.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 flex flex-col items-center justify-center text-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-sm">
                    <ClipboardCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-700">Хүлээлцэх хүсэлт байхгүй</p>
                    <p className="text-sm text-gray-500 mt-1 max-w-sm">Танд ирсэн ээлж хүлээлцэх хүсэлтүүд энд харагдана.</p>
                  </div>
                </div>
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
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
                  >
                    <p className="font-bold text-emerald-900">{s.stationCode}</p>
                    <p className="text-sm text-emerald-900/80 mt-1">Өмнөх оператор: {s.operatorName}</p>
                    <p className="text-xs text-emerald-900/70 mt-1">
                      {s.shiftDate} • {s.shiftType} • Төлөв: {s.handoverStage === 'waiting_next_operator' ? 'Хүлээн авах' : 'Харах'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {s.handoverStage === 'waiting_next_operator' && (
                        <Link
                          href={`/shift/${shiftId}`}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
                        >
                          Хүлээн авах
                        </Link>
                      )}
                      <Link
                        href={`/shift/${shiftId}`}
                        className="px-4 py-2 bg-white border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold hover:bg-emerald-50"
                      >
                        Өмнөх ээлжийн бүртгэл харах
                      </Link>
                    </div>
                    <p className="text-[11px] text-emerald-900/70 mt-3">
                      Тайлбар/буцаах үйлдлийг ээлжийн дэлгэрэнгүй дотор хийнэ.
                    </p>
                  </div>
                  );
                })}
                </div>
                  )}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-xl text-gray-900">Миний бүх ээлжийн бүртгэлүүд</h3>
            <p className="text-sm text-gray-500 mt-1">Таны хөтөлсөн бүх ээлжийн мэдээлэл</p>
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
                page.map((shift) => (
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
  );
}
