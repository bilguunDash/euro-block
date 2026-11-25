'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { AlertCircle, Camera, CheckCircle2, ChevronLeft, ClipboardList, ImagePlus, Save, Trash2, Upload, X } from 'lucide-react';
import useSWR from 'swr';
import {
  createEmptyY310Payload,
  mergeY310PayloadRows,
  type Y310Status,
  type Y310RepairMasterHandoverPayload,
} from '@/lib/y310-repair-master-handover-form';
import { resolveReceivingName } from '@/lib/shift-signature';
import { useToast } from '@/components/ui/ToastProvider';
import { RoleUserSelect } from '@/components/ui/RoleUserSelect';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

const swrFetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const EMPTY_SHIFT_IMAGES: ShiftInspectionImage[] = [];
const Y310_REPAIR_EQUIPMENT_IMAGE_SECTION = 'y310_repair_equipment';
const Y310_COMPRESSOR_IMAGE_SECTION = 'y310_compressor_inspection';
const Y310_ATTENTION_IMAGE_SECTION = 'y310_equipment_attention';
const Y310_REPAIR_WORK_IMAGE_SECTION = 'y310_repair_work';

type ShiftInspectionImage = {
  id: string;
  section?: string | null;
  rowKey?: string | null;
  rowLabel?: string | null;
  caption?: string | null;
  url: string;
  publicUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt?: string;
};

type PendingImage = {
  id: string;
  file: File;
  previewUrl: string;
  section: string;
  rowKey: string;
  rowLabel: string;
  caption: string;
  progress: number;
  status: 'ready' | 'uploading' | 'done' | 'error';
  error?: string;
};

type UploadTarget = {
  section: string;
  rowKey: string;
  rowLabel: string;
};

function StatusRadios({ value, onChange, name }: { value: Y310Status; onChange: (v: Y310Status) => void; name: string }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <label className="inline-flex items-center gap-1.5 cursor-pointer">
        <input type="radio" name={name} checked={value === 'normal'} onChange={() => onChange('normal')} />
        <span>Хэвийн (+)</span>
      </label>
      <label className="inline-flex items-center gap-1.5 cursor-pointer">
        <input type="radio" name={name} checked={value === 'abnormal'} onChange={() => onChange('abnormal')} />
        <span>Хэвийн бус (−)</span>
      </label>
    </div>
  );
}

