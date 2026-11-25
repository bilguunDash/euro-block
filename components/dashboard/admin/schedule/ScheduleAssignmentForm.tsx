import React from 'react';
import { Calendar } from 'lucide-react';
import { isMasterStationCode } from '@/lib/master-stations';
import type { DashboardUser, ScheduleFormState, ScheduleStateSetter, ScheduleView, Station } from './types';

type ScheduleAssignmentFormProps = {
  scheduleView: ScheduleView;
  scheduleForm: ScheduleFormState;
  setScheduleForm: ScheduleStateSetter<ScheduleFormState>;
  stationsByScheduleView: Station[];
  localUsers: DashboardUser[];
  assigningShift: boolean;
  createOperatorSchedule: (e: React.FormEvent) => void;
  createMasterSchedule: (e: React.FormEvent) => void;
};

function stationSelectLabel(station: Station) {
  if (station.code === 'ҮЯ-320') return `${station.code}: ${station.name}`;
  return `${station.code} - ${station.name}`;
}

export function ScheduleAssignmentForm({
  scheduleView,
  scheduleForm,
  setScheduleForm,
  stationsByScheduleView,
  localUsers,
  assigningShift,
  createOperatorSchedule,
  createMasterSchedule,
}: ScheduleAssignmentFormProps) {
  const selectedMaster = localUsers.find((u) => u.id === scheduleForm.assigneeUid) || null;
  const selectedMasterStation = String(selectedMaster?.stationCode || '').trim();

  return (
    <div className="lg:col-span-1 bg-white p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-orange-600">
          <Calendar className="w-5 h-5 shrink-0" />
          <h4 className="font-bold text-lg">Нэг хүнд ээлж оноох</h4>
        </div>
        <p className="text-sm leading-relaxed text-gray-500">
          Багаар нь бүхэлд нь оноох бол дээрх “Ээлжийн багаар оноох” хэсгийг ашиглана уу.
        </p>
      </div>
      <form onSubmit={scheduleView === 'operator' ? createOperatorSchedule : createMasterSchedule} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Эхлэх огноо (YYYY-MM-DD)</label>
          <input
            type="date"
            value={scheduleForm.shiftDate}
            onChange={(e) => setScheduleForm({ ...scheduleForm, shiftDate: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Дуусах огноо (заавал биш)</label>
          <input
            type="date"
            value={scheduleForm.endDate || ''}
            min={scheduleForm.shiftDate || undefined}
            onChange={(e) => setScheduleForm({ ...scheduleForm, endDate: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
          />
          <p className="text-xs text-gray-500">
            Хоосон бол нэг өдөр. Бөглөвөл эхлэх–дуусах мужийн бүх өдөрт сонгосон ээлжээр олноор оноогдоно.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase">Ээлж</label>
          <div className="flex gap-3">
            {['Өдрийн', 'Шөнийн'].map((type) => {
              const checked = scheduleForm.shiftTypes.includes(type);
              return (
                <label
                  key={type}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border cursor-pointer select-none transition-all ${
                    checked
                      ? 'border-orange-500 bg-orange-50 text-orange-700 font-bold'
                      : 'border-gray-200 text-gray-600 hover:border-orange-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        shiftTypes: e.target.checked
                          ? [...scheduleForm.shiftTypes, type]
                          : scheduleForm.shiftTypes.filter((t) => t !== type),
                      })
                    }
                    className="sr-only"
                  />
                  {type}
                </label>
              );
            })}
          </div>
          <p className="text-xs text-gray-500">Хоёуланг сонгож нэг дор оноож болно.</p>
        </div>

        {scheduleView === 'master' ? (
          <>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Мастер</label>
              <select
                value={scheduleForm.assigneeUid}
                onChange={(e) => {
                  const uid = e.target.value;
                  // Мастер өөрийн дамжлага дээр оноогдоно — сонгосон хэрэглэгчээс шууд авна.
                  const station = String(localUsers.find((u) => u.id === uid)?.stationCode || '').trim();
                  setScheduleForm({ ...scheduleForm, assigneeUid: uid, stationCode: station });
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                required
              >
                <option value="">Сонгох...</option>
                {localUsers
                  .filter((u) => u.role === 'master')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Мастерын дамжлага</label>
              {!scheduleForm.assigneeUid ? (
                <div className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-400">
                  Эхлээд мастер сонгоно уу
                </div>
              ) : !selectedMasterStation ? (
                <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-xl">
                  Энэ мастерт дамжлага тодорхойлогдоогүй байна. <b>Хэрэглэгч удирдлага</b> хэсгээс
                  тухайн хэрэглэгчийн дамжлагыг тохируулна уу.
                </p>
              ) : (
                <>
                  <div className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 font-bold text-gray-800">
                    {selectedMasterStation}
                  </div>
                  <p className="text-xs text-gray-500">
                    Мастер өөрийн дамжлага дээр оноогдоно — хэрэглэгчийн бүртгэлээс автоматаар авна.
                  </p>
                  {!isMasterStationCode(selectedMasterStation) ? (
                    <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-xl">
                      Анхаар: {selectedMasterStation} нь мастерын дамжлага биш байна.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Дамжлага</label>
              <select
                value={scheduleForm.stationCode}
                onChange={(e) => setScheduleForm({ ...scheduleForm, stationCode: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                required
              >
                <option value="">Сонгох...</option>
                {stationsByScheduleView.map((s) => (
                  <option key={s.code} value={s.code}>
                    {stationSelectLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Оператор</label>
              <select
                value={scheduleForm.assigneeUid}
                onChange={(e) => setScheduleForm({ ...scheduleForm, assigneeUid: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                required
              >
                <option value="">Сонгох...</option>
                {localUsers
                  .filter((u) => u.role === 'operator')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email}
                    </option>
                  ))}
              </select>
            </div>
          </>
        )}

        <div className="pt-1">
          <button
            type="submit"
            disabled={assigningShift}
            className="inline-flex items-center justify-center rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-black text-white shadow-sm transition-colors hover:bg-orange-700 disabled:opacity-50"
          >
            {assigningShift ? 'Оноож байна...' : 'Хуваарь хадгалах'}
          </button>
        </div>
      </form>
    </div>
  );
}
