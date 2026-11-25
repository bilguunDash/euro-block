import Link from 'next/link';
import { ClipboardCheck, Clock, Plus } from 'lucide-react';
import { mnDateLabel } from '../dashboard-helpers';
import { isMasterStationCode } from '@/lib/master-stations';
import { stationUsesPeriodicLogs } from '@/lib/shift-completeness';

type MyEntriesTabProps = {
  activeShift: any;
  todaySchedules: any[];
  loading: boolean;
  shifts: any[];
  operatorPreviousHandoverShifts: any[];
  selectedShiftType: string;
  selectedDate: string;
};

export function MyEntriesTab({
  activeShift,
  todaySchedules,
  loading,
  shifts,
  operatorPreviousHandoverShifts,
  selectedShiftType,
  selectedDate,
}: MyEntriesTabProps) {
  return (
    <section className="space-y-8">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-200">
          <h3 className="font-bold text-xl text-gray-900">Миний бүртгэлүүд</h3>
          <p className="text-sm text-gray-500 mt-1">Хяналтын хуудас / маягтуудыг нэг дороос эхлүүлэх, хадгалах, илгээх</p>
        </div>
        <div className="p-8">
          {!activeShift ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-dashed border-orange-200 bg-orange-50/70 px-6 py-8 text-center md:px-10 md:py-10">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-100 bg-white text-orange-600 shadow-sm">
                  <ClipboardCheck className="h-7 w-7" />
                </div>
                <p className="mt-4 text-lg font-black text-gray-900">Идэвхтэй ээлж байхгүй</p>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-600">
                  {todaySchedules.length > 0
                    ? 'Ээлжээ эхлүүлсний дараа хяналтын хуудас болон маягтууд идэвхжинэ.'
                    : 'Өнөөдрийн ээлжийн хуваарь оноогоогүй байна. Шаардлагатай бол ээлж эхлүүлэх хэсгээр бүртгэл үүсгэнэ үү.'}
                </p>
                <Link
                  href={`/shift/new?${new URLSearchParams({
                    shiftType: selectedShiftType,
                    shiftDate: selectedDate,
                  }).toString()}`}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-8 py-4 text-sm font-black text-white shadow-lg shadow-orange-100 transition hover:bg-orange-700"
                >
                  <Plus className="h-5 w-5" />
                  Ээлж эхлэх
                </Link>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-gray-900">Сүүлийн түүх / хадгалсан ноорог</p>
                    <p className="mt-1 text-sm text-gray-500">Өмнөх бүртгэлүүдээ хурдан нээж шалгах хэсэг.</p>
                  </div>
                  <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-black text-gray-500">
                    Нийт: {shifts.length}
                  </span>
                </div>

                {(() => {
                  const recentShifts = (Array.isArray(shifts) ? shifts : []).slice(0, 5);
                  if (loading) {
                    return (
                      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 text-sm font-bold text-gray-500">
                        Бүртгэлүүдийг уншиж байна...
                      </div>
                    );
                  }
                  if (recentShifts.length === 0) {
                    return (
                      <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center">
                        <Clock className="mx-auto h-8 w-8 text-gray-300" />
                        <p className="mt-3 text-sm font-bold text-gray-500">Сүүлийн бүртгэл одоогоор байхгүй.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="mt-4 space-y-2">
                      {recentShifts.map((shift: any) => {
                        const status = String(shift?.status || 'Төлөвгүй').trim();
                        const isDraft = status === 'Ноорог' || status === 'Хадгалсан';
                        const isApproved = status === 'Баталгаажсан';
                        const statusClass = isApproved
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : isDraft
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-gray-200 bg-gray-50 text-gray-600';
                        return (
                          <div
                            key={shift?.id || `${shift?.shiftDate}-${shift?.stationCode}-${shift?.shiftType}`}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-gray-900">
                                {shift?.stationCode || 'Дамжлагагүй'} • {shift?.shiftType || 'Ээлжийн төрөлгүй'}
                              </p>
                              <p className="mt-1 text-xs font-bold text-gray-500">{mnDateLabel(String(shift?.shiftDate || ''))}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${statusClass}`}>{status}</span>
                              {shift?.id ? (
                                <Link
                                  href={`/shift/${shift.id}`}
                                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-700 transition hover:bg-gray-100"
                                >
                                  Нээх
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black text-orange-700 uppercase tracking-wider">Идэвхтэй ээлж</p>
                  <p className="text-lg font-black text-gray-900 mt-1">
                    {activeShift.stationCode} • {activeShift.shiftType}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Төлөв: {activeShift.status || '—'}</p>
                </div>
                <Link
                  href={`/shift/${activeShift.id}`}
                  className="px-6 py-3 bg-orange-600 text-white rounded-2xl text-sm font-bold hover:bg-orange-700"
                >
                  Ээлж рүү орох
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <p className="font-bold text-gray-900">ХАБЭА-н хяналтын хуудас</p>
                  <p className="text-sm text-gray-500 mt-1">Бөглөх / засах</p>
                  <div className="mt-4 flex gap-3">
                    <Link href={`/shift/${activeShift.id}#hse`} className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700">
                      Шинэ бүртгэл
                    </Link>
                    <Link href={`/shift/${activeShift.id}#hse`} className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl text-xs font-bold hover:bg-gray-200">
                      Харах
                    </Link>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <p className="font-bold text-gray-900">Тоног төхөөрөмжийн үзлэг</p>
                  <p className="text-sm text-gray-500 mt-1">Шинэ үзлэг нэмэх</p>
                  <div className="mt-4 flex gap-3">
                    <Link href={`/shift/${activeShift.id}#station-form`} className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700">
                      Шинэ бүртгэл
                    </Link>
                    <Link href={`/shift/${activeShift.id}#station-form`} className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl text-xs font-bold hover:bg-gray-200">
                      Харах
                    </Link>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <p className="font-bold text-gray-900">Ээлж хүлээлцэх бүртгэл</p>
                  <p className="text-sm text-gray-500 mt-1">Хүлээлцэх бүртгэл нэмэх / харах</p>
                  <div className="mt-4 flex gap-3">
                    <Link href={`/shift/${activeShift.id}#station-form`} className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700">
                      Шинэ бүртгэл
                    </Link>
                    <Link href={`/shift/${activeShift.id}#station-form`} className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl text-xs font-bold hover:bg-gray-200">
                      Харах
                    </Link>
                  </div>
                </div>

                {/* `#periodic` хэсэг нь зөвхөн ҮЯ-400/ҮЯ-099 дээр рендэрлэгддэг тул
                    картыг ижил нөхцөлөөр хаана — эс бөгөөс хоосон руу үсэрнэ. */}
                {stationUsesPeriodicLogs(activeShift.stationCode) && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="font-bold text-gray-900">Тогтмол бүртгэл</p>
                    <p className="text-sm text-gray-500 mt-1">Давтамжит бүртгэл нэмэх</p>
                    <div className="mt-4 flex gap-3">
                      <Link href={`/shift/${activeShift.id}#periodic`} className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700">
                        Шинэ бүртгэл
                      </Link>
                      <Link href={`/shift/${activeShift.id}#periodic`} className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl text-xs font-bold hover:bg-gray-200">
                        Харах
                      </Link>
                    </div>
                  </div>
                )}

                {String(activeShift.stationCode || '') === 'ҮЯ-130' && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="font-bold text-gray-900">Цутгалтын үзүүлэлт</p>
                    <p className="text-sm text-gray-500 mt-1">Хөөлт / тархалт / нягт</p>
                    <div className="mt-4 flex gap-3">
                      <Link href={`/shift/${activeShift.id}#mix`} className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700">
                        Шинэ бүртгэл
                      </Link>
                      <Link href={`/shift/${activeShift.id}#mix`} className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl text-xs font-bold hover:bg-gray-200">
                        Харах
                      </Link>
                    </div>
                  </div>
                )}

                {String(activeShift.stationCode || '') === 'ҮЯ-190' && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="font-bold text-gray-900">Чанарын лабораторийн бүртгэл</p>
                    <p className="text-sm text-gray-500 mt-1">Автоклав / поддон / сорт</p>
                    <div className="mt-4 flex gap-3">
                      <Link href={`/shift/${activeShift.id}#quality`} className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700">
                        Шинэ бүртгэл
                      </Link>
                      <Link href={`/shift/${activeShift.id}#quality`} className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl text-xs font-bold hover:bg-gray-200">
                        Харах
                      </Link>
                    </div>
                  </div>
                )}

                {String(activeShift.stationCode || '') === 'ҮЯ-180' && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="font-bold text-gray-900">Автоклавын бүртгэл</p>
                    <p className="text-sm text-gray-500 mt-1">Autoclave Log</p>
                    <div className="mt-4 flex gap-3">
                      <Link href={`/shift/${activeShift.id}#station-form`} className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700">
                        Шинэ бүртгэл
                      </Link>
                      <Link href={`/shift/${activeShift.id}#station-form`} className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl text-xs font-bold hover:bg-gray-200">
                        Харах
                      </Link>
                    </div>
                  </div>
                )}

                {isMasterStationCode(activeShift.stationCode) && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="font-bold text-gray-900">Мастерын ээлжийн бүртгэл</p>
                    <p className="text-sm text-gray-500 mt-1">Ээлж хүлээлцэх form</p>
                    <div className="mt-4 flex gap-3">
                      <Link href={`/shift/${activeShift.id}#station-form`} className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700">
                        Шинэ бүртгэл
                      </Link>
                      <Link href={`/shift/${activeShift.id}#station-form`} className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl text-xs font-bold hover:bg-gray-200">
                        Харах
                      </Link>
                    </div>
                  </div>
                )}

                {String(activeShift.stationCode || '') === 'ҮЯ-320' && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="font-bold text-gray-900">Засварын бүртгэл</p>
                    <p className="text-sm text-gray-500 mt-1">Цахилгаан автоматжуулалт</p>
                    <div className="mt-4 flex gap-3">
                      <Link href={`/shift/${activeShift.id}#station-form`} className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700">
                        Шинэ бүртгэл
                      </Link>
                      <Link href={`/shift/${activeShift.id}#station-form`} className="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl text-xs font-bold hover:bg-gray-200">
                        Харах
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6">
                <p className="font-bold text-gray-900">Өмнөх операторын ээлжийн бүртгэл</p>
                <p className="text-sm text-gray-500 mt-1">Танд хүлээлцүүлсэн өмнөх операторын бүртгэлийг нээж харна</p>
                {(() => {
                  const prev =
                    operatorPreviousHandoverShifts.find((s: any) => s?.stationCode === activeShift.stationCode) ||
                    operatorPreviousHandoverShifts[0];
                  if (!prev) return <p className="text-sm text-gray-500 mt-3">Одоогоор олдсонгүй.</p>;
                  const prevId = prev.id || prev._id;
                  return (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-gray-700">
                        <span className="font-bold">{prev.stationCode}</span> • {prev.shiftType} • {prev.shiftDate}
                        <span className="block text-xs text-gray-500 mt-1">Өмнөх оператор: {prev.operatorName || '—'}</span>
                      </div>
                      {prevId ? (
                        <Link href={`/shift/${prevId}`} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800">
                          Нээх
                        </Link>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
