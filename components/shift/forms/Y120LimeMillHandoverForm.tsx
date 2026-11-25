'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, ChevronLeft, ImagePlus, Save, ClipboardList, Trash2, Upload, X } from 'lucide-react';
import {
  type Y120LimeMillHandoverPayload,
  type Y120NormStatus,
  createEmptyY120Payload,
} from '@/lib/y120-lime-mill-handover-form';
import { useToast } from '@/components/ui/ToastProvider';
import { mergeRowsByKey } from '@/components/shift/forms/shared/merge-by-key';
import { ShiftMasterField } from '@/components/shift/forms/shared/ShiftMasterField';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const EMPTY_SHIFT_IMAGES: ShiftInspectionImage[] = [];

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

function StatusRadios({
  value,
  onChange,
  name,
}: {
  value: Y120NormStatus;
  onChange: (v: Y120NormStatus) => void;
  name: string;
}) {
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input type="radio" name={name} checked={value === 'normal'} onChange={() => onChange('normal')} />
        <span>Хэвийн (+)</span>
      </label>
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input type="radio" name={name} checked={value === 'abnormal'} onChange={() => onChange('abnormal')} />
        <span>Хэвийн бус (−)</span>
      </label>
    </div>
  );
}

export function Y120LimeMillHandoverForm({
  shiftDate,
  shiftType,
  operatorName,
  operatorUid,
  initialPayload,
  shiftId,
  initialImages,
  onImagesChange,
  onBack,
  onSubmit,
  submitting,
  submitLabel = 'Бүртгэлийг хадгалаад ээлж эхлүүлэх',
  showSubmitButton = true,
}: {
  shiftDate: string;
  shiftType: string;
  operatorName: string;
  operatorUid: string;
  initialPayload?: Partial<Y120LimeMillHandoverPayload> | null;
  shiftId?: string;
  initialImages?: ShiftInspectionImage[];
  onImagesChange?: (images: ShiftInspectionImage[]) => void;
  onBack: () => void;
  onSubmit: (payload: Y120LimeMillHandoverPayload) => Promise<void>;
  submitting: boolean;
  submitLabel?: string;
  showSubmitButton?: boolean;
}) {
  const toast = useToast();
  const initial = useMemo(() => {
    const empty = createEmptyY120Payload({
        shiftDate,
        shiftType,
        operatorUid,
        operatorName,
      });
    const p = initialPayload ?? null;
    if (!p) return empty;
    return {
      ...empty,
      ...p,
      stationCode: 'ҮЯ-120',
      operatorUid,
      operatorName,
      shiftType,
      shiftDate: String((p as any).shiftDate || empty.shiftDate),
      inspections: mergeRowsByKey(empty.inspections, (p as any).inspections),
      milledMaterials: mergeRowsByKey(empty.milledMaterials, (p as any).milledMaterials),
      workplaceTidiness: {
        ...empty.workplaceTidiness,
        ...(((p as any).workplaceTidiness ?? {}) as object),
      },
    } as any;
  }, [shiftDate, shiftType, operatorUid, operatorName, initialPayload]);

  const [form, setForm] = useState<Y120LimeMillHandoverPayload>(() => ({ ...(initial as any) }));
  const [assignedMasterName, setAssignedMasterName] = useState('');
  const [formShiftDate, setFormShiftDate] = useState(String((initial as any).shiftDate || shiftDate));
  const [selectedInspectionKey, setSelectedInspectionKey] = useState('');
  const [selectedMilledMaterialKey, setSelectedMilledMaterialKey] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraTarget, setCameraTarget] = useState<UploadTarget | null>(null);
  const [deleteConfirmImageId, setDeleteConfirmImageId] = useState<string | null>(null);
  const [deletingImageIds, setDeletingImageIds] = useState<string[]>([]);
  const safeInitialImages = initialImages ?? EMPTY_SHIFT_IMAGES;
  const [uploadedImages, setUploadedImages] = useState<ShiftInspectionImage[]>(safeInitialImages);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const fileUploadTargetRef = useRef<UploadTarget | null>(null);
  const pendingImagesRef = useRef<PendingImage[]>([]);
  const uploadedImagesRef = useRef<ShiftInspectionImage[]>(safeInitialImages);

  const inspectionUploadOptions = useMemo(
    () => [
      ...form.inspections.map((row) => ({ key: row.key, label: row.label })),
      { key: 'hseInfo', label: 'ХАБЭА тухай мэдээлэл, санал' },
      { key: 'equipmentInfo', label: 'Тоног төхөөрөмжийн мэдээлэл, санал' },
      { key: 'workplaceTidiness', label: 'Ажлын байрны эмх цэгц, цэвэрлэгээ' },
    ],
    [form.inspections]
  );
  const effectiveInspectionKey = selectedInspectionKey || inspectionUploadOptions[0]?.key || '';
  const selectedInspection =
    inspectionUploadOptions.find((option) => option.key === effectiveInspectionKey) ?? null;
  const inspectionUploadTarget: UploadTarget | null = selectedInspection
    ? { section: 'y120_inspection', rowKey: selectedInspection.key, rowLabel: selectedInspection.label }
    : null;
  const pendingInspectionImages = pendingImages.filter((img) => img.section === 'y120_inspection');
  const uploadedInspectionImages = uploadedImages.filter((img) => img.section === 'y120_inspection');
  const milledMaterialUploadOptions = useMemo(
    () => form.milledMaterials.map((row) => ({ key: row.key, label: row.label })),
    [form.milledMaterials]
  );
  const effectiveMilledMaterialKey = selectedMilledMaterialKey || milledMaterialUploadOptions[0]?.key || '';
  const selectedMilledMaterial =
    milledMaterialUploadOptions.find((option) => option.key === effectiveMilledMaterialKey) ?? null;
  const milledMaterialUploadTarget: UploadTarget | null = selectedMilledMaterial
    ? {
        section: 'y120_milled_material',
        rowKey: selectedMilledMaterial.key,
        rowLabel: selectedMilledMaterial.label,
      }
    : null;
  const pendingMilledMaterialImages = pendingImages.filter((img) => img.section === 'y120_milled_material');
  const uploadedMilledMaterialImages = uploadedImages.filter((img) => img.section === 'y120_milled_material');
  const deleteConfirmImage = deleteConfirmImageId
    ? uploadedImages.find((img) => img.id === deleteConfirmImageId) ?? null
    : null;

  useEffect(() => {
    let cancelled = false;
    const loadAssignedMaster = async () => {
      try {
        const qs = new URLSearchParams({
          queryType: 'assigned_master',
          shiftDate,
          shiftType,
          stationCode: 'ҮЯ-120',
          operatorUid,
        });
        const res = await fetch(`/api/operator-schedules?${qs.toString()}`, { credentials: 'include' });
        const data = await res.json().catch(() => null);
        if (cancelled || !res.ok || !data?.ok) return;
        const name = String(data.master?.masterName || '').trim();
        setAssignedMasterName(name);
        if (name) {
          setForm((current) =>
            String(current.sigShiftMaster || '').trim() ? current : { ...current, sigShiftMaster: name }
          );
        }
      } catch {
        if (!cancelled) setAssignedMasterName('');
      }
    };
    loadAssignedMaster();
    return () => {
      cancelled = true;
    };
  }, [shiftDate, shiftType, operatorUid]);

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

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

  const setInspection = (key: string, patch: Partial<(typeof form.inspections)[0]>) => {
    setForm((f) => ({
      ...f,
      inspections: f.inspections.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    }));
  };

  const setMilled = (key: string, total: string) => {
    setForm((f) => ({
      ...f,
      milledMaterials: f.milledMaterials.map((r) => (r.key === key ? { ...r, total } : r)),
    }));
  };

  const addPendingFiles = (files: File[], target: UploadTarget | null) => {
    if (!files.length) return;
    if (!target) {
      toast.warning('Зураг хавсаргах төрлөө сонгоно уу.');
      return;
    }

    const valid: PendingImage[] = [];
    const errors: string[] = [];
    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      const hasAllowedExt = lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.png');
      if ((!ALLOWED_IMAGE_TYPES.has(file.type) && file.type) || !hasAllowedExt) {
        errors.push(`${file.name}: зөвхөн JPG/PNG формат дэмжинэ.`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        errors.push(`${file.name}: 5MB-аас их байна.`);
        continue;
      }
      valid.push({
        id: `${Date.now()}-${crypto.randomUUID()}`,
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

    if (errors.length) toast.warning(errors.join('\n'));
    if (valid.length) setPendingImages((current) => [...current, ...valid]);
  };

  const handleImageFiles = (files: FileList | null) => {
    if (!files?.length) return;
    addPendingFiles(Array.from(files), fileUploadTargetRef.current);
  };

  const openGallery = (target: UploadTarget | null) => {
    if (!target) {
      toast.warning('Зураг хавсаргах төрлөө сонгоно уу.');
      return;
    }
    fileUploadTargetRef.current = target;
    galleryInputRef.current?.click();
  };

  const closeCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    setCameraOpen(false);
    setCameraError('');
    setCameraTarget(null);
  };

  const openCamera = async (target: UploadTarget | null) => {
    if (!target) {
      toast.warning('Зураг хавсаргах төрлөө сонгоно уу.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.warning('Энэ browser camera preview дэмжихгүй байна. Галерей эсвэл file picker ашиглана уу.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      closeCamera();
      cameraStreamRef.current = stream;
      setCameraTarget(target);
      setCameraError('');
      setCameraOpen(true);
    } catch (e: unknown) {
      const name = e instanceof Error ? e.name : '';
      const message =
        name === 'NotAllowedError' ? 'Камер ашиглах зөвшөөрөл өгөөгүй байна.' :
        name === 'NotFoundError'   ? 'Камер олдсонгүй. Галерей ашиглана уу.' :
                                     'Камер нээхэд алдаа гарлаа.';
      setCameraError(message);
      toast.warning(message);
    }
  };

  const captureCameraImage = async () => {
    const target = cameraTarget;
    if (!target) {
      setCameraError('Зураг хавсаргах төрөл сонгогдоогүй байна.');
      return;
    }
    const video = cameraVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('Камер бэлэн болоогүй байна.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCameraError('Зураг боловсруулахад алдаа гарлаа.');
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) {
      setCameraError('Зураг үүсгэхэд алдаа гарлаа.');
      return;
    }

    const file = new File([blob], `camera-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`, {
      type: 'image/jpeg',
    });
    addPendingFiles([file], target);
    closeCamera();
  };

  const updatePendingCaption = (id: string, caption: string) => {
    setPendingImages((current) => current.map((img) => (img.id === id ? { ...img, caption } : img)));
  };

  const removePendingImage = (id: string) => {
    setPendingImages((current) => {
      const target = current.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((img) => img.id !== id);
    });
  };

  const uploadPendingImages = async (section: string) => {
    if (!shiftId) {
      toast.warning('Ээлж хадгалагдаагүй тул зураг upload хийх боломжгүй байна.');
      return;
    }
    const ready = pendingImages.filter(
      (img) => img.section === section && (img.status === 'ready' || img.status === 'error')
    );
    if (!ready.length) {
      toast.warning('Upload хийх зураг сонгоно уу.');
      return;
    }

    await Promise.all(
      ready.map(
        (img) =>
          new Promise<void>((resolve) => {
            setPendingImages((current) =>
              current.map((item) =>
                item.id === img.id ? { ...item, status: 'uploading', progress: 0, error: undefined } : item
              )
            );

            const formData = new FormData();
            formData.append('files', img.file);
            formData.append('captions', img.caption);
            formData.append('section', img.section);
            formData.append('rowKey', img.rowKey);
            formData.append('rowLabel', img.rowLabel);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', `/api/shifts/${shiftId}/images`);
            xhr.withCredentials = true;
            xhr.upload.onprogress = (event) => {
              if (!event.lengthComputable) return;
              const progress = Math.round((event.loaded / event.total) * 100);
              setPendingImages((current) =>
                current.map((item) => (item.id === img.id ? { ...item, progress } : item))
              );
            };
            xhr.onload = () => {
              let data: any = null;
              try {
                data = JSON.parse(xhr.responseText || '{}');
              } catch {
                /* ignore */
              }
              if (xhr.status >= 200 && xhr.status < 300 && data?.ok) {
                const uploaded = Array.isArray(data.images) ? (data.images as ShiftInspectionImage[]) : [];
                const next = [...uploaded, ...uploadedImagesRef.current];
                uploadedImagesRef.current = next;
                setUploadedImages(next);
                onImagesChange?.(next);
                removePendingImage(img.id);
                resolve();
                return;
              }
              const message = data?.error || 'Upload failed';
              setPendingImages((current) =>
                current.map((item) => (item.id === img.id ? { ...item, status: 'error', error: message } : item))
              );
              resolve();
            };
            xhr.onerror = () => {
              setPendingImages((current) =>
                current.map((item) =>
                  item.id === img.id ? { ...item, status: 'error', error: 'Сүлжээний алдаа гарлаа.' } : item
                )
              );
              resolve();
            };
            xhr.send(formData);
          })
      )
    );
  };

  const deleteUploadedImage = async (imageId: string) => {
    if (!shiftId) {
      toast.warning('Ээлж хадгалагдаагүй тул зураг устгах боломжгүй байна.');
      return;
    }

    setDeleteConfirmImageId(null);
    setDeletingImageIds((current) => [...current, imageId]);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/images?imageId=${encodeURIComponent(imageId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Delete failed');

      const next = uploadedImagesRef.current.filter((img) => img.id !== imageId);
      uploadedImagesRef.current = next;
      setUploadedImages(next);
      onImagesChange?.(next);
      toast.success('Зураг устгагдлаа.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Delete failed';
      toast.warning(message);
    } finally {
      setDeletingImageIds((current) => current.filter((id) => id !== imageId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const shiftMasterName = (assignedMasterName || form.sigShiftMaster || '').trim();

    // Талбарууд ХООСОН БАЙЖ БОЛНО — «заавал бөглөх» шалгалтыг хэрэглэгчийн
    // хүсэлтээр авав. Дутуу бөглөсөн маягтыг ч хадгална.
    const payload: Y120LimeMillHandoverPayload = {
      ...form,
      shiftDate: formShiftDate,
      shiftType,
      stationCode: 'ҮЯ-120',
      operatorUid,
      operatorName,
      sigReceiving: form.sigReceiving?.trim() || operatorName,
      sigShiftMaster: shiftMasterName,
      sigHandingOver: operatorName,
      submittedAt: new Date().toISOString(),
    };
    await onSubmit(payload);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-bold disabled:opacity-50"
        >
          <ChevronLeft className="w-5 h-5" />
          Буцах
        </button>
        <p className="text-xs text-gray-500 font-medium hidden sm:block">Хувилбар 2 · ҮЯ-120</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-4">
          <h1 className="text-lg md:text-xl font-bold text-gray-900 leading-snug flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-600" />
            ҮЯ-120: Шохойн тээрмийн операторын ээлж хүлээлцэх бүртгэл
          </h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Огноо</label>
              <input
                type="date"
                value={formShiftDate}
                onChange={(e) => setFormShiftDate(e.target.value)}
                className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Ээлж</label>
              <input
                type="text"
                value={shiftType}
                readOnly
                className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-gray-700"
              />
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Оператор: <span className="font-bold text-gray-900">{operatorName}</span>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-bold text-sm text-gray-800">
            Үзлэгийн төрөл
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-3 py-2 font-bold w-10">д/д</th>
                  <th className="px-3 py-2 font-bold min-w-[220px]">Үзлэгийн төрөл</th>
                  <th className="px-3 py-2 font-bold min-w-[180px]">Хэвийн / Хэвийн бус</th>
                  <th className="px-3 py-2 font-bold min-w-[160px]">Тайлбар</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.inspections.map((row, idx) => (
                  <tr key={row.key} className="align-top hover:bg-gray-50/50">
                    <td className="px-3 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-3 text-gray-900">{row.label}</td>
                    <td className="px-3 py-3">
                      <StatusRadios
                        name={`insp-${row.key}`}
                        value={row.status}
                        onChange={(v) => setInspection(row.key, { status: v })}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        value={row.comment}
                        onChange={(e) => setInspection(row.key, { comment: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                        placeholder="Тайлбар"
                      />
                    </td>
                  </tr>
                ))}
                <tr className="align-top bg-amber-50/30">
                  <td className="px-3 py-3 text-gray-500">13</td>
                  <td className="px-3 py-3 text-gray-900 font-medium" colSpan={3}>
                    <p className="mb-2">ХАБЭА тухай мэдээлэл, санал</p>
                    <textarea
                      value={form.hseInfo}
                      onChange={(e) => setForm((f) => ({ ...f, hseInfo: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                      placeholder="Мэдээлэл, санал бичнэ үү"
                    />
                  </td>
                </tr>
                <tr className="align-top bg-amber-50/30">
                  <td className="px-3 py-3 text-gray-500">14</td>
                  <td className="px-3 py-3 text-gray-900 font-medium" colSpan={3}>
                    <p className="mb-2">Тоног төхөөрөмжийн мэдээлэл, санал</p>
                    <textarea
                      value={form.equipmentInfo}
                      onChange={(e) => setForm((f) => ({ ...f, equipmentInfo: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                    />
                  </td>
                </tr>
                <tr className="align-top hover:bg-gray-50/50">
                  <td className="px-3 py-3 text-gray-500">15</td>
                  <td className="px-3 py-3 text-gray-900">Ажлын байрны эмх цэгц, цэвэрлэгээ</td>
                  <td className="px-3 py-3">
                    <StatusRadios
                      name="workplace-y120"
                      value={form.workplaceTidiness.status}
                      onChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          workplaceTidiness: { ...f.workplaceTidiness, status: v },
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="text"
                      value={form.workplaceTidiness.comment}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          workplaceTidiness: { ...f.workplaceTidiness, comment: e.target.value },
                        }))
                      }
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                      placeholder="Тайлбар"
                    />
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-3 py-4 bg-gray-50">
                    <div className="rounded-xl border border-dashed border-orange-300 bg-white p-4 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-end gap-3">
                        <div className="flex-1">
                          <label className="text-xs font-bold text-gray-500 uppercase">
                            Зураг хавсаргах үзлэгийн төрөл
                          </label>
                          <select
                            value={effectiveInspectionKey}
                            onChange={(e) => setSelectedInspectionKey(e.target.value)}
                            className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                          >
                            {inspectionUploadOptions.map((option) => (
                              <option key={option.key} value={option.key}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openCamera(inspectionUploadTarget)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
                          >
                            <Camera className="w-4 h-4" />
                            Камер
                          </button>
                          <button
                            type="button"
                            onClick={() => openGallery(inspectionUploadTarget)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
                          >
                            <ImagePlus className="w-4 h-4" />
                            Галерей
                          </button>
                          <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/jpeg,image/png"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              handleImageFiles(e.target.files);
                              e.currentTarget.value = '';
                            }}
                          />
                          <input
                            ref={galleryInputRef}
                            type="file"
                            accept="image/jpeg,image/png"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              handleImageFiles(e.target.files);
                              e.currentTarget.value = '';
                            }}
                          />
                        </div>
                      </div>

                      <p className="text-xs text-gray-500">
                        JPG/PNG формат дэмжинэ. Нэг зураг 5MB-аас ихгүй. Энэ хэсэг зөвхөн үзлэгийн төрөл хэсэгт хадгалагдана.
                      </p>

                      {pendingInspectionImages.length > 0 && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {pendingInspectionImages.map((img) => (
                              <div key={img.id} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                                <div className="relative aspect-video bg-gray-100">
                                  <Image
                                    src={img.previewUrl}
                                    alt={img.file.name}
                                    fill
                                    sizes="(min-width: 640px) 50vw, 100vw"
                                    className="object-cover"
                                    unoptimized
                                  />
                                </div>
                                <div className="p-3 space-y-2">
                                  <input
                                    type="text"
                                    value={img.caption}
                                    onChange={(e) => updatePendingCaption(img.id, e.target.value)}
                                    placeholder="Зургийн тайлбар"
                                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                                  />
                                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                                    <div
                                      className="h-full bg-orange-600 transition-all"
                                      style={{ width: `${img.progress}%` }}
                                    />
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
                            onClick={() => uploadPendingImages('y120_inspection')}
                            disabled={pendingInspectionImages.some((img) => img.status === 'uploading')}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-60"
                          >
                            <Upload className="w-4 h-4" />
                            Зураг upload хийх
                          </button>
                        </div>
                      )}

                      {uploadedInspectionImages.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-gray-500 uppercase">Хадгалагдсан зургууд</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {uploadedInspectionImages.map((img) => (
                              <div
                                key={img.id}
                                className="rounded-xl border border-gray-200 overflow-hidden bg-white hover:border-orange-300"
                              >
                                <a
                                  href={img.url || img.publicUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block"
                                >
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
                                    {img.rowLabel || 'Үзлэгийн зураг'}
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
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-bold text-sm">
            ТЭЭРЭМДСЭН ТҮҮХИЙ ЭД
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-gray-500 border-b">
                  <th className="text-left py-2 px-2">д/д</th>
                  <th className="text-left py-2 px-2">Үзүүлэлт</th>
                  <th className="text-left py-2 px-2">Хэмжих нэгж</th>
                  <th className="text-left py-2 px-2">Нийт</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.milledMaterials.map((row, idx) => (
                  <tr key={row.key}>
                    <td className="py-3 px-2">{idx + 1}</td>
                    <td className="py-3 px-2 text-gray-900">{row.label}</td>
                    <td className="py-3 px-2 text-gray-600">{row.unit}</td>
                    <td className="py-3 px-2">
                       <input
                        type="text"
                        inputMode="decimal"
                        value={row.total}
                        onChange={(e) => setMilled(row.key, e.target.value)}
                        className="w-28 px-2 py-1.5 rounded-lg border border-gray-200"
                        placeholder="%"
                      />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} className="py-4 px-2 bg-gray-50">
                    <div className="rounded-xl border border-dashed border-orange-300 bg-white p-4 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-end gap-3">
                        <div className="flex-1">
                          <label className="text-xs font-bold text-gray-500 uppercase">
                            Тээрэмдсэн түүхий эдийн зураг хавсаргах төрөл
                          </label>
                          <select
                            value={effectiveMilledMaterialKey}
                            onChange={(e) => setSelectedMilledMaterialKey(e.target.value)}
                            className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                          >
                            {milledMaterialUploadOptions.map((option) => (
                              <option key={option.key} value={option.key}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openCamera(milledMaterialUploadTarget)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
                          >
                            <Camera className="w-4 h-4" />
                            Камер
                          </button>
                          <button
                            type="button"
                            onClick={() => openGallery(milledMaterialUploadTarget)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
                          >
                            <ImagePlus className="w-4 h-4" />
                            Галерей
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-gray-500">
                        JPG/PNG формат дэмжинэ. Нэг зураг 5MB-аас ихгүй. Энэ зураг зөвхөн тээрэмдсэн түүхий эдийн хэсэгт хадгалагдана.
                      </p>

                      {pendingMilledMaterialImages.length > 0 && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {pendingMilledMaterialImages.map((img) => (
                              <div key={img.id} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                                <div className="relative aspect-video bg-gray-100">
                                  <Image
                                    src={img.previewUrl}
                                    alt={img.file.name}
                                    fill
                                    sizes="(min-width: 640px) 50vw, 100vw"
                                    className="object-cover"
                                    unoptimized
                                  />
                                </div>
                                <div className="p-3 space-y-2">
                                  <input
                                    type="text"
                                    value={img.caption}
                                    onChange={(e) => updatePendingCaption(img.id, e.target.value)}
                                    placeholder="Зургийн тайлбар"
                                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                                  />
                                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                                    <div
                                      className="h-full bg-orange-600 transition-all"
                                      style={{ width: `${img.progress}%` }}
                                    />
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
                            onClick={() => uploadPendingImages('y120_milled_material')}
                            disabled={pendingMilledMaterialImages.some((img) => img.status === 'uploading')}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-60"
                          >
                            <Upload className="w-4 h-4" />
                            Зураг upload хийх
                          </button>
                        </div>
                      )}

                      {uploadedMilledMaterialImages.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-gray-500 uppercase">Хадгалагдсан зургууд</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {uploadedMilledMaterialImages.map((img) => (
                              <div
                                key={img.id}
                                className="rounded-xl border border-gray-200 overflow-hidden bg-white hover:border-orange-300"
                              >
                                <a
                                  href={img.url || img.publicUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block"
                                >
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
                                    {img.rowLabel || 'Тээрэмдсэн түүхий эдийн зураг'}
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
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-6">
          <p className="font-bold text-gray-900 mb-2">Тэмдэглэл</p>
          <p className="text-sm text-gray-500 mb-3">
            Ээлжинд гарсан доголдол болон шийдвэрлэх асуудлыг нэг бүрчлэн бичнэ. Хэвийн (+), Хэвийн бус (−) тэмдэглэнэ.
          </p>
          <textarea
            value={form.shiftNotes}
            onChange={(e) => setForm((f) => ({ ...f, shiftNotes: e.target.value }))}
            rows={6}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono"
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Хүлээлгэн өгсөн оператор</label>
            <input
              type="text"
              value={operatorName}
              readOnly
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-gray-700 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Хянасан: Ээлжийн мастер</label>
            <div className="mt-1">
              <ShiftMasterField
                assignedMasterName={assignedMasterName}
                value={form.sigShiftMaster || ''}
                onChange={(v) => setForm((p) => ({ ...p, sigShiftMaster: v }))}
              />
            </div>
          </div>
        </div>

        <EnvironmentCheckSection
          rows={(form as any).environmentChecks}
          onChange={(rows) => setForm((prev: any) => ({ ...prev, environmentChecks: rows }))}
          disabled={submitting}
        />

        <div className="flex flex-wrap gap-4 justify-end">
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="px-6 py-3 rounded-xl border-2 border-gray-200 font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Цуцлах
          </button>
          {showSubmitButton ? (
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-8 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 disabled:opacity-50 shadow-lg shadow-orange-100"
            >
              {submitting ? (
                <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {submitLabel}
            </button>
          ) : null}
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
                  {deleteConfirmImage.rowLabel || 'Үзлэгийн зураг'}
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
                  className="px-5 py-2.5 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700"
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
              {cameraError ? <p className="text-sm text-red-600">{cameraError}</p> : <p className="text-sm text-gray-500">Зураг авахад бэлэн.</p>}
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
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
                >
                  <Camera className="w-4 h-4" />
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
