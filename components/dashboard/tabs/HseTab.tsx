import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { HorizontalPagedList } from '../HorizontalPagedList';

export function HseTab({
  profile,
  setShowHseIncidentModal,
  hseFilterSince,
  setHseFilterSince,
  hseFilterUntil,
  setHseFilterUntil,
  hseFilterStation,
  setHseFilterStation,
  hseFilterStatus,
  setHseFilterStatus,
  hseFilterQuery,
  setHseFilterQuery,
  stations,
  hseChecklistFiltered,
  hseStationLabel,
  setHseChecklistDetailId,
  hseFilteredLogs,
  setHseDecisionNote,
  setHseDetailLogId,
  hseDetailLogId,
  hseApproving,
  setHseApproving,
  selectedHseLog,
  renderIncidentAttachments,
  hseDecisionNote,
  hseNoteSaving,
  setHseNoteSaving,
  handleSaveHseLogNote,
  handleApproveHseLog,
  hseChecklistDetailId,
  selectedHseChecklist,
  selectedHseChecklistAttachmentPayload,
  hseChecklistNote,
  setHseChecklistNote,
  hseChecklistNoteSaving,
  setHseChecklistNoteSaving,
  handleSaveHseChecklistNote,
  hseLogs,
  setOperatorHseDetailLogId,
  operatorHseDetailLogId,
  selectedOperatorHseLog,
  mnIncidentSeverity,
  formatIncidentTime,
  incidentKeyValueRows,
}: any) {
  return (
        profile?.role === 'hse_engineer' ? (
          <section className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">ХАБ асуумж / бүртгэл</h3>
                <p className="text-gray-500">Хяналтын хуудас, осол/зөрчлийн бүртгэлүүдийг шүүж харах, хяналт хийх</p>
              </div>
              {profile?.role !== 'hse_engineer' && (
                <button
                  type="button"
                  onClick={() => setShowHseIncidentModal(true)}
                  className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-100 hover:bg-red-700 transition-all flex items-center gap-2"
                >
                  <ShieldAlert className="w-5 h-5" />
                  Осол бүртгэх
                </button>
              )}
            </div>

            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Эхлэх огноо</p>
                  <input
                    type="date"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200"
                    value={hseFilterSince}
                    onChange={(e) => setHseFilterSince(e.target.value)}
                  />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Дуусах огноо</p>
                  <input
                    type="date"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200"
                    value={hseFilterUntil}
                    onChange={(e) => setHseFilterUntil(e.target.value)}
                  />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Дамжлага</p>
                  <select
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white"
                    value={hseFilterStation}
                    onChange={(e) => setHseFilterStation(e.target.value)}
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
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Төлөв</p>
                  <select
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white"
                    value={hseFilterStatus}
                    onChange={(e) => setHseFilterStatus(e.target.value as any)}
                  >
                    <option value="all">Бүгд</option>
                    <option value="pending">Хүлээгдэж буй</option>
                    <option value="approved">Баталгаажсан</option>
                  </select>
                </div>
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Хайлт</p>
                  <input
                    className="w-full px-4 py-2 rounded-xl border border-gray-200"
                    placeholder="Оператор, тайлбар..."
                    value={hseFilterQuery}
                    onChange={(e) => setHseFilterQuery(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4 px-1">
                Төлөв шүүлт: <span className="font-bold">осол/зөрчил</span> = ХАБ инженерийн баталгаа;{' '}
                <span className="font-bold">checklist</span> = ээлж дээр илгээсэн эсэх.
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-gray-900">ХАБ checklist (ээлж)</h4>
                  <p className="text-sm text-gray-500 mt-1">ХАБЭА-н хяналтын хуудас — ээлжийн бүртгэл</p>
                </div>
                <span className="text-xs text-gray-500">Нийт: {hseChecklistFiltered.length}</span>
              </div>
              <HorizontalPagedList
                items={hseChecklistFiltered}
                renderPage={(page) => (
                <table className="w-full table-fixed text-left">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-bold">Цаг</th>
                      <th className="px-6 py-4 font-bold">Дамжлага</th>
                      <th className="px-6 py-4 font-bold">Оператор</th>
                      <th className="px-6 py-4 font-bold">Ээлж</th>
                      <th className="px-6 py-4 font-bold">Төлөв</th>
                      <th className="px-6 py-4 font-bold">Үйлдэл</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {page.map((row: any) => {
                      const d = row?.data && typeof row.data === 'object' ? row.data : {};
                      const submitted = !!(d as any).submittedAt;
                      return (
                        <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-xs text-gray-600">
                            {row.createdAt
                              ? new Date(row.createdAt).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })
                              : '—'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 font-bold">{hseStationLabel(row.stationCode)}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{row.operatorName || '—'}</td>
                          <td className="px-6 py-4 text-xs text-gray-600">
                            {(row.shiftDate || '—') + ' • ' + (row.shiftType || '—')}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${submitted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                }`}
                            >
                              {submitted ? 'Илгээсэн' : 'Ноорог'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              type="button"
                              onClick={() => setHseChecklistDetailId(String(row.id))}
                              className="text-sm font-bold text-orange-700 hover:underline"
                            >
                              Дэлгэрэнгүй →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {hseChecklistFiltered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                          Хяналтын хуудасны бүртгэл олдсонгүй.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                )}
              />
            </div>

            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-gray-900">Осол, зөрчлийн бүртгэл</h4>
                  <p className="text-sm text-gray-500 mt-1">Самбараас илгээсэн ХАБ бүртгэл</p>
                </div>
                <span className="text-xs text-gray-500">Нийт: {hseFilteredLogs.length}</span>
              </div>
              <HorizontalPagedList
                items={hseFilteredLogs}
                renderPage={(page) => (
                <table className="w-full table-fixed text-left">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-bold">Цаг</th>
                      <th className="px-6 py-4 font-bold">Дамжлага</th>
                      <th className="px-6 py-4 font-bold">Оператор</th>
                      <th className="px-6 py-4 font-bold">Инцидент</th>
                      <th className="px-6 py-4 font-bold">Төлөв</th>
                      <th className="px-6 py-4 font-bold">Үйлдэл</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {page.map((l: any) => (
                      <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-xs text-gray-600">
                          {l.createdAt
                            ? new Date(l.createdAt).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })
                            : l.timestamp
                              ? new Date(l.timestamp).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })
                              : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-bold">{hseStationLabel(l.stationCode)}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{l.operatorName || '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{Array.isArray(l.incidents) ? l.incidents.length : 0}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${l.hseEngineerApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              }`}
                          >
                            {l.hseEngineerApproved ? 'Баталгаажсан' : 'Хүлээгдэж буй'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => {
                              setHseDecisionNote(String(l.hseEngineerNote || ''));
                              setHseDetailLogId(String(l.id));
                            }}
                            className="text-sm font-bold text-orange-700 hover:underline"
                          >
                            Дэлгэрэнгүй →
                          </button>
                        </td>
                      </tr>
                    ))}
                    {hseFilteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                          Таарах бүртгэл олдсонгүй.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                )}
              />
            </div>

            {hseDetailLogId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <button
                  type="button"
                  className="absolute inset-0 bg-black/40"
                  aria-label="Хаах"
                  onClick={() => {
                    if (hseApproving) return;
                    setHseDetailLogId(null);
                  }}
                />
                <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-gray-200">
                  <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="text-xl font-black text-gray-900">ХАБ бүртгэлийн дэлгэрэнгүй</h4>
                      <p className="text-sm text-gray-500 mt-1">Хяналтын хуудас / осол, зөрчил / тэмдэглэл</p>
                    </div>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200"
                      onClick={() => {
                        if (hseApproving) return;
                        setHseDetailLogId(null);
                      }}
                    >
                      Хаах
                    </button>
                  </div>
                  <div className="p-6 space-y-6">
                    {!selectedHseLog ? (
                      <p className="text-sm text-gray-500">Мэдээлэл олдсонгүй.</p>
                    ) : (
                      <>
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                          <p className="font-black text-gray-900">
                            {hseStationLabel(selectedHseLog.stationCode)} • {selectedHseLog.operatorName || '—'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {selectedHseLog.createdAt
                              ? new Date(selectedHseLog.createdAt).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })
                              : selectedHseLog.timestamp
                                ? new Date(selectedHseLog.timestamp).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })
                                : '—'}
                          </p>
                          {selectedHseLog.generalComment ? (
                            <p className="text-sm text-gray-700 mt-3">Операторын тайлбар: {selectedHseLog.generalComment}</p>
                          ) : null}
                        </div>

                        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                          <div className="p-6 border-b border-gray-100">
                            <h5 className="font-bold text-gray-900">Осол, зөрчил</h5>
                          </div>
                          <div className="p-6">
                            {Array.isArray(selectedHseLog.incidents) && selectedHseLog.incidents.length > 0 ? (
                              <ul className="space-y-3">
                                {selectedHseLog.incidents.map((inc: any, idx: number) => (
                                  <li key={idx} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="text-sm font-black text-gray-900">
                                          {String(inc?.description || inc?.title || 'Тайлбаргүй')}
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-700 font-bold">
                                            Зэрэг: {mnIncidentSeverity(inc?.severity || inc?.level || inc?.priority)}
                                          </span>
                                          <span
                                            className={`px-3 py-1 rounded-full border font-bold ${
                                              inc?.violation === false
                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                : 'bg-red-50 border-red-200 text-red-700'
                                            }`}
                                          >
                                            Зөрчил: {inc?.violation === false ? 'Үгүй' : 'Тийм'}
                                          </span>
                                          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-700 font-bold">
                                            Цаг: {formatIncidentTime(inc?.reportedAt || inc?.reported_at || inc?.createdAt || inc?.created_at)}
                                          </span>
                                          {inc?.critical === true && (
                                            <span className="px-3 py-1 rounded-full bg-red-600 text-white font-black">
                                              Онц ноцтой
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {incidentKeyValueRows(inc).length > 0 && (
                                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {incidentKeyValueRows(inc).map((r: any) => (
                                          <div key={r.k} className="rounded-xl bg-white border border-gray-200 px-3 py-2">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{r.k}</p>
                                            <p className="text-xs text-gray-800 break-words">{r.v}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {renderIncidentAttachments(inc)}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-500">Инцидент бүртгэгдээгүй.</p>
                            )}
                          </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
                          <p className="text-xs font-black text-gray-400 uppercase tracking-wider">ХАБ инженерийн тэмдэглэл</p>
                          <textarea
                            className="mt-2 w-full min-h-[110px] px-4 py-3 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder="Тэмдэглэл..."
                            value={hseDecisionNote}
                            onChange={(e) => setHseDecisionNote(e.target.value)}
                            disabled={hseApproving || hseNoteSaving}
                          />
                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              type="button"
                              disabled={hseApproving || hseNoteSaving}
                              onClick={async () => {
                                if (!selectedHseLog) return;
                                setHseNoteSaving(true);
                                try {
                                  await handleSaveHseLogNote(String(selectedHseLog.id), hseDecisionNote || '');
                                } finally {
                                  setHseNoteSaving(false);
                                }
                              }}
                              className="px-5 py-3 rounded-2xl bg-gray-900 text-white text-sm font-black hover:bg-gray-800 disabled:opacity-60"
                            >
                              {hseNoteSaving ? 'Хадгалж байна...' : 'Тэмдэглэл хадгалах'}
                            </button>
                            {!selectedHseLog.hseEngineerApproved ? (
                              <button
                                type="button"
                                disabled={hseApproving || hseNoteSaving}
                                onClick={async () => {
                                  if (!selectedHseLog) return;
                                  setHseApproving(true);
                                  try {
                                    await handleApproveHseLog(String(selectedHseLog.id), hseDecisionNote || '');
                                    setHseDetailLogId(null);
                                  } finally {
                                    setHseApproving(false);
                                  }
                                }}
                                className="px-5 py-3 rounded-2xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 disabled:opacity-60"
                              >
                                Баталгаажуулах
                              </button>
                            ) : (
                              <span className="px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-black">
                                Баталгаажсан
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {hseChecklistDetailId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <button
                  type="button"
                  className="absolute inset-0 bg-black/40"
                  aria-label="Хаах"
                  onClick={() => setHseChecklistDetailId(null)}
                />
                <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-gray-200">
                  <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="text-xl font-black text-gray-900">ХАБ checklist</h4>
                      <p className="text-sm text-gray-500 mt-1">Ээлжийн хяналтын хуудас (унших)</p>
                    </div>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200"
                      onClick={() => setHseChecklistDetailId(null)}
                    >
                      Хаах
                    </button>
                  </div>
                  <div className="p-6 space-y-5">
                    {!selectedHseChecklist ? (
                      <p className="text-sm text-gray-500">Мэдээлэл олдсонгүй.</p>
                    ) : (
                      <>
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm space-y-1">
                          <p>
                            <span className="font-black text-gray-700">Дамжлага:</span>{' '}
                            <span className="text-gray-900">{hseStationLabel(selectedHseChecklist.stationCode)}</span>
                          </p>
                          <p>
                            <span className="font-black text-gray-700">Оператор:</span>{' '}
                            <span className="text-gray-900">{selectedHseChecklist.operatorName || '—'}</span>
                          </p>
                          <p>
                            <span className="font-black text-gray-700">Ээлж:</span>{' '}
                            <span className="text-gray-900">
                              {(selectedHseChecklist.shiftDate || '—') + ' • ' + (selectedHseChecklist.shiftType || '—')}
                            </span>
                          </p>
                          <p>
                            <span className="font-black text-gray-700">Бүртгэлийн цаг:</span>{' '}
                            <span className="text-gray-900">
                              {selectedHseChecklist.createdAt
                                ? new Date(selectedHseChecklist.createdAt).toLocaleString('mn-MN', {
                                  timeZone: 'Asia/Ulaanbaatar',
                                })
                                : '—'}
                            </span>
                          </p>
                        </div>
                        {(() => {
                          const d =
                            selectedHseChecklist.data && typeof selectedHseChecklist.data === 'object'
                              ? selectedHseChecklist.data
                              : {};
                          const yn = (v: unknown) => (v === true ? 'Тийм' : v === false ? 'Үгүй' : '—');
                          const rows: Array<{ k: string; v: string }> = [
                            { k: 'Хамгаалах хэрэгсэл бүрэн', v: yn((d as any).ppeComplete) },
                            { k: 'Ажлын байрны цэвэрлэгээ', v: yn((d as any).workplaceClean) },
                            { k: 'Хамгаалалт (guards)', v: yn((d as any).guardsInPlace) },
                            { k: 'Галын аюулгүй байдал', v: yn((d as any).fireSafetyOk) },
                          ];
                          return (
                            <ul className="space-y-2">
                              {rows.map((r: any) => (
                                <li
                                  key={r.k}
                                  className="flex justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                >
                                  <span className="text-gray-700 font-bold">{r.k}</span>
                                  <span className={r.v === 'Үгүй' ? 'text-red-600 font-black' : 'text-gray-900 font-bold'}>{r.v}</span>
                                </li>
                              ))}
                            </ul>
                          );
                        })()}
                        {(selectedHseChecklist.data as any)?.remarks ? (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                            <p className="text-xs font-black text-amber-900 uppercase tracking-wider">Тэмдэглэл</p>
                            <p className="text-sm text-gray-900 mt-2 whitespace-pre-wrap">
                              {String((selectedHseChecklist.data as any).remarks)}
                            </p>
                          </div>
                        ) : null}
                        {renderIncidentAttachments(selectedHseChecklistAttachmentPayload)}
                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                          <p className="text-xs font-black text-gray-400 uppercase tracking-wider">ХАБ инженерийн тэмдэглэл</p>
                          <textarea
                            className="mt-2 w-full min-h-[100px] px-4 py-3 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder="Тэмдэглэл..."
                            value={hseChecklistNote}
                            onChange={(e) => setHseChecklistNote(e.target.value)}
                            disabled={hseChecklistNoteSaving}
                          />
                          <button
                            type="button"
                            disabled={hseChecklistNoteSaving}
                            onClick={async () => {
                              if (!selectedHseChecklist) return;
                              setHseChecklistNoteSaving(true);
                              try {
                                await handleSaveHseChecklistNote(String(selectedHseChecklist.id), hseChecklistNote || '');
                              } finally {
                                setHseChecklistNoteSaving(false);
                              }
                            }}
                            className="mt-3 px-5 py-3 rounded-2xl bg-gray-900 text-white text-sm font-black hover:bg-gray-800 disabled:opacity-60"
                          >
                            {hseChecklistNoteSaving ? 'Хадгалж байна...' : 'Тэмдэглэл хадгалах'}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <Link
                            href={`/shift/${selectedHseChecklist.shiftId}`}
                            className="inline-flex px-5 py-3 rounded-2xl bg-orange-600 text-white text-sm font-black hover:bg-orange-700"
                          >
                            Ээлж нээх
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Хөдөлмөрийн аюулгүй байдал</h3>
                <p className="text-gray-500">ХАБЭА-н бүртгэл, осол зөрчлийн мэдээлэл</p>
              </div>
              <button
                type="button"
                onClick={() => setShowHseIncidentModal(true)}
                className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-100 hover:bg-red-700 transition-all flex items-center gap-2"
              >
                <ShieldAlert className="w-5 h-5" />
                Осол бүртгэх
              </button>
            </div>
            <p className="text-sm text-gray-500 -mt-4">
              Илгээсэн ослын бүртгэлийг дахин засах боломжгүй; шаардлагатай бол шинэ бүртгэл үүсгэнэ үү.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                <h4 className="font-bold text-lg mb-6">Сүүлийн үеийн ХАБ бүртгэл</h4>
                <HorizontalPagedList
                  items={hseLogs}
                  renderPage={(page) => (
                <div className="space-y-4">
                  {page.map((log: any) => (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => setOperatorHseDetailLogId(String(log.id))}
                      className="w-full text-left p-4 bg-gray-50 rounded-2xl flex items-center justify-between gap-3 hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200"
                    >
                      <div>
                        <p className="font-bold text-sm text-gray-900">{new Date(log.timestamp).toLocaleDateString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })}</p>
                        <p className="text-xs text-gray-500">{log.incidents?.length || 0} осол бүртгэгдсэн</p>
                        <p className="text-[10px] font-bold text-orange-600 mt-1">Дэлгэрэнгүй (зөвхөн унших) →</p>
                      </div>
                      <span className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase ${log.hseEngineerApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {log.hseEngineerApproved ? 'Баталгаажсан' : 'Хүлээгдэж буй'}
                      </span>
                    </button>
                  ))}
                </div>
                  )}
                />
              </div>
              <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                <h4 className="font-bold text-lg mb-6">Осол, зөрчлийн статистик</h4>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm border-b border-gray-100 pb-2">
                    <span className="text-gray-600">Нийт бүртгэл</span>
                    <span className="font-bold text-gray-900">{hseLogs.length}</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-gray-100 pb-2">
                    <span className="text-gray-600">Осол/зөрчлийн мэдээлэл</span>
                    <span className="font-bold text-gray-900">
                      {hseLogs.reduce((n: number, log: any) => n + (log.incidents?.length || 0), 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Баталгаажсан</span>
                    <span className="font-bold text-emerald-700">{hseLogs.filter((l: any) => l.hseEngineerApproved).length}</span>
                  </div>
                </div>
              </div>
            </div>

            {operatorHseDetailLogId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <button
                  type="button"
                  className="absolute inset-0 bg-black/40"
                  aria-label="Хаах"
                  onClick={() => setOperatorHseDetailLogId(null)}
                />
                <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-gray-200">
                  <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="text-xl font-black text-gray-900">ХАБ бүртгэл (зөвхөн унших)</h4>
                      <p className="text-sm text-gray-500 mt-1">Илгээсний дараа засвар хийх боломжгүй</p>
                    </div>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200"
                      onClick={() => setOperatorHseDetailLogId(null)}
                    >
                      Хаах
                    </button>
                  </div>
                  <div className="p-6 space-y-6">
                    {!selectedOperatorHseLog ? (
                      <p className="text-sm text-gray-500">Мэдээлэл олдсонгүй.</p>
                    ) : (
                      <>
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                          <p className="font-black text-gray-900">
                            {hseStationLabel(selectedOperatorHseLog.stationCode)} • {selectedOperatorHseLog.operatorName || '—'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {selectedOperatorHseLog.createdAt
                              ? new Date(selectedOperatorHseLog.createdAt).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })
                              : selectedOperatorHseLog.timestamp
                                ? new Date(selectedOperatorHseLog.timestamp).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })
                                : '—'}
                          </p>
                          {selectedOperatorHseLog.generalComment ? (
                            <p className="text-sm text-gray-700 mt-3">Операторын тайлбар: {selectedOperatorHseLog.generalComment}</p>
                          ) : null}
                        </div>

                        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                          <div className="p-6 border-b border-gray-100">
                            <h5 className="font-bold text-gray-900">Осол, зөрчил</h5>
                          </div>
                          <div className="p-6">
                            {Array.isArray(selectedOperatorHseLog.incidents) && selectedOperatorHseLog.incidents.length > 0 ? (
                              <ul className="space-y-3">
                                {selectedOperatorHseLog.incidents.map((inc: any, idx: number) => (
                                  <li key={idx} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="text-sm font-black text-gray-900">
                                          {String(inc?.description || inc?.title || 'Тайлбаргүй')}
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-700 font-bold">
                                            Зэрэг: {mnIncidentSeverity(inc?.severity || inc?.level || inc?.priority)}
                                          </span>
                                          <span
                                            className={`px-3 py-1 rounded-full border font-bold ${
                                              inc?.violation === false
                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                : 'bg-red-50 border-red-200 text-red-700'
                                            }`}
                                          >
                                            Зөрчил: {inc?.violation === false ? 'Үгүй' : 'Тийм'}
                                          </span>
                                          <span className="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-700 font-bold">
                                            Цаг: {formatIncidentTime(inc?.reportedAt || inc?.reported_at || inc?.createdAt || inc?.created_at)}
                                          </span>
                                          {inc?.critical === true && (
                                            <span className="px-3 py-1 rounded-full bg-red-600 text-white font-black">Онц ноцтой</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    {incidentKeyValueRows(inc).length > 0 && (
                                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {incidentKeyValueRows(inc).map((r: any) => (
                                          <div key={r.k} className="rounded-xl bg-white border border-gray-200 px-3 py-2">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{r.k}</p>
                                            <p className="text-xs text-gray-800 break-words">{r.v}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {renderIncidentAttachments(inc)}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-500">Инцидент бүртгэгдээгүй.</p>
                            )}
                          </div>
                        </div>

                        {selectedOperatorHseLog.hseEngineerNote ? (
                          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
                            <p className="text-xs font-black text-emerald-800 uppercase tracking-wider">ХАБ инженерийн тэмдэглэл</p>
                            <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap">{selectedOperatorHseLog.hseEngineerNote}</p>
                          </div>
                        ) : null}

                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                          <span
                            className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase ${selectedOperatorHseLog.hseEngineerApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              }`}
                          >
                            {selectedOperatorHseLog.hseEngineerApproved ? 'Баталгаажсан' : 'Хүлээгдэж буй'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        )
  );
}
