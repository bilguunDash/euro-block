import React, { useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';

type ImportResponse = {
  ok: boolean;
  mode: string;
  month: string;
  report: {
    matched: Array<{
      name: string;
      makId: string;
      position: string;
      stationCode: string;
      kind: 'operator' | 'master';
      dayShiftCount: number;
      nightShiftCount: number;
    }>;
    unmatchedNames: Array<{ name: string; makId: string; position: string; team: string }>;
    ambiguousNames: Array<{ name: string; makId: string; candidateCount: number }>;
    unmappedPositions: Array<{ position: string; people: string[] }>;
    wrongRole: Array<{ name: string; position: string; expectedRole: string; actualRole: string }>;
    conflicts: string[];
    warnings: string[];
  };
  toCreate: { operator: number; master: number };
  duplicates: { operator: number; master: number };
  created?: { operator: number; master: number };
};

type ScheduleExcelImportProps = {
  defaultMonth: string;
  onCommitted: (month: string) => void;
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function ScheduleExcelImport({ defaultMonth, onCommitted }: ScheduleExcelImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [month, setMonth] = useState('');
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [committed, setCommitted] = useState<ImportResponse | null>(null);
  const [error, setError] = useState('');

  const runRequest = async (f: File, m: string, mode: 'preview' | 'commit') => {
    setPending(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('month', m);
      fd.append('mode', mode);
      const r = await fetch('/api/schedules/import', { method: 'POST', body: fd, credentials: 'include' });
      const j = (await r.json().catch(() => null)) as ImportResponse | { error?: string } | null;
      if (!r.ok || !(j as any)?.ok) {
        throw new Error((j as any)?.error || 'Импорт амжилтгүй боллоо.');
      }
      if (mode === 'preview') {
        setResult(j as ImportResponse);
        setCommitted(null);
      } else {
        setCommitted(j as ImportResponse);
        onCommitted(m);
      }
    } catch (e: any) {
      setError(e?.message || 'Импорт амжилтгүй боллоо.');
      if (mode === 'preview') setResult(null);
    } finally {
      setPending(false);
    }
  };

  const handleFileChosen = (f: File) => {
    const m = month || defaultMonth || currentMonth();
    setFile(f);
    setMonth(m);
    setResult(null);
    setCommitted(null);
    setOpen(true);
    void runRequest(f, m, 'preview');
  };

  const handleMonthChange = (m: string) => {
    setMonth(m);
    setCommitted(null);
    if (file && /^\d{4}-\d{2}$/.test(m)) void runRequest(file, m, 'preview');
  };

  const close = () => {
    setOpen(false);
    setFile(null);
    setResult(null);
    setCommitted(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const totalToCreate = result ? result.toCreate.operator + result.toCreate.master : 0;
  const totalDuplicates = result ? result.duplicates.operator + result.duplicates.master : 0;
  const skippedPeople = result
    ? result.report.unmatchedNames.length +
      result.report.ambiguousNames.length +
      result.report.wrongRole.length +
      result.report.unmappedPositions.reduce((n, x) => n + x.people.length, 0)
    : 0;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileChosen(f);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 text-sm font-bold hover:bg-orange-100 transition-colors"
      >
        <FileSpreadsheet size={14} />
        Excel-ээс импортлох
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-3xl shadow-xl p-6 space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-gray-900">Excel-ээс хуваарь импортлох</h4>
                <p className="text-sm text-gray-500 break-all">{file?.name}</p>
              </div>
              <button type="button" onClick={close} className="text-gray-500 hover:text-gray-800 p-1" aria-label="Хаах">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Импортлох сар</label>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  disabled={pending}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </div>
              {pending && (
                <div className="flex items-center gap-2 text-sm text-gray-500 pb-2">
                  <Loader2 size={15} className="animate-spin" />
                  Шалгаж байна...
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
            )}

            {committed && (
              <div className="rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 font-semibold">
                Импорт амжилттай: оператор {committed.created?.operator || 0}, мастер {committed.created?.master || 0} хуваарь үүслээ.
              </div>
            )}

            {result && (
              <>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-bold">
                    Таарсан: {result.report.matched.length} хүн
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 text-xs font-bold">
                    Үүсгэх: {totalToCreate} мөр (оператор {result.toCreate.operator}, мастер {result.toCreate.master})
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
                    Давхардсан: {totalDuplicates}
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold">
                    Алгассан: {skippedPeople} хүн
                  </span>
                </div>

                {result.report.matched.length > 0 && (
                  <div className="rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr className="text-left text-xs text-gray-500 uppercase">
                            <th className="px-4 py-2.5 font-bold">Нэр</th>
                            <th className="px-4 py-2.5 font-bold">MAK ID</th>
                            <th className="px-4 py-2.5 font-bold">Дамжлага</th>
                            <th className="px-4 py-2.5 font-bold text-right">Өдрийн</th>
                            <th className="px-4 py-2.5 font-bold text-right">Шөнийн</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.report.matched.map((m, i) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="px-4 py-2 font-semibold text-gray-800">{m.name}</td>
                              <td className="px-4 py-2 text-gray-500">{m.makId}</td>
                              <td className="px-4 py-2 text-gray-600">
                                {m.stationCode}
                                {m.kind === 'master' && (
                                  <span className="ml-1.5 text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                                    МАСТЕР
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-right">{m.dayShiftCount}</td>
                              <td className="px-4 py-2 text-right">{m.nightShiftCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {result.report.unmatchedNames.length > 0 && (
                  <details className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3">
                    <summary className="text-sm font-bold text-amber-800 cursor-pointer select-none">
                      Нэр таараагүй ({result.report.unmatchedNames.length}) — системд бүртгэлгүй
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm text-amber-900">
                      {result.report.unmatchedNames.map((u, i) => (
                        <li key={i}>
                          {u.name} ({u.makId}) — {u.position}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {result.report.unmappedPositions.length > 0 && (
                  <details className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <summary className="text-sm font-bold text-gray-600 cursor-pointer select-none">
                      Дамжлагагүй албан тушаал ({result.report.unmappedPositions.reduce((n, x) => n + x.people.length, 0)} хүн)
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm text-gray-600">
                      {result.report.unmappedPositions.map((u, i) => (
                        <li key={i}>
                          <span className="font-semibold">{u.position}:</span> {u.people.join(', ')}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {result.report.ambiguousNames.length > 0 && (
                  <details className="rounded-xl border border-red-200 bg-red-50/50 px-4 py-3">
                    <summary className="text-sm font-bold text-red-700 cursor-pointer select-none">
                      Давхар таарсан нэр ({result.report.ambiguousNames.length})
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm text-red-800">
                      {result.report.ambiguousNames.map((u, i) => (
                        <li key={i}>
                          {u.name} ({u.makId}) — {u.candidateCount} хэрэглэгч таарсан тул алгаслаа
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {result.report.wrongRole.length > 0 && (
                  <details className="rounded-xl border border-red-200 bg-red-50/50 px-4 py-3">
                    <summary className="text-sm font-bold text-red-700 cursor-pointer select-none">
                      Эрх зөрсөн ({result.report.wrongRole.length})
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm text-red-800">
                      {result.report.wrongRole.map((u, i) => (
                        <li key={i}>
                          {u.name} — {u.position}: "{u.expectedRole}" эрх шаардлагатай, одоо "{u.actualRole}"
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {(result.report.conflicts.length > 0 || result.report.warnings.length > 0) && (
                  <details className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <summary className="text-sm font-bold text-gray-600 cursor-pointer select-none">
                      Анхааруулга ({result.report.conflicts.length + result.report.warnings.length})
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm text-gray-600">
                      {[...result.report.conflicts, ...result.report.warnings].map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={close}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
              >
                {committed ? 'Хаах' : 'Болих'}
              </button>
              {!committed && (
                <button
                  type="button"
                  disabled={pending || !result || totalToCreate === 0}
                  onClick={() => file && void runRequest(file, month, 'commit')}
                  className="flex-1 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {pending ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  Батлах ({totalToCreate} мөр)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
