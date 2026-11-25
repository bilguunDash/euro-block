import React from 'react';
import type { DashboardUser, ScheduleStateSetter, Station } from './types';

type ScheduleEditModalProps = {
  editingSchedule: any;
  setEditingSchedule: ScheduleStateSetter<any>;
  editableScheduleStationOptions: (scheduleRow: any) => Station[];
  localUsers: DashboardUser[];
  saveEditingSchedule: () => Promise<void>;
};

export function ScheduleEditModal({
  editingSchedule,
  setEditingSchedule,
  editableScheduleStationOptions,
  localUsers,
  saveEditingSchedule,
}: ScheduleEditModalProps) {
  if (!editingSchedule) return null;

  const isMasterSchedule = String(editingSchedule?.__kind || 'operator') === 'master';

  return (
    <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-gray-900">Хуваарь засах</h4>
            <p className="text-sm text-gray-500">
              {editingSchedule.shiftDate} • {editingSchedule.shiftType} • {editingSchedule.stationCode}
            </p>
          </div>
          <button type="button" onClick={() => setEditingSchedule(null)} className="text-gray-500 font-bold">
            x
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Огноо</label>
            <input
              type="date"
              value={String(editingSchedule.shiftDate || '')}
              onChange={(e) => setEditingSchedule({ ...editingSchedule, shiftDate: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Ээлж</label>
            <select
              value={String(editingSchedule.shiftType || '')}
              onChange={(e) => setEditingSchedule({ ...editingSchedule, shiftType: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200"
            >
              <option value="Өдрийн">Өдрийн</option>
              <option value="Шөнийн">Шөнийн</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Дамжлага</label>
            <select
              value={String(editingSchedule.stationCode || '')}
              onChange={(e) => setEditingSchedule({ ...editingSchedule, stationCode: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200"
            >
              <option value="">Сонгох...</option>
              {editableScheduleStationOptions(editingSchedule).map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">
              {isMasterSchedule ? 'Ээлжийн мастер' : 'Оператор'}
            </label>
            <select
              value={String(isMasterSchedule ? editingSchedule.masterUid : editingSchedule.operatorUid || '')}
              onChange={(e) => {
                const uid = e.target.value;
                const op = localUsers.find((u) => u.id === uid);
                if (isMasterSchedule) {
                  setEditingSchedule({
                    ...editingSchedule,
                    masterUid: uid,
                    masterName: op?.name || op?.email || null,
                    stationCode: '',
                  });
                } else {
                  setEditingSchedule({
                    ...editingSchedule,
                    operatorUid: uid,
                    operatorName: op?.name || op?.email || null,
                  });
                }
              }}
              className="w-full px-4 py-3 rounded-xl border border-gray-200"
            >
              {localUsers
                .filter((u) => (isMasterSchedule ? u.role === 'master' : u.role === 'operator'))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setEditingSchedule(null)}
            className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold"
          >
            Цуцлах
          </button>
          <button
            type="button"
            onClick={saveEditingSchedule}
            className="flex-1 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700"
          >
            Хадгалах
          </button>
        </div>
      </div>
    </div>
  );
}
