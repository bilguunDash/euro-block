import React, { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { AlertCircle, CheckCircle2, ChevronLeft, ClipboardList, Save } from 'lucide-react';

const nextMasterFetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());
import { useToast } from '@/components/ui/ToastProvider';
import {
  createEmptyY099MasterHandoverPayload,
  hasPerSubRowComments,
  mergeY099Payload,
  normalizeY099TimeValue,
  Y099_STOP_SECTIONS,
  type Y099LeftSubRow,
  type Y099ProdSubRow,
  type Y099ShiftMasterHandoverPayload,
  type Y099ShiftType,
  validateY099ShiftMasterHandoverPayload,
} from '@/lib/y099-shift-master-handover';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

// ─── cell class ───────────────────────────────────────────────────────────────
const td = 'border border-gray-300 px-2 py-1 text-sm align-middle';
const th = 'border border-gray-300 px-2 py-1 text-xs font-bold text-center bg-gray-50';
const input =
  'w-full px-2 py-1 rounded border border-gray-200 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200';
const inputTight = `${input} h-8`;
const inputTopTight = `${input} h-7`;
const stack = 'flex flex-col gap-1';
// ─── component ────────────────────────────────────────────────────────────────

async function fetcher(url: string) {
  const res = await fetch(url, { credentials: 'include' });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || 'Fetch error');
  return json;
}

type MasterDirectoryUser = {
  id: string | number;
  name?: string;
  email?: string;
};

