'use client';

import { Leaf, Plus, Trash2 } from 'lucide-react';
import {
  ENVIRONMENT_CHECK_ANSWERS,
  ENVIRONMENT_CHECK_TITLE,
  emptyEnvironmentCheckRow,
  environmentCheckHint,
  isStandardEnvironmentCheck,
  mergeEnvironmentChecks,
  type EnvironmentCheckAnswer,
  type EnvironmentCheckRow,
} from '@/lib/environment-check-form';

/**
 * Байгаль орчны хяналт — БҮХ станцын маягт (мастер, оператор) болон зөвхөн-харах
 * хувилбарт НЭГ ижил компонентоор орно. Хоёр газарт давхардуулбал асуулт, шошго
 * салж эхэлнэ.
 *
 * Стандарт 3 мөрийг УСТГАХГҮЙ (текстийг нь засаж болно) — тэдгээр нь Excel
 * тайлангийн тогтмол багана болдог. Нэмэлт мөр нь устгагдана.
 */
export function EnvironmentCheckSection({
  rows: incoming,
  onChange,
  disabled = false,
  readOnly = false,
  className = '',
}: {
  /** Маягтын хадгалсан утга. Хуучин бүртгэлд байхгүй / дутуу байж болно. */
  rows: unknown;
  onChange?: (rows: EnvironmentCheckRow[]) => void;
  disabled?: boolean;
  readOnly?: boolean;
  /** Байрлалын нэмэлт класс (ж: тухайн маягтад захын зай өөр хэрэгтэй бол). */
  className?: string;
}) {
  const editable = !readOnly && typeof onChange === 'function';
  // Энэ хэсгийг нэвтрүүлэхээс өмнөх бүртгэлд `environmentChecks` огт байхгүй, эсвэл
  // дутуу байж болно. Дуудагч тал бүрд давтахын оронд энд нэг л удаа нөхнө.
  const rows = mergeEnvironmentChecks(incoming);

  const patch = (key: string, field: keyof Omit<EnvironmentCheckRow, 'key'>, value: string) =>
    onChange?.(rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)));

  const addRow = () => onChange?.([...rows, emptyEnvironmentCheckRow()]);
  const removeRow = (key: string) => onChange?.(rows.filter((row) => row.key !== key));

  const cell = 'px-2 py-2 border border-gray-200 align-top';

  // Дээрх хэсгээс ЗААВАЛ тусгаарлагдсан байхын тулд гадна хүрээнд `pt-*` өгнө.
  // `mt-*` тохирохгүй: эцэг бүр өөр `space-y-*`-тай (ҮЯ-099 нь `space-y-6`,
  // бусад нь `space-y-8`) бөгөөд тэр дүрэм CSS-ийн давуу эрхээр `mt`-г дардаг.
  // `padding` нь `space-y`-д огт хамаарахгүй тул хаана ч ажиллана.
  return (
    <div className={`pt-6 ${className}`.trim()}>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <p className="font-bold text-sm text-gray-800 flex items-center gap-2">
            <Leaf className="w-4 h-4 text-green-600" />
            {ENVIRONMENT_CHECK_TITLE}
          </p>
          {editable && (
            <button
              type="button"
              onClick={addRow}
              disabled={disabled}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Мөр нэмэх
            </button>
          )}
        </div>

        <div className="overflow-x-auto p-2 md:p-4">
          <table className="w-full text-left text-xs border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-yellow-100 text-gray-800">
                <th className="px-2 py-2 font-bold border border-gray-200 w-10 text-center">№</th>
                <th className="px-2 py-2 font-bold border border-gray-200">Асуулт</th>
                <th className="px-2 py-2 font-bold border border-gray-200 w-32 text-center">Хариулт</th>
                <th className="px-2 py-2 font-bold border border-gray-200 w-72">Тайлбар</th>
                {editable && <th className="px-2 py-2 font-bold border border-gray-200 w-14 text-center">—</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const hint = environmentCheckHint(row.key);
                const standard = isStandardEnvironmentCheck(row.key);
                return (
                  <tr key={row.key} className="align-top hover:bg-green-50/20">
                    <td className={`${cell} text-center text-gray-500 font-medium`}>{index + 1}</td>

                    <td className={cell}>
                      {editable ? (
                        <textarea
                          value={row.label}
                          onChange={(e) => patch(row.key, 'label', e.target.value)}
                          disabled={disabled}
                          rows={2}
                          placeholder="Асуултаа бичнэ үү"
                          className="w-full px-2 py-1.5 rounded-md border border-gray-200 text-xs font-bold resize-y"
                        />
                      ) : (
                        <p className="font-bold text-gray-900 whitespace-pre-wrap">{row.label || '—'}</p>
                      )}
                      {hint && <p className="mt-1 text-[11px] italic text-gray-500">{hint}</p>}
                    </td>

                    <td className={cell}>
                      {editable ? (
                        <select
                          value={row.answer}
                          onChange={(e) => patch(row.key, 'answer', e.target.value as EnvironmentCheckAnswer)}
                          disabled={disabled}
                          className="w-full px-2 py-1.5 rounded-md border border-gray-200 text-xs"
                        >
                          {ENVIRONMENT_CHECK_ANSWERS.map((answer) => (
                            <option key={answer || 'blank'} value={answer}>
                              {answer || '—'}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-center font-bold text-gray-900">{row.answer || '—'}</p>
                      )}
                    </td>

                    <td className={cell}>
                      {editable ? (
                        <textarea
                          value={row.comment}
                          onChange={(e) => patch(row.key, 'comment', e.target.value)}
                          disabled={disabled}
                          rows={2}
                          className="w-full px-2 py-1.5 rounded-md border border-gray-200 text-xs resize-y"
                        />
                      ) : (
                        <p className="text-gray-700 whitespace-pre-wrap">{row.comment || '—'}</p>
                      )}
                    </td>

                    {editable && (
                      <td className={`${cell} text-center`}>
                        <button
                          type="button"
                          onClick={() => removeRow(row.key)}
                          disabled={disabled || standard}
                          title={standard ? 'Стандарт асуултыг устгах боломжгүй' : 'Мөр хасах'}
                          className="inline-flex p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {editable && (
          <p className="px-4 pb-4 text-[11px] text-gray-400">
            Бүх талбар заавал биш — хоосон орхиж болно. Нэмсэн мөрийг бөглөөгүй бол хадгалахад автоматаар хасагдана.
          </p>
        )}
      </div>
    </div>
  );
}
