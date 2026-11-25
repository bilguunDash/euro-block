import React, { useMemo, useState } from 'react';
import { UsersRound, ChevronDown, ChevronUp } from 'lucide-react';
import { SHIFT_GROUP_OPTIONS, shiftGroupLabel } from '@/lib/shift-crew';
import type { DashboardUser } from './types';

type ShiftCrewManagerProps = {
  users: DashboardUser[];
  saving: boolean;
  onAssign: (userIds: string[], shiftGroup: string | null) => void | Promise<void>;
};

const ROLE_LABEL: Record<string, string> = { operator: 'Оператор', master: 'Мастер' };

/** Багийн бүрэлдэхүүнийг олноор засах — хайлт, шүүлт, checkbox сонголт. */
export function ShiftCrewManager({ users, saving, onAssign }: ShiftCrewManagerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const crewUsers = useMemo(
    () => users.filter((u) => u.role === 'operator' || u.role === 'master'),
    [users]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return crewUsers.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (groupFilter === 'none') {
        if (String(u.shiftGroup || '')) return false;
      } else if (groupFilter && String(u.shiftGroup || '') !== groupFilter) {
        return false;
      }
      if (!q) return true;
      return [u.name, u.email, u.stationCode].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [crewUsers, query, roleFilter, groupFilter]);

  const allShown = filtered.length > 0 && filtered.every((u) => selected.has(u.id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (allShown) {
        const next = new Set(prev);
        filtered.forEach((u) => next.delete(u.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((u) => next.add(u.id));
      return next;
    });
  };

  const apply = async (group: string | null) => {
    if (selected.size === 0) return;
    await onAssign(Array.from(selected), group);
    setSelected(new Set());
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 p-6 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-orange-600">
            <UsersRound className="w-5 h-5 shrink-0" />
            <h4 className="font-bold text-lg">Багийн бүрэлдэхүүн</h4>
          </div>
          <p className="text-sm leading-relaxed text-gray-500">
            Хэн аль ээлжид ажиллахыг тохируулна. Ажилтан солигдох үед л засна.
          </p>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {open ? (
        <div className="border-t border-gray-100 p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Нэр, имэйл, дамжлагаар хайх"
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Бүх үүрэг</option>
              <option value="operator">Оператор</option>
              <option value="master">Мастер</option>
            </select>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Бүх баг</option>
              {SHIFT_GROUP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
              <option value="none">Баггүй</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-gray-50 px-4 py-3">
            <span className="text-sm font-bold text-gray-700">{selected.size} сонгосон</span>
            <span className="text-gray-300">|</span>
            {SHIFT_GROUP_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                disabled={selected.size === 0 || saving}
                onClick={() => apply(o.value)}
                className="rounded-xl bg-orange-600 px-3 py-1.5 text-xs font-black text-white hover:bg-orange-700 disabled:opacity-40"
              >
                {o.label} болгох
              </button>
            ))}
            <button
              type="button"
              disabled={selected.size === 0 || saving}
              onClick={() => apply(null)}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-40"
            >
              Багаас хасах
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-100">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={allShown} onChange={toggleAll} className="cursor-pointer" />
                  </th>
                  <th className="px-4 py-3 font-bold">Нэр</th>
                  <th className="px-4 py-3 font-bold">Үүрэг</th>
                  <th className="px-4 py-3 font-bold">Дамжлага</th>
                  <th className="px-4 py-3 font-bold">Баг</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Хэрэглэгч олдсонгүй.</td></tr>
                ) : (
                  filtered.map((u) => {
                    const station = String(u.stationCode || '').trim();
                    return (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(u.id)}
                            onChange={() => toggle(u.id)}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-bold text-gray-900">{u.name || u.email}</p>
                          {u.name ? <p className="text-xs text-gray-500">{u.email}</p> : null}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{ROLE_LABEL[String(u.role)] || u.role}</td>
                        <td className="px-4 py-3">
                          {station ? (
                            <span className="text-sm font-bold text-gray-800">{station}</span>
                          ) : (
                            <span className="text-xs font-bold text-amber-700">тодорхойгүй</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {u.shiftGroup ? (
                            <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-black uppercase text-orange-700">
                              {shiftGroupLabel(u.shiftGroup)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