export function Y310RepairMasterHandoverForm({
  shiftDate, shiftType, operatorUid, operatorName, onBack, onSubmit, submitting,
  initialPayload, shiftId, initialImages, onImagesChange, receivingMasterName,
}: {
  shiftDate: string; shiftType: string; operatorUid: string; operatorName: string;
  initialPayload?: Partial<Y310RepairMasterHandoverPayload> | null;
  receivingMasterName?: string | null;
  shiftId?: string;
  initialImages?: ShiftInspectionImage[];
  onImagesChange?: (images: ShiftInspectionImage[]) => void;
  onBack: () => void; onSubmit: (p: Y310RepairMasterHandoverPayload) => Promise<void>; submitting: boolean;
}) {
  const toast = useToast();
  const initial = useMemo(() => {
    const empty = createEmptyY310Payload({ shiftDate, shiftType, operatorUid, operatorName });
    const p = initialPayload ?? null;
    return p
      ? ({ ...empty, ...p, ...mergeY310PayloadRows(p), sigReceiving: resolveReceivingName(p.sigReceiving, receivingMasterName) } as any)
      : { ...empty, sigReceiving: resolveReceivingName(receivingMasterName) };
  }, [shiftDate, shiftType, operatorUid, operatorName, initialPayload, receivingMasterName]);
  const [form, setForm] = useState<Y310RepairMasterHandoverPayload>(() => ({ ...(initial as any) }));
  const prevInitialPayloadRef = useRef(initialPayload);
  useEffect(() => {
    const prev = prevInitialPayloadRef.current;
    prevInitialPayloadRef.current = initialPayload;
    if (!prev && initialPayload) {
      setForm({ ...(initial as any) });
    }
  }, [initialPayload, initial]);

  const nextMasterUrl =
    shiftId && shiftDate && shiftType
      ? `/api/master-schedule-next?stationCode=${encodeURIComponent('ҮЯ-310')}&shiftDate=${encodeURIComponent(shiftDate)}&shiftType=${encodeURIComponent(shiftType)}`
      : null;
  const { data: nextMasterData } = useSWR(nextMasterUrl, swrFetcher, { revalidateOnFocus: false });
  const autoMasterName: string =
    nextMasterData?.ok && nextMasterData?.found ? String(nextMasterData.schedule?.masterName || '') : '';
  const scheduleNotFound = nextMasterData !== undefined && nextMasterData?.ok && !nextMasterData?.found;

  const autoFilledRef = useRef(false);
  useEffect(() => {
    if (autoFilledRef.current) return;
    if (!autoMasterName) return;
    setForm((p) => {
      if (p.sigReceiving?.trim()) return p;
      autoFilledRef.current = true;
      return { ...p, sigReceiving: autoMasterName };
    });
  }, [autoMasterName]);
  const [formShiftDate, setFormShiftDate] = useState(shiftDate);
  const [invalidRowKey, setInvalidRowKey] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const sigReceivingRef = useRef<HTMLDivElement | null>(null);
  const focusInvalidRow = (key: string) => {
    setInvalidRowKey(key);
    rowRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const [selectedRepairImageKey, setSelectedRepairImageKey] = useState('');
  const [selectedCompressorImageKey, setSelectedCompressorImageKey] = useState('');
  const [selectedAttentionImageKey, setSelectedAttentionImageKey] = useState('');
  const [selectedRepairWorkImageKey, setSelectedRepairWorkImageKey] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [deletingImageIds, setDeletingImageIds] = useState<string[]>([]);
  const [deleteConfirmImageId, setDeleteConfirmImageId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraTarget, setCameraTarget] = useState<UploadTarget | null>(null);
  const safeInitialImages = initialImages ?? EMPTY_SHIFT_IMAGES;
  const [uploadedImages, setUploadedImages] = useState<ShiftInspectionImage[]>(safeInitialImages);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const fileUploadTargetRef = useRef<UploadTarget | null>(null);
  const pendingImagesRef = useRef<PendingImage[]>([]);
  const uploadedImagesRef = useRef<ShiftInspectionImage[]>(safeInitialImages);
  const repairImageOptions = useMemo(
    () => form.repairEquipment.map((row, index) => ({ key: row.key, label: `${index + 1}. ${row.label}` })),
    [form.repairEquipment]
  );
  const effectiveRepairImageKey = selectedRepairImageKey || repairImageOptions[0]?.key || '';
  const selectedRepairImage = repairImageOptions.find((option) => option.key === effectiveRepairImageKey) ?? null;
  const repairImageUploadTarget: UploadTarget | null = selectedRepairImage
    ? {
        section: Y310_REPAIR_EQUIPMENT_IMAGE_SECTION,
        rowKey: selectedRepairImage.key,
        rowLabel: selectedRepairImage.label,
      }
    : null;
  const compressorImageOptions = useMemo(
    () => form.compressors.map((row, index) => ({ key: row.key, label: `${index + 1}. ${row.label}` })),
    [form.compressors]
  );
  const effectiveCompressorImageKey = selectedCompressorImageKey || compressorImageOptions[0]?.key || '';
  const selectedCompressorImage = compressorImageOptions.find((option) => option.key === effectiveCompressorImageKey) ?? null;
  const compressorImageUploadTarget: UploadTarget | null = selectedCompressorImage
    ? {
        section: Y310_COMPRESSOR_IMAGE_SECTION,
        rowKey: selectedCompressorImage.key,
        rowLabel: selectedCompressorImage.label,
      }
    : null;
  const attentionImageOptions = useMemo(
    () => form.sections.map((row, index) => ({ key: row.key, label: `${index + 1}. ${row.labelMn}` })),
    [form.sections]
  );
  const effectiveAttentionImageKey = selectedAttentionImageKey || attentionImageOptions[0]?.key || '';
  const selectedAttentionImage = attentionImageOptions.find((option) => option.key === effectiveAttentionImageKey) ?? null;
  const attentionImageUploadTarget: UploadTarget | null = selectedAttentionImage
    ? {
        section: Y310_ATTENTION_IMAGE_SECTION,
        rowKey: selectedAttentionImage.key,
        rowLabel: selectedAttentionImage.label,
      }
    : null;
  const repairWorkImageOptions = useMemo(
    () => form.repairWork.map((row, index) => ({ key: row.key, label: `${index + 1}. ${row.labelMn || row.labelEn}` })),
    [form.repairWork]
  );
  const effectiveRepairWorkImageKey = selectedRepairWorkImageKey || repairWorkImageOptions[0]?.key || '';
  const selectedRepairWorkImage = repairWorkImageOptions.find((option) => option.key === effectiveRepairWorkImageKey) ?? null;
  const repairWorkImageUploadTarget: UploadTarget | null = selectedRepairWorkImage
    ? {
        section: Y310_REPAIR_WORK_IMAGE_SECTION,
        rowKey: selectedRepairWorkImage.key,
        rowLabel: selectedRepairWorkImage.label,
      }
    : null;
  const pendingRepairImages = pendingImages.filter((img) => img.section === Y310_REPAIR_EQUIPMENT_IMAGE_SECTION);
  const uploadedRepairImages = uploadedImages.filter((img) => img.section === Y310_REPAIR_EQUIPMENT_IMAGE_SECTION);
  const pendingCompressorImages = pendingImages.filter((img) => img.section === Y310_COMPRESSOR_IMAGE_SECTION);
  const uploadedCompressorImages = uploadedImages.filter((img) => img.section === Y310_COMPRESSOR_IMAGE_SECTION);
  const pendingAttentionImages = pendingImages.filter((img) => img.section === Y310_ATTENTION_IMAGE_SECTION);
  const uploadedAttentionImages = uploadedImages.filter((img) => img.section === Y310_ATTENTION_IMAGE_SECTION);
  const pendingRepairWorkImages = pendingImages.filter((img) => img.section === Y310_REPAIR_WORK_IMAGE_SECTION);
  const uploadedRepairWorkImages = uploadedImages.filter((img) => img.section === Y310_REPAIR_WORK_IMAGE_SECTION);
  const deleteConfirmImage = deleteConfirmImageId
    ? uploadedImages.find((img) => img.id === deleteConfirmImageId) ?? null
    : null;

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(() => {
    const nextImages = initialImages ?? EMPTY_SHIFT_IMAGES;
    uploadedImagesRef.current = nextImages;
    setUploadedImages(nextImages);
  }, [initialImages]);

  useEffect(
    () => () => {
      for (const img of pendingImagesRef.current) URL.revokeObjectURL(img.previewUrl);
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    []
  );

  useEffect(() => {
    if (!cameraOpen || !cameraVideoRef.current || !cameraStreamRef.current) return;
    cameraVideoRef.current.srcObject = cameraStreamRef.current;
    cameraVideoRef.current.play().catch(() => {
      setCameraError('Камер ажиллуулахад алдаа гарлаа.');
    });
  }, [cameraOpen]);

  const patchRepair = (key: string, patch: Record<string, unknown>) => {
    setForm((p) => ({ ...p, repairEquipment: p.repairEquipment.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
    if (invalidRowKey === key && 'status' in patch) setInvalidRowKey(null);
  };
  const patchCompressor = (key: string, patch: Record<string, unknown>) => {
    setForm((p) => ({ ...p, compressors: p.compressors.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
    if (invalidRowKey === key && ('statusOk' in patch || 'cleaned' in patch)) setInvalidRowKey(null);
  };
  const patchSection = (key: string, patch: Record<string, unknown>) => {
    setForm((p) => ({ ...p, sections: p.sections.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
    if (invalidRowKey === key && ('statusOk' in patch || 'cleaned' in patch)) setInvalidRowKey(null);
  };
  const patchRepairWork = (key: string, patch: Record<string, unknown>) => {
    setForm((p) => ({ ...p, repairWork: p.repairWork.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
  };

  const addPendingFiles = (files: FileList | File[], target: UploadTarget | null) => {
    if (!target) {
      toast.warning('Зураг хавсаргах төрлөө сонгоно уу.');
      return;
    }

    const next: PendingImage[] = [];
    for (const file of Array.from(files)) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        toast.warning(`${file.name} JPG/PNG формат биш байна.`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.warning(`${file.name} 5MB-аас их байна.`);
        continue;
      }
      next.push({
        id: `${target.section}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        section: target.section,
        rowKey: target.rowKey,
        rowLabel: target.rowLabel,
        caption: '',
        progress: 0,
        status: 'ready',
      });
    }
    if (next.length) setPendingImages((prev) => [...prev, ...next]);
  };

  const handleImageFiles = (files: FileList | null) => {
    if (!files?.length) return;
    addPendingFiles(files, fileUploadTargetRef.current);
  };

  const openGallery = (target: UploadTarget | null) => {
    fileUploadTargetRef.current = target;
    galleryInputRef.current?.click();
  };

  const closeCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraOpen(false);
    setCameraTarget(null);
    setCameraError('');
  };

  const openCamera = async (target: UploadTarget | null) => {
    if (!target) {
      toast.warning('Зураг хавсаргах төрлөө сонгоно уу.');
      return;
    }
    fileUploadTargetRef.current = target;
    setCameraTarget(target);
    setCameraError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.warning('Камер ашиглах боломжгүй байна.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setCameraError('Камер нээж чадсангүй.');
      toast.error('Камер нээж чадсангүй.');
    }
  };

  const captureCameraImage = async () => {
    const video = cameraVideoRef.current;
    if (!video || !cameraTarget) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return;
    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
    addPendingFiles([file], cameraTarget);
    closeCamera();
  };

  const updatePendingCaption = (id: string, caption: string) => {
    setPendingImages((prev) => prev.map((img) => (img.id === id ? { ...img, caption } : img)));
  };

  const removePendingImage = (id: string) => {
    setPendingImages((prev) => {
      const found = prev.find((img) => img.id === id);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  };

  const uploadPendingImages = async (section: string) => {
    if (!shiftId) {
      toast.warning('Ээлжийн ID олдсонгүй.');
      return;
    }

    const readyImages = pendingImages.filter((img) => img.section === section && img.status === 'ready');
    if (!readyImages.length) return;
    const missingCaption = readyImages.find((img) => !img.caption.trim());
    if (missingCaption) {
      toast.warning(`«${missingCaption.rowLabel}» зураг дээр тайлбар бичнэ үү.`);
      return;
    }

    for (const img of readyImages) {
      setPendingImages((prev) =>
        prev.map((item) => (item.id === img.id ? { ...item, status: 'uploading', progress: 20, error: undefined } : item))
      );

      try {
        const fd = new FormData();
        fd.append('files', img.file);
        fd.append('captions', img.caption.trim());
        fd.append('section', img.section);
        fd.append('rowKey', img.rowKey);
        fd.append('rowLabel', img.rowLabel);
        const res = await fetch(`/api/shifts/${shiftId}/images`, { method: 'POST', body: fd });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Upload failed');
        setPendingImages((prev) => prev.map((item) => (item.id === img.id ? { ...item, progress: 100, status: 'done' } : item)));
        const body = await res.json();
        const uploaded = (body.images ?? []) as ShiftInspectionImage[];
        const nextImages = [...uploadedImagesRef.current, ...uploaded];
        uploadedImagesRef.current = nextImages;
        setUploadedImages(nextImages);
        onImagesChange?.(nextImages);
        URL.revokeObjectURL(img.previewUrl);
        setPendingImages((prev) => prev.filter((item) => item.id !== img.id));
      } catch (err) {
        setPendingImages((prev) =>
          prev.map((item) =>
            item.id === img.id
              ? { ...item, status: 'error', progress: 0, error: err instanceof Error ? err.message : 'Upload failed' }
              : item
          )
        );
      }
    }
  };

  const deleteUploadedImage = async (imageId: string) => {
    if (!shiftId) {
      toast.warning('Ээлжийн ID олдсонгүй.');
      return;
    }
    setDeletingImageIds((prev) => [...prev, imageId]);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/images?imageId=${encodeURIComponent(imageId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Delete failed');
      const nextImages = uploadedImagesRef.current.filter((img) => img.id !== imageId);
      uploadedImagesRef.current = nextImages;
      setUploadedImages(nextImages);
      onImagesChange?.(nextImages);
      setDeleteConfirmImageId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Зураг устгахад алдаа гарлаа.');
    } finally {
      setDeletingImageIds((prev) => prev.filter((id) => id !== imageId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Талбарууд ХООСОН БАЙЖ БОЛНО — «заавал бөглөх» шалгалтыг хэрэглэгчийн
    // хүсэлтээр авав. Дутуу бөглөсөн маягтыг ч хадгална.
    const payload: Y310RepairMasterHandoverPayload = {
      ...(form as any),
      shiftDate: formShiftDate,
      shiftType,
      stationCode: 'ҮЯ-310',
      operatorUid,
      operatorName,
      sigHandingOver: operatorName,
      submittedAt: new Date().toISOString(),
      needsAdminApproval: scheduleNotFound ? true : undefined,
    };
    await onSubmit(payload);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} disabled={submitting} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-bold disabled:opacity-50">
          <ChevronLeft className="w-5 h-5" /> Буцах
        </button>
        <p className="text-xs text-gray-500 font-medium hidden sm:block">ҮЯ-310</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          className="hidden"
          onChange={(e) => {
            handleImageFiles(e.target.files);
            e.currentTarget.value = '';
          }}
        />
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-4">
          <h1 className="text-lg md:text-xl font-bold text-gray-900 leading-snug flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-600" />
            ҮЯ-310: Засварын мастерын ээлж хүлээлцэх бүртгэл
          </h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Огноо</label>
              <input type="date" value={formShiftDate} onChange={(e) => setFormShiftDate(e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Ээлж</label>
              <input type="text" value={shiftType} readOnly className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-gray-700" />
            </div>
          </div>
          <p className="text-sm text-gray-600">Мастер: <span className="font-bold text-gray-900">{operatorName}</span></p>
        </div>

        {/* ── 1. Засварын тоног төхөөрөмж ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-bold text-sm text-gray-800">
            Засварын тоног төхөөрөмж
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-3 py-2 font-bold w-10">№</th>
                  <th className="px-3 py-2 font-bold min-w-[200px]">Нэр</th>
                  <th className="px-3 py-2 font-bold min-w-[170px]">Хэвийн / Хэвийн бус</th>
                  <th className="px-3 py-2 font-bold min-w-[140px]">Тайлбар</th>
                  <th className="px-3 py-2 font-bold min-w-[200px]">
                    <div className="leading-tight normal-case text-[10px]">52-р 7 хоногийн үзлэгийн<br />төлөвлөгөөний дагуу хийсэн үзлэг</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.repairEquipment.map((row, idx) => (
                  <tr
                    key={row.key}
                    ref={(el) => { rowRefs.current[row.key] = el; }}
                    className={`align-top hover:bg-gray-50/50 ${invalidRowKey === row.key ? 'bg-red-50 ring-2 ring-inset ring-red-400' : ''}`}
                  >
                    <td className="px-3 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-3 text-gray-900">{row.label}</td>
                    <td className="px-3 py-3">
                      <StatusRadios name={`y310-re-${row.key}`} value={row.status} onChange={(v) => patchRepair(row.key, { status: v })} />
                    </td>
                    <td className="px-3 py-3">
                      <input type="text" value={row.comment} onChange={(e) => patchRepair(row.key, { comment: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm" placeholder="Тайлбар" />
                    </td>
                    <td className="px-3 py-3">
                      <input type="text" value={row.weeklyInspection} onChange={(e) => patchRepair(row.key, { weeklyInspection: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm" placeholder="Үзлэг, тайлбар" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-4 border-t border-gray-200 bg-white">
            <div className="w-full rounded-xl border border-dashed border-orange-300 bg-white p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-end gap-3">
                <div className="w-full md:w-96 max-w-full">
                  <label className="block text-xs font-bold text-gray-500 uppercase">
                    Засварын тоног төхөөрөмжийн зураг хавсаргах төрөл
                  </label>
                  <select
                    value={effectiveRepairImageKey}
                    onChange={(e) => setSelectedRepairImageKey(e.target.value)}
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    {repairImageOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openCamera(repairImageUploadTarget)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
                  >
                    <Camera className="w-4 h-4" />
                    Камер
                  </button>
                  <button
                    type="button"
                    onClick={() => openGallery(repairImageUploadTarget)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
                  >
                    <ImagePlus className="w-4 h-4" />
                    Галерей
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                JPG/PNG формат дэмжинэ. Нэг зураг 5MB-аас ихгүй. Upload хийхийн өмнө зураг бүр дээр тайлбар бичнэ.
              </p>
              {pendingRepairImages.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {pendingRepairImages.map((img) => (
                      <div key={img.id} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                        <div className="relative aspect-video bg-gray-100">
                          <Image src={img.previewUrl} alt={img.file.name} fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" unoptimized />
                        </div>
                        <div className="p-3 space-y-2">
                          <input
                            type="text"
                            value={img.caption}
                            onChange={(e) => updatePendingCaption(img.id, e.target.value)}
                            placeholder="Зургийн тайлбар заавал бичнэ"
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                          />
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full bg-orange-600 transition-all" style={{ width: `${img.progress}%` }} />
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              <span className="shrink-0">{Math.round(img.file.size / 1024)}KB</span>
                              <span className="truncate font-medium text-gray-700">{img.rowLabel}</span>
                            </div>
                            {img.status === 'error' ? (
                              <span className="shrink-0 text-red-600">{img.error}</span>
                            ) : (
                              <span className="shrink-0">{img.status === 'uploading' ? `${img.progress}%` : 'Upload хүлээгдэж байна'}</span>
                            )}
                            <button
                              type="button"
                              onClick={() => removePendingImage(img.id)}
                              disabled={img.status === 'uploading'}
                              className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                              aria-label="Зураг устгах"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => uploadPendingImages(Y310_REPAIR_EQUIPMENT_IMAGE_SECTION)}
                    disabled={pendingRepairImages.some((img) => img.status === 'uploading')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-60"
                  >
                    <Upload className="w-4 h-4" />
                    Зураг upload хийх
                  </button>
                </div>
              )}
              {uploadedRepairImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase">Хадгалагдсан зургууд</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {uploadedRepairImages.map((img) => (
                      <div key={img.id} className="rounded-xl border border-gray-200 overflow-hidden bg-white hover:border-orange-300">
                        <a href={img.url || img.publicUrl} target="_blank" rel="noreferrer" className="block">
                          <div className="relative aspect-video bg-gray-100">
                            <Image
                              src={(img.url || img.publicUrl) as string}
                              alt={img.caption || img.rowLabel || 'Зураг'}
                              fill
                              sizes="(min-width: 768px) 25vw, 50vw"
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        </a>
                        <div className="p-2">
                          <p className="text-[11px] font-bold text-gray-700 truncate">
                            {img.rowLabel || 'Засварын тоног төхөөрөмжийн зураг'}
                          </p>
                          {img.caption ? <p className="text-[11px] text-gray-500 truncate">{img.caption}</p> : null}
                          <details className="mt-2 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5">
                            <summary className="cursor-pointer text-[11px] font-bold text-orange-700">Тайлбар дэлгэрэнгүй харах</summary>
                            <p className="mt-2 text-[11px] leading-4 text-gray-700 whitespace-pre-wrap break-words">
                              {img.caption?.trim() || 'Тайлбар бичээгүй байна.'}
                            </p>
                          </details>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmImageId(img.id)}
                            disabled={deletingImageIds.includes(img.id)}
                            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-orange-200 px-2 py-1.5 text-[11px] font-bold text-orange-700 hover:bg-orange-50 disabled:opacity-60"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Устгах
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* ── 2. Хийн хангалт ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-bold text-sm text-gray-800">
            Хийн хангалт (Компрессорын үзлэг)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-3 py-2 font-bold w-10">№</th>
                  <th className="px-3 py-2 font-bold min-w-[180px]">Хийн хангалт</th>
                  <th className="px-3 py-2 font-bold min-w-[140px]">Хэвийн эсэх</th>
                  <th className="px-3 py-2 font-bold min-w-[140px]">Цэвэрлэгээ</th>
                  <th className="px-3 py-2 font-bold min-w-[140px]">Тайлбар</th>
                  <th className="px-3 py-2 font-bold min-w-[220px]">
                    <div className="leading-tight normal-case text-[10px]">Аварын байдалтай ажиллаж<br />байгаа тоног төхөөрөмж</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.compressors.map((row, idx) => (
                  <tr
                    key={row.key}
                    ref={(el) => { rowRefs.current[row.key] = el; }}
                    className={`align-top hover:bg-gray-50/50 ${invalidRowKey === row.key ? 'bg-red-50 ring-2 ring-inset ring-red-400' : ''}`}
                  >
                    <td className="px-3 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-3 text-gray-900">{row.label}</td>
                    <td className="px-3 py-3">
                      <StatusRadios name={`y310-co-${row.key}`} value={row.statusOk} onChange={(v) => patchCompressor(row.key, { statusOk: v })} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusRadios name={`y310-cl-${row.key}`} value={row.cleaned} onChange={(v) => patchCompressor(row.key, { cleaned: v })} />
                    </td>
                    <td className="px-3 py-3">
                      <input type="text" value={row.comment} onChange={(e) => patchCompressor(row.key, { comment: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm" placeholder="Тайлбар" />
                    </td>
                    <td className="px-3 py-3">
                      <input type="text" value={row.emergencyEquipment} onChange={(e) => patchCompressor(row.key, { emergencyEquipment: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-4 border-t border-gray-200 bg-white">
            <div className="w-full rounded-xl border border-dashed border-orange-300 bg-white p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-end gap-3">
                <div className="w-full md:w-96 max-w-full">
                  <label className="block text-xs font-bold text-gray-500 uppercase">
                    Хийн хангалтын зураг хавсаргах төрөл
                  </label>
                  <select
                    value={effectiveCompressorImageKey}
                    onChange={(e) => setSelectedCompressorImageKey(e.target.value)}
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    {compressorImageOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openCamera(compressorImageUploadTarget)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
                  >
                    <Camera className="w-4 h-4" />
                    Камер
                  </button>
                  <button
                    type="button"
                    onClick={() => openGallery(compressorImageUploadTarget)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
                  >
                    <ImagePlus className="w-4 h-4" />
                    Галерей
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                JPG/PNG формат дэмжинэ. Нэг зураг 5MB-аас ихгүй. Upload хийхийн өмнө зураг бүр дээр тайлбар бичнэ.
              </p>
              {pendingCompressorImages.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {pendingCompressorImages.map((img) => (
                      <div key={img.id} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                        <div className="relative aspect-video bg-gray-100">
                          <Image src={img.previewUrl} alt={img.file.name} fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" unoptimized />
                        </div>
                        <div className="p-3 space-y-2">
                          <input
                            type="text"
                            value={img.caption}
                            onChange={(e) => updatePendingCaption(img.id, e.target.value)}
                            placeholder="Зургийн тайлбар заавал бичнэ"
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                          />
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full bg-orange-600 transition-all" style={{ width: `${img.progress}%` }} />
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              <span className="shrink-0">{Math.round(img.file.size / 1024)}KB</span>
                              <span className="truncate font-medium text-gray-700">{img.rowLabel}</span>
                            </div>
                            {img.status === 'error' ? (
                              <span className="shrink-0 text-red-600">{img.error}</span>
                            ) : (
                              <span className="shrink-0">{img.status === 'uploading' ? `${img.progress}%` : 'Upload хүлээгдэж байна'}</span>
                            )}
                            <button
                              type="button"
                              onClick={() => removePendingImage(img.id)}
                              disabled={img.status === 'uploading'}
                              className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                              aria-label="Зураг устгах"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => uploadPendingImages(Y310_COMPRESSOR_IMAGE_SECTION)}
                    disabled={pendingCompressorImages.some((img) => img.status === 'uploading')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-60"
                  >
                    <Upload className="w-4 h-4" />
                    Зураг upload хийх
                  </button>
                </div>
              )}
              {uploadedCompressorImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase">Хадгалагдсан зургууд</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {uploadedCompressorImages.map((img) => (
                      <div key={img.id} className="rounded-xl border border-gray-200 overflow-hidden bg-white hover:border-orange-300">
                        <a href={img.url || img.publicUrl} target="_blank" rel="noreferrer" className="block">
                          <div className="relative aspect-video bg-gray-100">
                            <Image
                              src={(img.url || img.publicUrl) as string}
                              alt={img.caption || img.rowLabel || 'Зураг'}
                              fill
                              sizes="(min-width: 768px) 25vw, 50vw"
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        </a>
                        <div className="p-2">
                          <p className="text-[11px] font-bold text-gray-700 truncate">
                            {img.rowLabel || 'Хийн хангалтын зураг'}
                          </p>
                          {img.caption ? <p className="text-[11px] text-gray-500 truncate">{img.caption}</p> : null}
                          <details className="mt-2 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5">
                            <summary className="cursor-pointer text-[11px] font-bold text-orange-700">Тайлбар дэлгэрэнгүй харах</summary>
                            <p className="mt-2 text-[11px] leading-4 text-gray-700 whitespace-pre-wrap break-words">
                              {img.caption?.trim() || 'Тайлбар бичээгүй байна.'}
                            </p>
                          </details>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmImageId(img.id)}
                            disabled={deletingImageIds.includes(img.id)}
                            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-orange-200 px-2 py-1.5 text-[11px] font-bold text-orange-700 hover:bg-orange-50 disabled:opacity-60"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Устгах
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 3. Хэсэг / Sections ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-bold text-sm text-gray-800">
            Тоног төхөөрөмжид анхаарах зүйлс
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-3 py-2 font-bold w-10">№</th>
                  <th className="px-3 py-2 font-bold min-w-[240px]">Хэсэг</th>
                  <th className="px-3 py-2 font-bold min-w-[140px]">Хэвийн эсэх</th>
                  <th className="px-3 py-2 font-bold min-w-[140px]">Цэвэрлэгээ</th>
                  <th className="px-3 py-2 font-bold min-w-[200px]">
                    <div className="leading-tight normal-case text-[10px]">Тоног төхөөрөмжид<br />анхаарах зүйлс</div>
                  </th>
                  <th className="px-3 py-2 font-bold min-w-[200px]">
                    <div className="leading-tight normal-case text-[10px]">Дараагийн ээлжинд хийгдэх<br />ажил /Анхаарах зүйлс/</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.sections.map((row, idx) => (
                  <tr
                    key={row.key}
                    ref={(el) => { rowRefs.current[row.key] = el; }}
                    className={`align-top hover:bg-gray-50/50 ${invalidRowKey === row.key ? 'bg-red-50 ring-2 ring-inset ring-red-400' : ''}`}
                  >
                    <td className="px-3 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-3">
                      {row.labelEn && <div className="text-gray-900 font-medium text-xs">{row.labelEn}</div>}
                      <div className="text-gray-600 text-xs">{row.labelMn}</div>
                    </td>
                    <td className="px-3 py-3">
                      <StatusRadios name={`y310-so-${row.key}`} value={row.statusOk} onChange={(v) => patchSection(row.key, { statusOk: v })} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusRadios name={`y310-sc-${row.key}`} value={row.cleaned} onChange={(v) => patchSection(row.key, { cleaned: v })} />
                    </td>
                    <td className="px-3 py-3">
                      <input type="text" value={row.equipmentNotes} onChange={(e) => patchSection(row.key, { equipmentNotes: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm" />
                    </td>
                    <td className="px-3 py-3">
                      <input type="text" value={row.nextShiftWork} onChange={(e) => patchSection(row.key, { nextShiftWork: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-4 border-t border-gray-200 bg-white">
            <div className="w-full rounded-xl border border-dashed border-orange-300 bg-white p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-end gap-3">
                <div className="w-full md:w-96 max-w-full">
                  <label className="block text-xs font-bold text-gray-500 uppercase">
                    Тоног төхөөрөмжид анхаарах зүйлсийн зураг хавсаргах төрөл
                  </label>
                  <select
                    value={effectiveAttentionImageKey}
                    onChange={(e) => setSelectedAttentionImageKey(e.target.value)}
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    {attentionImageOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openCamera(attentionImageUploadTarget)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
                  >
                    <Camera className="w-4 h-4" />
                    Камер
                  </button>
                  <button
                    type="button"
                    onClick={() => openGallery(attentionImageUploadTarget)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
                  >
                    <ImagePlus className="w-4 h-4" />
                    Галерей
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                JPG/PNG формат дэмжинэ. Нэг зураг 5MB-аас ихгүй. Upload хийхийн өмнө зураг бүр дээр тайлбар бичнэ.
              </p>
              {pendingAttentionImages.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {pendingAttentionImages.map((img) => (
                      <div key={img.id} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                        <div className="relative aspect-video bg-gray-100">
                          <Image src={img.previewUrl} alt={img.file.name} fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" unoptimized />
                        </div>
                        <div className="p-3 space-y-2">
                          <input
                            type="text"
                            value={img.caption}
                            onChange={(e) => updatePendingCaption(img.id, e.target.value)}
                            placeholder="Зургийн тайлбар заавал бичнэ"
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                          />
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full bg-orange-600 transition-all" style={{ width: `${img.progress}%` }} />
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              <span className="shrink-0">{Math.round(img.file.size / 1024)}KB</span>
                              <span className="truncate font-medium text-gray-700">{img.rowLabel}</span>
                            </div>
                            {img.status === 'error' ? (
                              <span className="shrink-0 text-red-600">{img.error}</span>
                            ) : (
                              <span className="shrink-0">{img.status === 'uploading' ? `${img.progress}%` : 'Upload хүлээгдэж байна'}</span>
                            )}
                            <button
                              type="button"
                              onClick={() => removePendingImage(img.id)}
                              disabled={img.status === 'uploading'}
                              className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                              aria-label="Зураг устгах"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => uploadPendingImages(Y310_ATTENTION_IMAGE_SECTION)}
                    disabled={pendingAttentionImages.some((img) => img.status === 'uploading')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-60"
                  >
                    <Upload className="w-4 h-4" />
                    Зураг upload хийх
                  </button>
                </div>
              )}
              {uploadedAttentionImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase">Хадгалагдсан зургууд</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {uploadedAttentionImages.map((img) => (
                      <div key={img.id} className="rounded-xl border border-gray-200 overflow-hidden bg-white hover:border-orange-300">
                        <a href={img.url || img.publicUrl} target="_blank" rel="noreferrer" className="block">
                          <div className="relative aspect-video bg-gray-100">
                            <Image
                              src={(img.url || img.publicUrl) as string}
                              alt={img.caption || img.rowLabel || 'Зураг'}
                              fill
                              sizes="(min-width: 768px) 25vw, 50vw"
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        </a>
                        <div className="p-2">
                          <p className="text-[11px] font-bold text-gray-700 truncate">
                            {img.rowLabel || 'Тоног төхөөрөмжид анхаарах зүйлсийн зураг'}
                          </p>
                          {img.caption ? <p className="text-[11px] text-gray-500 truncate">{img.caption}</p> : null}
                          <details className="mt-2 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5">
                            <summary className="cursor-pointer text-[11px] font-bold text-orange-700">Тайлбар дэлгэрэнгүй харах</summary>
                            <p className="mt-2 text-[11px] leading-4 text-gray-700 whitespace-pre-wrap break-words">
                              {img.caption?.trim() || 'Тайлбар бичээгүй байна.'}
                            </p>
                          </details>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmImageId(img.id)}
                            disabled={deletingImageIds.includes(img.id)}
                            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-orange-200 px-2 py-1.5 text-[11px] font-bold text-orange-700 hover:bg-orange-50 disabled:opacity-60"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Устгах
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 4. Засварын ажлын бүртгэл (18 мөр) ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-bold text-sm text-gray-800">
            Засварын ажлын бүртгэл
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-3 py-2 font-bold w-10">№</th>
                  <th className="px-3 py-2 font-bold min-w-[240px]">Хэсэг</th>
                  <th className="px-3 py-2 font-bold min-w-[180px]">
                    <div className="leading-tight normal-case text-[10px]">Нөлөөлөгдөөгүй<br />Цаг</div>
                  </th>
                  <th className="px-3 py-2 font-bold min-w-[180px]">
                    <div className="leading-tight normal-case text-[10px]">Нөлөөлөгдсөн<br />Цаг</div>
                  </th>
                  <th className="px-3 py-2 font-bold min-w-[160px]">Тайлбар</th>
                  <th className="px-3 py-2 font-bold min-w-[200px]">
                    <div className="leading-tight normal-case text-[10px]">Ээлжинд нэмэлтээр<br />хийсэн ажлууд</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.repairWork.map((row, idx) => (
                  <tr key={row.key} className="align-top hover:bg-gray-50/50">
                    <td className="px-3 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-3">
                      {row.labelEn && <div className="text-gray-900 font-medium text-xs">{row.labelEn}</div>}
                      <div className="text-gray-600 text-xs">{row.labelMn}</div>
                    </td>
                    <td className="px-3 py-3">
                      <input type="datetime-local" value={row.unplannedTime} onChange={(e) => patchRepairWork(row.key, { unplannedTime: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm" />
                    </td>
                    <td className="px-3 py-3">
                      <input type="datetime-local" value={row.plannedTime} onChange={(e) => patchRepairWork(row.key, { plannedTime: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm" />
                    </td>
                    <td className="px-3 py-3">
                      <input type="text" value={row.comment} onChange={(e) => patchRepairWork(row.key, { comment: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm" />
                    </td>
                    <td className="px-3 py-3">
                      <input type="text" value={row.additionalWork} onChange={(e) => patchRepairWork(row.key, { additionalWork: e.target.value })} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-4 border-t border-gray-200 bg-white">
            <div className="w-full rounded-xl border border-dashed border-orange-300 bg-white p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-end gap-3">
                <div className="w-full md:w-96 max-w-full">
                  <label className="block text-xs font-bold text-gray-500 uppercase">
                    Засварын ажлын бүртгэлийн зураг хавсаргах төрөл
                  </label>
                  <select
                    value={effectiveRepairWorkImageKey}
                    onChange={(e) => setSelectedRepairWorkImageKey(e.target.value)}
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    {repairWorkImageOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openCamera(repairWorkImageUploadTarget)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
                  >
                    <Camera className="w-4 h-4" />
                    Камер
                  </button>
                  <button
                    type="button"
                    onClick={() => openGallery(repairWorkImageUploadTarget)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
                  >
                    <ImagePlus className="w-4 h-4" />
                    Галерей
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                JPG/PNG формат дэмжинэ. Нэг зураг 5MB-аас ихгүй. Upload хийхийн өмнө зураг бүр дээр тайлбар бичнэ.
              </p>
              {pendingRepairWorkImages.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {pendingRepairWorkImages.map((img) => (
                      <div key={img.id} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                        <div className="relative aspect-video bg-gray-100">
                          <Image src={img.previewUrl} alt={img.file.name} fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" unoptimized />
                        </div>
                        <div className="p-3 space-y-2">
                          <input
                            type="text"
                            value={img.caption}
                            onChange={(e) => updatePendingCaption(img.id, e.target.value)}
                            placeholder="Зургийн тайлбар заавал бичнэ"
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                          />
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full bg-orange-600 transition-all" style={{ width: `${img.progress}%` }} />
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              <span className="shrink-0">{Math.round(img.file.size / 1024)}KB</span>
                              <span className="truncate font-medium text-gray-700">{img.rowLabel}</span>
                            </div>
                            {img.status === 'error' ? (
                              <span className="shrink-0 text-red-600">{img.error}</span>
                            ) : (
                              <span className="shrink-0">{img.status === 'uploading' ? `${img.progress}%` : 'Upload хүлээгдэж байна'}</span>
                            )}
                            <button
                              type="button"
                              onClick={() => removePendingImage(img.id)}
                              disabled={img.status === 'uploading'}
                              className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                              aria-label="Зураг устгах"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => uploadPendingImages(Y310_REPAIR_WORK_IMAGE_SECTION)}
                    disabled={pendingRepairWorkImages.some((img) => img.status === 'uploading')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-60"
                  >
                    <Upload className="w-4 h-4" />
                    Зураг upload хийх
                  </button>
                </div>
              )}
              {uploadedRepairWorkImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase">Хадгалагдсан зургууд</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {uploadedRepairWorkImages.map((img) => (
                      <div key={img.id} className="rounded-xl border border-gray-200 overflow-hidden bg-white hover:border-orange-300">
                        <a href={img.url || img.publicUrl} target="_blank" rel="noreferrer" className="block">
                          <div className="relative aspect-video bg-gray-100">
                            <Image
                              src={(img.url || img.publicUrl) as string}
                              alt={img.caption || img.rowLabel || 'Зураг'}
                              fill
                              sizes="(min-width: 768px) 25vw, 50vw"
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        </a>
                        <div className="p-2">
                          <p className="text-[11px] font-bold text-gray-700 truncate">
                            {img.rowLabel || 'Засварын ажлын бүртгэлийн зураг'}
                          </p>
                          {img.caption ? <p className="text-[11px] text-gray-500 truncate">{img.caption}</p> : null}
                          <details className="mt-2 rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5">
                            <summary className="cursor-pointer text-[11px] font-bold text-orange-700">Тайлбар дэлгэрэнгүй харах</summary>
                            <p className="mt-2 text-[11px] leading-4 text-gray-700 whitespace-pre-wrap break-words">
                              {img.caption?.trim() || 'Тайлбар бичээгүй байна.'}
                            </p>
                          </details>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmImageId(img.id)}
                            disabled={deletingImageIds.includes(img.id)}
                            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-orange-200 px-2 py-1.5 text-[11px] font-bold text-orange-700 hover:bg-orange-50 disabled:opacity-60"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Устгах
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Гарын үсэг + Submit ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          {autoMasterName && form.sigReceiving === autoMasterName && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
              <span>Хуваарийн дагуу <strong>{autoMasterName}</strong> автоматаар тодорхойлогдлоо. Шаардлагатай бол өөрчилж болно.</span>
            </div>
          )}
          {scheduleNotFound && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
              <span>Дараагийн ээлжийн мастерын хуваарь олдсонгүй. Мастераар сонгох эсвэл Admin-д мэдэгдэнэ үү.</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">Ээлж хүлээлгэн өгсөн: Засварын мастер</p>
              <input type="text" value={operatorName} readOnly className="w-full px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-700 font-medium" />
            </div>
            <div ref={sigReceivingRef}>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">Ээлж хүлээн авсан: Засварын мастер</p>
              <RoleUserSelect
                roles={['master']}
                value={form.sigReceiving}
                onChange={(_id, user) => setForm((p) => ({ ...p, sigReceiving: user?.label || '' }))}
                placeholder="Засварын мастер сонгох..."
              />
            </div>
          </div>
          <EnvironmentCheckSection
            rows={(form as any).environmentChecks}
            onChange={(rows) => setForm((prev: any) => ({ ...prev, environmentChecks: rows }))}
            disabled={submitting}
          />

          <div className="flex items-center justify-end gap-3 pt-6">
            <button type="button" onClick={onBack} disabled={submitting} className="px-6 py-3 rounded-xl bg-gray-100 font-bold text-gray-800 hover:bg-gray-200 disabled:opacity-60">Цуцлах</button>
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 disabled:opacity-60">
              <Save className="w-5 h-5" /> Хадгалах
            </button>
          </div>
        </div>
      </form>
      {deleteConfirmImage && (
        <div className="fixed inset-0 z-[220] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-orange-600 text-white">
              <p className="text-lg font-black">Зураг устгах</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-800">Энэ зургийг устгах уу?</p>
                <p className="text-xs font-bold text-gray-500 truncate">
                  {deleteConfirmImage.rowLabel || 'Засварын тоног төхөөрөмжийн зураг'}
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmImageId(null)}
                  className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-800 font-bold hover:bg-gray-200"
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={() => deleteUploadedImage(deleteConfirmImage.id)}
                  disabled={deletingImageIds.includes(deleteConfirmImage.id)}
                  className="px-5 py-2.5 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 disabled:opacity-60"
                >
                  Устгах
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {cameraOpen && (
        <div className="fixed inset-0 z-[200] bg-black/70 p-4 flex items-center justify-center">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-gray-900">Камер</p>
                <p className="text-xs text-gray-500">{cameraTarget?.rowLabel || 'Зураг'}</p>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                aria-label="Камер хаах"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-black">
              <video
                ref={cameraVideoRef}
                className="w-full max-h-[70vh] object-contain"
                playsInline
                muted
                autoPlay
              />
            </div>
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {cameraError ? (
                <p className="text-sm text-red-600">{cameraError}</p>
              ) : (
                <p className="text-sm text-gray-500">Зураг авахад бэлэн.</p>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeCamera}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
                >
                  Болих
                </button>
                <button
                  type="button"
                  onClick={captureCameraImage}
                  className="px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
                >
                  Зураг авах
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
