'use client';

import React, { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Megaphone, Plus, Trash2, Edit2, CheckCircle2, Clock, Info, AlertTriangle, ShieldAlert, Eye, User } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { HorizontalPagedList } from './HorizontalPagedList';
import { parseUlaanbaatarLocal, toUlaanbaatarLocalInput } from '@/lib/ulaanbaatar-time';

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store', credentials: 'include' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error || 'Fetch error');
  return json;
};

function formatDate(value: any) {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}`;
}

function roleName(role: string) {
  const map: Record<string, string> = {
    operator: 'Оператор',
    master: 'Мастер',
    hse_engineer: 'ХАБ',
    chief_engineer: 'Ерөнхий инженер',
    auditor: 'Аудитор',
    admin: 'Админ',
    dispatcher: 'Диспетчер',
  };
  return map[String(role || '')] || role || 'Хэрэглэгч';
}

function typeLabel(value: string) {
  const map: Record<string, string> = {
    info: 'Мэдээлэл',
    warning: 'Анхааруулга',
    danger: 'Яаралтай',
  };
  return map[String(value || '')] || 'Мэдээлэл';
}

function typeTone(value: string) {
  if (value === 'danger') {
    return {
      icon: 'bg-red-50 text-red-600',
      badge: 'border-red-200 bg-red-50 text-red-700',
    };
  }
  if (value === 'warning') {
    return {
      icon: 'bg-amber-50 text-amber-600',
      badge: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }
  return {
    icon: 'bg-blue-50 text-blue-600',
    badge: 'border-blue-200 bg-blue-50 text-blue-700',
  };
}

function cleanAudience(values: string[]) {
  return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
}

const ANNOUNCEMENT_TARGET_ROLES = [
  { id: 'operator', name: 'Оператор' },
  { id: 'master', name: 'Мастер' },
  { id: 'admin', name: 'Админ' },
  { id: 'dispatcher', name: 'Диспетчер' },
  { id: 'hse_engineer', name: 'ХАБ' },
] as const;

function expiresAtMs(announcement: any) {
  if (!announcement?.expiresAt) return null;
  const ms = new Date(announcement.expiresAt).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isVisibleAnnouncement(announcement: any, now = Date.now()) {
  if (!announcement?.isActive) return false;
  const expiry = expiresAtMs(announcement);
  return expiry == null || expiry > now;
}

export function AnnouncementCenter({
  profile,
  mode = 'user',
  confirmAction,
  stations = [],
}: {
  profile: any;
  mode?: 'user' | 'admin';
  confirmAction?: (opts: { title: string; message: string; confirmText?: string; danger?: boolean }) => Promise<boolean>;
  stations?: any[];
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showReadersId, setShowReadersId] = useState<string | null>(null);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('info');
  const [isActive, setIsActive] = useState(true);
  const [expiresAt, setExpiresAt] = useState('');

  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [targetStations, setTargetStations] = useState<string[]>([]);

  const canManage = profile?.role === 'admin' || profile?.role === 'master' || profile?.role === 'dispatcher';
  const showManage = mode === 'admin' && canManage;

  const { data, mutate } = useSWR('/api/announcements?includeInactive=1', fetcher, { refreshInterval: 15000 });
  const announcements = data?.announcements || [];

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setType('info');
    setIsActive(true);
    setExpiresAt('');
    setTargetRoles([]);
    setTargetStations([]);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.warning('Гарчиг болон агуулга оруулна уу.');
      return;
    }
    if (!expiresAt) {
      toast.warning('Дуусах огноо, цагийг заавал оруулна уу.');
      return;
    }
    // Талбар нь Улаанбаатарын ханын цаг өгдөг. `new Date(...)`-аар шууд задлавал
    // хөтчийн бүсээр тайлагдана — серверт ЯГ ямар агшин болохыг эргэлзээгүй
    // хэлэхийн тулд UTC болгож ISO хэлбэрээр илгээнэ.
    const expiresAtDate = parseUlaanbaatarLocal(expiresAt);
    if (!expiresAtDate) {
      toast.warning('Дуусах огноо, цаг буруу байна.');
      return;
    }
    if (expiresAtDate.getTime() <= Date.now()) {
      // Хугацаа дууссан зарлалыг сервер автоматаар устгадаг тул өнгөрсөн
      // хугацаатай хадгалбал зарлал шууд алга болно.
      toast.warning('Дуусах хугацаа ирээдүйн цаг байх ёстой.');
      return;
    }

    setSaving(true);
    try {
      const body = {
        id: editingId,
        title: title.trim(),
        content: content.trim(),
        type,
        isActive,
        expiresAt: expiresAtDate.toISOString(),
        targetRoles: cleanAudience(targetRoles),
        targetStations: cleanAudience(targetStations),
      };

      const res = await fetch('/api/announcements', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || 'Хадгалахад алдаа гарлаа');

      toast.success(
        editingId
          ? 'Зарлал шинэчлэгдлээ.'
          : `Зарлал нэмэгдлээ. Мэдэгдэл ${Number(json.notificationRecipients || 0)} хэрэглэгчид илгээгдлээ.`
      );
      resetForm();
      mutate();
    } catch (e: any) {
      toast.error(e?.message || 'Алдаа гарлаа.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (ann: any) => {
    setEditingId(ann.id);
    setTitle(ann.title);
    setContent(ann.content);
    setType(ann.type);
    setIsActive(ann.isActive);
    // `toISOString()` нь UTC өгдөг тул `datetime-local` талбарт 8 цагаар ухарч
    // ордог байв — засаад хадгалах бүрт дуусах хугацаа урагшилж, эцэстээ
    // үүсгэсэн цагаасаа ч өмнө болж байсан.
    setExpiresAt(toUlaanbaatarLocalInput(ann.expiresAt));
    setTargetRoles(Array.isArray(ann.targetRoles) ? ann.targetRoles : []);
    setTargetStations(Array.isArray(ann.targetStations) ? ann.targetStations : []);
  };

  const handleDelete = async (ann: any) => {
    if (!confirmAction) return;
    const ok = await confirmAction({
      title: 'Устгах уу?',
      message: `"${ann.title}" зарлалыг устгах уу?`,
      confirmText: 'Устгах',
      danger: true,
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/announcements?id=${ann.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Устгахад алдаа гарлаа');
      toast.success('Зарлал устгагдлаа.');
      mutate();
    } catch (e: any) {
      toast.error(e?.message || 'Алдаа гарлаа.');
    }
  };

  return (
    <section className="space-y-8">
      <div>
        <h3 className="text-2xl font-bold text-gray-900">{showManage ? 'Зарлалын удирдлага' : 'Шинэ зарлалууд'}</h3>
        <p className="text-gray-600">Нийт ажилчид болон мастеруудад түгээсэн чухал мэдээллийг эндээс харна.</p>
      </div>

      {showManage && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900">{editingId ? 'Зарлал засах' : 'Шинэ зарлал оруулах'}</h4>
              <p className="text-xs text-gray-500">Мэдээллийн төрөл болон харагдах хугацааг тохируулж болно.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Гарчиг</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none transition-all focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20"
                placeholder="Зарлалын гарчиг..."
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Төрөл</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition-all focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="info">Энгийн (Мэдээлэл)</option>
                  <option value="warning">Анхааруулга (Шар)</option>
                  <option value="danger">Яаралтай (Улаан)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Дуусах огноо, цаг</label>
                <div className="relative">
                  <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm font-semibold outline-none transition-all focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Агуулга</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full min-h-[120px] rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium outline-none transition-all focus:border-orange-300 focus:ring-2 focus:ring-orange-500/20"
              placeholder="Зарлалын дэлгэрэнгүй агуулга..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Хэнд харагдах (Үүрэг)</label>
              <select
                value={targetRoles[0] || ''}
                onChange={(e) => setTargetRoles(e.target.value ? [e.target.value] : [])}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-bold"
              >
                <option value="">Бүх хэрэглэгчид</option>
                {ANNOUNCEMENT_TARGET_ROLES.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-gray-400 italic">* Сонгохгүй бол бүх хэрэглэгчдэд харагдана.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Хэнд харагдах (Дамжлага)</label>
              <select
                value={targetStations[0] || ''}
                onChange={(e) => setTargetStations(e.target.value ? [e.target.value] : [])}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-bold"
              >
                <option value="">Бүх дамжлага</option>
                {stations.filter((s: any) => s.code).map((s: any) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm font-bold text-gray-700">Идэвхтэй</span>
            </label>
            <div className="flex gap-3">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200"
                >
                  Цуцлах
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 disabled:opacity-50"
              >
                {saving ? 'Хадгалж байна...' : editingId ? 'Шинэчлэх' : 'Нийтлэх'}
              </button>
            </div>
          </div>
        </div>
      )}

      <HorizontalPagedList
        items={announcements}
        renderPage={(page) => (
      <div className="grid grid-cols-1 gap-4">
        {page.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-gray-400">
              <Megaphone className="h-7 w-7" />
            </div>
            <p className="mt-4 font-black text-gray-700">Зарлал одоогоор байхгүй байна</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
              Шинэ зарлал нийтлэгдсэн үед энэ хэсэгт харагдана.
            </p>
          </div>
        ) : (
          page.map((ann: any) => (
            <div
              key={ann.id}
              className={`bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md ${
                !ann.isActive ? 'opacity-60 grayscale' : ''
              }`}
            >
              <div className="p-6 md:p-8 flex items-start gap-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${typeTone(ann.type).icon}`}>
                  {ann.type === 'danger' ? <ShieldAlert className="w-6 h-6" /> :
                   ann.type === 'warning' ? <AlertTriangle className="w-6 h-6" /> :
                   <Info className="w-6 h-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${typeTone(ann.type).badge}`}>
                          {typeLabel(ann.type)}
                        </span>
                        {!ann.isActive && <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-black uppercase text-gray-600">Идэвхгүй</span>}
                      </div>
                      <h5 className="break-words text-xl font-bold text-gray-900">{ann.title}</h5>
                    </div>
                    {showManage && (
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button
                          onClick={() => setShowReadersId(ann.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
                          title="Уншсан хүмүүс"
                        >
                          <Eye className="w-4 h-4" />
                          Харах
                        </button>
                        <button
                          onClick={() => handleEdit(ann)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                        >
                          <Edit2 className="w-4 h-4" />
                          Засах
                        </button>
                        <button
                          onClick={() => handleDelete(ann)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                        >
                          <Trash2 className="w-4 h-4" />
                          Устгах
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 grid gap-2 rounded-2xl border border-gray-100 bg-gray-50/70 p-4 text-xs text-gray-600 md:grid-cols-3">
                    <div>
                      <p className="font-black uppercase tracking-wider text-gray-400">Нийтэлсэн</p>
                      <p className="mt-1 font-bold text-gray-800">{ann.authorName || 'Систем'}</p>
                    </div>
                    <div>
                      <p className="font-black uppercase tracking-wider text-gray-400">Огноо</p>
                      <p className="mt-1 flex items-center gap-1 font-bold text-gray-800">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        {formatDate(ann.createdAt)}
                      </p>
                    </div>
                    {ann.expiresAt && (
                      <div>
                        <p className="font-black uppercase tracking-wider text-gray-400">Дуусах</p>
                        <p className="mt-1 font-bold text-red-600">{formatDate(ann.expiresAt)}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {(ann.targetRoles?.length > 0 || ann.targetStations?.length > 0) ? (
                      <>
                        {ann.targetRoles?.map((r: string) => (
                          <span key={r} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-[10px] font-bold border border-blue-100 uppercase">
                            {roleName(r)}
                          </span>
                        ))}
                        {ann.targetStations?.map((s: string) => (
                          <span key={s} className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-md text-[10px] font-bold border border-purple-100 uppercase">
                            {s}
                          </span>
                        ))}
                      </>
                    ) : (
                      <span className="text-[10px] text-gray-400 italic">Бүх хэрэглэгчдэд харагдана</span>
                    )}
                  </div>
                  <div className="mt-4 text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {ann.content}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
        )}
      />

      {showReadersId && (
        <ReadersModal
          announcementId={showReadersId}
          onClose={() => setShowReadersId(null)}
        />
      )}
    </section>
  );
}

function ReadersModal({ announcementId, onClose }: { announcementId: string; onClose: () => void }) {
  const { data, isLoading } = useSWR(`/api/announcements/read?announcementId=${announcementId}`, fetcher);
  const reads = data?.reads || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            Танилцсан ажилтнууд
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        <div className="p-6 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="w-6 h-6 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : reads.length === 0 ? (
            <div className="text-center p-8 text-gray-400 italic">Одоогоор танилцсан ажилтан байхгүй байна.</div>
          ) : (
            <div className="space-y-4">
              {reads.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="font-bold text-gray-800">{r.userName}</div>
                  <div className="text-[10px] text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(r.readAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-6 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-white border border-gray-200 font-bold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Хаах
          </button>
        </div>
      </div>
    </div>
  );
}

export function AnnouncementWidget() {
  const { data, mutate } = useSWR('/api/announcements', fetcher, { refreshInterval: 30000 });
  const announcements = (Array.isArray(data?.announcements) ? data.announcements : []).filter((ann: any) => isVisibleAnnouncement(ann));
  const active = announcements[0]; // Just show the latest for now
  const [detailAnnouncementId, setDetailAnnouncementId] = useState<string | null>(null);
  const showDetail = Boolean(active?.id && detailAnnouncementId === active.id);

  useEffect(() => {
    const expiries = announcements
      .map(expiresAtMs)
      .filter((value: number | null): value is number => typeof value === 'number' && value > Date.now());
    if (expiries.length === 0) return;
    const delay = Math.max(0, Math.min(...expiries) - Date.now() + 250);
    const timer = window.setTimeout(() => {
      setDetailAnnouncementId(null);
      mutate();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [announcements, mutate]);

  const handleViewDetail = () => {
    setDetailAnnouncementId(active.id);
  };

  if (!active) return null;

  return (
    <div className="bg-gradient-to-r from-orange-600 to-amber-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
        <Megaphone className="w-32 h-32 rotate-12" />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest opacity-80 mb-2">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          Зарлал
        </div>
        <h4 className="text-xl font-black mb-2 leading-tight">{active.title}</h4>
        <p className="text-sm opacity-90 line-clamp-2 mb-4 leading-relaxed">{active.content}</p>
        <button 
          onClick={handleViewDetail}
          className="bg-white/20 hover:bg-white/30 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-bold transition-all border border-white/10"
        >
          Дэлгэрэнгүй харах
        </button>
      </div>

      {showDetail && (
        <AnnouncementDetailModal
          announcement={active}
          onClose={() => setDetailAnnouncementId(null)}
          onAcknowledged={() => {
            setDetailAnnouncementId(null);
            mutate();
          }}
        />
      )}
    </div>
  );
}

function AnnouncementDetailModal({
  announcement,
  onClose,
  onAcknowledged,
}: {
  announcement: any;
  onClose: () => void;
  onAcknowledged: () => void;
}) {
  const toast = useToast();
  const [acknowledging, setAcknowledging] = useState(false);
  const roleName = {
    'admin': 'Админ',
    'master': 'Мастер',
    'operator': 'Оператор',
    'hse_engineer': 'ХАБ Инженер',
    'chief_engineer': 'Ерөнхий Инженер',
    'auditor': 'Аудитор',
    'dispatcher': 'Диспетчер'
  }[announcement.authorRole as string] || announcement.authorRole || 'Систем';

  const handleAcknowledge = async () => {
    if (!announcement?.id || acknowledging) return;
    setAcknowledging(true);
    try {
      const res = await fetch('/api/announcements/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ announcementId: announcement.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || 'Танилцсан төлөв хадгалахад алдаа гарлаа.');
      toast.success('Зарлалтай танилцсан төлөв бүртгэгдлээ.');
      onAcknowledged();
    } catch (e: any) {
      toast.error(e?.message || 'Танилцсан төлөв хадгалахад алдаа гарлаа.');
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className={`p-8 pb-6 bg-gradient-to-br ${
          announcement.type === 'danger' ? 'from-red-50 to-white' :
          announcement.type === 'warning' ? 'from-amber-50 to-white' :
          'from-blue-50 to-white'
        } relative`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2.5 rounded-2xl ${
              announcement.type === 'danger' ? 'bg-red-100 text-red-600' :
              announcement.type === 'warning' ? 'bg-amber-100 text-amber-600' :
              'bg-blue-100 text-blue-600'
            }`}>
              <Megaphone className="w-6 h-6" />
            </div>
            <span className={`text-xs font-black uppercase tracking-widest ${
              announcement.type === 'danger' ? 'text-red-600' :
              announcement.type === 'warning' ? 'text-amber-600' :
              'text-blue-600'
            }`}>
              Зарлалын дэлгэрэнгүй
            </span>
          </div>
          <h3 className="text-2xl font-black text-gray-900 leading-tight mb-2">{announcement.title}</h3>
          
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-gray-400 mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                <User className="w-4 h-4" />
              </div>
              <div>
                <div className="text-gray-900">{announcement.authorName}</div>
                <div className="text-[10px] uppercase tracking-wider">{roleName}</div>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {formatDate(announcement.createdAt)}
            </div>
          </div>
        </div>

        <div className="p-8 pt-4">
          <div className="text-gray-700 whitespace-pre-wrap leading-relaxed text-lg italic">
            {announcement.content}
          </div>
          
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.4fr]">
            <button
              type="button"
              onClick={onClose}
              className="py-4 rounded-2xl bg-gray-100 text-gray-700 font-black text-sm hover:bg-gray-200 transition-all"
            >
              Хаах
            </button>
            <button
              type="button"
              onClick={handleAcknowledge}
              disabled={acknowledging}
              className="py-4 rounded-2xl bg-gray-900 text-white font-black text-sm hover:bg-gray-800 transition-all shadow-lg hover:shadow-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {acknowledging ? 'Бүртгэж байна...' : 'Танилцсан'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
