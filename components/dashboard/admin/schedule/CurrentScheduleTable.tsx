import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { HorizontalPagedList } from '../../HorizontalPagedList';
import type { DashboardUser, ScheduleStateSetter, ScheduleView, Station } from './types';

type CurrentScheduleTableProps = {
  scheduleView: ScheduleView;
  opSchedulesAll: any[];
  masterSchedulesAll: any[];
  stations: Station[];
  localUsers: DashboardUser[];
  setEditingSchedule: ScheduleStateSetter<any>;
  handleDeleteScheduleClick: (schedule: any) => Promise<void>;
  readOnly?: boolean;
  /** Дээд талын "Сар" шүүлтүүрийн утга — хоосон үзэгдэх мессежид зааж өгнө. */
  scheduleMonth?: string;
};

export function CurrentScheduleTable({
  scheduleView,
  opSchedulesAll,
  masterSchedulesAll,
  stations,
  localUsers,
  setEditingSchedule,
  handleDeleteScheduleClick,
  readOnly = false,
  scheduleMonth,
}: CurrentScheduleTableProps) {
  const visibleSchedules = scheduleView === 'operator' ? opSchedulesAll : masterSchedulesAll;
  const columnCount = (scheduleView === 'master' ? 5 : 4) + (readOnly ? 0 : 1);

  return (
    <div className={`${readOnly ? 'lg:col-span-4' : 'lg:col-span-3'} bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-6">
        <h4 className="font-bold text-gray-900">Одоогийн хуваарь</h4>
        <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-bold">
          Нийт: {visibleSchedules.length}
        </span>
      </div>
      <HorizontalPagedList
        items={visibleSchedules}
        pageSize={8}
        renderPage={(page) => (
        <table className="w-full table-fixed text-left">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <th className="w-[7.5rem] px-4 py-4 font-bold whitespace-nowrap">Огноо</th>
              <th className="w-[5.5rem] px-3 py-4 font-bold whitespace-nowrap">Ээлж</th>
              <th className="px-4 py-4 font-bold">Дамжлага</th>
              {scheduleView === 'master' ? (
                <th className="w-[8rem] px-4 py-4 font-bold whitespace-nowrap">Ээлжийн баг</th>
              ) : null}
              <th className="w-[14rem] px-4 py-4 font-bold">Ажилтан</th>
              {!readOnly ? <th className="w-[11rem] px-5 py-4 text-right font-bold whitespace-nowrap">Үйлдэл</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleSchedules.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-6 py-12 text-center text-gray-400">
                  <p>Хуваарь одоогоор байхгүй байна.</p>
                  {scheduleMonth ? (
                    <p className="mt-1 text-xs">
                      Зөвхөн <b>{scheduleMonth}</b> сарын хуваарийг харуулж байна — өөр сард
                      оноосон бол дээрх <b>«Сар»</b> шүүлтүүрийг тохируулж шалгана уу.
                    </p>
                  ) : null}
                </td>
              </tr>
            ) : (
              page.map((s: any) => {
                const uid = scheduleView === 'operator' ? s.operatorUid : s.masterUid;
                const u = localUsers.find((x) => x.id === uid);
                const displayName =
                  scheduleView === 'operator'
                    ? s.operatorName || u?.name || u?.email || 'Оператор тодорхойгүй'
                    : s.masterName || u?.name || u?.email || 'Мастер тодорхойгүй';
                // Мастер өөрийн станц дээрээ хуваарьтай. Хариуцлага нь станцаар биш
                // багаар тогтдог тул мөр бүрт харьяалал тооцох шаардлагагүй.
                const displayStationCode = s.stationCode;
                const stationInfo = stations.find((st) => st.code === displayStationCode);
                const crewText = u?.shiftGroup ? `${u.shiftGroup}-р ээлж` : '';

                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 align-middle text-xs font-semibold text-gray-900 whitespace-nowrap">{s.shiftDate}</td>
                    <td className="px-3 py-4 align-middle text-xs font-semibold text-gray-600 whitespace-nowrap">{s.shiftType}</td>
                    <td className="px-4 py-4 align-middle">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-orange-600">
                          {stationInfo?.code || displayStationCode}
                        </p>
                        {stationInfo?.name ? (
                          <p className="truncate text-xs text-gray-500">{stationInfo.name}</p>
                        ) : null}
                      </div>
                    </td>
                    {scheduleView === 'master' ? (
                      <td className="px-4 py-4 align-middle">
                        {crewText ? (
                          <span className="inline-flex whitespace-nowrap rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-black text-orange-700">
                            {crewText}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    ) : null}
                    <td className="px-4 py-4 align-middle text-sm text-gray-700">
                      <p className="truncate font-semibold">{displayName}</p>
                    </td>
                    {!readOnly ? (
                      <td className="px-5 py-4 align-middle text-sm whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingSchedule({ ...s, __kind: scheduleView })}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition-colors hover:bg-blue-100"
                            title="Засах"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Засах
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteScheduleClick(s)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition-colors hover:bg-red-100"
                            title="Устгах"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Устгах
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        )}
      />
    </div>
  );
}
