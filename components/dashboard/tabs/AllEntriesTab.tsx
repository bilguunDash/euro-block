import Link from 'next/link';
import { Eye, Search } from 'lucide-react';
import { mnDateTimeCompact } from '../dashboard-helpers';
import { HorizontalPagedList } from '../HorizontalPagedList';

type AllEntriesTabProps = {
  profileRole?: string | null;
  allEntriesSince: string;
  setAllEntriesSince: (value: string) => void;
  allEntriesUntil: string;
  setAllEntriesUntil: (value: string) => void;
  allEntriesShiftType: 'all' | 'Өдрийн' | 'Шөнийн';
  setAllEntriesShiftType: (value: 'all' | 'Өдрийн' | 'Шөнийн') => void;
  allEntriesStatus: 'all' | 'Ноорог' | 'Хадгалсан' | 'Баталгаажсан' | 'Цуцлагдсан';
  setAllEntriesStatus: (value: 'all' | 'Ноорог' | 'Хадгалсан' | 'Баталгаажсан' | 'Цуцлагдсан') => void;
  allEntriesRole: string;
  setAllEntriesRole: (value: string) => void;
  allEntriesMasterUid: string;
  setAllEntriesMasterUid: (value: string) => void;
  allEntriesEntryType: 'all' | 'shift' | 'equipment' | 'production' | 'repair' | 'ingredient' | 'measurement';
  setAllEntriesEntryType: (value: 'all' | 'shift' | 'equipment' | 'production' | 'repair' | 'ingredient' | 'measurement') => void;
  allEntriesQuery: string;
  setAllEntriesQuery: (value: string) => void;
  stations: any[];
  localUsers: any[];
  masterAllEntriesFiltered: any[];
};

