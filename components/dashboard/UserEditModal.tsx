'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, Shield, Factory, RotateCcw, Smartphone, Tablet, Users, Layers } from 'lucide-react';
import { appendAuditLog } from '@/lib/audit-log';
import { useToast } from '@/components/ui/ToastProvider';
import { SHIFT_GROUP_OPTIONS, shiftGroupLabel } from '@/lib/shift-crew';
import { isMasterStationCode } from '@/lib/master-stations';
import { ROLE_OPTIONS, isAllowedRole, normalizeRole as normalizeRoleValue } from '@/lib/roles';

interface UserEditModalProps {
  user: any;
  stations: any[];
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
  adminProfile: any;
}

export function UserEditModal({ user, stations, onClose, onSaved, adminProfile }: UserEditModalProps) {
  const toast = useToast();
  const normalizeRole = (r: unknown): string => normalizeRoleValue(r);

  const [name, setName] = useState<string>(String(user.name || '').trim());
  const [role, setRole] = useState<string>(normalizeRole(user.role));
  const [stationCode, setStationCode] = useState(user.stationCode || '');
  const [shiftGroup, setShiftGroup] = useState<string>(String(user.shiftGroup || ''));
  const [isApproved, setIsApproved] = useState(user.isApproved || false);
  const [tabletAccessAllowed, setTabletAccessAllowed] = useState(user.tabletAccessAllowed ?? true);
  const [mobileAccessAllowed, setMobileAccessAllowed] = useState(Boolean(user.mobileAccessAllowed));
  const [sortDualRole, setSortDualRole] = useState(Boolean(user.sortDualRole));
  const [resetDevices, setResetDevices] = useState(false);
  const [loading, setLoading] = useState(false);

  // Mount дээр л нэг удаа шалгана (анхны `user.role`), `<select onChange>` бүрт биш —
  // засах цонх нээгдэх мөчид танигдахгүй role-той хэрэглэгчийг илрүүлнэ.
  useEffect(() => {
    const initialRole = normalizeRole(user.role);
    if (!isAllowedRole(initialRole)) {
      console.warn(`UserEditModal: "${user.role}" эрх танигдахгүй байна (user.id=${user.id}).`);
      toast.warning(
        `Энэ хэрэглэгчийн эрх ("${user.role}") жагсаалтад бүртгэлгүй байна. Хадгалахын өмнө «Системийн үүрэг» талбарыг сонгож шинэчлэх шаардлагатай.`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Дамжлагын сонголтыг үүргээр нь шүүнэ — мастер зөвхөн мастерын дамжлага
   * (ҮЯ-099/181/310/400/410), оператор зөвхөн операторын дамжлага сонгоно.
   * Мастерын станц нь хариуцах мастерыг тодорхойлох үндэс тул холилдож болохгүй.
   */
  const stationOptions = useMemo(() => {
    const list = Array.isArray(stations) ? stations : [];
    if (role === 'master') return list.filter((s: any) => isMasterStationCode(s?.code));
    if (role === 'operator') return list.filter((s: any) => !isMasterStationCode(s?.code));
    return list;
  }, [stations, role]);

  // Үүрэг солиход одоогийн дамжлага тохирохгүй болвол цэвэрлэнэ (хуучин утга үлдэхээс сэргийлнэ).
  useEffect(() => {
    if (!stationCode) return;
    if (stationOptions.some((s: any) => String(s?.code) === stationCode)) return;
    setStationCode('');
  }, [stationOptions, stationCode]);

  const devices = Array.isArray(user.devices) ? user.devices : [];
  const formatDate = (value: any) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('mn-MN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Update via PostgreSQL API
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: user.id,
          name,
          role,
          stationCode,
          shiftGroup: shiftGroup || null,
          isApproved,
          tabletAccessAllowed,
          mobileAccessAllowed,
          sortDualRole,
          resetDevices,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Failed to update user');

      await appendAuditLog({
        actorUid: adminProfile.uid,
        actorName: adminProfile.displayName,
        action: 'user_updated',
        entityType: 'user',
        entityId: user.id,
        details: `Updated name to ${name || '(empty)'}, role to ${role}, station to ${stationCode || 'none'}, crew to ${shiftGroupLabel(shiftGroup)}, approved: ${isApproved}, tabletAccessAllowed: ${tabletAccessAllowed}, mobileAccessAllowed: ${mobileAccessAllowed}, sortDualRole: ${sortDualRole}, resetDevices: ${resetDevices}`,
      });

      toast.success('Хэрэглэгчийн мэдээлэл амжилттай шинэчлэгдлээ.');
      await onSaved?.();
      onClose();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error('Мэдээлэл шинэчлэхэд алдаа гарлаа:\n\n' + (error?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md max-h-[92vh] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Хэрэглэгч засах</h3>
            <p className="text-sm text-gray-500">{name || '—'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-8 space-y-6 overflow-y-auto">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Нэр</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              placeholder="Жишээ: Даваа"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
              <Shield className="w-3 h-3" />
              Системийн үүрэг
            </label>
            <select
              value={role}
              onChange={(e) => setRole(normalizeRole(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              required
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
              <Factory className="w-3 h-3" />
              {role === 'master' ? 'Мастерын дамжлага' : 'Хариуцсан дамжлага'}
            </label>
            <select
              value={stationCode}
              onChange={(e) => setStationCode(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
            >
              <option value="">
                {role === 'master' || role === 'operator' ? 'Сонгоогүй' : 'Сонгохгүй (Бүх дамжлага)'}
              </option>
              {stationOptions.map((s: any) => (
                <option key={s.code} value={s.code}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
            {role === 'master' ? (
              <p className="text-xs leading-relaxed text-gray-500">
                Зөвхөн мастерын дамжлага. Энэ нь тухайн мастер ямар ээлжүүдийг харах,
                баталгаажуулахыг тодорхойлно — хоосон бол хуваарь оноогдохгүй.
              </p>
            ) : role === 'operator' ? (
              <p className="text-xs leading-relaxed text-gray-500">
                Багаар хуваарь оноох үндэс — хоосон бол тухайн оператор алгасагдана.
              </p>
            ) : null}
          </div>

          {role === 'operator' || role === 'master' ? (
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                <Users className="w-3 h-3" />
                Ээлжийн баг
              </label>
              <select
                value={shiftGroup}
                onChange={(e) => setShiftGroup(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              >
                <option value="">Баггүй</option>
                {SHIFT_GROUP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-xs leading-relaxed text-gray-500">
                Багаар хуваарь оноох үндэс. Олон хүнийг нэг дор оноох бол{' '}
                <b>Ээлжийн хуваарь</b> хуудасны “Багийн бүрэлдэхүүн” хэсгийг ашиглана уу.
              </p>
            </div>
          ) : null}

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isApproved ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Зөвшөөрөл</p>
                <p className="text-[10px] text-gray-500 uppercase font-medium">Системд нэвтрэх эрх</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsApproved(!isApproved)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isApproved ? 'bg-orange-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isApproved ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <div>
              <p className="text-sm font-bold text-gray-900">Төхөөрөмжийн эрх</p>
              <p className="text-xs text-gray-500">Operator/master ямар төхөөрөмжөөс нэвтрэхийг админ сонгоно.</p>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-white border border-gray-100 p-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${tabletAccessAllowed ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                  <Tablet className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Таблет</p>
                  <p className="text-[11px] text-gray-500">Админ нээсэн үед ашиглана</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTabletAccessAllowed(!tabletAccessAllowed)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${tabletAccessAllowed ? 'bg-orange-600' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${tabletAccessAllowed ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-white border border-gray-100 p-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${mobileAccessAllowed ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Гар утас</p>
                  <p className="text-[11px] text-gray-500">Админ нээсэн үед ашиглана</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileAccessAllowed(!mobileAccessAllowed)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${mobileAccessAllowed ? 'bg-orange-600' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${mobileAccessAllowed ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="rounded-xl bg-white border border-gray-100 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase text-gray-500">Бүртгэгдсэн төхөөрөмж</p>
                <button
                  type="button"
                  onClick={() => setResetDevices(!resetDevices)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                    resetDevices ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>
              {resetDevices ? (
                <p className="mt-2 text-xs text-red-600">Хадгалах үед энэ хэрэглэгчийн device бүртгэл цэвэрлэгдэнэ.</p>
              ) : null}
              <div className="mt-3 space-y-2 max-h-32 overflow-y-auto pr-1">
                {devices.length === 0 ? (
                  <p className="text-xs text-gray-500">Бүртгэгдсэн төхөөрөмж байхгүй.</p>
                ) : (
                  devices.map((device: any) => (
                    <div key={device.id || device.deviceId} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold capitalize text-gray-800">{device.deviceType || 'unknown'}</span>
                        <span className={`text-[10px] font-bold ${device.allowed ? 'text-emerald-700' : 'text-red-600'}`}>
                          {device.allowed ? 'Allowed' : 'Blocked'}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-gray-500">
                        {device.platform || device.blockedReason || 'device'} · {formatDate(device.lastSeenAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between rounded-xl bg-white border border-gray-100 p-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${sortDualRole ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Рам + Сорт хосолсон эрх</p>
                  <p className="text-[11px] text-gray-500">
                    Идэвхжүүлбэл энэ хэрэглэгч сорт бүртгэлийн систем дээр рам болон сортын бүртгэлийг аль алиныг нь
                    дангаараа хийх боломжтой болно.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSortDualRole(!sortDualRole)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${sortDualRole ? 'bg-orange-600' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${sortDualRole ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
            >
              Цуцлах
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-4 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-100 disabled:opacity-50"
            >
              {loading ? 'Хадгалж байна...' : 'Хадгалах'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
