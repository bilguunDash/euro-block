'use client';

import { useState, useEffect, use, useMemo, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getPeriodicLogStatus, getShiftCompleteness, stationUsesPeriodicLogs } from '@/lib/shift-completeness';
import {
  classifyHandoverTiming,
  HANDOVER_TIMING_LABELS,
  minutesOfDayInTimeZone,
  resolveHandoverWindow,
} from '@/lib/handover-window';
import { appendAuditLog } from '@/lib/audit-log';
import { confirmMasterWarning, shiftFormMasterName } from '@/lib/handover-master-check';
import { completedWithoutRequestWarning, unsentHandoverKind, unsentHandoverNotice } from '@/lib/handover-unsent';
import { createNotification } from '@/lib/notifications';
import { CalendarClock, ChevronLeft, CheckCircle2, AlertTriangle, ClipboardList, ShieldAlert, UserRound } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

// Extracted Components
import { MixLogModal } from '@/components/shift/MixLogModal';
import { QualityLogModal } from '@/components/shift/QualityLogModal';
import { HandoverModal } from '@/components/shift/HandoverModal';
import { ProcessCheckModal } from '@/components/shift/ProcessCheckModal';
import { RecipeChangeModal } from '@/components/shift/RecipeChangeModal';
import { RepairModal } from '@/components/shift/RepairModal';
import { HseChecklistModal } from '@/components/shift/HseChecklistModal';
import { PeriodicLogModal } from '@/components/shift/PeriodicLogModal';
import { ShiftImageReviewPanel } from '@/components/shift/ShiftImageReviewPanel';
import { Y110StartFormReadOnly } from '@/components/shift/Y110StartFormReadOnly';
import type { Y110CementPumpStartPayload } from '@/lib/y110-cement-pump-form';
import {
  type ShiftInspectionImage,
  Y110CementPumpStartForm,
} from '@/components/shift/forms/Y110CementPumpStartForm';
import { Y120HandoverFormReadOnly } from '@/components/shift/Y120HandoverFormReadOnly';
import { Y121HandoverFormReadOnly } from '@/components/shift/Y121HandoverFormReadOnly';
import { Y130HandoverFormReadOnly } from '@/components/shift/Y130HandoverFormReadOnly';
import { Y140HandoverFormReadOnly } from '@/components/shift/Y140HandoverFormReadOnly';
import { Y150HandoverFormReadOnly } from '@/components/shift/Y150HandoverFormReadOnly';
import { Y160HandoverFormReadOnly } from '@/components/shift/Y160HandoverFormReadOnly';
import { Y170HandoverFormReadOnly } from '@/components/shift/Y170HandoverFormReadOnly';
import { Y170PackingOperatorReadOnly } from '@/components/shift/Y170PackingOperatorReadOnly';
import { Y180AutoclaveOperatorReadOnly } from '@/components/shift/Y180AutoclaveOperatorReadOnly';
import { Y190HandoverFormReadOnly } from '@/components/shift/Y190HandoverFormReadOnly';
import { Y210TechnologyKilnOperatorReadOnly } from '@/components/shift/Y210TechnologyKilnOperatorReadOnly';
import { Y310RepairMasterHandoverReadOnly } from '@/components/shift/Y310RepairMasterHandoverReadOnly';
import { Y320ElectricalAutomationRepairReadOnly } from '@/components/shift/Y320ElectricalAutomationRepairReadOnly';
import { FactoryProcessControlReadOnly } from '@/components/shift/FactoryProcessControlReadOnly';
import { CAH02ElectricalControlReadOnly } from '@/components/shift/CAH02ElectricalControlReadOnly';
import { IngredientChangeRecordReadOnly } from '@/components/shift/IngredientChangeRecordReadOnly';
import { Y099ShiftMasterHandoverReadOnly } from '@/components/shift/Y099ShiftMasterHandoverReadOnly';
import { Y120LimeMillHandoverForm } from '@/components/shift/forms/Y120LimeMillHandoverForm';
import { Y121BallMillHandoverForm } from '@/components/shift/forms/Y121BallMillHandoverForm';
import { Y130MixingTowerHandoverForm } from '@/components/shift/forms/Y130MixingTowerHandoverForm';
import { Y140MoldRotationHandoverForm } from '@/components/shift/forms/Y140MoldRotationHandoverForm';
import { Y150CuttingLineHandoverForm } from '@/components/shift/forms/Y150CuttingLineHandoverForm';
import { Y160RamRotationHandoverForm } from '@/components/shift/forms/Y160RamRotationHandoverForm';
import { Y170TrolleyRotationHandoverForm } from '@/components/shift/forms/Y170TrolleyRotationHandoverForm';
import { Y170PackingOperatorForm } from '@/components/shift/forms/Y170PackingOperatorForm';
import { Y180AutoclaveOperatorForm } from '@/components/shift/forms/Y180AutoclaveOperatorForm';
import { Y190QualityInspectorHandoverForm } from '@/components/shift/forms/Y190QualityInspectorHandoverForm';
import { Y210TechnologyKilnOperatorForm } from '@/components/shift/forms/Y210TechnologyKilnOperatorForm';
import { Y310RepairMasterHandoverForm } from '@/components/shift/forms/Y310RepairMasterHandoverForm';
import { Y320ElectricalAutomationRepairForm } from '@/components/shift/forms/Y320ElectricalAutomationRepairForm';
import { FactoryProcessControlForm } from '@/components/shift/forms/FactoryProcessControlForm';
import { CAH02ElectricalControlForm } from '@/components/shift/forms/CAH02ElectricalControlForm';
import { Y181HeatMasterHandoverForm } from '@/components/shift/forms/Y181HeatMasterHandoverForm';
import { IngredientChangeRecordForm } from '@/components/shift/forms/IngredientChangeRecordForm';
import { Y099ShiftMasterHandoverForm } from '@/components/shift/forms/Y099ShiftMasterHandoverForm';
import { useToast } from '@/components/ui/ToastProvider';
import { MasterStationFormSection } from '@/components/shift/MasterStationFormSection';
import { RoleUserSelect } from '@/components/ui/RoleUserSelect';
import { preferEnvironmentChecks } from '@/lib/environment-check-form';
import { resolveReceivingName } from '@/lib/shift-signature';
import { isMasterStationCode, masterStationFormConfig } from '@/lib/master-stations';