export function AllEntriesTab({
  profileRole,
  allEntriesSince,
  setAllEntriesSince,
  allEntriesUntil,
  setAllEntriesUntil,
  allEntriesShiftType,
  setAllEntriesShiftType,
  allEntriesStatus,
  setAllEntriesStatus,
  allEntriesRole,
  setAllEntriesRole,
  allEntriesMasterUid,
  setAllEntriesMasterUid,
  allEntriesEntryType,
  setAllEntriesEntryType,
  allEntriesQuery,
  setAllEntriesQuery,
  stations,
  localUsers,
  masterAllEntriesFiltered,
}: AllEntriesTabProps) {
  const equipmentCellLabel = (row: any) => {
    const text = String(row?.equipmentText || '').trim();
    if (text) return text;
    if (['shift', 'production', 'measurement'].includes(String(row?.entryTypeKey || ''))) {
      return 'Хамаарахгүй';
    }
    return 'Мэдээлэл бүртгээгүй';
  };

  return (
    <section className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-gray-900">
          {profileRole === 'dispatcher' ? 'Бүх бүртгэл харах' : 'Бүх операторын бүртгэл'}
        </h3>
        <p className="text-gray-500">
          {profileRole === 'dispatcher'
            ? 'Бүх дамжлага, бүх операторын бүртгэлийг нэг дор хайж шүүнэ.'
            : 'Бүх операторын ирүүлсэн бүртгэлийг шүүж харна.'}
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-2">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Огноо</p>
            <input
              type="date"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800"
              value={(allEntriesSince as any) || ''}
              onChange={(e) => setAllEntriesSince(e.target.value)}
            />
          </div>
          <div className="xl:col-span-2">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Огноо</p>
            <input
              type="date"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800"
              value={(allEntriesUntil as any) || ''}
              onChange={(e) => setAllEntriesUntil(e.target.value)}
            />
          </div>
          <div className="xl:col-span-2">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Ээлж</p>
            <select
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800"
              value={allEntriesShiftType}
              onChange={(e) => setAllEntriesShiftType(e.target.value as any)}
            >
              <option value="all">Бүгд</option>
              <option value="Өдрийн">Өдрийн</option>
              <option value="Шөнийн">Шөнийн</option>
            </select>
          </div>
          <div className="xl:col-span-2">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Төлөв</p>
            <select
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800"
              value={allEntriesStatus}
              onChange={(e) => setAllEntriesStatus(e.target.value as any)}
            >
              <option value="all">Бүгд</option>
              <option value="Ноорог">Ноорог</option>
              <option value="Хадгалсан">Хадгалсан</option>
              <option value="Баталгаажсан">Баталгаажсан</option>
              <option value="Цуцлагдсан">Цуцлагдсан</option>
            </select>
          </div>
          <div className="xl:col-span-2">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Дамжлага</p>
            <select
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800"
              value={allEntriesRole}
              onChange={(e) => setAllEntriesRole(e.target.value)}
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
          <div className="xl:col-span-2">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Ээлжийн мастер</p>
            <select
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800"
              value={allEntriesMasterUid}
              onChange={(e) => setAllEntriesMasterUid(e.target.value)}
            >
              <option value="all">Бүгд</option>
              {localUsers
                .filter((u: any) => u.role === 'master')
                .map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
            </select>
          </div>
          <div className="xl:col-span-3">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Бүртгэлийн төрөл</p>
            <select
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800"
              value={allEntriesEntryType}
              onChange={(e) => setAllEntriesEntryType(e.target.value as any)}
            >
              <option value="all">Бүгд</option>
              <option value="shift">Ээлжийн бүртгэл</option>
              <option value="equipment">Тоног төхөөрөмж</option>
              <option value="production">Үйлдвэрлэл</option>
              <option value="repair">Засвар</option>
              <option value="ingredient">Орц найрлага</option>
              <option value="measurement">Хэмжилт</option>
            </select>
          </div>
          <div className="md:col-span-2 xl:col-span-9">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Хайлт (оператор / төрөл / тоног төхөөрөмж)</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-gray-800 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-50"
                value={allEntriesQuery}
                onChange={(e) => setAllEntriesQuery(e.target.value)}
                placeholder="Оператор, бүртгэлийн төрөл, тоног төхөөрөмжөөр хайх..."
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-4">
          <h4 className="font-bold text-gray-900">Жагсаалт</h4>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-600">Нийт: {masterAllEntriesFiltered.length}</span>
        </div>
        <HorizontalPagedList
          items={masterAllEntriesFiltered}
          renderPage={(page) => (
          <table className="w-full table-fixed text-left">
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[13%]" />
              <col className="w-[8%]" />
              <col className="w-[11%]" />
            </colgroup>
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase text-gray-500">
                <th className="px-3 py-4 font-bold">Огноо</th>
                <th className="px-3 py-4 font-bold">Оператор</th>
                <th className="px-3 py-4 font-bold">Дамжлага</th>
                <th className="px-3 py-4 font-bold">Станц</th>
                <th className="px-3 py-4 font-bold">Ээлж</th>
                <th className="px-3 py-4 font-bold">Мастер</th>
                <th className="px-3 py-4 font-bold">Төрөл</th>
                <th className="px-3 py-4 font-bold">Төлөв</th>
                <th className="px-3 py-4 font-bold leading-4">Тоног төхөөрөмж</th>
                <th className="px-3 py-4 text-right font-bold">Үйлдэл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {page.map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-4 text-xs leading-5 text-gray-600">
                    {mnDateTimeCompact(r.timestampIso)}
                  </td>
                  <td className="px-3 py-4 text-sm leading-5 text-gray-700 break-words">{r.operatorName || '—'}</td>
                  <td className="px-3 py-4 text-sm leading-5 text-gray-700 break-words">{r.stationName || '—'}</td>
                  <td className="px-3 py-4 text-sm font-bold text-gray-900">{r.stationCode || '—'}</td>
                  <td className="px-3 py-4 text-sm text-gray-700">{r.shiftType || '—'}</td>
                  <td className="px-3 py-4 text-sm font-bold leading-5 text-orange-700 break-words">{r.masterName || '—'}</td>
                  <td className="px-3 py-4 text-sm leading-5 text-gray-700 break-words">{r.entryTypeLabel || '—'}</td>
                  <td className="px-3 py-4">
                    <span
                      title={r.statusLabel === 'Баталгаажсан' && r.adminApproved ? 'Эцсийн баталгаажсан' : r.statusLabel}
                      className={`inline-flex max-w-full rounded-full border px-2.5 py-1 text-[10px] font-black uppercase leading-4 ${r.statusLabel === 'Баталгаажсан'
                      ? (r.adminApproved ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700')
                      : r.statusLabel === 'Хадгалсан'
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : r.statusLabel === 'Ноорог'
                          ? 'border-gray-200 bg-gray-50 text-gray-700'
                          : 'border-gray-200 bg-gray-50 text-gray-600'
                      }`}>
                      {r.statusLabel === 'Баталгаажсан' && r.adminApproved ? 'Эцсийн' : r.statusLabel}
                    </span>
                  </td>
                  <td
                    className={`px-3 py-4 truncate text-sm ${
                      r.equipmentText ? 'text-gray-600' : 'text-gray-400'
                    }`}
                    title={equipmentCellLabel(r)}
                  >
                    {equipmentCellLabel(r)}
                  </td>
                  <td className="px-3 py-4 text-right">
                    <Link
                      href={`/shift/${r.shiftId}`}
                      title="Бүртгэлийн дэлгэрэнгүй нээх"
                      className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black text-orange-700 transition hover:bg-orange-100"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Нээх
                    </Link>
                  </td>
                </tr>
              ))}
              {masterAllEntriesFiltered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-gray-400">
                    Таарах бүртгэл олдсонгүй.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          )}
        />
      </div>
    </section>
  );
}
