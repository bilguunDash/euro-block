'use client';

import React from 'react';
import { ClipboardList } from 'lucide-react';
import { hasPerSubRowComments } from '@/lib/y099-shift-master-handover';
import type {
  Y099LeftSubRow,
  Y099ProdSubRow,
  Y099ShiftMasterHandoverPayload,
} from '@/lib/y099-shift-master-handover';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';
import { resolveReceivingName } from '@/lib/shift-signature';

const td = 'border border-gray-300 px-2 py-1 text-sm align-middle';
const th = 'border border-gray-300 px-2 py-1 text-xs font-bold text-center bg-gray-50';
const stack = 'flex flex-col gap-1';
const stopSections = [
  'Цемент шахах насос',
  'Шохойн тээрэм',
  'Бөмбөлөгт тээрэм',
  'Цамхаг',
  'Хэвний эргэлт',
  'Зүсэх шугам',
  'Рам эргэх',
  'Тэргэнцэр эргэлт',
  'Савлах',
  'Чанар шалгах',
  'Автоклав',
  'Технологийн зуух',
  'Агуулах, суллалт',
  'Тог тасралт',
  'Түүхий эд',
];

export function Y099ShiftMasterHandoverReadOnly({
  data,
  receivingMasterName,
}: {
  data: Y099ShiftMasterHandoverPayload;
  receivingMasterName?: string | null;
}) {
  return (
    <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-orange-50/40">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-orange-600" />
          ҮЯ-099: Ээлжийн мастерын ээлж хүлээлцэх бүртгэл (хадгалсан)
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Огноо: {data.shiftDate} · Ээлж: {data.shiftType} · Мастер: {data.masterName || '—'}
          {data.submittedAt ? ` · Илгээсэн: ${new Date(data.submittedAt).toLocaleString('mn-MN')}` : ''}
        </p>
      </div>

      {/* Table */}
      <div className="p-6 space-y-6">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[1100px]">
            <thead>
              <tr>
                <th className={th} rowSpan={2}>д/д</th>
                <th className={`${th} text-center`} colSpan={3}>Түүхий эдийн бэлтгэл</th>
                <th className={`${th} text-center`} colSpan={6}>Бүтээгдэхүүн үйлдвэрлэл</th>
                <th className={th} rowSpan={2}>Тайлбар</th>
              </tr>
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
              {data.rows.map((r) => {
                const span = Math.max(r.leftSubRows.length, r.prodSubRows.length);
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
                  <tr key={r.key} className="align-top">
                    <td className={`${td} text-center font-bold text-gray-600`}>{r.no}</td>
                    <td className={`${td} font-medium text-gray-900`}>{r.leftLabel}</td>

                    <td className={`${td} text-gray-600 whitespace-nowrap`}>
                      <div className={stack}>
                        {leftPadded.map((ls, i) => (
                          <div key={ls?.key ?? `u-${i}`} className="min-h-[32px] flex items-center">
                            {ls?.unit ?? ''}
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className={`${td} font-bold text-gray-900`}>
                      <div className={stack}>
                        {leftPadded.map((ls, i) => (
                          <div key={ls?.key ?? `v-${i}`} className="min-h-[32px] flex items-center">
                            {ls?.value || '—'}
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

                    <td className={`${td} text-gray-600 whitespace-nowrap`}>
                      <div className={stack}>
                        {prodPadded.map((ps, i) => (
                          <div
                            key={ps?.key ?? `pu-${i}`}
                            className={`min-h-[32px] flex items-center ${
                              splitProdUnitRows && i < prodPadded.length - 1
                                ? '-mx-2 px-2 border-b border-gray-300'
                                : ''
                            }`}
                          >
                            {ps?.unit ?? ''}
                          </div>
                        ))}
                      </div>
                    </td>

                    {!isDirtyMergedHidden &&
                      (isDirtyMergedStart ? (
                        <td className={`${td} text-center font-medium text-gray-700`} rowSpan={3}>
                          Залгасан цаг
                        </td>
                      ) : (
                        <td className={`${td} font-bold text-gray-900`}>
                          <div className={stack}>
                            {prodPadded.map((ps, i) => (
                              <div key={ps?.key ?? `pd-${i}`} className="min-h-[32px] flex items-center">
                                {ps?.dirty || '—'}
                              </div>
                            ))}
                          </div>
                        </td>
                      ))}
                    {isCleanMilledMergedRow ? (
                      <td className={`${td} text-center font-medium text-gray-700`} colSpan={2}>
                        {cleanMilledMergedText}
                      </td>
                    ) : (
                      <td className={`${td} font-bold text-gray-900`}>
                        <div className={stack}>
                          {prodPadded.map((ps, i) => (
                            <div
                              key={ps?.key ?? `pc-${i}`}
                              className={`min-h-[32px] flex items-center ${
                                splitProdUnitRows && i < prodPadded.length - 1
                                  ? '-mx-2 px-2 border-b border-gray-300'
                                  : ''
                              }`}
                            >
                              {ps?.clean || '—'}
                            </div>
                          ))}
                        </div>
                      </td>
                    )}
                    {!isCleanMilledMergedRow &&
                      (!isMilledMergedHidden &&
                        (isMilledMergedStart ? (
                          <td className={`${td} text-center font-medium text-gray-700`} rowSpan={3}>
                            Бүтээгдэхүүний хэмжээ
                          </td>
                        ) : (
                        <td className={`${td} font-bold text-gray-900`}>
                          <div className={stack}>
                            {prodPadded.map((ps, i) => (
                              <div key={ps?.key ?? `pm-${i}`} className="min-h-[32px] flex items-center">
                                {ps?.milled || '—'}
                              </div>
                            ))}
                          </div>
                        </td>
                        )))}
                    <td className={`${td} font-bold text-gray-900`}>
                      <div className={stack}>
                        {prodPadded.map((ps, i) => (
                          <div
                            key={ps?.key ?? `px-${i}`}
                            className={`min-h-[32px] flex items-center ${
                              splitProdUnitRows && i < prodPadded.length - 1
                                ? '-mx-2 px-2 border-b border-gray-300'
                                : ''
                            }`}
                          >
                            {ps?.discarded || '—'}
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className={`${td} text-gray-700`}>
                      {hasPerSubRowComments(r.no) ? (
                        <div className={stack}>
                          {prodPadded.map((ps, i) => (
                            <div
                              key={ps?.key ?? `pcm-${i}`}
                              className={`min-h-[32px] flex items-center ${
                                i < prodPadded.length - 1
                                  ? '-mx-2 px-2 border-b border-gray-300'
                                  : ''
                              }`}
                            >
                              {ps?.comment || '—'}
                            </div>
                          ))}
                        </div>
                      ) : (
                        r.comment || '—'
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
            </thead>
            <tbody>
              {stopSections.map((label, idx) => (
                <tr key={`stop-ro-${idx + 1}`}>
                  <td className={`${td} text-center`}>{idx + 1}</td>
                  <td className={td}>{label}</td>
                  <td className={td}>{data.stopRemarks?.[idx] || ''}</td>
                  {idx === 0 && (
                    <td className={`${td} border-t-0 border-b-0 whitespace-pre-wrap`} rowSpan={stopSections.length}>
                      {data.downtimeInfo}
                    </td>
                  )}
                  {idx === 0 && (
                    <td className={`${td} border-t-0 border-b-0 whitespace-pre-wrap`} rowSpan={stopSections.length}>
                      {data.additionalWork}
                    </td>
                  )}

                  {idx < 7 && (
                    idx === 0 ? (
                      <>
                        <td className={`${td} font-medium`}>Ирц</td>
                        <td className={td}>{data.attendance?.present}</td>
                        <td className={td}>{data.attendance?.coming}</td>
                        <td className={td}>{data.attendance?.arrived}</td>
                      </>
                    ) : idx === 1 ? (
                      <>
                        <td className={`${td} font-medium`}>Тасалсан:</td>
                        <td className={td} colSpan={3}>{data.attendance?.absent}</td>
                      </>
                    ) : idx === 2 ? (
                      <>
                        <td className={`${td} font-medium`}>Нэр:</td>
                        <td className={`${td} h-32 align-top whitespace-pre-wrap`} colSpan={3}>
                          {data.attendance?.absentNames}
                        </td>
                      </>
                    ) : idx === 3 ? (
                      <>
                        <td className={`${td} font-medium`}>Чөлөө:</td>
                        <td className={td} colSpan={3}>{data.attendance?.onLeave}</td>
                      </>
                    ) : idx === 4 ? (
                      <>
                        <td className={`${td} font-medium`}>Нэр:</td>
                        <td className={`${td} h-32 align-top whitespace-pre-wrap`} colSpan={3}>
                          {data.attendance?.onLeaveNames}
                        </td>
                      </>
                    ) : idx === 5 ? (
                      <>
                        <td className={`${td} font-medium`}>Өвчтэй:</td>
                        <td className={td} colSpan={3}>{data.attendance?.sick}</td>
                      </>
                    ) : (
                      <>
                        <td className={`${td} font-medium`}>Нэр:</td>
                        <td className={`${td} h-32 align-top whitespace-pre-wrap`} colSpan={3}>
                          {data.attendance?.sickNames}
                        </td>
                      </>
                    )
                  )}
                  {idx === 7 && (
                    <td className={`${td} align-top whitespace-pre-wrap`} colSpan={4} rowSpan={stopSections.length - 7}>
                      <div className="flex flex-col h-full">
                        <span className="text-[10px] font-bold text-gray-400 mb-1">Нэмэлт:</span>
                        {data.attendance?.extra}
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
                <td className={`${td} min-h-[4rem] text-gray-700 whitespace-pre-wrap`}>
                  {data.hseInfo || '—'}
                </td>
              </tr>
              <tr>
                <td className={`${td} text-center font-bold`}>2</td>
                <td className={`${td} font-medium`}>Тоног төхөөрөмжийн мэдээлэл, санал</td>
                <td className={`${td} min-h-[4rem] text-gray-700 whitespace-pre-wrap`}>
                  {data.equipmentInfo || '—'}
                </td>
              </tr>
              <tr>
                <td className={`${td} text-center font-bold`}>3</td>
                <td className={`${td} font-medium`}>Ажлын байрны эмх цэгц, цэвэрлэгээ</td>
                <td className={`${td} min-h-[4rem] text-gray-700 whitespace-pre-wrap`}>
                  {data.workplaceInfo || '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700 text-center">
            Дараагийн ээлжинд анхаарах зүйлс, хийгдэх ажил:
          </label>
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 min-h-[8rem] text-gray-700 whitespace-pre-wrap">
            {data.nextShiftInfo || '—'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 pt-4">
          <div className="flex flex-col gap-1 border-t border-gray-300 pt-2">
            <span className="text-xs text-gray-500">Ээлж хүлээлгэж өгсөн ээлжийн мастер:</span>
            <span className="text-sm font-bold text-gray-900">{data.handedOverBy || '—'}</span>
          </div>
          <div className="flex flex-col gap-1 border-t border-gray-300 pt-2">
            <span className="text-xs text-gray-500">Ээлж хүлээн авсан ээлжийн мастер:</span>
            <span className="text-sm font-bold text-gray-900">{resolveReceivingName(data.receivedBy, receivingMasterName) || '—'}</span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 md:px-6 md:pb-6">
        <EnvironmentCheckSection rows={(data as any)?.environmentChecks} readOnly />
      </div>
    </section>
  );
}
