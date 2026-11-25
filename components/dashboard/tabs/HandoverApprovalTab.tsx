import Link from 'next/link';
import { HorizontalPagedList } from '../HorizontalPagedList';

export function HandoverApprovalTab({
  handoverQueue,
  setHandoverDecisionNote,
  setHandoverDetailId,
  handoverDetailId,
  handoverSubmitting,
  handoverDetailLoading,
  handoverDetailShift,
  handoverDetailMissing,
  handoverExpandedLogId,
  setHandoverExpandedLogId,
  compactObj,
  mnModalLogType,
  handoverDecisionNote,
  handleMasterHandoverDecision,
}: any) {
  return (
        <section className="space-y-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Ээлж хүлээлцэх баталгаажуулалт</h3>
            <p className="text-gray-500">Хүлээгдэж буй ээлж хүлээлцэх</p>
          </div>
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h4 className="font-bold text-gray-900">Хүлээгдэж буй ээлж хүлээлцэх</h4>
              <span className="text-xs font-bold text-blue-800 bg-blue-100 px-3 py-1 rounded-full">{handoverQueue.length}</span>
            </div>
            <div className="p-6">
              {handoverQueue.length === 0 ? (
                <p className="text-sm text-gray-500">Одоогоор хүлээгдэж буй ээлж хүлээлцэх байхгүй.</p>
              ) : (
                <HorizontalPagedList
                  items={handoverQueue}
                  renderPage={(page) => (
                <ul className="space-y-3">
                  {page.map((s: any) => (
                    <li key={s.id} className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <p className="font-bold text-blue-900">
                        {s.stationCode} • {s.shiftType}
                      </p>
                      <p className="text-sm text-blue-900/80 mt-1">
                        {s.operatorName || '—'} → {s.handoverToOperatorName || '—'}
                      </p>
                      <p className="text-xs text-blue-900/70 mt-1">
                        Илгээсэн:{' '}
                        {(s.handoverRequestedAt || s.createdAt)
                          ? new Date(s.handoverRequestedAt || s.createdAt).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })
                          : '—'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setHandoverDecisionNote('');
                            setHandoverDetailId(String(s.id));
                          }}
                          className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-black hover:bg-orange-700"
                        >
                          Дэлгэрэнгүй
                        </button>
                        <Link href={`/shift/${s.id}`} className="px-4 py-2 rounded-xl bg-white border border-orange-200 text-orange-700 text-xs font-black hover:bg-orange-50">
                          Shift руу орох
                        </Link>
                        <span className="px-3 py-2 rounded-xl bg-white border border-blue-100 text-xs font-bold text-blue-900">
                          Төлөв: Хүлээгдэж буй
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                  )}
                />
              )}
            </div>
          </div>

          {handoverDetailId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/40"
                aria-label="Хаах"
                onClick={() => {
                  if (handoverSubmitting) return;
                  setHandoverDetailId(null);
                }}
              />
              <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-gray-200">
                <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h4 className="text-xl font-black text-gray-900">Ээлж хүлээлцэх дэлгэрэнгүй</h4>
                    <p className="text-sm text-gray-500 mt-1">Өмнөх ээлжийн бүртгэлүүдийг read-only харах</p>
                  </div>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200"
                    onClick={() => {
                      if (handoverSubmitting) return;
                      setHandoverDetailId(null);
                    }}
                  >
                    Хаах
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {handoverDetailLoading ? (
                    <p className="text-sm text-gray-500">Уншиж байна...</p>
                  ) : !handoverDetailShift ? (
                    <p className="text-sm text-gray-500">Мэдээлэл олдсонгүй.</p>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-gray-500 uppercase tracking-wider">Хүлээгдэж буй ээлж</p>
                            <p className="text-lg font-black text-gray-900 mt-1">
                              {handoverDetailShift.stationCode} • {handoverDetailShift.shiftType} • {handoverDetailShift.shiftDate}
                            </p>
                            <p className="text-sm text-gray-700 mt-2">
                              {handoverDetailShift.operatorName || '—'} → {handoverDetailShift.handoverToOperatorName || '—'}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              Илгээсэн:{' '}
                              {handoverDetailShift.handoverRequestedAt
                                ? new Date(handoverDetailShift.handoverRequestedAt).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })
                                : '—'}
                            </p>
                          </div>
                          <Link
                            href={`/shift/${handoverDetailShift._id || handoverDetailId}`}
                            className="shrink-0 px-4 py-2 rounded-xl bg-white border border-orange-200 text-orange-700 text-sm font-bold hover:bg-orange-50"
                          >
                            Shift хуудас нээх →
                          </Link>
                        </div>
                      </div>

                      {handoverDetailMissing.length > 0 && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                          <p className="font-bold text-amber-900">Анхаар: Дутуу бүртгэлтэй</p>
                          <ul className="mt-2 list-disc pl-5 text-sm text-amber-900/90 space-y-1">
                            {handoverDetailMissing.map((m: string) => (
                              <li key={m}>{m}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                          <h5 className="font-bold text-gray-900">Өмнөх ээлжийн бүртгэлүүд (read-only)</h5>
                          <p className="text-sm text-gray-500 mt-1">Бүртгэлийн төрөл, timestamp, дэлгэрэнгүй контент</p>
                        </div>
                        <div className="p-6">
                          {Array.isArray(handoverDetailShift.modalLogs) && handoverDetailShift.modalLogs.length > 0 ? (
                            <ul className="space-y-3">
                              {handoverDetailShift.modalLogs
                                .slice()
                                .sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
                                .slice(0, 50)
                                .map((l: any) => {
                                  const expanded = handoverExpandedLogId === String(l.id);
                                  const payload = compactObj(l.data || l);
                                  return (
                                    <li key={l.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                                      <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="font-bold text-gray-900">{mnModalLogType(l.logType)}</p>
                                          <p className="text-xs text-gray-500 mt-1">
                                            {l.createdAt
                                              ? new Date(l.createdAt).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })
                                              : '—'}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          className="shrink-0 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-black hover:bg-gray-100"
                                          onClick={() => setHandoverExpandedLogId(expanded ? null : String(l.id))}
                                        >
                                          {expanded ? 'Хураах' : 'Дэлгэрэнгүй'}
                                        </button>
                                      </div>
                                      {expanded && (
                                        <pre className="mt-3 text-xs bg-white border border-gray-200 rounded-2xl p-4 overflow-auto max-h-80">
                                          {JSON.stringify(payload, null, 2)}
                                        </pre>
                                      )}
                                    </li>
                                  );
                                })}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-500">Modal бүртгэл олдсонгүй.</p>
                          )}
                        </div>
                      </div>

                      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                          <h5 className="font-bold text-gray-900">Станцын бүртгэлүүд (read-only summary)</h5>
                          <p className="text-sm text-gray-500 mt-1">Тоног төхөөрөмж / үйлдвэрлэл / засвар / орц найрлага / хэмжилт</p>
                        </div>
                        <div className="p-6 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                              <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Тоног төхөөрөмж</p>
                              <p className="mt-1 text-xl font-black text-gray-900">
                                {Array.isArray(handoverDetailShift.equipmentInspections) ? handoverDetailShift.equipmentInspections.length : 0}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                              <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Үйлдвэрлэл</p>
                              <p className="mt-1 text-xl font-black text-gray-900">
                                {Array.isArray(handoverDetailShift.productionLogs) ? handoverDetailShift.productionLogs.length : 0}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                              <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Засвар</p>
                              <p className="mt-1 text-xl font-black text-gray-900">
                                {Array.isArray(handoverDetailShift.repairEntries) ? handoverDetailShift.repairEntries.length : 0}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                              <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Орц найрлага</p>
                              <p className="mt-1 text-xl font-black text-gray-900">
                                {Array.isArray(handoverDetailShift.ingredientRecords) ? handoverDetailShift.ingredientRecords.length : 0}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                              <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Хэмжилт</p>
                              <p className="mt-1 text-xl font-black text-gray-900">
                                {Array.isArray(handoverDetailShift.measurementRows) ? handoverDetailShift.measurementRows.length : 0}
                              </p>
                            </div>
                          </div>

                          {Array.isArray(handoverDetailShift.equipmentInspections) && handoverDetailShift.equipmentInspections.length > 0 && (
                            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                              <div className="px-4 py-3 border-b bg-gray-50 text-sm font-bold text-gray-900">Тоног төхөөрөмжийн шалгалт (жишээ 20 мөр)</div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                  <thead>
                                    <tr className="text-xs uppercase tracking-wider text-gray-500 bg-gray-50">
                                      <th className="px-4 py-3 font-bold">Нэр</th>
                                      <th className="px-4 py-3 font-bold">Төлөв</th>
                                      <th className="px-4 py-3 font-bold">Тайлбар</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {handoverDetailShift.equipmentInspections.slice(0, 20).map((x: any) => (
                                      <tr key={x.id}>
                                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{x.itemLabel || x.labelMn || x.itemKey || '—'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700">{x.status || x.statusOk || '—'}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{x.comment || x.equipmentNotes || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {Array.isArray(handoverDetailShift.productionLogs) && handoverDetailShift.productionLogs.length > 0 && (
                            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                              <div className="px-4 py-3 border-b bg-gray-50 text-sm font-bold text-gray-900">Үйлдвэрлэлийн бүртгэл (жишээ 20 мөр)</div>
                              <ul className="p-4 space-y-3">
                                {handoverDetailShift.productionLogs.slice(0, 20).map((x: any) => (
                                  <li key={x.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div>
                                        <p className="font-bold text-gray-900">{String(x.logType || 'production')}</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                          {x.createdAt ? new Date(x.createdAt).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' }) : '—'}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-black hover:bg-gray-100"
                                        onClick={() => setHandoverExpandedLogId(handoverExpandedLogId === String(x.id) ? null : String(x.id))}
                                      >
                                        {handoverExpandedLogId === String(x.id) ? 'Хураах' : 'Дэлгэрэнгүй'}
                                      </button>
                                    </div>
                                    {handoverExpandedLogId === String(x.id) && (
                                      <pre className="mt-3 text-xs bg-white border border-gray-200 rounded-2xl p-4 overflow-auto max-h-80">
                                        {JSON.stringify(compactObj(x.data || x), null, 2)}
                                      </pre>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {Array.isArray(handoverDetailShift.repairEntries) && handoverDetailShift.repairEntries.length > 0 && (
                            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                              <div className="px-4 py-3 border-b bg-gray-50 text-sm font-bold text-gray-900">Засварын бүртгэл (жишээ 20 мөр)</div>
                              <ul className="p-4 space-y-2">
                                {handoverDetailShift.repairEntries.slice(0, 20).map((x: any) => (
                                  <li key={x.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                                    <p className="font-bold text-gray-900">{x.labelMn || x.itemKey || x.entryType || 'Засвар'}</p>
                                    <p className="text-sm text-gray-600 mt-1">{x.comment || x.repairWorkDone || '—'}</p>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {Array.isArray(handoverDetailShift.ingredientRecords) && handoverDetailShift.ingredientRecords.length > 0 && (
                            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                              <div className="px-4 py-3 border-b bg-gray-50 text-sm font-bold text-gray-900">Орц найрлага (жишээ 20 мөр)</div>
                              <ul className="p-4 space-y-2">
                                {handoverDetailShift.ingredientRecords.slice(0, 20).map((x: any) => (
                                  <li key={x.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                                    <p className="font-bold text-gray-900">{x.label || x.itemKey || '—'}</p>
                                    <p className="text-sm text-gray-600 mt-1">
                                      {x.originalValue ? `${x.originalValue} → ${x.changedValue || ''}` : (x.changedValue || '—')}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {Array.isArray(handoverDetailShift.measurementRows) && handoverDetailShift.measurementRows.length > 0 && (
                            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                              <div className="px-4 py-3 border-b bg-gray-50 text-sm font-bold text-gray-900">Хэмжилтийн мөрүүд (жишээ 10 мөр)</div>
                              <div className="p-4 space-y-2">
                                {handoverDetailShift.measurementRows.slice(0, 10).map((x: any) => (
                                  <div key={x.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                                    <p className="font-bold text-gray-900">
                                      Цаг: {x.timeValue || x.measuredTime || x.measuredTime35 || '—'}
                                    </p>
                                    <pre className="mt-2 text-xs bg-white border border-gray-200 rounded-2xl p-4 overflow-auto max-h-60">
                                      {JSON.stringify(compactObj(x), null, 2)}
                                    </pre>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Тайлбар (сонголттой)</p>
                        <textarea
                          className="mt-2 w-full min-h-[110px] px-4 py-3 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="Баталгаажуулах/буцаахтай холбоотой тэмдэглэл..."
                          value={handoverDecisionNote}
                          onChange={(e) => setHandoverDecisionNote(e.target.value)}
                          disabled={handoverSubmitting}
                        />
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => handleMasterHandoverDecision('accept')}
                            disabled={handoverSubmitting}
                            className="px-5 py-3 rounded-2xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 disabled:opacity-60"
                          >
                            Баталгаажуулах
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMasterHandoverDecision('return')}
                            disabled={handoverSubmitting}
                            className="px-5 py-3 rounded-2xl bg-red-600 text-white text-sm font-black hover:bg-red-700 disabled:opacity-60"
                          >
                            Буцаах
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
  );
}
