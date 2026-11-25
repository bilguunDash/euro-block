'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { BookOpen, CheckCircle2, FileText, FileUp, Info, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { hseDocOpenUrl } from '@/lib/hse-doc-open-url';
import { useToast } from '@/components/ui/ToastProvider';
import { HorizontalPagedList } from './HorizontalPagedList';

const DOCUMENT_PAGE_SIZE = 12;
const ACKNOWLEDGEMENT_PAGE_SIZE = 20;

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store', credentials: 'include' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error || 'Fetch error');
  return json;
};

function roleLabel(role: string) {
  const map: Record<string, string> = {
    operator: 'Оператор',
    master: 'Мастер',
    all: 'Бүгд',
  };
  return map[String(role || '')] || role || 'Оператор';
}

function stationLabel(code: string | null | undefined, stations: any[]) {
  if (!code) return 'Бүх дамжлага';
  const found = stations.find((s) => s.code === code);
  return found ? `${found.code} - ${found.name}` : code;
}

function formatDate(value: any) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleString('mn-MN', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function InstructionCenter({
  profile,
  stations,
  mode = 'user',
  confirmAction,
}: {
  profile: any;
  stations: any[];
  mode?: 'user' | 'admin';
  confirmAction?: (opts: { title: string; message: string; confirmText?: string; danger?: boolean }) => Promise<boolean>;
}) {
  const toast = useToast();
  const documentsRef = useRef<HTMLDivElement>(null);
  const acknowledgementsRef = useRef<HTMLDivElement>(null);
  const [openedIds, setOpenedIds] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stationCode, setStationCode] = useState('');
  const [stationQuery, setStationQuery] = useState('');
  const [roleTarget, setRoleTarget] = useState<'operator' | 'master' | 'all'>('operator');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [documentPage, setDocumentPage] = useState(1);
  const [ackFilter, setAckFilter] = useState<'missing' | 'acknowledged'>('missing');
  const [missingPage, setMissingPage] = useState(1);
  const [acknowledgedPage, setAcknowledgedPage] = useState(1);

  const canManageDocuments = profile?.role === 'admin' || profile?.role === 'hse_engineer';
  const showManage = mode === 'admin' && canManageDocuments;
  const showOverview = mode === 'admin' || profile?.role === 'master' || profile?.role === 'dispatcher';

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const docsUrl = useMemo(() => {
    if (!showManage) return '/api/instructions';
    const params = new URLSearchParams({
      includeInactive: '1',
      page: String(documentPage),
      pageSize: String(DOCUMENT_PAGE_SIZE),
    });
    if (debouncedQuery) params.set('q', debouncedQuery);
    return `/api/instructions?${params.toString()}`;
  }, [showManage, documentPage, debouncedQuery]);
  const { data: docsData, error: docsError, isLoading: docsLoading, mutate: mutateDocs } = useSWR(docsUrl, fetcher, { refreshInterval: 10000 });
  const overviewUrl = showOverview
    ? `/api/instructions/overview?missingPage=${missingPage}&acknowledgedPage=${acknowledgedPage}&pageSize=${ACKNOWLEDGEMENT_PAGE_SIZE}`
    : null;
  const { data: overviewData, error: overviewError, isLoading: overviewLoading, mutate: mutateOverview } = useSWR(
    overviewUrl,
    fetcher,
    { refreshInterval: 12000 }
  );

  const allDocuments = useMemo(() => docsData?.documents || [], [docsData?.documents]);

  const documents = useMemo(() => {
    if (showManage) return allDocuments;
    const q = query.trim().toLowerCase();
    return q ? allDocuments.filter((doc: any) => String(doc.title || '').toLowerCase().includes(q)) : allDocuments;
  }, [allDocuments, query, showManage]);

  useEffect(() => {
    if (showManage && docsData?.page && docsData.page !== documentPage) {
      setDocumentPage(docsData.page);
    }
  }, [showManage, docsData?.page, documentPage]);

  useEffect(() => {
    if (!showOverview) return;
    if (overviewData?.missingPage && overviewData.missingPage !== missingPage) {
      setMissingPage(overviewData.missingPage);
    }
    if (overviewData?.acknowledgedPage && overviewData.acknowledgedPage !== acknowledgedPage) {
      setAcknowledgedPage(overviewData.acknowledgedPage);
    }
  }, [showOverview, overviewData?.missingPage, overviewData?.acknowledgedPage, missingPage, acknowledgedPage]);

  const filteredStations = useMemo(() => {
    const q = stationQuery.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter((station) =>
      [station.code, station.name].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [stations, stationQuery]);

  const missingRows = overviewData?.missing || [];
  const acknowledgedRows = overviewData?.acknowledged || [];
  const missingTotal = overviewData?.missingTotal ?? missingRows.length;
  const acknowledgedTotal = overviewData?.acknowledgedTotal ?? acknowledgedRows.length;
  const summaries = overviewData?.summaries || [];
  
  const displayRows = ackFilter === 'missing' ? missingRows : acknowledgedRows;

  const openInstruction = async (doc: any) => {
    const popup = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    try {
      const res = await fetch(`/api/instructions/${doc.id}/open`, { method: 'POST', credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || 'Файл нээхэд алдаа гарлаа');
      const targetUrl = hseDocOpenUrl(json.url || doc.fileUrl || doc.url);
      if (popup) popup.location.href = targetUrl;
      else window.open(targetUrl, '_blank', 'noopener,noreferrer');
      setOpenedIds((prev) => ({ ...prev, [doc.id]: true }));
    } catch (e: any) {
      if (popup) popup.close();
      toast.error(e?.message || 'Файл нээхэд алдаа гарлаа.');
    }
  };

  const acknowledgeInstruction = async (doc: any) => {
    try {
      const res = await fetch(`/api/instructions/${doc.id}/acknowledge`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || 'Баталгаажуулахад алдаа гарлаа');
      toast.success('Танилцсан баталгаажуулалт хадгалагдлаа.');
      await mutateDocs();
      await mutateOverview();
    } catch (e: any) {
      toast.error(e?.message || 'Баталгаажуулахад алдаа гарлаа.');
    }
  };

  const uploadFile = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) {
      throw new Error([json.error, json.hint].filter(Boolean).join('\n\n') || 'Upload failed');
    }
    return json;
  };

  const createInstruction = async (file: File) => {
    if (!title.trim()) {
      toast.warning('Гарчиг оруулна уу.');
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadFile(file);
      const res = await fetch('/api/instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          fileUrl: uploaded.url,
          fileName: file.name,
          stationCode,
          roleTarget,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || 'Хадгалахад алдаа гарлаа');
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      toast.success('Зааварчилгаа нэмэгдлээ.');
      if (showManage && documentPage !== 1) setDocumentPage(1);
      else await mutateDocs();
      await mutateOverview();
    } catch (e: any) {
      toast.error(e?.message || 'Зааварчилгаа нэмэхэд алдаа гарлаа.');
    } finally {
      setUploading(false);
    }
  };

  const deleteInstruction = async (doc: any) => {
    try {
      if (!doc?.id) {
        toast.error('Устгах файлын ID олдсонгүй.');
        return;
      }

      let ok = true;

      if (confirmAction) {
        ok = await confirmAction({
          title: 'Устгах уу?',
          message: `"${doc.title}" зааварчилгааг устгах уу?`,
          confirmText: 'Устгах',
          danger: true,
        });
      } else {
        ok = window.confirm(`"${doc.title}" зааварчилгааг устгах уу?`);
      }

      if (!ok) return;

      const res = await fetch(`/api/instructions?id=${encodeURIComponent(doc.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.ok === false) {
        throw new Error(json.error || 'Устгахад алдаа гарлаа');
      }

      toast.success('Зааварчилгаа устгагдлаа.');

      await mutateDocs?.();
      await mutateOverview?.();
    } catch (e: any) {
      console.error('deleteInstruction error:', e);
      toast.error(e?.message || 'Устгахад алдаа гарлаа.');
    }
  };

  const acknowledgedCount = docsData?.userAcknowledgedTotal
    ?? documents.filter((doc: any) => doc.acknowledged).length;

  return (
    <section className="space-y-8">
      <div>
        <h3 className="text-2xl font-bold text-gray-900">Зааварчилгаа баталгаажуулалт</h3>
        <div className="mt-3 inline-flex max-w-3xl items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>Файл нээж танилцаад “Танилцсан” товчоор огноотой нь баталгаажуулна.</p>
        </div>
      </div>

      {showManage && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900">Файл оруулах</h4>
              <p className="text-xs text-gray-500">PDF болон бусад зааварчилгааны файлыг operator/master-д онооно.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20"
              placeholder="Гарчиг"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[0.8fr_1.2fr]">
              <input
                value={stationQuery}
                onChange={(e) => setStationQuery(e.target.value)}
                className="px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20"
                placeholder="Дамжлага хайх..."
              />
              <select
                value={stationCode}
                onChange={(e) => setStationCode(e.target.value)}
                className="min-w-0 px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20"
                title={stationLabel(stationCode, stations)}
              >
                <option value="">Бүх дамжлага</option>
                {filteredStations.map((station) => (
                  <option key={station.code} value={station.code}>
                    {station.code} - {station.name}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={roleTarget}
              onChange={(e) => setRoleTarget(e.target.value as any)}
              className="px-4 py-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20"
            >
              <option value="operator">Оператор</option>
              <option value="master">Мастер</option>
              <option value="all">Бүгд</option>
            </select>
            <label className={`flex min-h-24 cursor-pointer items-center gap-4 rounded-2xl border border-dashed px-4 py-4 transition-colors ${selectedFile ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-gray-50 hover:border-orange-200 hover:bg-orange-50/60'}`}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-orange-600 shadow-sm">
                <FileUp className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-gray-900">
                  {selectedFile ? selectedFile.name : 'Файл сонгох'}
                </span>
                <span className="mt-1 block text-xs font-medium text-gray-500">
                  {selectedFile ? `${Math.max(1, Math.round(selectedFile.size / 1024))} KB` : 'PDF эсвэл зааварчилгааны файл сонгоно'}
                </span>
              </span>
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSelectedFile(file);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 min-h-24"
            placeholder="Тайлбар"
          />
          <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
            {selectedFile && (
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
                disabled={uploading}
              >
                Файл цэвэрлэх
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!selectedFile) {
                  toast.warning('Файл сонгоно уу.');
                  return;
                }
                createInstruction(selectedFile);
              }}
              disabled={uploading || !selectedFile}
              className="inline-flex items-center justify-center rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-black text-white shadow-sm transition-colors hover:bg-orange-700 disabled:bg-gray-200 disabled:text-gray-500"
            >
              {uploading ? 'Байршуулж байна...' : 'Нийтлэх'}
            </button>
          </div>
        </div>
      )}

      {showOverview && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 text-center">
            <p className="text-xs font-bold uppercase text-gray-500">Идэвхтэй файл</p>
            <p className="mt-3 text-4xl font-black text-gray-900">{summaries.length}</p>
          </div>
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 text-center">
            <p className="text-xs font-bold uppercase text-gray-500">Танилцаагүй</p>
            <p className="mt-3 text-4xl font-black text-red-600">{missingTotal}</p>
          </div>
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 text-center">
            <p className="text-xs font-bold uppercase text-gray-500">Миний баталгаажуулалт</p>
            <p className="mt-3 text-4xl font-black text-emerald-600">{acknowledgedCount}</p>
          </div>
        </div>
      )}

      <div ref={documentsRef} className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-6">
        <div className="space-y-5">
          <div>
            <h4 className="font-bold text-gray-900">Зааварчилгааны файлууд</h4>
            <p className="text-xs text-gray-500">Нээх товч дарсны дараа “Танилцсан” баталгаажуулалт идэвхжинэ.</p>
          </div>
          <div className="relative mb-2 max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setDocumentPage(1);
              }}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm font-bold text-gray-800 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-50"
              placeholder="Гарчгаар хайх..."
            />
          </div>
        </div>

        {docsError ? (
          <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
            {docsError.message || 'Зааварчилгааны файлуудыг ачаалж чадсангүй.'}
          </p>
        ) : docsLoading || (showManage && query.trim() !== debouncedQuery) ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">Файлуудыг ачаалж байна...</p>
        ) : documents.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-6 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-400 shadow-sm">
              <FileText className="h-7 w-7" />
            </div>
            <p className="mt-4 font-black text-gray-700">
              {query.trim() ? 'Хайлтын илэрц олдсонгүй' : 'Зааварчилгааны файл байхгүй байна'}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
              {query.trim()
                ? 'Хайлтын үгээ өөрчилж дахин шалгана уу.'
                : 'Одоогоор танд оноосон заавар, ХАБ баримт бүртгэгдээгүй байна.'}
            </p>
          </div>
        ) : (
          <HorizontalPagedList
            key={showManage ? 'admin-documents' : query}
            items={documents}
            pageSize={DOCUMENT_PAGE_SIZE}
            pagination={showManage ? {
              page: docsData?.page ?? documentPage,
              total: docsData?.total ?? documents.length,
              onPageChange: (page: number) => {
                setDocumentPage(page);
                documentsRef.current?.scrollIntoView({ block: 'start' });
              },
            } : undefined}
            renderPage={(pageDocuments) => (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {pageDocuments.map((doc: any) => {
              const opened = Boolean(openedIds[doc.id]);
              const canAck = doc.isActive && !doc.acknowledged && (opened || doc.acknowledged);
              return (
                <div key={doc.id} className={`rounded-2xl border p-5 ${doc.isActive ? 'border-gray-200' : 'border-gray-100 bg-gray-50 opacity-70'}`}>
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="font-bold text-gray-900 break-words">{doc.title}</h5>
                      <p className="mt-1 text-xs text-gray-500">
                        {stationLabel(doc.stationCode, stations)} · {roleLabel(doc.roleTarget)}
                      </p>
                      {doc.description ? <p className="mt-3 text-sm text-gray-600">{doc.description}</p> : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {showManage ? (
                          (() => {
                            const summary = summaries.find((s: any) => s.id === doc.id);
                            const ackCount = summary?.acknowledged ?? doc.ackCount ?? 0;
                            const total = summary?.totalTargets;
                            
                            return (
                              <span className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${ackCount > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                <CheckCircle2 className="w-4 h-4" />
                                {total !== undefined ? `${ackCount} / ${total} танилцсан` : `${ackCount} хүн танилцсан`}
                              </span>
                            );
                          })()
                        ) : doc.acknowledged ? (
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                            <CheckCircle2 className="w-4 h-4" />
                            Танилцсан: {formatDate(doc.acknowledgedAt)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                            <ShieldAlert className="w-4 h-4" />
                            Танилцаагүй
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openInstruction(doc)}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-800 font-bold hover:bg-gray-50"
                    >
                      Файл нээх
                    </button>
                    {!doc.acknowledged && (profile?.role === 'operator' || profile?.role === 'master') && (
                      <button
                        type="button"
                        onClick={() => acknowledgeInstruction(doc)}
                        disabled={!canAck}
                        className="px-4 py-2.5 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 disabled:bg-gray-200 disabled:text-gray-500"
                      >
                        Танилцсан
                      </button>
                    )}
                    {showManage && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteInstruction(doc);
                        }}
                        className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-red-600 font-bold hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Устгах
                      </button>
                    )}
                  </div>
                </div>
              );
                })}
              </div>
            )}
          />
        )}
      </div>

      {showOverview && (
        <div ref={acknowledgementsRef} className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-gray-900">Танилцалтын бүртгэл</h4>
              <p className="text-xs text-gray-500 mt-1">Хэн ямар файлтай танилцсан эсвэл танилцаагүйг эндээс харна.</p>
            </div>
            <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setAckFilter('missing')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${ackFilter === 'missing' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Танилцаагүй ({missingTotal})
              </button>
              <button
                onClick={() => setAckFilter('acknowledged')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${ackFilter === 'acknowledged' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Танилцсан ({acknowledgedTotal})
              </button>
            </div>
          </div>
          {overviewError ? (
            <p role="alert" className="px-6 py-8 text-sm text-red-700">{overviewError.message || 'Танилцалтын бүртгэлийг ачаалж чадсангүй.'}</p>
          ) : overviewLoading ? (
            <p className="px-6 py-8 text-sm text-gray-500">Танилцалтын бүртгэлийг ачаалж байна...</p>
          ) : (
          <HorizontalPagedList
            key={ackFilter}
            items={displayRows}
            pageSize={ACKNOWLEDGEMENT_PAGE_SIZE}
            pagination={{
              page: ackFilter === 'missing' ? (overviewData?.missingPage ?? missingPage) : (overviewData?.acknowledgedPage ?? acknowledgedPage),
              total: ackFilter === 'missing' ? missingTotal : acknowledgedTotal,
              onPageChange: (page: number) => {
                if (ackFilter === 'missing') setMissingPage(page);
                else setAcknowledgedPage(page);
                acknowledgementsRef.current?.scrollIntoView({ block: 'start' });
              },
            }}
            renderPage={(pageRows) => (
              <div className="overflow-x-auto max-h-[520px]">
                <table className="w-full text-left min-w-[860px]">
              <thead className="sticky top-0 bg-white z-10 shadow-sm">
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-bold">Файл</th>
                  <th className="px-6 py-4 font-bold">Хэрэглэгч</th>
                  <th className="px-6 py-4 font-bold">Үүрэг</th>
                  <th className="px-6 py-4 font-bold">Дамжлага</th>
                  {ackFilter === 'acknowledged' && <th className="px-6 py-4 font-bold">Огноо</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={ackFilter === 'acknowledged' ? 5 : 4} className="px-6 py-10 text-center text-gray-400">
                      {ackFilter === 'missing' ? 'Танилцаагүй хэрэглэгч байхгүй.' : 'Танилцсан хэрэглэгч байхгүй.'}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row: any) => (
                    <tr key={`${row.documentId}-${row.operatorUid}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{row.documentTitle}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{row.operatorName}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{roleLabel(row.operatorRole)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{stationLabel(row.operatorStationCode, stations)}</td>
                      {ackFilter === 'acknowledged' && (
                        <td className="px-6 py-4 text-sm text-emerald-600 font-medium">
                          {formatDate(row.acknowledgedAt)}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
                </table>
              </div>
            )}
          />
          )}
        </div>
      )}
    </section>
  );
}
