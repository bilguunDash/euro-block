'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { appendAuditLog } from '@/lib/audit-log';
import { isoDateInTimeZone } from '@/lib/handover-window';
import { autoAcceptedMessage } from '@/lib/handover-auto-accept';
import { ChevronLeft, ChevronRight, Factory, Clock, AlertTriangle, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/ToastProvider';
import { MASTER_STATION_CODES } from '@/lib/master-stations';

const STATIONS = [
  { code: 'ҮЯ-099', name: 'Ээлжийн мастер' },
  { code: 'ҮЯ-110', name: 'Цемент шахах төхөөрөмжийн оператор' },
  { code: 'ҮЯ-120', name: 'Шохойн тээрмийн оператор' },
  { code: 'ҮЯ-121', name: 'Бөмбөлөгт тээрмийн оператор' },
  { code: 'ҮЯ-190', name: 'Чанар шалгагч' },
  { code: 'ҮЯ-140', name: 'Хэв эргэлтийн оператор' },
  { code: 'ҮЯ-130', name: 'Зуурах цамхагийн оператор' },
  { code: 'ҮЯ-150', name: 'Зүсэх дамжлагын оператор' },
  { code: 'ҮЯ-160', name: 'Рам эргэлтийн оператор' },
  { code: 'ҮЯ-161', name: 'Тэргэнцэр эргэлтийн оператор' },
  { code: 'ҮЯ-170', name: 'Савлах төхөөрөмжийн оператор' },
  { code: 'ҮЯ-210', name: 'Технологийн зуухны оператор' },
  { code: 'ҮЯ-180', name: 'Автоклавын оператор' },
  { code: 'ҮЯ-181', name: 'Дулааны мастер' },
  { code: 'ҮЯ-310', name: 'Засварын мастер' },
  { code: 'ҮЯ-320', name: 'Цахилгаан автоматжуулалтын засварын бүртгэл' },
  { code: 'ҮЯ-400', name: 'Үйлдвэрийн процесст тавих хяналтын хуудас' },
  { code: 'ҮЯ-410', name: 'Цахилгаан автоматжуулалтын мастер' },
  { code: 'ОНБ', name: 'Бүтээгдэхүүний орц найрлага өөрчилсөн бүртгэл' },
];

function stationSelectLabel(station: { code: string; name: string }) {
  if (station.code === 'ҮЯ-320') return `${station.code}: ${station.name}`;
  return `${station.code} - ${station.name}`;
}

export default function NewShiftPage() {
  const { profile, user, loading: authLoading, loggingIn, authError, login, clearError } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [stationCode, setStationCode] = useState('');
  const [shiftType, setShiftType] = useState<'Өдрийн' | 'Шөнийн'>('Өдрийн');
  const [prefillShiftDate, setPrefillShiftDate] = useState(() => isoDateInTimeZone());
  const [loading, setLoading] = useState(false);
  const [stationLocked, setStationLocked] = useState(false);
  const [shiftTypeLocked, setShiftTypeLocked] = useState(false);
  const [checkingActive, setCheckingActive] = useState(true);
  const [activeShiftHint, setActiveShiftHint] = useState<{
    id: string;
    stationCode?: string;
    shiftType?: string;
    shiftDate?: string;
  } | null>(null);
  const appliedSearchRef = useRef<string>('');

  const availableStations = (() => {
    const role = String(profile?.role || '');
    if (role === 'operator') {
      return STATIONS.filter((s) => !(MASTER_STATION_CODES as readonly string[]).includes(s.code));
    }
    if (role === 'master') {
      // Master хуваарь/оноолтгүй ч 3 master дамжлагад (ҮЯ-099/310/410) ээлж эхлүүлж болно.
      return STATIONS.filter((s) => (MASTER_STATION_CODES as readonly string[]).includes(s.code));
    }
    return STATIONS;
  })();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setCheckingActive(false);
      setActiveShiftHint(null);
      return;
    }
    setCheckingActive(true);
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user || !profile) return;

    // Apply query params whenever the search string changes.
    const search = typeof window !== 'undefined' ? window.location.search : '';
    if (search === appliedSearchRef.current) return;
    appliedSearchRef.current = search;

    const sp = new URLSearchParams(search);
    const auto = sp.get('auto');
    const qStation = (sp.get('stationCode') || '').trim();
    const qShiftType = sp.get('shiftType');
    const qShiftDate = sp.get('shiftDate');

    if (qShiftDate) setPrefillShiftDate(qShiftDate);
    if (qShiftType === 'Өдрийн' || qShiftType === 'Шөнийн') setShiftType(qShiftType);

    if (qStation) {
      setStationCode(qStation);
    } else {
      // No query station => default to profile station.
      setStationCode(profile.stationCode || '');
    }

    // Lock station selection only when coming from an assigned schedule slot.
    setStationLocked(auto === '1' && !!qStation);
    setShiftTypeLocked(auto === '1' && (qShiftType === 'Өдрийн' || qShiftType === 'Шөнийн'));
  }, [authLoading, user, profile]);

  // If role does not allow the selected station, reset it (unless locked by schedule).
  useEffect(() => {
    if (!profile) return;
    if (stationLocked) return;
    if (!stationCode) return;
    if (!availableStations.some((s) => s.code === stationCode)) setStationCode('');
  }, [profile, stationLocked, stationCode, availableStations]);

  useEffect(() => {
    if (authLoading || !user || !profile) return;

    const checkActive = async () => {
      try {
        const qs = new URLSearchParams({ queryType: 'active', operatorUid: profile.uid });
        const res = await fetch(`/api/shifts?${qs.toString()}`, { cache: 'no-store', credentials: 'include' });
        const data = await res.json();
        if (data?.ok && data.shift) {
          setActiveShiftHint({
            id: data.shift.id,
            stationCode: data.shift.stationCode,
            shiftType: data.shift.shiftType,
            shiftDate: data.shift.shiftDate,
          });
        } else setActiveShiftHint(null);
      } catch (error) {
        console.error('Error checking active shift:', error);
        setActiveShiftHint(null);
      } finally {
        setCheckingActive(false);
      }
    };
    checkActive();
  }, [authLoading, user, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!stationCode) {
      toast.warning('Дамжлага сонгоно уу.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          operatorUid: profile.uid,
          operatorName: profile.displayName || profile.email,
          stationCode,
          shiftType,
          shiftDate: prefillShiftDate,
          status: 'Хадгалсан',
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        // Энэ ээлж аль хэдийн эхэлсэн — шинэ (давхар) бүртгэл үүсгэхгүй, өмнөхийг нь нээнэ.
        if (res.status === 409 && data?.existingShiftId) {
          toast.warning(data.error || 'Энэ ээлж аль хэдийн эхэлсэн байна.');
          router.push(`/shift/${data.existingShiftId}`);
          return;
        }
        toast.error(data?.error || 'API Error');
        return;
      }
      const shiftId = data.id as string;
      await appendAuditLog({
        actorUid: profile.uid,
        actorName: profile.displayName,
        action: 'shift_started',
        entityType: 'shift',
        entityId: shiftId,
        details: `Started shift at ${stationCode} (${shiftType})`
      });

      // Ээлжээ эхлүүлснээр түүнд хүлээлгэн өгсөн өмнөх ээлжүүд хүлээн авсанд тооцогдоно — мэдэгдэнэ.
      const autoAccepted = autoAcceptedMessage(data.autoAcceptedHandovers);
      if (autoAccepted) toast.show({ message: autoAccepted, title: 'Ээлж хүлээн авлаа', variant: 'info', durationMs: 9000 });

      router.push(`/shift/${shiftId}`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Ээлж эхлүүлэхэд алдаа гарлаа.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-8 bg-orange-600 text-white">
            <h1 className="text-2xl font-bold">Евроблок Ээлжийн Бүртгэл</h1>
            <p className="text-orange-100 mt-2">Системд нэвтэрч ээлжээ эхлүүлнэ үү.</p>
          </div>
          <div className="p-8 space-y-4">
            {authError && (
              <div className="p-4 rounded-xl bg-red-50 text-red-800 text-sm">
                <p className="font-bold mb-1">Нэвтрэхэд алдаа</p>
                <p>{authError}</p>
                <button type="button" onClick={clearError} className="mt-2 text-xs font-bold underline">
                  Хаах
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => login()}
              disabled={loggingIn}
              className="w-full py-4 px-4 rounded-2xl border-2 border-gray-200 font-bold text-gray-800 hover:border-orange-200 hover:bg-orange-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loggingIn ? (
                <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <LogIn className="w-5 h-5 text-orange-600" />
              )}
              Нэвтрэх
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (checkingActive) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Буцах</span>
          </Link>
        </div>

        {activeShiftHint && (
          <div className="mb-6 p-5 rounded-2xl border border-blue-200 bg-blue-50 text-blue-950">
            <p className="font-bold text-blue-900 mb-1">Идэвхтэй ээлж байна</p>
            <p className="text-sm text-blue-800/90 mb-1">
              {activeShiftHint.stationCode ? `${activeShiftHint.stationCode}` : 'Ээлж'}
              {activeShiftHint.shiftDate ? ` · ${activeShiftHint.shiftDate}` : ''}
              {activeShiftHint.shiftType ? ` · ${activeShiftHint.shiftType}` : ''}
            </p>
            <p className="text-xs text-blue-700/80 mb-4">
              Хуудас эхлээд энд үлдэнэ. Ээлж үргэлжлүүлэх бол доорх товчийг дарна уу. Шинэ ээлж нээхээс өмнө одоогийн ээлжээ журмаар дуусгана уу.
            </p>
            <Link
              href={`/shift/${activeShiftHint.id}`}
              className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors text-sm"
            >
              Ээлж руу орох / үргэлжлүүлэх
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-8 bg-orange-600 text-white">
            <h1 className="text-2xl font-bold">Шинэ ээлж эхлүүлэх</h1>
            <p className="text-orange-100 mt-2">Өнөөдрийн ээлжийн бүртгэлээ эхлүүлнэ үү.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Дамжлага</label>
              <div className="relative">
                <Factory className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  value={stationCode}
                  onChange={(e) => setStationCode(e.target.value)}
                  disabled={stationLocked}
                  className="w-full pl-12 pr-10 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all appearance-none font-bold text-gray-900 disabled:opacity-90 disabled:cursor-not-allowed"
                  required
                >
                  <option value="">Сонгох...</option>
                  {availableStations.map((s) => (
                    <option key={s.code} value={s.code}>{stationSelectLabel(s)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ээлжийн төрөл</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => !shiftTypeLocked && setShiftType('Өдрийн')}
                  disabled={shiftTypeLocked}
                  className={`py-4 rounded-2xl border-2 font-bold transition-all flex items-center justify-center gap-2 ${
                    shiftType === 'Өдрийн' 
                      ? 'border-orange-600 bg-orange-50 text-orange-600' 
                      : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                  }`}
                >
                  <Clock className="w-5 h-5" />
                  Өдрийн
                </button>
                <button
                  type="button"
                  onClick={() => !shiftTypeLocked && setShiftType('Шөнийн')}
                  disabled={shiftTypeLocked}
                  className={`py-4 rounded-2xl border-2 font-bold transition-all flex items-center justify-center gap-2 ${
                    shiftType === 'Шөнийн' 
                      ? 'border-orange-600 bg-orange-50 text-orange-600' 
                      : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                  }`}
                >
                  <Clock className="w-5 h-5" />
                  Шөнийн
                </button>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-orange-600 text-white rounded-2xl font-bold shadow-lg shadow-orange-100 hover:bg-orange-700 transition-all disabled:opacity-50"
              >
                {loading ? 'Эхлүүлж байна...' : 'Ээлж эхлүүлэх'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 p-6 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
          <div className="text-sm text-amber-900">
            <p className="font-bold mb-1">Анхааруулга</p>
            <p>Ээлж эхлүүлснээр таны ирц болон ажлын цаг бүртгэгдэж эхэлнэ. Бүртгэлээ үнэн зөв хөтөлнө үү.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