export default function ShiftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmText: string;
    danger?: boolean;
    onConfirm?: () => void;
  }>({ open: false, title: '', message: '', confirmText: 'Тийм', danger: true });
  const [shift, setShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showMixModal, setShowMixModal] = useState(false);
  const [mixLogs, setMixLogs] = useState<any[]>([]);
  const [qualityLogs, setQualityLogs] = useState<any[]>([]);
  const [handovers, setHandovers] = useState<any[]>([]);
  const [processChecks, setProcessChecks] = useState<any[]>([]);
  const [recipeChanges, setRecipeChanges] = useState<any[]>([]);
  const [repairs, setRepairs] = useState<any[]>([]);
  const [hseChecklist, setHseChecklist] = useState<any>(null);
  const [showQualModal, setShowQualModal] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [showHseModal, setShowHseModal] = useState(false);
  const [showPeriodicModal, setShowPeriodicModal] = useState(false);
  const [periodicLogs, setPeriodicLogs] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);


  const [y110StartForm, setY110StartForm] = useState<Y110CementPumpStartPayload | null>(null);
  const [y110Images, setY110Images] = useState<ShiftInspectionImage[]>([]);
  const [showY110StartEdit, setShowY110StartEdit] = useState(false);
  const [y110Saving, setY110Saving] = useState(false);
  const [stationForms, setStationForms] = useState<Record<string, any>>({});
  const [stationFormModal, setStationFormModal] = useState<{
    kind: string;
    stationCode: string;
    title: string;
  } | null>(null);
  const [stationSaving, setStationSaving] = useState(false);
  const [handoverTargets, setHandoverTargets] = useState<any[]>([]);
  const [selectedHandoverToUid, setSelectedHandoverToUid] = useState('');
  const [handoverTargetLoading, setHandoverTargetLoading] = useState(true);
  const [handoverTargetError, setHandoverTargetError] = useState('');
  const [handoverTargetKind, setHandoverTargetKind] = useState<'master' | 'operator'>('operator');
  // Master→master хүлээлцэхэд хуваарь олдохгүй бол гараар сонгох хүлээн авах мастер (нэр).
  const [manualNextMasterName, setManualNextMasterName] = useState('');
  const [manualNextMasterUid, setManualNextMasterUid] = useState('');
  // waiting_current_master баталгаажуулахад дараагийн операторын хуваарь олдохгүй бол
  // мастерын гараар сонгосон дараагийн оператор (сонголттой; хоосон бол хуучин зан төлөв хэвээр).
  const [manualNextOperatorName, setManualNextOperatorName] = useState('');
  const [manualNextOperatorUid, setManualNextOperatorUid] = useState('');
  /** Ээлж дуусгагч өөрөө баталгаажуулах мастерыг сонгоно. Хоосон бол багаас автоматаар. */
  const [manualConfirmMasterName, setManualConfirmMasterName] = useState('');
  const [manualConfirmMasterUid, setManualConfirmMasterUid] = useState('');
  /** Мастер өөрийн ээлжээ хүлээлцэхдээ сонгох «батлах админ» (чиглүүлэлт). */
  const [manualApprovalAdminName, setManualApprovalAdminName] = useState('');
  const [manualApprovalAdminUid, setManualApprovalAdminUid] = useState('');
  const [handoverDecisionNote, setHandoverDecisionNote] = useState('');
  const [showEarlyCompleteDialog, setShowEarlyCompleteDialog] = useState(false);
  const [earlyCompleteReason, setEarlyCompleteReason] = useState('');
  const [showEarlyHandoverDialog, setShowEarlyHandoverDialog] = useState(false);
  const [earlyHandoverReason, setEarlyHandoverReason] = useState('');
  const [handoverWindowSettings, setHandoverWindowSettings] = useState<Record<string, string>>({});
  /** Хүлээлцэх цагийн цонхны тооцоог амьд байлгах «цохилт» (минут тутам). */
  const [nowMinuteTick, setNowMinuteTick] = useState(() => minutesOfDayInTimeZone());

  // `manual*Name` state-үүд урьд нь зөвхөн ИЛГЭЭХ мөчид л ашиглагдаж, хадгалагдсаны
  // дараа хуудас дахин ачаалахад (жишээ нь оператор өөрийн илгээсэн хүсэлтээ дахин
  // нээх, эсвэл мастер батлах гэж орох үед) байнга хоосон эхэлдэг байсан — гэтэл
  // сервер дээр (`shift.nextOperatorName` гэх мэт) сонголт нь бодитоор хадгалагдсан
  // байдаг. Иймд хэрэглэгчид "сонгосон зүйл минь хадгалагдаагүй, дахин сонгуулах гээд
  // байна" мэт харагддаг байсан (bug — өгөгдөл алдагдаагүй, зөвхөн UI буцааж
  // уншаагүй). Shift анх ачаалахад хадгалагдсан утгыг select-үүдэд нэг л удаа буцааж
  // тавина (дараагийн polling-үүдэд идэвхтэй засварыг дарахгүй байхын тулд зөвхөн
  // нэг удаа).
  const hydratedManualFieldsRef = useRef(false);
  useEffect(() => {
    if (!shift || hydratedManualFieldsRef.current) return;
    hydratedManualFieldsRef.current = true;
    if (shift.nextOperatorName) setManualNextOperatorName(shift.nextOperatorName);
    if (shift.nextMasterName) setManualNextMasterName(shift.nextMasterName);
    if (shift.approvalAdminName) setManualApprovalAdminName(shift.approvalAdminName);
    // Урьдчилан сонгогдох мастерын нэр uid-тайгаа таарах ёстой (маягтын мастертай тулгахад хэрэглэнэ).
    const prefillConfirmMasterName = shift.currentMasterUid ? shift.currentMasterName : shift.shiftMasterName;
    if (prefillConfirmMasterName) setManualConfirmMasterName(prefillConfirmMasterName);
    setManualNextOperatorUid(shift.nextOperatorUid || shift.handoverToOperatorUid || '');
    setManualNextMasterUid(shift.nextMasterUid || '');
    setManualApprovalAdminUid(shift.approvalAdminUid || '');
    setManualConfirmMasterUid(shift.currentMasterUid || shift.shiftMasterUid || '');
  }, [shift?.id]);

  // Маягтад бичсэн мастер ≠ бүртгэл илгээгдэх мастер бол хүлээлгэн өгөх цонхонд анхааруулна.
  const formMasterName = useMemo(
    () => shiftFormMasterName([y110StartForm, ...Object.values(stationForms)]),
    [y110StartForm, stationForms]
  );
  const confirmMasterWarningText = useMemo(
    () => confirmMasterWarning(formMasterName, { uid: manualConfirmMasterUid, name: manualConfirmMasterName }),
    [formMasterName, manualConfirmMasterUid, manualConfirmMasterName]
  );

  const hseImages = useMemo(
    () => y110Images.filter((img) => img.section === 'hse_checklist'),
    [y110Images]
  );
  useEffect(() => {
    let cancelled = false;
    let stopPolling = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/shifts/${id}`, { cache: 'no-store', credentials: 'include' });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data?.ok) {
          const message = data?.error || 'API Error';
          if ([400, 403, 404].includes(res.status)) {
            setShift(null);
            setLoadError(message);
            setLoading(false);
            stopPolling = true;
            return;
          }
          throw new Error(message);
        }
        const s = data.shift;
        setLoadError(null);
        stopPolling = false;
        setShift({ ...s, id: s._id || s.id || id });
        const modalLogs = Array.isArray(s.modalLogs) ? s.modalLogs : [];

        const byType = (t: string) =>
          modalLogs
            .filter((l: any) => String(l?.logType || '') === `modal_${t}`)
            .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((l: any) => ({ id: l.id, ...(l.data || {}) }));


        setMixLogs(byType('mix_logs'));
        setQualityLogs(byType('quality_logs'));
        setHandovers(byType('handovers'));
        setProcessChecks(byType('process_checks'));
        setRecipeChanges(byType('recipe_changes'));
        setRepairs(byType('repairs'));
        setPeriodicLogs(byType('periodic_logs'));

        const hse = byType('hse_checklist');
        setHseChecklist(hse.length ? hse[hse.length - 1] : null);

        const y110Logs = byType('y110_start_form');
        const y110 = (y110Logs.length ? y110Logs[y110Logs.length - 1] : (s?.y110StartForm ?? null)) as any;
        setY110StartForm(y110);
        setY110Images(Array.isArray(s.shiftImages) ? s.shiftImages : []);
        setStationForms({
          y099_master_handover_v1: (byType('y099_master_handover_v1').slice(-1)[0] as any) ?? null,
          y120_handover_form: (byType('y120_handover_form').slice(-1)[0] as any) ?? null,
          y121_handover_form: (byType('y121_handover_form').slice(-1)[0] as any) ?? null,
          y130_handover_form: (byType('y130_handover_form').slice(-1)[0] as any) ?? null,
          y140_handover_form: (byType('y140_handover_form').slice(-1)[0] as any) ?? null,
          y150_handover_form: (byType('y150_handover_form').slice(-1)[0] as any) ?? null,
          y160_handover_form: (byType('y160_handover_form').slice(-1)[0] as any) ?? null,
          y161_handover_form: (byType('y161_handover_form').slice(-1)[0] as any) ?? null,
          y170_packing_operator_form: (byType('y170_packing_operator_form').slice(-1)[0] as any) ?? null,
          y180_autoclave_operator_form: (byType('y180_autoclave_operator_form').slice(-1)[0] as any) ?? null,
          y190_handover_form: (byType('y190_handover_form').slice(-1)[0] as any) ?? null,
          y210_technology_kiln_operator_form:
            (byType('y210_technology_kiln_operator_form').slice(-1)[0] as any) ?? null,
          y310_repair_master_form: (byType('y310_repair_master_form').slice(-1)[0] as any) ?? null,
          y320_electrical_automation_repair_form:
            (byType('y320_electrical_automation_repair_form').slice(-1)[0] as any) ?? null,
          factory_process_control_form: (byType('factory_process_control_form').slice(-1)[0] as any) ?? null,
          cah02_electrical_control_form: (byType('cah02_electrical_control_form').slice(-1)[0] as any) ?? null,
          y181_heat_master_handover_v1: (byType('y181_heat_master_handover_v1').slice(-1)[0] as any) ?? null,
          ingredient_change_record_form: (byType('ingredient_change_record_form').slice(-1)[0] as any) ?? null,
        });
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'API Error');
          setLoading(false);
        }
      }
    };
    load();
    const interval = setInterval(() => {
      if (!stopPolling) void load();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);


  useEffect(() => {
    if (!shift?.id) return;
    let cancelled = false;
    let firstLoad = true;
    const loadNextHandover = async () => {
      if (firstLoad) setHandoverTargetLoading(true);
      try {
        const response = await fetch(`/api/shifts/${id}/next-handover`, {
          cache: 'no-store',
          credentials: 'include',
        });
        const json = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok || !json?.ok) {
          throw new Error(json?.error || 'Дараагийн операторын хуваарийг шалгаж чадсангүй.');
        }
        const rows = json.schedule ? [json.schedule] : [];
        setHandoverTargets(rows);
        setHandoverTargetKind(json.handoverKind === 'master' ? 'master' : 'operator');
        // Хуваарийн саналыг сонгогчид урьдчилан бөглөнө — хэрэглэгч хүсвэл өөрчилнө.
        // (Чөлөө авсан/ирээгүй бол өөр хүн сонгоно.) Зөвхөн хоосон үед бөглөх нь
        // хэрэглэгчийн гар сонголтыг polling-д дарж бичихээс сэргийлнэ.
        if (json.schedule?.masterName) {
          setManualNextMasterName((prev) => prev || String(json.schedule.masterName));
        }
        if (json.schedule?.masterUid) {
          setManualNextMasterUid((prev) => prev || String(json.schedule.masterUid));
        }
        if (json.schedule?.operatorName) {
          setManualNextOperatorName((prev) => prev || String(json.schedule.operatorName));
        }
        if (json.schedule?.operatorUid) {
          setManualNextOperatorUid((prev) => prev || String(json.schedule.operatorUid));
        }
        setHandoverTargetError(json.eligible ? '' : String(json.error || 'Дараагийн хүлээн авагч олдсонгүй.'));
        setSelectedHandoverToUid(
          json.eligible
            ? String(json.schedule?.operatorUid || json.schedule?.masterUid || '')
            : ''
        );
      } catch (error) {
        if (cancelled) return;
        setHandoverTargets([]);
        setSelectedHandoverToUid('');
        setHandoverTargetError(
          error instanceof Error ? error.message : 'Дараагийн операторын хуваарийг шалгаж чадсангүй.'
        );
      } finally {
        if (!cancelled && firstLoad) setHandoverTargetLoading(false);
        firstLoad = false;
      }
    };
    void loadNextHandover();
    const interval = window.setInterval(() => void loadNextHandover(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [id, shift?.id, shift?.shiftDate, shift?.shiftType, shift?.stationCode, shift?.operatorUid]);

  // Цонхны хил давахад «Эрт/Хоцорсон» шууд шинэчлэгдэхийн тулд минут тутам цохино.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMinuteTick((prev) => {
        const next = minutesOfDayInTimeZone();
        return prev === next ? prev : next;
      });
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const periodicIntervalHours = useMemo(() => {
    const value = Number(handoverWindowSettings.periodic_interval_hours || '2');
    return Number.isFinite(value) && value > 0 ? value : 2;
  }, [handoverWindowSettings.periodic_interval_hours]);

  const completeness = useMemo(
    () =>
      shift
        ? getShiftCompleteness({
          stationCode: shift.stationCode,
          hseChecklist,
          stationForms,
          handovers,
          mixLogs,
          qualityLogs,
          processChecks,
          recipeChanges,
          repairs,
          periodicLogs,
          checkInIso: shift.checkIn,
          checkOutIso: shift.checkOut,
          periodicIntervalHours,
          requirePeriodicLogs: stationUsesPeriodicLogs(shift.stationCode),
        })
        : { ok: false, missing: [] },
    [
      shift,
      stationForms,
      hseChecklist,
      handovers,
      mixLogs,
      qualityLogs,
      processChecks,
      recipeChanges,
      repairs,
      periodicLogs,
      periodicIntervalHours,
    ]
  );
  const isMasterStationShift = Boolean(shift && isMasterStationCode(shift.stationCode));
  // Хүсэлт нь одоо хэнд ч очоогүй (дуусгаад илгээгээгүй / буцаагдаад дахин илгээгээгүй) бол анхааруулна.
  const unsentKind = unsentHandoverKind(shift);
  const unsentNotice = unsentKind ? unsentHandoverNotice(unsentKind, isMasterStationShift) : null;
  const periodicStatus = useMemo(
    () =>
      getPeriodicLogStatus({
        stationCode: shift?.stationCode,
        periodicLogs,
        checkInIso: shift?.checkIn,
        checkOutIso: shift?.checkOut,
        periodicIntervalHours,
      }),
    [shift?.stationCode, shift?.checkIn, shift?.checkOut, periodicLogs, periodicIntervalHours]
  );
  const submittedPeriodicLogs = useMemo(
    () => periodicLogs.filter((log) => Boolean(log?.submittedAt) || !log?.draftSavedAt),
    [periodicLogs]
  );

  // Request browser notification permission once when a master opens a periodic-log shift
  useEffect(() => {
    if (profile?.role !== 'master') return;
    if (!shift || profile.uid !== shift.operatorUid) return;
    if (!stationUsesPeriodicLogs(shift.stationCode)) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
    Notification.requestPermission().catch(() => {});
  }, [profile?.role, profile?.uid, shift?.operatorUid, shift?.stationCode]);

  // Schedule a browser notification when the next periodic-log deadline arrives (master only)
  useEffect(() => {
    if (profile?.role !== 'master') return;
    if (!shift || profile.uid !== shift.operatorUid) return;
    if (!stationUsesPeriodicLogs(shift.stationCode)) return;
    if (shift.operatorShiftCompleted) return;
    if (typeof Notification === 'undefined') return;
    const deadlineMs = periodicStatus.nextDeadlineMs;
    if (!deadlineMs) return;
    const delayMs = deadlineMs - Date.now();
    if (delayMs <= 0) return;
    const timer = window.setTimeout(() => {
      if (Notification.permission === 'granted') {
        try {
          new Notification('Тогтмол бүртгэл бөглөх цаг болов!', {
            body: `${shift.stationCode} · ${shift.shiftDate} (${shift.shiftType})\nДавтамжит хяналтын бүртгэл хийх цаг боллоо.`,
            icon: '/favicon.ico',
            tag: `periodic-${shift.id}-${deadlineMs}`,
          });
        } catch {
          // Notification API not supported or blocked
        }
      }
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [
    profile?.role,
    profile?.uid,
    shift?.id,
    shift?.operatorUid,
    shift?.stationCode,
    shift?.shiftDate,
    shift?.shiftType,
    shift?.operatorShiftCompleted,
    periodicStatus.nextDeadlineMs,
  ]);

  const shiftExpectedEndMs = useMemo(() => {
    if (!shift?.checkIn) return null;
    const checkInMs = new Date(shift.checkIn).getTime();
    if (!Number.isFinite(checkInMs)) return null;
    return checkInMs + 12 * 60 * 60 * 1000;
  }, [shift?.checkIn]);

  const isEarlyCompletion = useMemo(() => {
    if (!shiftExpectedEndMs) return false;
    if (shift?.operatorShiftCompleted) return false;
    return Date.now() < shiftExpectedEndMs;
  }, [shiftExpectedEndMs, shift?.operatorShiftCompleted]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j?.ok) setHandoverWindowSettings(j.settings || {});
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const handoverTiming = useMemo(() => {
    const shiftType = String(shift?.shiftType || '');
    // Цонх сонгох ба ангилах логик нь `lib/handover-window.ts`-д (сервертэй ижил
    // ганц хэрэгжилт). `nowMinuteTick` нь хамаарал — эс бөгөөс хуудсыг нээлттэй
    // орхиход цонхны хил давсан ч утга хуучнаараа гацна.
    const { start, end, label: windowLabel } = resolveHandoverWindow(shiftType, handoverWindowSettings);
    const key = classifyHandoverTiming(nowMinuteTick, start, end);
    return { key, label: HANDOVER_TIMING_LABELS[key], windowLabel };
  }, [
    shift?.shiftType,
    nowMinuteTick,
    handoverWindowSettings.day_handover_start,
    handoverWindowSettings.day_handover_end,
    handoverWindowSettings.night_handover_start,
    handoverWindowSettings.night_handover_end,
  ]);
  const handoverWindowStrict =
    String(handoverWindowSettings.shift_handover_window_strict || 'false').toLowerCase() === 'true';



  const handleAdminApprove = async () => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'chief_engineer')) return;
    if (!shift) return;
    if (!shift.masterApproved) {
      toast.warning('Эхлээд ээлжийн мастер баталгаажуулах ёстой.');
      return;
    }
    const stage = String(shift.handoverStage || '').trim();
    const isHandoverDone =
      !!shift.handoverFinalAcceptedAt ||
      stage === 'accepted' ||
      stage === 'returned';
    if (!isHandoverDone) {
      toast.warning('Ээлж хүлээлцэх процесс бүрэн дууссаны дараа admin эцсийн баталгаажуулалт хийнэ.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        status: 'Баталгаажсан',
        adminApproved: true,
        adminApprovedBy: profile.displayName || profile.name || profile.email,
        adminApprovedDate: new Date().toISOString(),
      };
      const res = await fetch(`/api/shifts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setShift((prev: any) => ({ ...prev, ...payload }));
        toast.success('Эцсийн баталгаажуулалт амжилттай хийгдлээ.');
      } else {
        toast.error(data?.error || 'Алдаа гарлаа');
      }
    } catch (e) {
      toast.error('Хүсэлт илгээхэд алдаа гарлаа');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveY110StartForm = async (payload: Y110CementPumpStartPayload) => {
    if (!profile) return;
    if (!shift) return;
    if (profile.uid !== shift.operatorUid) {
      toast.warning('Зөвхөн тухайн ээлжийн оператор засварлана.');
      return;
    }
    setY110Saving(true);
    try {
      const res = await fetch(`/api/shifts/${id}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'y110_start_form', mode: 'submit', data: payload }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'Failed');
      setY110StartForm(payload);
      setShowY110StartEdit(false);
      toast.success('ҮЯ-110 эхлэх үзлэг хадгаллаа.');
    } catch (e: any) {
      toast.error('Хадгалахад алдаа:\n\n' + (e?.message || ''));
    } finally {
      setY110Saving(false);
    }
  };

  const saveStationModalForm = async (kind: string, payload: any) => {
    if (!profile) return;
    if (!shift) return;
    const privilegedEditor =
      profile.role === 'admin' || profile.role === 'master' || profile.role === 'chief_engineer';
    if (profile.uid !== shift.operatorUid && !privilegedEditor) {
      toast.warning('Зөвхөн тухайн ээлжийн оператор эсвэл эрхтэй хэрэглэгч засварлана.');
      return;
    }
    setStationSaving(true);
    try {
      const res = await fetch(`/api/shifts/${id}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: kind, mode: 'submit', data: payload }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'Failed');
      setStationForms((prev) => ({ ...prev, [kind]: payload }));
      setStationFormModal(null);
      toast.success('Хадгаллаа.');
    } catch (e: any) {
      toast.error('Хадгалахад алдаа:\n\n' + (e?.message || ''));
    } finally {
      setStationSaving(false);
    }
  };

  const completeOperatorShift = async (reason?: string) => {
    if (!profile || shift.operatorUid !== profile.uid) return false;
    const note = String(reason || '').trim();
    const completedAt = new Date().toISOString();
    try {
      const res = await fetch(`/api/shifts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          checkOut: completedAt,
          operatorShiftCompleted: true,
          handoverTimingReason: note,
          ...(note ? { notes: note } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed');
      await appendAuditLog({
        actorUid: profile.uid,
        actorName: profile.displayName,
        action: 'shift_operator_completed',
        entityType: 'shift',
        entityId: id,
      });
      setShift((prev: any) =>
        prev
          ? {
            ...prev,
            checkOut: completedAt,
            operatorShiftCompleted: true,
            handoverTimingReason: note || prev.handoverTimingReason,
            ...(note ? { notes: note } : {}),
          }
          : prev
      );
      if (shift.handoverAwaitingAcceptance) {
        if (note) toast.success('Ээлж дуусгалаа. Хугацаанаас өмнө дуусгасан тайлбар хадгалагдлаа.');
        else toast.success('Ээлж дуусгалаа.');
      } else {
        // «Ээлж дуусгах» хэнд ч юу ч илгээдэггүй — операторууд, мастерууд үүнийг илгээсэн гэж андуурч байсан.
        toast.warning(
          `${note ? 'Хугацаанаас өмнө дуусгасан тайлбар хадгалагдлаа. ' : ''}${completedWithoutRequestWarning(isMasterStationShift)}`,
          'Ээлж дуусгалаа',
        );
      }
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Ээлж дуусгахад алдаа гарлаа.');
      return false;
    }
  };

  const handleOperatorCompleteShift = async () => {
    if (!canAppendLogs) {
      toast.warning('Энэ role дээр засвар/үйлдэл хийх эрхгүй.');
      return;
    }
    if (!profile || shift.operatorUid !== profile.uid) return;
    // Маягт дутуу байсан ч ээлж дуусгахыг БЛОКЛОХГҮЙ (хэрэглэгчийн хүсэлт).
    // `completeness.missing` нь дээрх шар анхааруулга болон мастер/тайлангийн
    // хэсгүүдэд МЭДЭЭЛЛИЙН зорилгоор хэвээр харагдана.
    if (handoverTiming.key !== 'normal') {
      setEarlyCompleteReason('');
      setShowEarlyCompleteDialog(true);
      return;
    }
    await completeOperatorShift();
  };

  const submitHandoverRequest = async (reason?: string) => {
    if (!profile || shift.operatorUid !== profile.uid) return false;
    try {
      const completedAt = shift.checkOut || new Date().toISOString();
      const completesWithRequest = !shift.operatorShiftCompleted;
      const payload: Record<string, unknown> = {
        handoverAwaitingAcceptance: true,
        handoverRequestedAt: new Date().toISOString(),
        ...(completesWithRequest
          ? {
              checkOut: completedAt,
              operatorShiftCompleted: true,
            }
          : {}),
      };
      const note = String(reason || '').trim();
      if (note) {
        payload.notes = note;
        payload.handoverTimingReason = note;
      }

      // Сонгосон хүнийг үргэлж хавсаргана — backend дээр гараар сонгосон нь
      // хуваарийг дарна (чөлөө авсан/ирээгүй хүн хуваарьт хэвээр байдаг).
      if (isMasterStationShift) {
        const pickedMaster = manualNextMasterUid.trim();
        if (!pickedMaster && !handoverTargets[0]) {
          toast.warning('Хүлээн авах дараагийн мастерыг сонгоно уу.');
          return false;
        }
        if (pickedMaster) payload.nextMasterUid = pickedMaster;
        const pickedAdmin = manualApprovalAdminUid.trim();
        if (pickedAdmin) payload.approvalAdminUid = pickedAdmin;
      } else {
        const pickedOperator = manualNextOperatorUid.trim();
        if (pickedOperator) payload.nextOperatorUid = pickedOperator;
        const pickedConfirmMaster = manualConfirmMasterUid.trim();
        if (pickedConfirmMaster) payload.confirmMasterUid = pickedConfirmMaster;
      }

      const r = await fetch(`/api/shifts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'Failed');
      if (completesWithRequest) {
        await appendAuditLog({
          actorUid: profile.uid,
          actorName: profile.displayName,
          action: 'shift_operator_completed',
          entityType: 'shift',
          entityId: id,
        });
      }
      await appendAuditLog({
        actorUid: profile.uid,
        actorName: profile.displayName,
        action: 'shift_handover_requested',
        entityType: 'shift',
        entityId: id,
      });
      const nextTarget = handoverTargets[0] || null;
      setShift((prev: any) => {
        if (!prev) return prev;
        const masterSelfHandover =
          profile.role === 'master' &&
          prev.operatorUid === profile.uid &&
          isMasterStationCode(prev.stationCode);
        return masterSelfHandover
            ? {
              ...prev,
              operatorShiftCompleted: true,
              checkOut: completedAt,
              handoverAwaitingAcceptance: true,
              handoverRequestedAt: String(payload.handoverRequestedAt),
              handoverStage: 'waiting_next_master',
              currentMasterUid: profile.uid,
              currentMasterName: prev.operatorName || profile.displayName || null,
              currentMasterApprovedByUid: profile.uid,
              currentMasterApprovedByName: profile.displayName || null,
              currentMasterApprovedAt: String(payload.handoverRequestedAt),
              nextMasterUid: nextTarget?.masterUid || null,
              nextMasterName: nextTarget?.masterName || null,
              handoverToOperatorUid: null,
              handoverToOperatorName: null,
              nextOperatorUid: null,
              nextOperatorName: null,
            }
            : {
              ...prev,
              operatorShiftCompleted: true,
              checkOut: completedAt,
              handoverAwaitingAcceptance: true,
              handoverRequestedAt: String(payload.handoverRequestedAt),
              handoverStage: 'waiting_current_master',
              currentMasterUid: prev.currentMasterUid || prev.shiftMasterUid || null,
              currentMasterName: prev.currentMasterName || null,
              handoverToOperatorUid: null,
              handoverToOperatorName: null,
              nextOperatorUid: null,
              nextOperatorName: null,
              nextMasterUid: null,
              nextMasterName: null,
            };
      });
      toast.success('Хүлээлцэх хүсэлт илгээлээ.');
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Хүсэлт илгээхэд алдаа гарлаа.');
      return false;
    }
  };

  const handleRequestHandover = async () => {
    if (!canAppendLogs) {
      toast.warning('Энэ role дээр засвар/үйлдэл хийх эрхгүй.');
      return;
    }
    if (!profile || shift.operatorUid !== profile.uid) return;
    // Маягт дутуу байсан ч хүлээлцэх хүсэлт илгээхийг БЛОКЛОХГҮЙ (хэрэглэгчийн хүсэлт).
    if (handoverTiming.key !== 'normal') {
      if (handoverWindowStrict) {
        toast.error(
          `Ээлж хүлээлцэх цагийн цонх хаалттай байна. ${shift.shiftType} ээлжийн хүсэлтийг ${handoverTiming.windowLabel} хооронд илгээнэ.`
        );
        return;
      }
      setEarlyHandoverReason('');
      setShowEarlyHandoverDialog(true);
      return;
    }
    await submitHandoverRequest();
  };

  const handleAcceptHandover = async () => {
    if (!profile) return;
    if (!shift) return;
    if (!canAcceptHandover) {
      toast.error('Ээлж хүлээн авах эрхгүй.');
      return;
    }
    // Мастерын станцын маягт дутуу байсан ч баталгаажуулахыг БЛОКЛОХГҮЙ
    // (хэрэглэгчийн хүсэлт — бүх маягтын талбар заавал биш болсонтой нийцүүлэв).
    // Тайлбар (`handoverDecisionNote`) UI дээр ЯВЦУУДАА "Тайлбар (сонголттой)" гэж
    // тэмдэглэдэг ("Тайлбар (заавал)" биш — доор `showEarlyCompleteDialog`/
    // `showEarlyHandoverDialog`-той харьцуул) тул энд цаг хоцорсон/эрт үед ч
    // заавал бичихийг ШААРДАХГҮЙ — эс бөгөөс "сонголттой" гэсэн шошго нь худал
    // болж, оператор яагаад товч ажиллахгүй байгааг ойлгохгүй байх bug үүсдэг байв.
    try {
      const stageBefore = String(shift.handoverStage || '').trim();
      const acceptedAt = new Date().toISOString();
      const payload: Record<string, unknown> = {
        handoverAwaitingAcceptance: false,
        handoverAcceptedByUid: profile.uid,
        handoverAcceptedByName: profile.displayName,
        handoverAcceptedAt: acceptedAt,
        attentionNotes: handoverDecisionNote || '',
        handoverTimingReason: handoverDecisionNote || '',
      };
      // Мастер баталгаажуулахдаа дараагийн операторыг сонгож болно — сонгосон нь
      // хуваарийг дарна (чөлөө/ажил таслалт хуваарьт тусдаггүй).
      if (stageBefore === 'waiting_current_master') {
        const pickedOperator = manualNextOperatorUid.trim();
        if (pickedOperator) payload.nextOperatorUid = pickedOperator;
      }
      const res = await fetch(`/api/shifts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed');
      await appendAuditLog({
        actorUid: profile.uid,
        actorName: profile.displayName,
        action: 'shift_handover_accepted',
        entityType: 'shift',
        entityId: id,
      });
      setShift((prev: any) => {
        if (!prev) return prev;
        if (stageBefore === 'waiting_current_master') {
          const nextOperator = handoverTargets[0] || null;
          if (!nextOperator?.operatorUid) {
            return {
              ...prev,
              handoverStage: 'accepted',
              handoverAwaitingAcceptance: false,
              currentMasterApprovedByUid: profile.uid,
              currentMasterApprovedByName: profile.displayName,
              currentMasterApprovedAt: acceptedAt,
              currentMasterComment: handoverDecisionNote || null,
              masterApproved: true,
              masterApprovedBy: profile.displayName,
              masterApprovedDate: acceptedAt,
              handoverAcceptedByUid: profile.uid,
              handoverAcceptedByName: profile.displayName,
              handoverAcceptedAt: acceptedAt,
              handoverFinalAcceptedAt: acceptedAt,
              nextMasterUid: null,
              nextMasterName: null,
              nextOperatorUid: null,
              nextOperatorName: null,
              handoverToOperatorUid: null,
              handoverToOperatorName: null,
            };
          }
          // `masterApproved`-г ЭНД тавихгүй — дараагийн оператор хүлээж авах хүртэл
          // дамжлага дуусаагүй тул сервер ч мөн зориудаар тавьдаггүй
          // (app/api/shifts/[id]/route.ts). Урьд нь энд `true` болгосноос
          // «Мастер баталгаажсан» гэж хуурамчаар харагдаад polling дараа нь
          // буцаадаг байв.
          return {
            ...prev,
            handoverStage: 'waiting_next_operator',
            handoverAwaitingAcceptance: true,
            currentMasterApprovedByUid: profile.uid,
            currentMasterApprovedByName: profile.displayName,
            currentMasterApprovedAt: acceptedAt,
            currentMasterComment: handoverDecisionNote || null,
            nextMasterUid: null,
            nextMasterName: null,
            nextOperatorUid: nextOperator?.operatorUid || prev.nextOperatorUid || null,
            nextOperatorName: nextOperator?.operatorName || prev.nextOperatorName || null,
            handoverToOperatorUid: nextOperator?.operatorUid || prev.handoverToOperatorUid || null,
            handoverToOperatorName: nextOperator?.operatorName || prev.handoverToOperatorName || null,
          };
        }
        if (stageBefore === 'waiting_next_master') {
          if (prev.nextOperatorUid) {
            return {
              ...prev,
              handoverStage: 'accepted',
              handoverAwaitingAcceptance: false,
              handoverAcceptedByUid: profile.uid,
              handoverAcceptedByName: profile.displayName,
              handoverAcceptedAt: acceptedAt,
              handoverFinalAcceptedAt: acceptedAt,
              nextMasterUid: null,
              nextMasterName: null,
            };
          }
          // Дараагийн мастер өөрөө баталгаажуулсан — сервер дээр энэ нь ЭЦСИЙН шат
          // (`accepted` + `masterApproved`). Урьд нь энд `waiting_next_operator`
          // гэж харуулдаг байсан тул хэрэглэгчид дуусаагүй мэт харагдаад
          // polling 5 секундын дараа засдаг байв.
          return {
            ...prev,
            handoverStage: 'accepted',
            handoverAwaitingAcceptance: false,
            nextMasterApprovedByUid: profile.uid,
            nextMasterApprovedByName: profile.displayName,
            nextMasterApprovedAt: acceptedAt,
            nextMasterComment: handoverDecisionNote || null,
            masterApproved: true,
            masterApprovedBy: profile.displayName,
            masterApprovedDate: acceptedAt,
            handoverAcceptedByUid: profile.uid,
            handoverAcceptedByName: profile.displayName,
            handoverAcceptedAt: acceptedAt,
            handoverFinalAcceptedAt: acceptedAt,
          };
        }
        return {
          ...prev,
          handoverStage: 'accepted',
          handoverAwaitingAcceptance: false,
          handoverAcceptedByUid: profile.uid,
          handoverAcceptedByName: profile.displayName,
          handoverAcceptedAt: acceptedAt,
          handoverFinalAcceptedAt: acceptedAt,
        };
      });
      setHandoverDecisionNote('');
      toast.success(stageBefore === 'waiting_next_operator' ? 'Хүлээн авлаа.' : 'Баталгаажууллаа.');
      // Дараагийн оператор ЭЦСИЙН удаа хүлээн авахад шууд өөрийн шинэ ээлжийг
      // эхлүүлэх маягт руу шилжүүлнэ (дамжлага урьдчилан бөглөгдсөн) — урьд нь
      // хүлээн авсны дараа юу ч болдоггүй, оператор өөрөө дараа нь /shift/new
      // руу гараар орж ээлжээ тусад нь эхлүүлэх шаардлагатай байсан.
      if (stageBefore === 'waiting_next_operator' && shift.stationCode) {
        // Хуваарийн «Ээлж эхлүүлэх» холбоосын адил дараагийн хуваарийн огноо, ээлжийн
        // төрлийг `auto=1`-тэй дамжуулна; хуваарь олдоогүй бол зөвхөн станцтай URL.
        const slot = handoverTargets[0] || null;
        const nextShiftDate = String(slot?.shiftDate || '').trim();
        const nextShiftType = String(slot?.shiftType || '').trim();
        if (nextShiftDate && nextShiftType) {
          router.push(
            '/shift/new?' +
              new URLSearchParams({
                auto: '1',
                stationCode: shift.stationCode,
                shiftType: nextShiftType,
                shiftDate: nextShiftDate,
              }).toString()
          );
        } else {
          router.push(`/shift/new?stationCode=${encodeURIComponent(shift.stationCode)}`);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Ээлж хүлээн авахад алдаа гарлаа.');
    }
  };

  const handleReturnHandover = async () => {
    if (!profile) return;
    if (!shift) return;
    if (!canAcceptHandover) {
      toast.error('Ээлж хүлээн авах/буцаах эрхгүй.');
      return;
    }
    try {
      const doReturn = async () => {
        const r = await fetch(`/api/shifts/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            handoverAwaitingAcceptance: false,
            attentionNotes: handoverDecisionNote || '',
          }),
        });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) throw new Error(j?.error || 'Failed');
        await appendAuditLog({
          actorUid: profile.uid,
          actorName: profile.displayName,
          action: 'shift_handover_returned',
          entityType: 'shift',
          entityId: id,
        });
        // Сервер ээлжийг «дуусаагүй» болгож буцаадаг тул оператор маягтаа шууд
        // засах боломжтой болно — polling хүлээлгүй тэр даруй тусгана.
        setShift((prev: any) =>
          prev
            ? {
              ...prev,
              handoverStage: 'returned',
              handoverAwaitingAcceptance: false,
              operatorShiftCompleted: false,
              handoverReturnedByUid: profile.uid,
              handoverReturnedByName: profile.displayName,
              handoverReturnedAt: new Date().toISOString(),
              handoverReturnReason: handoverDecisionNote || null,
            }
            : prev
        );
        setHandoverDecisionNote('');
        toast.success('Буцаалаа. Оператор бүртгэлээ засаад дахин илгээнэ.');
      };
      setConfirmDialog({
        open: true,
        title: 'Буцаах уу?',
        message: 'Ээлжийг буцаах уу?',
        confirmText: 'Буцаах',
        danger: true,
        onConfirm: () => {
          setConfirmDialog((s) => ({ ...s, open: false }));
          void doReturn();
        },
      });
    } catch (e) {
      console.error(e);
      toast.error('Буцаахад алдаа гарлаа.');
    }
  };

  const canAcceptHandover =
    shift &&
    shift.handoverAwaitingAcceptance &&
    profile &&
    shift.operatorUid !== profile.uid &&
    (() => {
      const stage = String(shift.handoverStage || '').trim();
      if (profile.role === 'chief_engineer' || profile.role === 'admin') return true;
      if (stage === 'waiting_current_master') {
        return profile.role === 'master' && shift.currentMasterUid === profile.uid;
      }
      if (stage === 'waiting_next_master') {
        if (shift.nextOperatorUid) {
          return (
            profile.role === 'operator' &&
            (shift.nextOperatorUid === profile.uid || shift.handoverToOperatorUid === profile.uid)
          );
        }
        return profile.role === 'master' && shift.nextMasterUid === profile.uid;
      }
      if (stage === 'waiting_next_operator') {
        return (
          profile.role === 'operator' &&
          (shift.nextOperatorUid === profile.uid || shift.handoverToOperatorUid === profile.uid)
        );
      }
      return (
        (shift.handoverToOperatorUid && shift.handoverToOperatorUid === profile.uid) ||
        (profile.role === 'master' && shift.shiftMasterUid === profile.uid) ||
        (profile.role === 'operator' &&
          profile.stationCode &&
          profile.stationCode === shift.stationCode)
      );
    })();

  const role = String(profile?.role || '');
  const handoverStage = String(shift?.handoverStage || '').trim();
  const handoverStageLabel =
    handoverStage === 'waiting_current_master'
      ? 'Одоогийн ээлжийн мастер хянана'
      : handoverStage === 'waiting_next_master'
        ? shift?.nextOperatorUid
          ? 'Дараагийн оператор хүлээн авна'
          : 'Дараагийн ээлжийн мастер хянана'
        : handoverStage === 'waiting_next_operator'
          ? 'Дараагийн оператор хүлээн авна'
          : 'Ээлж хүлээлцэх хяналт';
  const isNextOperatorStage =
    handoverStage === 'waiting_next_operator' ||
    (handoverStage === 'waiting_next_master' && !!shift?.nextOperatorUid);
  const handoverActionLabel = isNextOperatorStage ? 'Хүлээн авах' : 'Баталгаажуулах';
  const isReadOnlyRole = role === 'dispatcher' || role === 'auditor' || role === 'hse_engineer' || role === 'manager';
  const isShiftOwner = !!profile && !!shift && shift.operatorUid === profile.uid;
  const canMasterReviewEdit = role === 'master' && !!canAcceptHandover;
  const canMasterEditControlledShift =
    role === 'master' &&
    !!profile &&
    !!shift &&
    shift.operatorUid !== profile.uid &&
    shift.shiftMasterUid === profile.uid;
  /**
   * Мастер ӨӨРИЙН мастер станцын ээлжийг засах эрх.
   *
   * «Ээлжийн хяналт» табаас мастер өөрийн мастер станцын БҮХ ээлжийг хардаг
   * (`masterScopedShiftWhere` — app/api/shifts/route.ts). Гэтэл засах товч
   * гарахгүй байсан тул «Дэлгэрэнгүй» рүү орсон мастер юу ч хийж чаддаггүй байв.
   * Сервер тал үүнийг аль хэдийн зөвшөөрдөг (`canAppendShiftLog` — мастер бүх
   * ээлжид log бичиж болно), тиймээс энэ нь зөвхөн харагдах эрхийг сервертэй
   * нийцүүлж байна.
   */
  const canMasterEditOwnStationShift =
    role === 'master' &&
    !!profile &&
    !!shift &&
    isMasterStationCode(profile.stationCode) &&
    String(profile.stationCode || '').trim() === String(shift.stationCode || '').trim();
  const isHandoverFullyAccepted =
    !!shift?.handoverFinalAcceptedAt ||
    handoverStage === 'accepted';
  const effectiveShiftId = String(shift?.id || id || '').trim();
  const canAppendLogs =
    !!profile &&
    !!shift &&
    !isReadOnlyRole &&
    (role === 'admin' ||
      role === 'chief_engineer' ||
      ((role === 'operator' || role === 'master') && isShiftOwner) ||
      canMasterEditControlledShift ||
      canMasterEditOwnStationShift ||
      canMasterReviewEdit);
  const canEditStationMainForm =
    canAppendLogs &&
    !!shift &&
    shift.status !== 'Баталгаажсан' &&
    (role === 'admin' ||
      role === 'chief_engineer' ||
      canMasterEditControlledShift ||
      canMasterEditOwnStationShift ||
      canMasterReviewEdit ||
      (isShiftOwner && !shift.handoverAwaitingAcceptance && !shift.operatorShiftCompleted));
  const canReviewShiftImages = role === 'admin' || role === 'master';

  useEffect(() => {
    if (canAppendLogs) return;
    setShowMixModal(false);
    setShowQualModal(false);
    setShowHandoverModal(false);
    setShowProcessModal(false);
    setShowRecipeModal(false);
    setShowRepairModal(false);
    setStationFormModal(null);

    setShowHseModal(false);
    setShowPeriodicModal(false);
  }, [canAppendLogs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!shift) {
    const missingShiftMessage =
      loadError === 'Forbidden'
        ? 'Энэ бүртгэлийг харах эрх байхгүй байна.'
        : loadError === 'Invalid id'
          ? 'Бүртгэлийн холбоос буруу байна.'
          : 'Энэ бүртгэл устсан эсвэл олдсонгүй.';

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Бүртгэл олдсонгүй</h2>
        <p className="text-sm text-gray-500 mb-4">{missingShiftMessage}</p>
        <Link href="/" className="text-orange-600 font-bold hover:underline">Буцах</Link>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {confirmDialog.open && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-orange-600 text-white">
              <p className="text-lg font-black">{confirmDialog.title}</p>
            </div>
            <div className="p-6 space-y-6">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{confirmDialog.message}</p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmDialog((s) => ({ ...s, open: false }))}
                  className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-800 font-bold hover:bg-gray-200"
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={() => confirmDialog.onConfirm?.()}
                  className={`px-5 py-2.5 rounded-xl text-white font-bold ${confirmDialog.danger ? 'bg-orange-600 hover:bg-orange-700' : 'bg-orange-600 hover:bg-orange-700'
                    }`}
                >
                  {confirmDialog.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showEarlyCompleteDialog && (
        <div className="fixed inset-0 z-[220] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-amber-600 text-white">
              <p className="text-lg font-black">Анхааруулга</p>
            </div>
            <div className="p-6 space-y-5">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {handoverTiming.label}. Үнэхээр үргэлжлүүлэх үү?
                {shiftExpectedEndMs
                  ? `\n\nТөлөвлөсөн дуусах цаг: ${new Date(shiftExpectedEndMs).toLocaleString('mn-MN', {
                    timeZone: 'Asia/Ulaanbaatar',
                  })}`
                  : ''}
                {`\nСтандарт хугацаа: ${handoverTiming.windowLabel}`}
              </p>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Тайлбар (заавал)
                </label>
                <textarea
                  value={earlyCompleteReason}
                  onChange={(e) => setEarlyCompleteReason(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500/30 outline-none text-sm"
                  placeholder="Яагаад стандарт хугацаанаас гадуур хүлээлцэж байгаагаа бичнэ үү..."
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowEarlyCompleteDialog(false);
                    setEarlyCompleteReason('');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-800 font-bold hover:bg-gray-200"
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const reason = earlyCompleteReason.trim();
                    if (!reason) {
                      toast.warning(`${handoverTiming.label}. Тайлбараа заавал бичнэ үү.`);
                      return;
                    }
                    await completeOperatorShift(reason);
                    setShowEarlyCompleteDialog(false);
                    setEarlyCompleteReason('');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700"
                >
                  Тийм, дуусгах
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showEarlyHandoverDialog && (
        <div className="fixed inset-0 z-[220] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-amber-600 text-white">
              <p className="text-lg font-black">Анхааруулга</p>
            </div>
            <div className="p-6 space-y-5">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {handoverTiming.label}. Үргэлжлүүлэх үү?
                {`\nСтандарт хугацаа: ${handoverTiming.windowLabel}`}
              </p>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Тайлбар (заавал)
                </label>
                <textarea
                  value={earlyHandoverReason}
                  onChange={(e) => setEarlyHandoverReason(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500/30 outline-none text-sm"
                  placeholder="Яагаад стандарт хугацаанаас гадуур хүлээлцүүлж байгаагаа бичнэ үү..."
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowEarlyHandoverDialog(false);
                    setEarlyHandoverReason('');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-800 font-bold hover:bg-gray-200"
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const reason = earlyHandoverReason.trim();
                    if (!reason) {
                      toast.warning(`${handoverTiming.label}. Тайлбараа заавал бичнэ үү.`);
                      return;
                    }
                    const sent = await submitHandoverRequest(reason);
                    if (sent) {
                      setShowEarlyHandoverDialog(false);
                      setEarlyHandoverReason('');
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700"
                >
                  Тийм, үргэлжлүүлэх
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
            <ChevronLeft className="w-5 h-5" />
            <span>Буцах</span>
          </Link>
          <div className="flex flex-col items-center">
            <h1 className="text-lg font-bold text-gray-900">
              {shift.stationCode} — {shift.stationName || 'Ээлжийн бүртгэл'}
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              {shift.shiftDate} ({shift.shiftType}) — <span className="text-orange-600 font-bold">{shift.operatorName}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline whitespace-nowrap"
            >
              Самбар
            </Link>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${shift.status === 'Баталгаажсан' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
              {shift.status}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 mt-8 space-y-8">

        {/* Буцаагдсан ээлж — урьд нь буцаалт хуудсанд огт харагддаггүй байсан тул
            оператор яагаад буцаагдсаныг мэдэх аргагүй байв. */}
        {handoverStage === 'returned' && shift.status !== 'Баталгаажсан' && (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-rose-900">Ээлж хүлээлцэх буцаагдсан</p>
                <p className="mt-1 text-sm text-rose-800">
                  {shift.handoverReturnedByName
                    ? `${shift.handoverReturnedByName} буцаасан`
                    : 'Хүлээн авагч буцаасан'}
                  {shift.handoverReturnedAt
                    ? ` · ${new Date(shift.handoverReturnedAt).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })}`
                    : ''}
                </p>
                {shift.handoverReturnReason ? (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-white px-4 py-3">
                    <p className="text-xs font-bold uppercase text-rose-700">Шалтгаан</p>
                    <p className="mt-1 text-sm leading-6 text-gray-800 whitespace-pre-wrap break-words">
                      {shift.handoverReturnReason}
                    </p>
                  </div>
                ) : null}
                {profile && shift.operatorUid === profile.uid ? (
                  <p className="mt-3 text-sm font-medium text-rose-900">
                    Бүртгэлээ засаад «Хүлээлцэх хүсэлт илгээх» товчийг дахин дарна уу.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        )}

        {profile && shift.operatorUid === profile.uid && shift.status !== 'Баталгаажсан' && !completeness.ok && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-bold text-amber-900 mb-2">Дутуу бүртгэл (ээлж дуусгах / хүлээлцэхэд шаардлагатай):</p>
            <ul className="list-disc pl-5 text-sm text-amber-800 space-y-1">
              {completeness.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {canAppendLogs && profile && shift.operatorUid === profile.uid && shift.status !== 'Баталгаажсан' && (
          <section className="space-y-4">
            <div className={`border p-4 ${
              handoverTargetError
                ? 'border-amber-300 bg-amber-50'
                : 'border-emerald-200 bg-emerald-50'
            }`}>
              <div className="flex items-start gap-3">
                <CalendarClock className={`mt-0.5 h-5 w-5 shrink-0 ${
                  handoverTargetError ? 'text-amber-700' : 'text-emerald-700'
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900">
                    {isMasterStationShift ? 'Дараагийн мастерын хуваарь' : 'Дараагийн хүлээн авах хуваарь'}
                  </p>
                  {handoverTargetLoading ? (
                    <p className="mt-1 text-sm text-gray-600">Хуваарь шалгаж байна...</p>
                  ) : handoverTargets[0] ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase text-gray-500">Огноо, ээлж</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                          {handoverTargets[0].shiftDate} · {handoverTargets[0].shiftType}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase text-gray-500">Дамжлага</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">{handoverTargets[0].stationCode}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase text-gray-500">
                          {handoverTargetKind === 'master' ? 'Дараагийн мастер' : 'Дараагийн оператор'}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                          <UserRound className="h-4 w-4 text-gray-500" />
                          {handoverTargetKind === 'master'
                            ? handoverTargets[0].masterName || handoverTargets[0].masterUid
                            : handoverTargets[0].operatorName || handoverTargets[0].operatorUid}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {handoverTargetError ? (
                    <>
                      <p className="mt-2 text-sm font-medium text-amber-800">{handoverTargetError}</p>
                      <p className="mt-1 text-xs text-amber-700">
                        Хуваарь олдсонгүй тул хүлээн авах хүнийг доороос гараар сонгоно уу.
                      </p>
                    </>
                  ) : null}

                  {/* Хүлээн авах хүн ба баталгаажуулах мастерыг хүсэлт ИЛГЭЭХЭЭС ӨМНӨ
                      ҮРГЭЛЖ сонгож болно — хуваарийн санал урьдчилан бөглөгдсөн ч чөлөө
                      авсан/ажилдаа ирээгүй тохиолдолд өөр хүн сонгох боломжтой байх ёстой.
                      Харин хүсэлт аль хэдийн ИЛГЭЭГДСЭН бол (`handoverAwaitingAcceptance`)
                      сонголт сервер дээр бэхжсэн тул цаашид энд өөрчлөх боломжгүй, зөвхөн
                      харна — эс бөгөөс аль хэдийн илгээсэн сонголтоо санамсаргүй дарж
                      болзошгүй. */}
                  {!handoverTargetLoading ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-[11px] font-bold uppercase text-gray-500">
                          {isMasterStationShift ? 'Хүлээн авах дараагийн мастер' : 'Хүлээн авах дараагийн оператор'}
                        </label>
                        <div className="mt-1">
                          {shift.handoverAwaitingAcceptance ? (
                            <LockedSelection
                              value={isMasterStationShift ? shift.nextMasterName || manualNextMasterName : shift.nextOperatorName || manualNextOperatorName}
                            />
                          ) : isMasterStationShift ? (
                            <RoleUserSelect
                              roles={['master']}
                              value={manualNextMasterUid}
                              onChange={(uid, user) => { setManualNextMasterUid(uid); setManualNextMasterName(user?.label || ''); }}
                              placeholder="Мастер сонгох..."
                            />
                          ) : (
                            <RoleUserSelect
                              roles={['operator']}
                              value={manualNextOperatorUid}
                              onChange={(uid, user) => { setManualNextOperatorUid(uid); setManualNextOperatorName(user?.label || ''); }}
                              placeholder="Оператор сонгох..."
                            />
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-gray-500">
                          {shift.handoverAwaitingAcceptance
                            ? 'Хүсэлт илгээгдсэн тул энд өөрчлөх боломжгүй.'
                            : 'Хуваарийн санал урьдчилан бөглөгдсөн — таарахгүй бол өөрчилнө үү.'}
                        </p>
                      </div>
                      {!isMasterStationShift ? (
                        <div>
                          <label className="text-[11px] font-bold uppercase text-gray-500">
                            Баталгаажуулах мастер
                          </label>
                          <div className="mt-1">
                            {shift.handoverAwaitingAcceptance ? (
                              <LockedSelection value={shift.currentMasterName || manualConfirmMasterName} />
                            ) : (
                              <RoleUserSelect
                                roles={['master']}
                                value={manualConfirmMasterUid}
                                onChange={(uid, user) => { setManualConfirmMasterUid(uid); setManualConfirmMasterName(user?.label || ''); }}
                                placeholder="Мастер сонгох..."
                              />
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-gray-500">
                            {shift.handoverAwaitingAcceptance
                              ? 'Хүсэлт илгээгдсэн тул энд өөрчлөх боломжгүй.'
                              : 'Хоосон бол багийн мастер автоматаар сонгогдоно.'}
                          </p>
                          {!shift.handoverAwaitingAcceptance && confirmMasterWarningText ? (
                            <p
                              role="alert"
                              className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-800"
                            >
                              {confirmMasterWarningText}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <div>
                          <label className="text-[11px] font-bold uppercase text-gray-500">
                            Батлах админ
                          </label>
                          <div className="mt-1">
                            {shift.handoverAwaitingAcceptance ? (
                              <LockedSelection value={shift.approvalAdminName || manualApprovalAdminName} />
                            ) : (
                              <RoleUserSelect
                                roles={['admin', 'chief_engineer']}
                                value={manualApprovalAdminUid}
                                onChange={(uid, user) => { setManualApprovalAdminUid(uid); setManualApprovalAdminName(user?.label || ''); }}
                                placeholder="Админ сонгох..."
                              />
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-gray-500">
                            {shift.handoverAwaitingAcceptance
                              ? 'Хүсэлт илгээгдсэн тул энд өөрчлөх боломжгүй.'
                              : 'Мэдэгдэл түүн рүү очно. Шаардлагатай бол өөр админ мөн батална.'}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            {unsentNotice ? (
              <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div>
                  <p className="text-sm font-bold text-red-800">{unsentNotice.title}</p>
                  <p className="mt-1 text-sm text-red-700">{unsentNotice.body}</p>
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleOperatorCompleteShift}
                disabled={!!shift.operatorShiftCompleted}
                className="px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {shift.operatorShiftCompleted ? 'Ээлж дууссан' : 'Ээлж дуусгах'}
              </button>
              {!isHandoverFullyAccepted && !shift.adminApproved && (
                <button
                  type="button"
                  onClick={handleRequestHandover}
                  disabled={shift.handoverAwaitingAcceptance}
                  className="px-6 py-3 bg-orange-600 text-white rounded-xl text-sm font-bold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {shift.handoverAwaitingAcceptance
                    ? 'Хүлээлцэх хүсэлт илгээгдсэн'
                    : 'Хүлээлцэх хүсэлт илгээх'}
                </button>
              )}
            </div>
          </section>
        )}

        {(shift.handoverTimingStatus || shift.handoverTimingReason) && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black text-amber-900">Ээлж хүлээлцэх хугацааны тэмдэглэл</p>
                {shift.handoverTimingStatus ? (
                  <p className="mt-1 text-sm font-bold text-amber-800">{shift.handoverTimingStatus}</p>
                ) : null}
              </div>
              {shift.handoverTimingRecordedAt ? (
                <p className="text-xs font-bold text-amber-700">{new Date(shift.handoverTimingRecordedAt).toLocaleString()}</p>
              ) : null}
            </div>
            {shift.handoverTimingReason ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-white px-4 py-3">
                <p className="text-xs font-bold uppercase text-amber-700">Тайлбар</p>
                <p className="mt-1 text-sm leading-6 text-gray-800 whitespace-pre-wrap break-words">{shift.handoverTimingReason}</p>
              </div>
            ) : null}
          </section>
        )}

        {shift.handoverAwaitingAcceptance && canAcceptHandover && profile && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h3 className="font-bold text-emerald-900">{handoverStageLabel}</h3>
                <p className="text-sm text-emerald-800 mt-1">
                  {shift.stationCode} — өмнөх ээлжийн бүртгэлийг шалгаж, хүлээн авах/буцаах шийдвэр гаргана уу.
                </p>
              </div>
              <div className="flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleReturnHandover}
                  className="px-5 py-2.5 bg-white text-emerald-800 rounded-xl text-sm font-bold border border-emerald-200 hover:bg-emerald-50"
                >
                  Буцаах
                </button>
                <button
                  type="button"
                  onClick={handleAcceptHandover}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700"
                >
                  {handoverActionLabel}
                </button>
              </div>
            </div>

            {handoverStage === 'waiting_current_master' ? (
              <div className={`border p-4 ${
                handoverTargetError
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-emerald-200 bg-white'
              }`}>
                <p className="text-xs font-bold uppercase text-gray-600">Дараагийн хүлээн авах хуваарь</p>
                {handoverTargetLoading ? (
                  <p className="mt-2 text-sm text-gray-600">Хуваарь шалгаж байна...</p>
                ) : handoverTargets[0] ? (
                  <p className="mt-2 text-sm font-semibold text-gray-900">
                    {handoverTargets[0].shiftDate} · {handoverTargets[0].shiftType} ·{' '}
                    {handoverTargets[0].stationCode} ·{' '}
                    {handoverTargets[0].operatorName || handoverTargets[0].operatorUid}
                  </p>
                ) : null}
                {handoverTargetError ? (
                  <>
                    <p className="mt-2 text-sm font-medium text-amber-800">{handoverTargetError}</p>
                    <p className="mt-1 text-xs text-amber-700">
                      {shift.nextOperatorName
                        ? 'Ээлж дуусгасан оператор дараагийн операторыг аль хэдийн сонгож илгээсэн байна.'
                        : 'Доороос дараагийн операторыг гараар сонгож болно. Сонгохгүй бол баталгаажуулсны дараа ээлж хүлээлцэлт хаагдаж, master/admin final approval руу шилжинэ.'}
                    </p>
                  </>
                ) : null}
                {!handoverTargetLoading ? (
                  <div className="mt-3 max-w-xs">
                    <label className="text-[11px] font-bold uppercase text-gray-500">
                      Дараагийн оператор
                    </label>
                    {shift.nextOperatorName ? (
                      // Ээлж дуусгаж буй оператор дараагийн операторыг аль хэдийн сонгож
                      // хадгалуулсан тул мастер энд ирээд ӨӨРЧЛӨХГҮЙ, зөвхөн харна —
                      // урьд нь энд дахин сонгуулдаг байсан нь оператор өмнө нь илгээсэн
                      // сонголтоо санамсаргүй дарж болзошгүй bug байсан тул хоригложээ.
                      <div className="mt-1">
                        <LockedSelection value={shift.nextOperatorName} />
                      </div>
                    ) : (
                      <div className="mt-1">
                        <RoleUserSelect
                          roles={['operator']}
                          value={manualNextOperatorUid}
                          onChange={(uid, user) => { setManualNextOperatorUid(uid); setManualNextOperatorName(user?.label || ''); }}
                          placeholder="Оператор сонгох..."
                        />
                      </div>
                    )}
                    <p className="mt-1 text-[11px] text-gray-500">
                      {shift.nextOperatorName
                        ? 'Ээлж дуусгасан оператор сонгосон тул энд өөрчлөх боломжгүй.'
                        : 'Сонгосон хүн хуваарийг дарна. Хоосон бол хуваарийн дагуу.'}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-xs font-bold text-emerald-800 uppercase">Тайлбар (сонголттой)</label>
              <textarea
                value={handoverDecisionNote}
                onChange={(e) => setHandoverDecisionNote(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-emerald-200 bg-white focus:ring-2 focus:ring-emerald-500/30 outline-none text-sm"
                rows={3}
                placeholder="Хүлээлцэхэд тайлбар нэмэх бол энд бичнэ..."
              />
            </div>
          </section>
        )}

        {shift.handoverAwaitingAcceptance && profile?.uid === shift.operatorUid && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            Таны хүлээлцүүлсэн ээлжийг дараагийн оператор эсвэл мастер «Хүлээн авсан» гэж баталгаажуулахыг хүлээнэ.
          </div>
        )}

        {/* Shift Info */}
        <section id="shift-info" className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-8 scroll-mt-24">
          <InfoItem label="Оператор" value={shift.operatorName} />
          <InfoItem label="Ээлжийн дугаар" value={shift.shiftNumber} />
          <InfoItem label="Эхэлсэн цаг" value={new Date(shift.checkIn).toLocaleTimeString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })} />
          <InfoItem label="Төлөв" value={shift.status} />
          {shift.checkOut ? <InfoItem label="Дууссан цаг" value={new Date(shift.checkOut).toLocaleTimeString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })} /> : null}
        </section>

        {y110Images.length > 0 && (
          <ShiftImageReviewPanel
            shiftId={effectiveShiftId}
            images={y110Images}
            canReview={canReviewShiftImages}
            onImagesChange={setY110Images}
          />
        )}

        {/* `id="station-form"` — dashboard-ийн "Шинэ бүртгэл / Харах" холбоосууд энд заана.
            Доорх гурван салбар нь харилцан үл нийцэх тул id давхардахгүй. */}
        {isMasterStationShift && masterStationFormConfig(shift.stationCode) ? (
          <div id="station-form" className="scroll-mt-24">
            <MasterStationFormSection
              stationCode={shift.stationCode}
              stationForms={stationForms}
              shift={shift}
              canEdit={canEditStationMainForm}
              onEdit={() => {
                const config = masterStationFormConfig(shift.stationCode);
                if (!config) return;
                setStationFormModal({
                  kind: config.formKind,
                  stationCode: config.stationCode,
                  title: config.title,
                });
              }}
            />
          </div>
        ) : null}

        {/* ТЭМДЭГЛЭЛ: Урьд нь энд «хариуцах мастерын ӨӨРИЙНХ нь станцын маягт»-ыг
            операторын ээлжийн хуудсанд шингээж харуулдаг байсныг ХАССАН (2026-08).
            Шалтгаан: `stationForms` нь тухайн ээлжийн өөрийнх нь modalLogs-оос
            уншигддаг тул (дээрх `setStationForms`) нэг мастер багийнхаа 11 операторын
            хуудас бүр дээр ижил маягтыг ТУСДАА бөглөх ёстой болж, нэг ээлжид нэг удаа
            бөглөх ёстой бүртгэл 11 хувь давхардаж байв. Мөн `lib/crew-master.ts` нь
            хуваарьтай мастерыг эхэлж сонгодог тул ҮЯ-181/ҮЯ-410 зэрэг тусгай мастер
            бүх дамжлагын операторын хуудсанд гэнэт гарч ирдэг байсан. Мастер өөрийн
            маягтаа ЗӨВХӨН өөрийн ээлжийн хуудсан дээр бөглөнө (дээрх салбар). */}

        {shift.stationCode === 'ҮЯ-110' && (
          <section id="station-form" className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-4 scroll-mt-24">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-bold text-gray-900">ҮЯ-110 эхлэх үзлэг</h3>
                <p className="text-sm text-gray-500 mt-1">Ээлж эхэлсний дараа бүртгэнэ.</p>
              </div>
              {canAppendLogs &&
                profile?.uid === shift.operatorUid &&
                shift.status !== 'Баталгаажсан' &&
                !shift.operatorShiftCompleted && (
                  <button
                    type="button"
                    onClick={() => setShowY110StartEdit(true)}
                    className="px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
                  >
                    {y110StartForm ? 'Засах' : 'Бүртгэх'}
                  </button>
                )}
            </div>
            {y110StartForm ? (
              <Y110StartFormReadOnly data={y110StartForm} />
            ) : (
              <p className="text-sm text-gray-500">Бүртгэл хийгдээгүй.</p>
            )}
            {y110Images.length > 0 && (
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <h4 className="text-sm font-bold text-gray-900">Хавсаргасан зургууд</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {y110Images.map((image) => (
                    <a
                      key={image.id}
                      href={image.url || image.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl border border-gray-200 overflow-hidden bg-white hover:border-orange-300"
                    >
                      <div className="relative aspect-video bg-gray-100">
                        <Image
                          src={(image.url || image.publicUrl) as string}
                          alt={image.caption || image.rowLabel || 'Зураг'}
                          fill
                          sizes="(min-width: 768px) 25vw, 50vw"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="p-2">
                        <p className="text-[11px] font-bold text-gray-700 truncate">
                          {image.rowLabel || 'Үзлэгийн зураг'}
                        </p>
                        {image.caption ? (
                          <p className="text-[11px] text-gray-500 truncate">{image.caption}</p>
                        ) : null}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Station main form (like ҮЯ-110 pattern) */}
        {shift.stationCode !== 'ҮЯ-110' && !isMasterStationShift && (
          <section id="station-form" className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-4 scroll-mt-24">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-bold text-gray-900">
                  {shift.stationCode} — {shift.stationName || 'Ээлжийн бүртгэл'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">Ээлжийн явцад бүртгэнэ.</p>
              </div>
              {canEditStationMainForm && (
                <button
                  type="button"
                  onClick={() => {
                    const sc = String(shift.stationCode || '');
                    if (sc === 'ҮЯ-099') {
                      setStationFormModal({
                        kind: 'y099_master_handover_v1',
                        stationCode: sc,
                        title: 'ҮЯ-099: Ээлжийн мастерын ээлж хүлээлцэх бүртгэл',
                      });
                      return;
                    }
                    const title = `${sc} — ${shift.stationName || 'Ээлжийн бүртгэл'}`;
                    const kind =
                      sc === 'ҮЯ-120'
                        ? 'y120_handover_form'
                        : sc === 'ҮЯ-121'
                          ? 'y121_handover_form'
                          : sc === 'ҮЯ-130'
                            ? 'y130_handover_form'
                            : sc === 'ҮЯ-140'
                              ? 'y140_handover_form'
                              : sc === 'ҮЯ-150'
                                ? 'y150_handover_form'
                                : sc === 'ҮЯ-160'
                                  ? 'y160_handover_form'
                                  : sc === 'ҮЯ-161'
                                    ? 'y161_handover_form'
                                    : sc === 'ҮЯ-170'
                                      ? 'y170_packing_operator_form'
                                      : sc === 'ҮЯ-180'
                                        ? 'y180_autoclave_operator_form'
                                        : sc === 'ҮЯ-190'
                                          ? 'y190_handover_form'
                                          : sc === 'ҮЯ-210'
                                            ? 'y210_technology_kiln_operator_form'
                                            : sc === 'ҮЯ-310'
                                              ? 'y310_repair_master_form'
                                              : sc === 'ҮЯ-320'
                                                ? 'y320_electrical_automation_repair_form'
                                                : sc === 'ҮЯ-400'
                                                  ? 'factory_process_control_form'
                                                  : sc === 'ҮЯ-410'
                                                    ? 'cah02_electrical_control_form'
                                                    : sc === 'ОНБ'
                                                      ? 'ingredient_change_record_form'
                                                      : '';
                    if (!kind) return;
                    setStationFormModal({ kind, stationCode: sc, title });
                  }}
                  className="px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
                >
                  {(() => {
                    const sc = String(shift.stationCode || '');
                    if (sc === 'ҮЯ-099') return stationForms?.y099_master_handover_v1 ? 'Засах' : 'Бүртгэх';
                    const kind =
                      sc === 'ҮЯ-120'
                        ? 'y120_handover_form'
                        : sc === 'ҮЯ-121'
                          ? 'y121_handover_form'
                          : sc === 'ҮЯ-130'
                            ? 'y130_handover_form'
                            : sc === 'ҮЯ-140'
                              ? 'y140_handover_form'
                              : sc === 'ҮЯ-150'
                                ? 'y150_handover_form'
                                : sc === 'ҮЯ-160'
                                  ? 'y160_handover_form'
                                  : sc === 'ҮЯ-161'
                                    ? 'y161_handover_form'
                                    : sc === 'ҮЯ-170'
                                      ? 'y170_packing_operator_form'
                                      : sc === 'ҮЯ-180'
                                        ? 'y180_autoclave_operator_form'
                                        : sc === 'ҮЯ-190'
                                          ? 'y190_handover_form'
                                          : sc === 'ҮЯ-210'
                                            ? 'y210_technology_kiln_operator_form'
                                            : sc === 'ҮЯ-310'
                                              ? 'y310_repair_master_form'
                                              : sc === 'ҮЯ-320'
                                                ? 'y320_electrical_automation_repair_form'
                                                : sc === 'ҮЯ-400'
                                                  ? 'factory_process_control_form'
                                                  : sc === 'ҮЯ-410'
                                                    ? 'cah02_electrical_control_form'
                                                    : sc === 'ОНБ'
                                                      ? 'ingredient_change_record_form'
                                                      : '';
                    const existing = kind ? stationForms[kind] : null;
                    // fall back to reconstructPayload fields for legacy
                    const legacyKey =
                      sc === 'ҮЯ-120'
                        ? 'y120HandoverForm'
                        : sc === 'ҮЯ-121'
                          ? 'y121HandoverForm'
                          : sc === 'ҮЯ-130'
                            ? 'y130HandoverForm'
                            : sc === 'ҮЯ-140'
                              ? 'y140HandoverForm'
                              : sc === 'ҮЯ-150'
                                ? 'y150HandoverForm'
                                : sc === 'ҮЯ-160'
                                  ? 'y160HandoverForm'
                                  : sc === 'ҮЯ-161'
                                    ? 'y161HandoverForm'
                                    : sc === 'ҮЯ-170'
                                      ? 'y170PackingOperatorForm'
                                      : sc === 'ҮЯ-180'
                                        ? 'y180AutoclaveOperatorForm'
                                        : sc === 'ҮЯ-190'
                                          ? 'y190HandoverForm'
                                          : sc === 'ҮЯ-210'
                                            ? 'y210TechnologyKilnOperatorForm'
                                            : sc === 'ҮЯ-310'
                                              ? 'y310RepairMasterForm'
                                              : sc === 'ҮЯ-320'
                                                ? 'y320ElectricalAutomationRepairForm'
                                                : sc === 'ҮЯ-400'
                                                  ? 'factoryProcessControlForm'
                                                  : sc === 'ҮЯ-410'
                                                    ? 'cah02ElectricalControlForm'
                                                    : sc === 'ОНБ'
                                                      ? 'ingredientChangeRecordForm'
                                                      : '';
                    const legacy = legacyKey ? (shift as any)[legacyKey] : null;
                    return existing || legacy ? 'Засах' : 'Бүртгэх';
                  })()}
                </button>
              )}
            </div>

            {(() => {
              const sc = String(shift.stationCode || '');
              if (sc === 'ҮЯ-099') {
                const data = stationForms?.y099_master_handover_v1 || null;
                if (!data) return <p className="text-sm text-gray-500">Бүртгэл хийгдээгүй.</p>;
                return (
                  <Y099ShiftMasterHandoverReadOnly
                    data={data}
                    receivingMasterName={resolveReceivingName(shift.handoverAcceptedByName, shift.nextMasterName)}
                  />
                );
              }
              const kind =
                sc === 'ҮЯ-120'
                  ? 'y120_handover_form'
                  : sc === 'ҮЯ-121'
                    ? 'y121_handover_form'
                    : sc === 'ҮЯ-130'
                      ? 'y130_handover_form'
                      : sc === 'ҮЯ-140'
                        ? 'y140_handover_form'
                        : sc === 'ҮЯ-150'
                          ? 'y150_handover_form'
                          : sc === 'ҮЯ-160'
                            ? 'y160_handover_form'
                            : sc === 'ҮЯ-161'
                              ? 'y161_handover_form'
                              : sc === 'ҮЯ-170'
                                ? 'y170_packing_operator_form'
                                : sc === 'ҮЯ-180'
                                  ? 'y180_autoclave_operator_form'
                                  : sc === 'ҮЯ-190'
                                    ? 'y190_handover_form'
                                    : sc === 'ҮЯ-210'
                                      ? 'y210_technology_kiln_operator_form'
                                      : sc === 'ҮЯ-310'
                                        ? 'y310_repair_master_form'
                                        : sc === 'ҮЯ-320'
                                          ? 'y320_electrical_automation_repair_form'
                                          : sc === 'ҮЯ-400'
                                            ? 'factory_process_control_form'
                                            : sc === 'ҮЯ-410'
                                              ? 'cah02_electrical_control_form'
                                              : sc === 'ОНБ'
                                                ? 'ingredient_change_record_form'
                                                : '';
              const legacyKey =
                sc === 'ҮЯ-120'
                  ? 'y120HandoverForm'
                  : sc === 'ҮЯ-121'
                    ? 'y121HandoverForm'
                    : sc === 'ҮЯ-130'
                      ? 'y130HandoverForm'
                      : sc === 'ҮЯ-140'
                        ? 'y140HandoverForm'
                        : sc === 'ҮЯ-150'
                          ? 'y150HandoverForm'
                          : sc === 'ҮЯ-160'
                            ? 'y160HandoverForm'
                            : sc === 'ҮЯ-161'
                              ? 'y161HandoverForm'
                              : sc === 'ҮЯ-170'
                                ? 'y170PackingOperatorForm'
                                : sc === 'ҮЯ-180'
                                  ? 'y180AutoclaveOperatorForm'
                                  : sc === 'ҮЯ-190'
                                    ? 'y190HandoverForm'
                                    : sc === 'ҮЯ-210'
                                      ? 'y210TechnologyKilnOperatorForm'
                                      : sc === 'ҮЯ-310'
                                        ? 'y310RepairMasterForm'
                                        : sc === 'ҮЯ-320'
                                          ? 'y320ElectricalAutomationRepairForm'
                                          : sc === 'ҮЯ-400'
                                            ? 'factoryProcessControlForm'
                                            : sc === 'ҮЯ-410'
                                              ? 'cah02ElectricalControlForm'
                                              : sc === 'ОНБ'
                                                ? 'ingredientChangeRecordForm'
                                                : '';
              const existing = kind ? stationForms[kind] : null;
              const legacy = legacyKey ? (shift as any)[legacyKey] : null;
              const data = existing || legacy;
              if (!data) return <p className="text-sm text-gray-500">Бүртгэл хийгдээгүй.</p>;

              if (sc === 'ҮЯ-120') return <Y120HandoverFormReadOnly data={data} />;
              if (sc === 'ҮЯ-121') return <Y121HandoverFormReadOnly data={data} />;
              if (sc === 'ҮЯ-130') return <Y130HandoverFormReadOnly data={data} />;
              if (sc === 'ҮЯ-140') return <Y140HandoverFormReadOnly data={data} />;
              if (sc === 'ҮЯ-150') return <Y150HandoverFormReadOnly data={data} />;
              if (sc === 'ҮЯ-160') return <Y160HandoverFormReadOnly data={data} />;
              if (sc === 'ҮЯ-161') return <Y170HandoverFormReadOnly data={data} />;
              if (sc === 'ҮЯ-170') return <Y170PackingOperatorReadOnly data={data} />;
              if (sc === 'ҮЯ-180') return <Y180AutoclaveOperatorReadOnly data={data} />;
              if (sc === 'ҮЯ-190') return <Y190HandoverFormReadOnly data={data} />;
              if (sc === 'ҮЯ-210') return <Y210TechnologyKilnOperatorReadOnly data={data} />;
              if (sc === 'ҮЯ-310') return (
                <Y310RepairMasterHandoverReadOnly
                  data={data}
                  receivingMasterName={resolveReceivingName(shift.handoverAcceptedByName, shift.nextMasterName)}
                />
              );
              if (sc === 'ҮЯ-320') return (
                <Y320ElectricalAutomationRepairReadOnly
                  data={data}
                  receivingName={resolveReceivingName(shift.handoverAcceptedByName, shift.nextOperatorName)}
                />
              );
              if (sc === 'ҮЯ-400') return <FactoryProcessControlReadOnly data={data} />;
              if (sc === 'ҮЯ-410') return (
                <CAH02ElectricalControlReadOnly
                  data={data}
                  receivingMasterName={resolveReceivingName(shift.handoverAcceptedByName, shift.nextMasterName)}
                />
              );
              if (sc === 'ОНБ') return <IngredientChangeRecordReadOnly data={data} />;
              return <p className="text-sm text-gray-500">Бүртгэл хийгдээгүй.</p>;
            })()}
          </section>
        )}

        {showY110StartEdit && shift.stationCode === 'ҮЯ-110' && (
          <div className="fixed inset-0 z-[120] bg-black/40 overflow-y-auto">
            <div className="min-h-full flex items-start justify-center p-4">
              <div className="w-full max-w-3xl bg-white rounded-3xl shadow-xl max-h-[calc(100vh-2rem)] overflow-y-auto">
                <Y110CementPumpStartForm
                  shiftDate={String(shift.shiftDate || '').slice(0, 10)}
                  shiftType={(shift.shiftType as any) || 'Өдрийн'}
                  operatorName={shift.operatorName || profile?.displayName || profile?.email || ''}
                  operatorUid={shift.operatorUid || profile?.uid || ''}
                  initialPayload={y110StartForm}
                  shiftId={effectiveShiftId}
                  initialImages={y110Images}
                  onImagesChange={setY110Images}
                  onBack={() => setShowY110StartEdit(false)}
                  onSubmit={handleSaveY110StartForm}
                  submitting={y110Saving}
                />
              </div>
            </div>
          </div>
        )}

        {stationFormModal && (
          <div className="fixed inset-0 z-[120] bg-black/40 overflow-y-auto">
            <div className="min-h-full flex items-start justify-center p-4">
              <div className="w-[95vw] max-w-7xl bg-white rounded-3xl shadow-xl max-h-[calc(100vh-2rem)] overflow-y-auto">
                {stationFormModal.stationCode === 'ҮЯ-099' ? (
                  <Y099ShiftMasterHandoverForm
                    shiftDate={String(shift.shiftDate || '').slice(0, 10)}
                    shiftType={((shift.shiftType as any) || 'Өдрийн') as any}
                    masterUid={shift.operatorUid || profile?.uid || ''}
                    masterName={shift.operatorName || profile?.displayName || profile?.email || ''}
                    initialPayload={{
                      ...(stationForms[stationFormModal.kind] || {}),
                      environmentChecks: preferEnvironmentChecks(
                        stationForms.y099_master_handover_v1?.environmentChecks,
                        stationForms.factory_process_control_form?.environmentChecks ?? (shift as any).factoryProcessControlForm?.environmentChecks
                      ),
                    }}
                    shiftId={shift.id}
                    onBack={() => setStationFormModal(null)}
                    onSubmit={(p) => saveStationModalForm(stationFormModal.kind, p)}
                    submitting={stationSaving}
                  />
                ) : stationFormModal.stationCode === 'ҮЯ-120' ? (
                  <Y120LimeMillHandoverForm
                    shiftDate={String(shift.shiftDate || '').slice(0, 10)}
                    shiftType={(shift.shiftType as any) || 'Өдрийн'}
                    operatorName={shift.operatorName || profile?.displayName || profile?.email || ''}
                    operatorUid={shift.operatorUid || profile?.uid || ''}
                    initialPayload={stationForms[stationFormModal.kind] || (shift as any).y120HandoverForm}
                    shiftId={effectiveShiftId}
                    initialImages={y110Images}
                    onImagesChange={setY110Images}
                    onBack={() => setStationFormModal(null)}
                    onSubmit={(p) => saveStationModalForm(stationFormModal.kind, p)}
                    submitting={stationSaving}
                    submitLabel="Бүртгэл хадгалах"
                    showSubmitButton={profile?.uid === shift.operatorUid || role === 'admin' || role === 'chief_engineer' || canMasterEditControlledShift || canMasterReviewEdit}
                  />
                ) : stationFormModal.stationCode === 'ҮЯ-121' ? (
                  <Y121BallMillHandoverForm
                    shiftDate={String(shift.shiftDate || '').slice(0, 10)}
                    shiftType={(shift.shiftType as any) || 'Өдрийн'}
                    operatorName={shift.operatorName || profile?.displayName || profile?.email || ''}
                    operatorUid={shift.operatorUid || profile?.uid || ''}
                    initialPayload={stationForms[stationFormModal.kind] || (shift as any).y121HandoverForm}
                    shiftId={effectiveShiftId}
                    initialImages={y110Images}
                    onImagesChange={setY110Images}
                    onBack={() => setStationFormModal(null)}
                    onSubmit={(p) => saveStationModalForm(stationFormModal.kind, p)}
                    submitting={stationSaving}
                  />
                ) : stationFormModal.stationCode === 'ҮЯ-130' ? (
                  <Y130MixingTowerHandoverForm
                    shiftDate={String(shift.shiftDate || '').slice(0, 10)}
                    shiftType={(shift.shiftType as any) || 'Өдрийн'}
                    operatorName={shift.operatorName || profile?.displayName || profile?.email || ''}
                    operatorUid={shift.operatorUid || profile?.uid || ''}
                    initialPayload={stationForms[stationFormModal.kind] || (shift as any).y130HandoverForm}
                    shiftId={effectiveShiftId}
                    initialImages={y110Images}
                    onImagesChange={setY110Images}
                    onBack={() => setStationFormModal(null)}
                    onSubmit={(p) => saveStationModalForm(stationFormModal.kind, p)}
                    submitting={stationSaving}
                  />
                ) : stationFormModal.stationCode === 'ҮЯ-140' ? (
                  <Y140MoldRotationHandoverForm
                    shiftDate={String(shift.shiftDate || '').slice(0, 10)}
                    shiftType={(shift.shiftType as any) || 'Өдрийн'}
                    operatorName={shift.operatorName || profile?.displayName || profile?.email || ''}
                    operatorUid={shift.operatorUid || profile?.uid || ''}
                    initialPayload={stationForms[stationFormModal.kind] || (shift as any).y140HandoverForm}
                    shiftId={shift.id}
                    initialImages={y110Images}
                    onImagesChange={setY110Images}
                    onBack={() => setStationFormModal(null)}
                    onSubmit={(p) => saveStationModalForm(stationFormModal.kind, p)}
                    submitting={stationSaving}
                  />
                ) : stationFormModal.stationCode === 'ҮЯ-150' ? (
                  <Y150CuttingLineHandoverForm
                    shiftDate={String(shift.shiftDate || '').slice(0, 10)}
                    shiftType={(shift.shiftType as any) || 'Өдрийн'}
                    operatorName={shift.operatorName || profile?.displayName || profile?.email || ''}
                    operatorUid={shift.operatorUid || profile?.uid || ''}
                    initialPayload={stationForms[stationFormModal.kind] || (shift as any).y150HandoverForm}
                    shiftId={shift.id}
                    initialImages={y110Images}
                    onImagesChange={setY110Images}
                    onBack={() => setStationFormModal(null)}
                    onSubmit={(p) => saveStationModalForm(stationFormModal.kind, p)}
                    submitting={stationSaving}
                  />
                ) : stationFormModal.stationCode === 'ҮЯ-160' ? (
                  <Y160RamRotationHandoverForm
                    shiftDate={String(shift.shiftDate || '').slice(0, 10)}
                    shiftType={(shift.shiftType as any) || 'Өдрийн'}
                    operatorName={shift.operatorName || profile?.displayName || profile?.email || ''}
                    operatorUid={shift.operatorUid || profile?.uid || ''}
                    initialPayload={stationForms[stationFormModal.kind] || (shift as any).y160HandoverForm}
                    shiftId={shift.id}
                    initialImages={y110Images}
                    onImagesChange={setY110Images}
                    onBack={() => setStationFormModal(null)}
                    onSubmit={(p) => saveStationModalForm(stationFormModal.kind, p)}
                    submitting={stationSaving}
                  />
                ) : stationFormModal.stationCode === 'ҮЯ-161' ? (
                  <Y170TrolleyRotationHandoverForm
                    shiftDate={String(shift.shiftDate || '').slice(0, 10)}
                    shiftType={(shift.shiftType as any) || 'Өдрийн'}
                    operatorName={shift.operatorName || profile?.displayName || profile?.email || ''}
                    operatorUid={shift.operatorUid || profile?.uid || ''}
                    initialPayload={stationForms[stationFormModal.kind] || (shift as any).y161HandoverForm}
                    shiftId={shift.id}
                    initialImages={y110Images}
                    onImagesChange={setY110Images}
                    onBack={() => setStationFormModal(null)}
                    onSubmit={(p) => saveStationModalForm(stationFormModal.kind, p)}
                    submitting={stationSaving}
                  />
                ) : stationFormModal.stationCode === 'ҮЯ-170' ? (
                  <Y170PackingOperatorForm
                    shiftDate={String(shift.shiftDate || '').slice(0, 10)}
                    shiftType={(shift.shiftType as any) || 'Өдрийн'}
                    operatorName={shift.operatorName || profile?.displayName || profile?.email || ''}
                    operatorUid={shift.operatorUid || profile?.uid || ''}
                    initialPayload={stationForms[stationFormModal.kind] || (shift as any).y170PackingOperatorForm}
                    shiftId={shift.id}
                    initialImages={y110Images}
                    onImagesChange={setY110Images}
                    onBack={() => setStationFormModal(null)}
                    onSubmit={(p) => saveStationModalForm(stationFormModal.kind, p)}
                    submitting={stationSaving}
                  />
                ) : stationFormModal.stationCode === 'ҮЯ-180' ? (
                  <Y180AutoclaveOperatorForm
                    shiftDate={String(shift.shiftDate || '').slice(0, 10)}
                    shiftType={(shift.shiftType as any) || 'Өдрийн'}
                    operatorName={shift.operatorName || profile?.displayName || profile?.email || ''}
                    operatorUid={shift.operatorUid || profile?.uid || ''}
                    initialPayload={stationForms[stationFormModal.kind] || (shift as any).y180AutoclaveOperatorForm}
                    shiftId={shift.id}
                    initialImages={y110Images}
                    onImagesChange={setY110Images}
                    onBack={() => setStationFormModal(null)}
                    onSubmit={(p) => saveStationModalForm(stationFormModal.kind, p)}
                    submitting={stationSaving}
                  />
                ) : stationFormModal.stationCode === 'ҮЯ-190' ? (
                  <Y190QualityInspectorHandoverForm
                    shiftDate={String(shift.shiftDate || '').slice(0, 10)}
                    shiftType={(shift.shiftType as any) || 'Өдрийн'}
                    operatorName={shift.operatorName || profile?.displayName || profile?.email || ''}
                    operatorUid={shift.operatorUid || profile?.uid || ''}
                    initialPayload={stationForms[stationFormModal.kind] || (shift as any).y190HandoverForm}
                    shiftId={shift.id}
                    initialImages={y110Images}
                    onImagesChange={setY110Images}
                    onBack={() => setStationFormModal(null)}
                    onSubmit={(p) => saveStationModalForm(stationFormModal.kind, p)}
                    submitting={stationSaving}
                  />
                ) : stationFormModal.stationCode === 'ҮЯ-210' ? (
                  <Y210TechnologyKilnOperatorForm
                    shiftDate={String(shift.shiftDate || '').slice(0, 10)}
                    shiftType={(shift.shiftType as any) || 'Өдрийн'}
                    operatorName={shift.operatorName || profile?.displayName || profile?.email || ''}
                    operatorUid={shift.operatorUid || profile?.uid || ''}
                    initialPayload={stationForms[stationFormModal.kind] || (shift as any).y210TechnologyKilnOperatorForm}
                    shiftId={shift.id}
                    initialImages={y110Images}
                    onImagesChange={setY110Images}
                    onBack={() => setStationFormModal(null)}
                    onSubmit={(p) => saveStationModalForm(stationFormModal.kind, p)}
                    submitting={stationSaving}
                  />
                ) : stationFormModal.stationCode === 'ҮЯ-310' ? (
                  <Y310RepairMasterHandoverForm
                    shiftDate={String(shift.shiftDate || '').slice(0, 10)}
                    shiftType={(shift.shiftType as any) || 'Өдрийн'}
                    receivingMasterName={resolveReceivingName(shift.handoverAcceptedByName, shift.nextMasterName)}
                    operatorName={stationFormModal.stationCode === shift.stationCode ? (shift.operatorName || profile?.displayName || profile?.email || '') : (shift.currentMasterName || profile?.displayName || profile?.email || '')}
                    operatorUid={stationFormModal.stationCode === shift.stationCode ? (shift.operatorUid || profile?.uid || '') : (shift.shiftMasterUid || '')}
                    initialPayload={stationForms[stationFormModal.kind] || (shift as any).y310RepairMasterForm}
                    shiftId={shift.id}
                    initialImages={y110Images}
                    onImagesChange={setY110Images}
                    onBack={() => setStationFormModal(null)}
                    onSubmit={(p) => saveStationModalForm(stationFormModal.kind, p)}
                    submitting={stationSaving}
                  />
                ) : stationFormModal.stationCode === 'ҮЯ-320' ? (
                  <Y320ElectricalAutomationRepairForm
                    receivingName={resolveReceivingName(shift.handoverAcceptedByName, shift.nextOperatorName)}
                    shiftDate={String(shift.shiftDate || '').slice(0, 10)}
                    shiftType={(shift.shiftType as any) || 'Өдрийн'}
                    operatorName={shift.operatorName || profile?.displayName || profile?.email || ''}
                    operatorUid={shift.operatorUid || profile?.uid || ''}
                    initialPayload={stationForms[stationFormModal.kind] || (shift as any).y320ElectricalAutomationRepairForm}
                    shiftId={shift.id}
                    initialImages={y110Images}
                    onImagesChange={setY110Images}
                    onBack={() => setStationFormModal(null)}
                    onSubmit={(p) => saveStationModalForm(stationFormModal.kind, p)}
                    submitting={stationSaving}
                  />
                ) : stationFormModal.stationCode === 'ҮЯ-400' ? (
                  <FactoryProcessControlForm
                    showEnvironmentChecks={shift.stationCode !== 'ҮЯ-099' || !stationForms.y099_master_handover_v1}
                    shiftDate={String(shift.shiftDate || '').slice(0, 10)}
                    shiftType={(shift.shiftType as any) || 'Өдрийн'}
                    operatorName={shift.operatorName || profile?.displayName || profile?.email || ''}
                    operatorUid={shift.operatorUid || profile?.uid || ''}
                    initialPayload={stationForms[stationFormModal.kind] || (shift as any).factoryProcessControlForm}
                    shiftId={shift.id}
                    initialImages={y110Images}
                    onImagesChange={setY110Images}
                    onBack={() => setStationFormModal(null)}
                    onSubmit={(p) => saveStationModalForm(stationFormModal.kind, p)}
                    submitting={stationSaving}
                  />
                ) : stationFormModal.stationCode === 'ҮЯ-410' ? (
                  <CAH02ElectricalControlForm
                    receivingMasterName={resolveReceivingName(shift.handoverAcceptedByName, shift.nextMasterName)}
                    shiftDate={String(shift.shiftDate || '').slice(0, 10)}
                    shiftType={(shift.shiftType as any) || 'Өдрийн'}
                    operatorName={stationFormModal.stationCode === shift.stationCode ? (shift.operatorName || profile?.displayName || profile?.email || '') : (shift.currentMasterName || profile?.displayName || profile?.email || '')}
                    operatorUid={stationFormModal.stationCode === shift.stationCode ? (shift.operatorUid || profile?.uid || '') : (shift.shiftMasterUid || '')}
                    initialPayload={stationForms[stationFormModal.kind] || (shift as any).cah02ElectricalControlForm}
                    shiftId={shift.id}
                    initialImages={y110Images}
                    onImagesChange={setY110Images}
                    onBack={() => setStationFormModal(null)}
                    onSubmit={(p) => saveStationModalForm(stationFormModal.kind, p)}
                    submitting={stationSaving}
                  />
                ) : stationFormModal.stationCode === 'ҮЯ-181' ? (
                  <Y181HeatMasterHandoverForm
                    receivingMasterName={resolveReceivingName(shift.handoverAcceptedByName, shift.nextMasterName)}
                    shiftDate={String(shift.shiftDate || '').slice(0, 10)}
                    shiftType={(shift.shiftType as any) || 'Өдрийн'}
                    operatorName={stationFormModal.stationCode === shift.stationCode ? (shift.operatorName || profile?.displayName || profile?.email || '') : (shift.currentMasterName || profile?.displayName || profile?.email || '')}
                    operatorUid={stationFormModal.stationCode === shift.stationCode ? (shift.operatorUid || profile?.uid || '') : (shift.shiftMasterUid || '')}
                    initialPayload={stationForms[stationFormModal.kind]}
                    shiftId={shift.id}
                    initialImages={y110Images}
                    onImagesChange={setY110Images}
                    onBack={() => setStationFormModal(null)}
                    onSubmit={(p) => saveStationModalForm(stationFormModal.kind, p)}
                    submitting={stationSaving}
                  />
                ) : stationFormModal.stationCode === 'ОНБ' ? (
                  <IngredientChangeRecordForm
                    shiftDate={String(shift.shiftDate || '').slice(0, 10)}
                    shiftType={(shift.shiftType as any) || 'Өдрийн'}
                    operatorName={shift.operatorName || profile?.displayName || profile?.email || ''}
                    operatorUid={shift.operatorUid || profile?.uid || ''}
                    initialPayload={stationForms[stationFormModal.kind] || (shift as any).ingredientChangeRecordForm}
                    shiftId={shift.id}
                    initialImages={y110Images}
                    onImagesChange={setY110Images}
                    onBack={() => setStationFormModal(null)}
                    onSubmit={(p) => saveStationModalForm(stationFormModal.kind, p)}
                    submitting={stationSaving}
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}



        {/* Цутгалтын үзүүлэлт — ҮЯ-130-д ээлж дуусгахад ЗААВАЛ шаардагддаг
            (lib/shift-completeness.ts). Өмнө нь MixLogModal-ыг нээх товч хаана ч
            байгаагүй тул ҮЯ-130-ын оператор ээлжээ хэзээ ч дуусгах боломжгүй байсан. */}
        {String(shift.stationCode || '') === 'ҮЯ-130' ? (
          <section id="mix" className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden scroll-mt-24">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-orange-600" />
                Цутгалтын үзүүлэлт
              </h3>
              {canAppendLogs ? (
                <button
                  type="button"
                  onClick={() => setShowMixModal(true)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors"
                >
                  Шинэ бүртгэл
                </button>
              ) : null}
            </div>
            <div className="p-6">
              {mixLogs.length === 0 ? (
                <p className="text-center text-gray-400 py-4">
                  Цутгалтын үзүүлэлт бүртгээгүй байна. Ээлж дуусгахад заавал шаардлагатай.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                        <th className="px-4 py-3 font-bold">Цутгалтын №</th>
                        <th className="px-4 py-3 font-bold">Хөөлт (мин)</th>
                        <th className="px-4 py-3 font-bold">Тархалт (см)</th>
                        <th className="px-4 py-3 font-bold">Темп (°С)</th>
                        <th className="px-4 py-3 font-bold">Нягт (кг/м3)</th>
                        <th className="px-4 py-3 font-bold">Бүртгэсэн</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {mixLogs.map((log: any, i: number) => (
                        <tr key={log?.id ?? i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{log?.pourCount ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-700">{log?.risingTime ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-700">{log?.spread ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-700">{log?.pourTemp ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-700">{log?.freshSlurryDensity ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {log?.createdAt ? new Date(log.createdAt).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {/* Чанарын лабораторийн бүртгэл — ҮЯ-190-д ээлж дуусгахад ЗААВАЛ шаардагддаг.
            Цутгалтын үзүүлэлттэй ижил алдаа: QualityLogModal-д нээх товч байгаагүй. */}
        {String(shift.stationCode || '') === 'ҮЯ-190' ? (
          <section id="quality" className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden scroll-mt-24">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-orange-600" />
                Чанарын лабораторийн бүртгэл
              </h3>
              {canAppendLogs ? (
                <button
                  type="button"
                  onClick={() => setShowQualModal(true)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors"
                >
                  Шинэ бүртгэл
                </button>
              ) : null}
            </div>
            <div className="p-6">
              {qualityLogs.length === 0 ? (
                <p className="text-center text-gray-400 py-4">
                  Чанарын бүртгэл хийгээгүй байна. Ээлж дуусгахад заавал шаардлагатай.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                        <th className="px-4 py-3 font-bold">Автоклав №</th>
                        <th className="px-4 py-3 font-bold">Поддон №</th>
                        <th className="px-4 py-3 font-bold">Хэмжээ</th>
                        <th className="px-4 py-3 font-bold">1-р сорт м3</th>
                        <th className="px-4 py-3 font-bold">Бүртгэсэн</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {qualityLogs.map((log: any, i: number) => (
                        <tr key={log?.id ?? i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{log?.autoclaveNum ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-700">{log?.poddonNum ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-700">{log?.productSize || '—'}</td>
                          <td className="px-4 py-3 text-gray-700">{log?.sort1M3 ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {log?.createdAt ? new Date(log.createdAt).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {/* HSE Checklist */}
        <section id="hse" className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden scroll-mt-24">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              ХАБЭА-н хяналтын хуудас
            </h3>
            {canAppendLogs ? (
              <button
                type="button"
                onClick={() => setShowHseModal(true)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
              >
                {hseChecklist ? 'Засах' : 'Бүртгэх'}
              </button>
            ) : null}
          </div>
          <div className="p-6 space-y-6">
            {!hseChecklist ? (
              <p className="text-center text-gray-400 py-4">ХАБЭА-н хяналтын хуудас бөглөөгүй байна.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-700">Хамгаалах хэрэгсэл бүрэн</span>
                  {hseChecklist.ppeComplete ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-700">Ажлын байрны цэвэрлэгээ</span>
                  {hseChecklist.workplaceClean ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-700">Төхөөрөмжийн хамгаалалт</span>
                  {hseChecklist.guardsInPlace ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-700">Гал түймрийн аюулгүй байдал</span>
                  {hseChecklist.fireSafetyOk ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
                </div>
              </div>
            )}
            {hseImages.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase">Хавсаргасан зургууд</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {hseImages.map((img) => (
                    <div
                      key={img.id}
                      className="rounded-xl border border-gray-200 overflow-hidden bg-white hover:border-orange-300"
                    >
                      <a href={img.url || img.publicUrl} target="_blank" rel="noreferrer" className="block">
                        <div className="relative aspect-video bg-gray-100">
                          <Image
                            src={(img.url || img.publicUrl) as string}
                            alt={img.caption || img.rowLabel || 'ХАБЭА-н зураг'}
                            fill
                            sizes="(min-width: 768px) 25vw, 50vw"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      </a>
                      <div className="p-2">
                        <p className="text-[11px] font-bold text-gray-700 truncate">
                          {img.rowLabel || 'ХАБЭА-н зураг'}
                        </p>
                        {img.caption ? (
                          <p className="text-[11px] text-gray-500 truncate">{img.caption}</p>
                        ) : null}
                        <details className="mt-2 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5">
                          <summary className="cursor-pointer text-[11px] font-bold text-orange-700">
                            Тайлбар дэлгэрэнгүй харах
                          </summary>
                          <p className="mt-2 text-[11px] leading-4 text-gray-700 whitespace-pre-wrap break-words">
                            {img.caption?.trim() || 'Тайлбар бичээгүй байна.'}
                          </p>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {shift.stationCode === 'ҮЯ-099' && !shift.checkOut && (
          (() => {
            const needsFactory = !stationForms.factory_process_control_form;
            const needsPeriodic = periodicStatus.missingCount > 0;
            if (!needsFactory && !needsPeriodic) return null;
            return (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 space-y-2">
                <p className="text-sm font-bold text-amber-800">⚠️ Ээлж дуусгахын өмнө дараах бүртгэлүүдийг бөглөнө үү:</p>
                <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                  {needsFactory && <li>Үйлдвэрийн процесст тавих хяналтын хуудас</li>}
                  {needsPeriodic && <li>Тогтмол бүртгэл — {periodicStatus.missingCount} удаа дутуу ({periodicIntervalHours} цаг тутам)</li>}
                </ul>
              </div>
            );
          })()
        )}

        {shift.stationCode === 'ҮЯ-099' && (
          <section id="process-control" className="scroll-mt-24 bg-white rounded-3xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-bold text-gray-900">Үйлдвэрийн процесст тавих хяналтын хуудас</h3>
                <p className="text-sm text-gray-500 mt-1">Ээлжийн мастер ээлжийн явцад бөглөнө.</p>
              </div>
              {canAppendLogs ? (
                <button
                  type="button"
                  onClick={() =>
                    setStationFormModal({
                      kind: 'factory_process_control_form',
                      stationCode: 'ҮЯ-400',
                      title: 'Үйлдвэрийн процесст тавих хяналтын хуудас',
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
                >
                  {stationForms.factory_process_control_form ? 'Засах' : 'Бүртгэх'}
                </button>
              ) : null}
            </div>
            {stationForms.factory_process_control_form ? (
              <FactoryProcessControlReadOnly
                data={stationForms.factory_process_control_form}
                showEnvironmentChecks={!stationForms.y099_master_handover_v1}
              />
            ) : (
              <p className="text-sm text-gray-500">Бүртгэл хийгдээгүй.</p>
            )}
          </section>
        )}

        {/* ҮЯ-099-ээс тогтмол бүртгэлийг хассан (2026-08). Гэхдээ ӨМНӨ бүртгэсэн
            мөрүүд байвал хэсгийг харуулсаар байна — эс бөгөөс түүхэн өгөгдөл
            хараагүй алга болно. Шинэ бүртгэл нэмэх товч нь дотроо
            `stationUsesPeriodicLogs`-оор хаагдана. */}
        {(stationUsesPeriodicLogs(shift.stationCode) || periodicLogs.length > 0) && (
          <section id="periodic" className="scroll-mt-24 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-gray-100 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Тогтмол бүртгэл</h3>
                {stationUsesPeriodicLogs(shift.stationCode) ? (
                  <p className="mt-1 text-sm text-gray-500">
                    {periodicIntervalHours} цаг тутам бүртгэнэ. Шаардлагатай: {periodicStatus.requiredCount},
                    бүртгэсэн: {periodicStatus.completedCount}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-gray-500">
                    Энэ дамжлагад тогтмол бүртгэл шаардахаа больсон. Доорх нь өмнө бүртгэсэн
                    {' '}{periodicLogs.length} мөр (зөвхөн харах).
                  </p>
                )}
              </div>
              {stationUsesPeriodicLogs(shift.stationCode) && canAppendLogs && profile?.uid === shift.operatorUid && !shift.operatorShiftCompleted && (
                <button
                  type="button"
                  onClick={() => setShowPeriodicModal(true)}
                  className="inline-flex items-center justify-center rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-700"
                >
                  Шинэ бүртгэл
                </button>
              )}
            </div>

            {periodicStatus.isOverdue ? (
              <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-6 py-4 text-amber-900">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-bold">Тогтмол бүртгэл хоцорсон</p>
                  <p className="mt-1 text-sm">{periodicStatus.missingCount} бүртгэл дутуу байна.</p>
                </div>
              </div>
            ) : periodicStatus.nextDeadlineMs ? (
              <div className="border-b border-gray-100 bg-gray-50 px-6 py-3 text-sm text-gray-600">
                Дараагийн бүртгэлийн хугацаа:{' '}
                <span className="font-bold text-gray-900">
                  {new Date(periodicStatus.nextDeadlineMs).toLocaleString('mn-MN', {
                    timeZone: 'Asia/Ulaanbaatar',
                  })}
                </span>
              </div>
            ) : null}

            {periodicLogs.length === 0 ? (
              <p className="px-6 py-8 text-sm text-gray-500">Тогтмол бүртгэл одоогоор байхгүй байна.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {periodicLogs.map((log, index) => (
                  <div key={log.id || index} className="grid gap-3 px-6 py-4 sm:grid-cols-4 sm:items-center">
                    <div>
                      <p className="text-xs font-bold uppercase text-gray-400">Бүртгэлийн цаг</p>
                      <p className="mt-1 text-sm font-bold text-gray-900">{log.logTime || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-gray-400">Процесс</p>
                      <p className="mt-1 text-sm text-gray-700">{log.processStatus || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-gray-400">Төлөв</p>
                      <p className={`mt-1 text-sm font-bold ${log.isLate ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {log.draftSavedAt && !log.submittedAt ? 'Ноорог' : log.isLate ? 'Хоцорсон' : 'Хугацаандаа'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-gray-400">Тэмдэглэл</p>
                      <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap break-words">{log.remarks || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {shift.masterApproved && (
          <section className="bg-emerald-50 p-8 rounded-3xl border border-emerald-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-emerald-900">Баталгаажсан</h3>
              <p className="text-sm text-emerald-700">
                Мастер {shift.masterApprovedBy} {new Date(shift.masterApprovedDate).toLocaleString()}-нд баталгаажуулсан.
              </p>
            </div>
          </section>
        )}

        {/* Admin Double Approval Section */}
        {(profile?.role === 'admin' || profile?.role === 'chief_engineer') &&
          shift.masterApproved &&
          isHandoverFullyAccepted &&
          !shift.adminApproved && (
            <section className="bg-orange-600 p-8 rounded-[2rem] border border-orange-500 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-orange-200 mt-6">
              <div>
                <h3 className="text-xl font-black text-white mb-1 tracking-tight">Админы давхар хяналт</h3>
                <p className="text-orange-100 text-sm font-medium opacity-90">Инженер / Админы эцсийн баталгаажуулалт.</p>
              </div>
              <button
                onClick={handleAdminApprove}
                disabled={submitting}
                className="px-10 py-4 bg-white text-orange-600 rounded-2xl font-black shadow-lg hover:bg-orange-50 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
              >
                {submitting ? (
                  <div className="w-6 h-6 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-6 h-6" />
                )}
                Эцсийн байдлаар баталгаажуулах
              </button>
            </section>
          )}

        {shift.adminApproved && (
          <section className="bg-blue-50 p-8 rounded-3xl border border-blue-100 flex items-center gap-4 mt-6">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-blue-900">Эцсийн байдлаар баталгаажсан</h3>
              <p className="text-sm text-blue-700">
                Админ {shift.adminApprovedBy} {new Date(shift.adminApprovedDate).toLocaleString()}-нд давхар баталгаажуулсан.
              </p>
            </div>
          </section>
        )}
      </main>

      {/* Modals */}

      {canAppendLogs && showMixModal && <MixLogModal shiftId={effectiveShiftId} onClose={() => setShowMixModal(false)} />}
      {canAppendLogs && showQualModal && <QualityLogModal shiftId={effectiveShiftId} onClose={() => setShowQualModal(false)} />}
      {canAppendLogs && showHandoverModal && <HandoverModal shiftId={effectiveShiftId} onClose={() => setShowHandoverModal(false)} />}
      {canAppendLogs && showProcessModal && <ProcessCheckModal shiftId={effectiveShiftId} onClose={() => setShowProcessModal(false)} />}
      {canAppendLogs && showRecipeModal && <RecipeChangeModal shiftId={effectiveShiftId} onClose={() => setShowRecipeModal(false)} />}
      {canAppendLogs && showRepairModal && <RepairModal shiftId={effectiveShiftId} shift={shift} onClose={() => setShowRepairModal(false)} />}
      {canAppendLogs && showPeriodicModal && stationUsesPeriodicLogs(shift.stationCode) && (
        <PeriodicLogModal
          shiftId={effectiveShiftId}
          checkInIso={shift.checkIn}
          existingPeriodicCount={submittedPeriodicLogs.length}
          periodicIntervalHours={periodicIntervalHours}
          onClose={() => setShowPeriodicModal(false)}
        />
      )}

      {canAppendLogs && showHseModal && (
        <HseChecklistModal
          shiftId={effectiveShiftId}
          initialData={hseChecklist}
          initialImages={hseImages}
          onImagesChange={(nextHseImages) => {
            setY110Images((current) => [
              ...nextHseImages,
              ...current.filter((img) => img.section !== 'hse_checklist'),
            ]);
          }}
          onClose={() => setShowHseModal(false)}
        />
      )}
    </div>
  );
}

/** Хүсэлт аль хэдийн илгээгдсэн/бэхжсэн сонголтыг зөвхөн харуулах, засаж болдоггүй блок. */
function LockedSelection({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900">
      <UserRound className="h-4 w-4 shrink-0 text-gray-500" />
      {value || '—'}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

function Plus({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