export function Y099ShiftMasterHandoverForm({
  shiftDate,
  shiftType,
  masterUid,
  masterName,
  initialPayload,
  shiftId,
  onBack,
  onSubmit,
  submitting,
}: {
  shiftDate: string;
  shiftType: Y099ShiftType;
  masterUid: string;
  masterName: string;
  initialPayload?: Partial<Y099ShiftMasterHandoverPayload> | null;
  shiftId?: string;
  onBack: () => void;
  onSubmit: (payload: Y099ShiftMasterHandoverPayload) => Promise<void>;
  submitting: boolean;
}) {
  const toast = useToast();
  const { data: userData } = useSWR('/api/user-directory?roles=master', fetcher);
  const masters = useMemo<MasterDirectoryUser[]>(
    () => (Array.isArray(userData?.users) ? (userData.users as MasterDirectoryUser[]) : []),
    [userData],
  );
  const mastersById = useMemo(
    () => new Map<string, MasterDirectoryUser>(masters.map((m) => [String(m.id), m])),
    [masters]
  );
  const findMasterIdByLabel = (label: string) => {
    const normalized = String(label || '').trim();
    if (!normalized) return '';
    const matches = masters.filter((m) => (m.name || m.email || '') === normalized);
    return matches.length === 1 ? String(matches[0].id) : '';
  };

  const initial = useMemo(() => {
    const empty = createEmptyY099MasterHandoverPayload({ shiftDate, shiftType, masterUid, masterName });
    return mergeY099Payload(empty, initialPayload);
  }, [shiftDate, shiftType, masterUid, masterName, initialPayload]);

  const [form, setForm] = useState<Y099ShiftMasterHandoverPayload>(() => ({ ...initial }));

  const scheduleQuery =
    shiftDate && shiftType
      ? `stationCode=${encodeURIComponent('ҮЯ-099')}&shiftDate=${encodeURIComponent(shiftDate)}&shiftType=${encodeURIComponent(shiftType)}`
      : null;

  // Next shift's master → "Ээлж хүлээн авах ээлжийн мастер"
  const nextMasterUrl = shiftId && scheduleQuery ? `/api/master-schedule-next?${scheduleQuery}` : null;
  const { data: nextMasterData } = useSWR(nextMasterUrl, nextMasterFetcher, { revalidateOnFocus: false });
  const autoMasterName: string =
    nextMasterData?.ok && nextMasterData?.found ? String(nextMasterData.schedule?.masterName || '') : '';
  const autoMasterUid: string =
    nextMasterData?.ok && nextMasterData?.found ? String(nextMasterData.schedule?.masterUid || '') : '';
  const scheduleNotFound = nextMasterData !== undefined && nextMasterData?.ok && !nextMasterData?.found;

  // This shift's master → "Ээлж хүлээлгэж өгсөн ээлжийн мастер"
  const currentMasterUrl = scheduleQuery ? `/api/master-schedule-current?${scheduleQuery}` : null;
  const { data: currentMasterData } = useSWR(currentMasterUrl, nextMasterFetcher, { revalidateOnFocus: false });
  const currentMasterName: string =
    currentMasterData?.ok && currentMasterData?.found ? String(currentMasterData.schedule?.masterName || '') : '';
  const currentMasterUid: string =
    currentMasterData?.ok && currentMasterData?.found ? String(currentMasterData.schedule?.masterUid || '') : '';

  const autoFilledRef = useRef(false);
  useEffect(() => {
    if (autoFilledRef.current || !autoMasterName) return;
    setForm((p) => {
      if (p.receivedBy?.trim()) return p;
      autoFilledRef.current = true;
      return { ...p, receivedBy: autoMasterName, receivedByUid: autoMasterUid };
    });
  }, [autoMasterName, autoMasterUid]);

  const handedOverFilledRef = useRef(false);
  useEffect(() => {
    if (handedOverFilledRef.current) return;
    // Prefer schedule-resolved master; fall back to the master prop (shift starter).
    const name = currentMasterName || masterName;
    const uid = currentMasterUid || masterUid;
    if (!name) return;
    setForm((p) => {
      if (p.handedOverBy?.trim()) return p;
      handedOverFilledRef.current = true;
      return { ...p, handedOverBy: name, handedOverByUid: uid };
    });
  }, [currentMasterName, currentMasterUid, masterName, masterUid]);

  // ── patch helpers ────────────────────────────────────────────────────────────

  const patchLeftSub = (rowKey: string, subKey: string, value: string) => {
    setForm((p) => ({
      ...p,
      rows: p.rows.map((r) =>
        r.key !== rowKey
          ? r
          : {
            ...r,
            leftSubRows: r.leftSubRows.map((s) => (s.key === subKey ? { ...s, value } : s)),
          },
      ),
    }));
  };

  const patchLeftUnit = (rowKey: string, subKey: string, unit: string) => {
    setForm((p) => ({
      ...p,
      rows: p.rows.map((r) =>
        r.key !== rowKey
          ? r
          : {
            ...r,
            leftSubRows: r.leftSubRows.map((s) => (s.key === subKey ? { ...s, unit } : s)),
          },
      ),
    }));
  };

  const patchProdSub = (rowKey: string, subKey: string, patch: Partial<Y099ProdSubRow>) => {
    setForm((p) => ({
      ...p,
      rows: p.rows.map((r) =>
        r.key !== rowKey
          ? r
          : {
            ...r,
            prodSubRows: r.prodSubRows.map((s) => (s.key === subKey ? { ...s, ...patch } : s)),
          },
      ),
    }));
  };

  const patchComment = (rowKey: string, comment: string) => {
    setForm((p) => ({
      ...p,
      rows: p.rows.map((r) => (r.key === rowKey ? { ...r, comment } : r)),
    }));
  };

  // ── submit ───────────────────────────────────────────────────────────────────

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.receivedBy && !form.receivedByUid && !findMasterIdByLabel(form.receivedBy)) {
      toast.warning('Хүлээн авах мастерыг жагсаалтаас дахин сонгоно уу.');
      return;
    }
    const validationError = validateY099ShiftMasterHandoverPayload(form, scheduleNotFound);
    if (validationError) {
      toast.warning(validationError);
      return;
    }
    await onSubmit({
      ...form,
      receivedByUid: form.receivedByUid || findMasterIdByLabel(form.receivedBy),
      masterUid,
      masterName,
      submittedAt: new Date().toISOString(),
      ...(scheduleNotFound ? { needsAdminApproval: true } : {}),
    } as any);
  };

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={submit} className="bg-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-orange-50/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-orange-600" />
              ҮЯ-099: Ээлжийн мастерын ээлж хүлээлцэх бүртгэл
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Огноо: {shiftDate} · Ээлж: {shiftType} · Ээлжийн мастер: {masterName || '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-800 text-sm font-bold hover:bg-gray-200"
            disabled={submitting}
          >
            <ChevronLeft className="w-4 h-4" />
            Буцах
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="p-6 space-y-6">
        <div className="overflow-x-auto rounded-xl border border-gray-300">
          <table className="w-full border-collapse text-sm min-w-[1100px]">
            <thead>
              {/* Group header */}
              <tr>
                <th className={th} rowSpan={2}>д/д</th>
                <th className={`${th} text-center`} colSpan={3}>Түүхий эдийн бэлтгэл</th>
                <th className={`${th} text-center`} colSpan={6}>Бүтээгдэхүүн үйлдвэрлэл</th>
                <th className={th} rowSpan={2}>Тайлбар</th>
              </tr>
              {/* Column header */}
              <tr>
                <th className={th}>Тодорхойлолт</th>
                <th className={th}>Үзүүлэлт</th>
                <th className={th}>Үлдэгдэл</th>
                <th className={th}>Тодорхойлолт</th>
                <th className={th}>Үзүүлэлт</th>
                <th className={th}>Бохир</th>
                <th className={th}>Цэвэр</th>
                <th className={th}>Нураасан</th>
                <th className={th}>Хаясан</th>
              </tr>
            </thead>
            <tbody>
              {form.rows.map((r) => {
                const span = Math.max(r.leftSubRows.length, r.prodSubRows.length);
                const lockDirty = r.no >= 3 && r.no <= 8;
                const lockMilledDiscarded = r.no >= 3 && r.no <= 5;
                const editableLeftUnit = r.no >= 8 && r.no <= 10;
                const splitProdUnitRows = r.no >= 6 && r.no <= 8;
                const isDescMergedStart = r.no === 6;
                const isDescMergedHidden = r.no === 7 || r.no === 8;
                const isDirtyMergedStart = r.no === 6;
                const isDirtyMergedHidden = r.no === 7 || r.no === 8;
                const isMilledMergedStart = r.no === 6;
                const isMilledMergedHidden = r.no === 7 || r.no === 8;
                const isCleanMilledMergedRow = r.no === 9 || r.no === 10;
                const cleanMilledMergedText = r.no === 9 ? 'Асгамал, ш' : r.no === 10 ? 'Багцалгаа, ш' : '';
                const leftPadded: (Y099LeftSubRow | null)[] = [
                  ...r.leftSubRows,
                  ...new Array(Math.max(0, span - r.leftSubRows.length)).fill(null),
                ];
                const prodPadded: (Y099ProdSubRow | null)[] = [
                  ...r.prodSubRows,
                  ...new Array(Math.max(0, span - r.prodSubRows.length)).fill(null),
                ];

                return (
                  <tr key={r.key} className="hover:bg-orange-50/20 align-top">
                    <td className={`${td} text-center font-bold text-gray-600`}>{r.no}</td>
                    <td className={`${td} font-medium text-gray-900`}>{r.leftLabel}</td>

                    {/* Left unit stack */}
                    <td className={`${td} text-gray-600 whitespace-nowrap`}>
                      <div className={stack}>
                        {leftPadded.map((ls, i) => (
                          <div key={ls?.key ?? `x-${i}`} className="min-h-[32px] flex items-center">
                            {ls ? (
                              editableLeftUnit ? (
                                <input
                                  type="text"
                                  value={ls.unit}
                                  onChange={(e) => patchLeftUnit(r.key, ls.key, e.target.value)}
                                  className={input}
                                  placeholder="..."
                                />
                              ) : (
                                ls.unit
                              )
                            ) : (
                              ''
                            )}
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Left value stack */}
                    <td className={td}>
                      <div className={stack}>
                        {leftPadded.map((ls, i) => (
                          <div key={ls?.key ?? `xv-${i}`} className="min-h-[32px] flex items-center">
                            {ls ? (
                              <input
                                type="text"
                                value={ls.value}
                                onChange={(e) => patchLeftSub(r.key, ls.key, e.target.value)}
                                className={input}
                                placeholder="..."
                              />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </td>

                    {!isDescMergedHidden &&
                      (isDescMergedStart ? (
                        <td className={`${td} text-center font-medium text-gray-700`} rowSpan={3}>
                          Автоклав
                        </td>
                      ) : (
                        <td className={`${td} font-medium text-gray-900`}>
                          <div className={stack}>
                            {prodPadded.map((ps, i) => (
                              <div key={ps?.key ?? `pl-${i}`} className="min-h-[32px] flex items-center">
                                {ps?.description || (i === 0 ? r.prodLabel : '')}
                              </div>
                            ))}
                          </div>
                        </td>
                      ))}

                    {/* Prod unit stack */}
                    <td className={`${td} text-gray-600 whitespace-nowrap`}>
                      <div className={stack}>
                        {prodPadded.map((ps, i) => (
                          <div
                            key={ps?.key ?? `pu-${i}`}
                            className={`min-h-[32px] flex items-center ${splitProdUnitRows && i < prodPadded.length - 1
                                ? '-mx-2 px-2 border-b border-gray-300'
                                : ''
                              }`}
                          >
                            {ps?.unit ?? ''}
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Dirty stack / merged cell for rows 6-8 */}
                    {!isDirtyMergedHidden &&
                      (isDirtyMergedStart ? (
                        <td className={`${td} text-center font-medium text-gray-700`} rowSpan={3}>
                          Залгасан цаг
                        </td>
                      ) : (
                        <td className={td}>
                          <div className={stack}>
                            {prodPadded.map((ps, i) => (
                              <div key={ps?.key ?? `pd-${i}`} className="min-h-[32px] flex items-center">
                                {ps && !lockDirty ? (
                                  <input
                                    type="text"
                                    value={ps.dirty}
                                    onChange={(e) => patchProdSub(r.key, ps.key, { dirty: e.target.value })}
                                    className={input}
                                  />
                                ) : ''}
                              </div>
                            ))}
                          </div>
                        </td>
                      ))}

                    {/* Clean stack (or merged clean+milled for rows 9-10) */}
                    {isCleanMilledMergedRow ? (
                      <td className={`${td} text-center font-medium text-gray-700`} colSpan={2}>
                        {cleanMilledMergedText}
                      </td>
                    ) : (
                      <td className={td}>
                        <div className={stack}>
                          {prodPadded.map((ps, i) => (
                            <div
                              key={ps?.key ?? `pc-${i}`}
                              className={`min-h-[32px] flex items-center ${splitProdUnitRows && i < prodPadded.length - 1
                                  ? '-mx-2 px-2 border-b border-gray-300'
                                  : ''
                                }`}
                            >
                              {ps ? (
                                hasPerSubRowComments(r.no) ? (
                                  /* Автоклавын блок — «Залгасан цаг»: цаг:минут сонгоно.
                                     Таних боломжгүй хуучин бичлэгийг устгахгүй, шар
                                     хүрээгээр тэмдэглэж tooltip-д эх утгыг харуулна. */
                                  (() => {
                                    const timeValue = normalizeY099TimeValue(ps.clean);
                                    const legacyUnparsed = !!ps.clean && !timeValue;
                                    return (
                                      <input
                                        type="time"
                                        value={timeValue}
                                        onChange={(e) => patchProdSub(r.key, ps.key, { clean: e.target.value })}
                                        title={
                                          legacyUnparsed
                                            ? `Хуучин бичлэг: «${ps.clean}» — цаг, минутыг дахин сонгоно уу.`
                                            : undefined
                                        }
                                        className={`${i < 3 ? inputTopTight : inputTight}${legacyUnparsed ? ' ring-1 ring-amber-400' : ''}`}
                                      />
                                    );
                                  })()
                                ) : (
                                  <input
                                    type="text"
                                    value={ps.clean}
                                    onChange={(e) => patchProdSub(r.key, ps.key, { clean: e.target.value })}
                                    className={splitProdUnitRows ? (i < 3 ? inputTopTight : inputTight) : input}
                                  />
                                )
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </td>
                    )}

                    {/* Milled stack / merged cell for rows 6-8 */}
                    {!isCleanMilledMergedRow &&
                      (!isMilledMergedHidden &&
                        (isMilledMergedStart ? (
                          <td className={`${td} text-center font-medium text-gray-700`} rowSpan={3}>
                            Бүтээгдэхүүний хэмжээ
                          </td>
                        ) : (
                          <td className={td}>
                            <div className={stack}>
                              {prodPadded.map((ps, i) => (
                                <div key={ps?.key ?? `pm-${i}`} className="min-h-[32px] flex items-center">
                                  {ps && !lockMilledDiscarded ? (
                                    <input
                                      type="text"
                                      value={ps.milled}
                                      onChange={(e) => patchProdSub(r.key, ps.key, { milled: e.target.value })}
                                      className={input}
                                    />
                                  ) : ''}
                                </div>
                              ))}
                            </div>
                          </td>
                        )))}

                    {/* Discarded stack */}
                    <td className={td}>
                      <div className={stack}>
                        {prodPadded.map((ps, i) => (
                          <div
                            key={ps?.key ?? `px-${i}`}
                            className={`min-h-[32px] flex items-center ${splitProdUnitRows && i < prodPadded.length - 1
                                ? '-mx-2 px-2 border-b border-gray-300'
                                : ''
                              }`}
                          >
                            {ps && !lockMilledDiscarded ? (
                              <input
                                type="text"
                                value={ps.discarded}
                                onChange={(e) => patchProdSub(r.key, ps.key, { discarded: e.target.value })}
                                className={input}
                              />
                            ) : ''}
                          </div>
                        ))}
                      </div>
                    </td>

                    {/* Comment — автоклавын блокт (мөр 6-8) автоклав бүр өөрийн тайлбартай */}
                    <td className={td}>
                      {hasPerSubRowComments(r.no) ? (
                        <div className={stack}>
                          {prodPadded.map((ps, i) => (
                            <div
                              key={ps?.key ?? `pcm-${i}`}
                              className={`min-h-[32px] flex items-center ${i < prodPadded.length - 1
                                  ? '-mx-2 px-2 border-b border-gray-300'
                                  : ''
                                }`}
                            >
                              {ps ? (
                                <input
                                  type="text"
                                  value={ps.comment}
                                  onChange={(e) => patchProdSub(r.key, ps.key, { comment: e.target.value })}
                                  className={input}
                                  placeholder="..."
                                />
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={r.comment}
                          onChange={(e) => patchComment(r.key, e.target.value)}
                          className={input}
                          placeholder="..."
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-300">
          <table className="w-full border-collapse text-sm min-w-[1200px]">
            <thead>
              <tr>
                <th className={th} colSpan={2}></th>
                <th className={th} colSpan={2}>Сул зогсолтын бүртгэл:</th>
                <th className={th}>Нэмэлт ажилууд:</th>
                <th className={th} colSpan={4}>Ээлжийн ирц:</th>
              </tr>
              <tr>
                <th className={th}>дд</th>
                <th className={th}>Хэсэг</th>
                <th className={th}>Цаг</th>
                <th className={th}>Тайлбар</th>
                <th className={th}></th>
                <th className={th}>Ирц</th>
                <th className={th}>Ирэх</th>
                <th className={th}>Ирсэн</th>
                <th className={th}>Нэмэлт</th>
              </tr>
            </thead>
            <tbody>
              {Y099_STOP_SECTIONS.map((label, idx) => (
                <tr key={`stop-${idx + 1}`}>
                  <td className={`${td} text-center`}>{idx + 1}</td>
                  <td className={td}>{label}</td>
                  <td className={td}>
                    <input
                      type="text"
                      className={input}
                      value={form.stopRemarks[idx] || ''}
                      onChange={(e) => {
                        const next = [...form.stopRemarks];
                        next[idx] = e.target.value;
                        setForm((p) => ({ ...p, stopRemarks: next }));
                      }}
                    />
                  </td>
                  {idx === 0 && (
                    <td className={`${td} border-t-0 border-b-0 align-top`} rowSpan={Y099_STOP_SECTIONS.length}>
                      <textarea
                        className={`${input} h-[600px] resize-none`}
                        value={form.downtimeInfo}
                        onChange={(e) => setForm((p) => ({ ...p, downtimeInfo: e.target.value }))}
                        placeholder="Сул зогсолтын бүртгэл..."
                      />
                    </td>
                  )}
                  {idx === 0 && (
                    <td className={`${td} border-t-0 border-b-0 align-top`} rowSpan={Y099_STOP_SECTIONS.length}>
                      <textarea
                        className={`${input} h-[600px] resize-none`}
                        value={form.additionalWork}
                        onChange={(e) => setForm((p) => ({ ...p, additionalWork: e.target.value }))}
                        placeholder="Нэмэлт ажилууд..."
                      />
                    </td>
                  )}

                  {idx < 7 && (
                    idx === 0 ? (
                      <>
                        <td className={`${td} font-medium`}>Ирц</td>
                        <td className={td}>
                          <input
                            type="text"
                            className={`${input} h-12`}
                            value={form.attendance.present}
                            onChange={(e) => setForm((p) => ({ ...p, attendance: { ...p.attendance, present: e.target.value } }))}
                          />
                        </td>
                        <td className={td}>
                          <input
                            type="text"
                            className={`${input} h-12`}
                            value={form.attendance.coming}
                            onChange={(e) => setForm((p) => ({ ...p, attendance: { ...p.attendance, coming: e.target.value } }))}
                          />
                        </td>
                        <td className={td}>
                          <input
                            type="text"
                            className={`${input} h-12`}
                            value={form.attendance.arrived}
                            onChange={(e) => setForm((p) => ({ ...p, attendance: { ...p.attendance, arrived: e.target.value } }))}
                          />
                        </td>
                      </>
                    ) : idx === 1 ? (
                      <>
                        <td className={`${td} font-medium`}>Тасалсан:</td>
                        <td className={td} colSpan={3}>
                          <input
                            type="text"
                            className={`${input} h-12`}
                            value={form.attendance.absent}
                            onChange={(e) => setForm((p) => ({ ...p, attendance: { ...p.attendance, absent: e.target.value } }))}
                          />
                        </td>
                      </>
                    ) : idx === 2 ? (
                      <>
                        <td className={`${td} font-medium`}>Нэр:</td>
                        <td className={td} colSpan={3}>
                          <input
                            type="text"
                            className={`${input} h-32`}
                            value={form.attendance.absentNames}
                            onChange={(e) => setForm((p) => ({ ...p, attendance: { ...p.attendance, absentNames: e.target.value } }))}
                          />
                        </td>
                      </>
                    ) : idx === 3 ? (
                      <>
                        <td className={`${td} font-medium`}>Чөлөө:</td>
                        <td className={td} colSpan={3}>
                          <input
                            type="text"
                            className={`${input} h-14`}
                            value={form.attendance.onLeave}
                            onChange={(e) => setForm((p) => ({ ...p, attendance: { ...p.attendance, onLeave: e.target.value } }))}
                          />
                        </td>
                      </>
                    ) : idx === 4 ? (
                      <>
                        <td className={`${td} font-medium`}>Нэр:</td>
                        <td className={td} colSpan={3}>
                          <input
                            type="text"
                            className={`${input} h-32`}
                            value={form.attendance.onLeaveNames}
                            onChange={(e) => setForm((p) => ({ ...p, attendance: { ...p.attendance, onLeaveNames: e.target.value } }))}
                          />
                        </td>
                      </>
                    ) : idx === 5 ? (
                      <>
                        <td className={`${td} font-medium`}>Өвчтэй:</td>
                        <td className={td} colSpan={3}>
                          <input
                            type="text"
                            className={`${input} h-14`}
                            value={form.attendance.sick}
                            onChange={(e) => setForm((p) => ({ ...p, attendance: { ...p.attendance, sick: e.target.value } }))}
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={`${td} font-medium`}>Нэр:</td>
                        <td className={td} colSpan={3}>
                          <input
                            type="text"
                            className={`${input} h-32`}
                            value={form.attendance.sickNames}
                            onChange={(e) => setForm((p) => ({ ...p, attendance: { ...p.attendance, sickNames: e.target.value } }))}
                          />
                        </td>
                      </>
                    )
                  )}
                  {idx === 7 && (
                    <td className={td} colSpan={4} rowSpan={Y099_STOP_SECTIONS.length - 7}>
                      <div className="flex flex-col h-full">
                        <span className="text-[10px] font-bold text-gray-400 mb-1">Нэмэлт:</span>
                        <textarea
                          className={`${input} flex-1 resize-none`}
                          value={form.attendance.extra}
                          onChange={(e) => setForm((p) => ({ ...p, attendance: { ...p.attendance, extra: e.target.value } }))}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-300">
          <table className="w-full border-collapse text-sm min-w-[1200px]">
            <tbody>
              <tr>
                <td className={`${td} text-center font-bold w-12`}>1</td>
                <td className={`${td} font-medium w-64`}>ХАБЭА тухай мэдээлэл, санал</td>
                <td className={td}>
                  <textarea
                    value={form.hseInfo}
                    onChange={(e) => setForm((p) => ({ ...p, hseInfo: e.target.value }))}
                    className={`${input} h-16 resize-none`}
                    placeholder="..."
                  />
                </td>
              </tr>
              <tr>
                <td className={`${td} text-center font-bold`}>2</td>
                <td className={`${td} font-medium`}>Тоног төхөөрөмжийн мэдээлэл, санал</td>
                <td className={td}>
                  <textarea
                    value={form.equipmentInfo}
                    onChange={(e) => setForm((p) => ({ ...p, equipmentInfo: e.target.value }))}
                    className={`${input} h-16 resize-none`}
                    placeholder="..."
                  />
                </td>
              </tr>
              <tr>
                <td className={`${td} text-center font-bold`}>3</td>
                <td className={`${td} font-medium`}>Ажлын байрны эмх цэгц, цэвэрлэгээ</td>
                <td className={td}>
                  <textarea
                    value={form.workplaceInfo}
                    onChange={(e) => setForm((p) => ({ ...p, workplaceInfo: e.target.value }))}
                    className={`${input} h-16 resize-none`}
                    placeholder="..."
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700 text-center">
            Дараагийн ээлжинд анхаарах зүйлс, хийгдэх ажил:
          </label>
          <textarea
            value={form.nextShiftInfo}
            onChange={(e) => setForm((p) => ({ ...p, nextShiftInfo: e.target.value }))}
            className={`${input} h-32 resize-none`}
            placeholder="..."
          />
        </div>

        <div className="grid grid-cols-2 gap-8 pt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Ээлж хүлээлгэж өгсөн ээлжийн мастер:</span>
            <select
              value={form.handedOverByUid || findMasterIdByLabel(form.handedOverBy)}
              onChange={(e) => {
                const selected = mastersById.get(e.target.value);
                setForm((p) => ({
                  ...p,
                  handedOverBy: selected ? (selected.name || selected.email || '') : '',
                  handedOverByUid: selected ? String(selected.id) : '',
                }));
              }}
              className={`${input} border-b border-t-0 border-l-0 border-r-0 rounded-none focus:ring-0 bg-transparent`}
            >
              <option value="">Сонгох...</option>
                  {masters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.email}{masters.filter((other) => (other.name || other.email || '') === (m.name || m.email || '')).length > 1 ? ` — ${m.email || 'Имэйлгүй'}` : ''}
                </option>
              ))}
            </select>
          </div>
          {autoMasterName && form.receivedBy === autoMasterName && (
            <div className="flex items-start gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800 mb-1">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
              <span>Хуваарийн дагуу <strong>{autoMasterName}</strong> автоматаар тодорхойлогдлоо.</span>
            </div>
          )}
          {scheduleNotFound && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 mb-1">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
              <span>Дараагийн мастерын хуваарь олдсонгүй. Гараар сонгох эсвэл Admin баталгаажуулна.</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Ээлж хүлээн авах ээлжийн мастер:</span>
            <select
              value={form.receivedByUid || findMasterIdByLabel(form.receivedBy)}
              onChange={(e) => {
                const selected = mastersById.get(e.target.value);
                setForm((p) => ({
                  ...p,
                  receivedBy: selected ? (selected.name || selected.email || '') : '',
                  receivedByUid: selected ? String(selected.id) : '',
                }));
              }}
              className={`${input} border-b border-t-0 border-l-0 border-r-0 rounded-none focus:ring-0 bg-transparent`}
            >
              <option value="">Сонгох...</option>
                  {masters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.email}{masters.filter((other) => (other.name || other.email || '') === (m.name || m.email || '')).length > 1 ? ` — ${m.email || 'Имэйлгүй'}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <EnvironmentCheckSection
          rows={(form as any).environmentChecks}
          onChange={(rows) => setForm((prev: any) => ({ ...prev, environmentChecks: rows }))}
          disabled={submitting}
        />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 rounded-2xl bg-gray-100 text-gray-800 font-bold hover:bg-gray-200"
            disabled={submitting}
          >
            Болих
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-7 py-3 rounded-2xl bg-orange-600 text-white font-black hover:bg-orange-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {submitting ? 'Хадгалж байна...' : 'Хадгалах'}
          </button>
        </div>
      </div>
    </form>
  );
}
