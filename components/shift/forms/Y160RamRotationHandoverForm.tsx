'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, ChevronLeft, ClipboardList, ImagePlus, Save, Trash2, Upload, X } from 'lucide-react';
import {
  type Y160RamRotationHandoverPayload,
  type Y160NormStatus,
  createEmptyY160Payload,
  Y160_EQUIPMENT_COMMENT_ONLY_KEYS,
  Y160_EQUIPMENT_LABELS,
} from '@/lib/y160-ram-rotation-handover-form';
import { useToast } from '@/components/ui/ToastProvider';
import { useAssignedShiftMaster } from '@/components/shift/forms/useAssignedShiftMaster';
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
  value: Y160NormStatus;
  onChange: (v: Y160NormStatus) => void;
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

function mergeEquipmentRows(
  defaults: Y160RamRotationHandoverPayload['equipmentInspections'],
  saved?: Partial<Y160RamRotationHandoverPayload>['equipmentInspections']
): Y160RamRotationHandoverPayload['equipmentInspections'] {
  const savedByKey = new Map((Array.isArray(saved) ? saved : []).map((row) => [String(row?.key ?? ''), row]));
  return defaults.map((row) => {
    const savedRow = savedByKey.get(row.key);
    return {
      ...row,
      status: (savedRow?.status ?? row.status) as Y160NormStatus,
      comment: savedRow?.comment ?? row.comment,
    };
  });
}

export function Y160RamRotationHandoverForm({
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
}: {
  shiftDate: string;
  shiftType: string;
  operatorName: string;
  operatorUid: string;
  initialPayload?: Partial<Y160RamRotationHandoverPayload> | null;
  shiftId?: string;
  initialImages?: ShiftInspectionImage[];
  onImagesChange?: (images: ShiftInspectionImage[]) => void;
  onBack: () => void;
  onSubmit: (payload: Y160RamRotationHandoverPayload) => Promise<void>;
  submitting: boolean;
}) {
  const toast = useToast();
  const initial = useMemo(() => {
    const empty = createEmptyY160Payload({
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
      equipmentInspections: mergeEquipmentRows(
        Y160_EQUIPMENT_LABELS.map(({ key, label }) => ({
          key,
          label,
          status: '' as Y160NormStatus,
          comment: '',
        })),
        p.equipmentInspections
      ),
    } as Y160RamRotationHandoverPayload;
  }, [shiftDate, shiftType, operatorUid, operatorName, initialPayload]);

  const [form, setForm] = useState<Y160RamRotationHandoverPayload>(() => ({ ...(initial as any) }));
  const assignedMasterName = useAssignedShiftMaster({ shiftDate, shiftType, stationCode: 'ҮЯ-160', operatorUid });
  useEffect(() => {
    if (!assignedMasterName) return;
    setForm((current: any) =>
      String(current.sigShiftMaster || '').trim() ? current : { ...current, sigShiftMaster: assignedMasterName }
    );
  }, [assignedMasterName]);
  const [formShiftDate, setFormShiftDate] = useState(shiftDate);
  const [invalidRowKey, setInvalidRowKey] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const focusInvalidRow = (key: string) => {
    setInvalidRowKey(key);
    rowRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const [selectedEquipmentImageKey, setSelectedEquipmentImageKey] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [deletingImageIds, setDeletingImageIds] = useState<string[]>([]);
  const [deleteConfirmImageId, setDeleteConfirmImageId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraTarget, setCameraTarget] = useState<UploadTarget | null>(null);
  const safeInitialImages = initialImages ?? EMPTY_SHIFT_IMAGES;
  const [uploadedImages, setUploadedImages] = useState<ShiftInspectionImage[]>(safeInitialImages);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const fileUploadTargetRef = useRef<UploadTarget | null>(null);
  const pendingImagesRef = useRef<PendingImage[]>([]);
  const uploadedImagesRef = useRef<ShiftInspectionImage[]>(safeInitialImages);
  const equipmentImageOptions = useMemo(
    () => form.equipmentInspections.map((row) => ({ key: row.key, label: row.label })),
    [form.equipmentInspections]
  );
  const effectiveEquipmentImageKey = selectedEquipmentImageKey || equipmentImageOptions[0]?.key || '';
  const selectedEquipmentImage =
    equipmentImageOptions.find((option) => option.key === effectiveEquipmentImageKey) ?? null;
  const equipmentUploadTarget: UploadTarget | null = selectedEquipmentImage
    ? { section: 'y160_equipment_operation', rowKey: selectedEquipmentImage.key, rowLabel: selectedEquipmentImage.label }
    : null;
  const pendingEquipmentImages = pendingImages.filter((img) => img.section === 'y160_equipment_operation');
  const uploadedEquipmentImages = uploadedImages.filter((img) => img.section === 'y160_equipment_operation');
  const deleteConfirmImage = deleteConfirmImageId
    ? uploadedImages.find((img) => img.id === deleteConfirmImageId) ?? null
    : null;

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

  const setEquipment = (key: string, patch: Partial<(typeof form.equipmentInspections)[0]>) => {
    setForm((f) => ({
      ...f,
      equipmentInspections: f.equipmentInspections.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    }));
    if (invalidRowKey === key && 'status' in patch) setInvalidRowKey(null);
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
      setCameraError('Камер нээж чадсангүй. Галерейгаас зураг сонгоно уу.');
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
    const shiftMasterName = (assignedMasterName || form.sigShiftMaster || '').trim();

    // Талбарууд ХООСОН БАЙЖ БОЛНО — «заавал бөглөх» шалгалтыг хэрэглэгчийн
    // хүсэлтээр авав. Дутуу бөглөсөн маягтыг ч хадгална.
    const payload: Y160RamRotationHandoverPayload = {
      ...form,
      shiftDate: formShiftDate,
      shiftType,
      stationCode: 'ҮЯ-160',
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
        <p className="text-xs text-gray-500 font-medium hidden sm:block">ҮЯ-160</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-4">
          <h1 className="text-lg md:text-xl font-bold text-gray-900 leading-snug flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-600" />
            ҮЯ-160: Рам эргэлтийн операторын бүртгэл
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
            Тоног төхөөрөмжийн ажиллагаа
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-3 py-2 font-bold w-10">д/д</th>
                  <th className="px-3 py-2 font-bold min-w-[200px]">Тоног төхөөрөмж</th>
                  <th className="px-3 py-2 font-bold min-w-[180px]">Хэвийн / Хэвийн бус</th>
                  <th className="px-3 py-2 font-bold min-w-[140px]">Тайлбар</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.equipmentInspections.map((row, idx) => {
                  const commentOnly = Y160_EQUIPMENT_COMMENT_ONLY_KEYS.has(row.key);
                  return (
                    <tr
                      key={row.key}
                      ref={(el) => { rowRefs.current[row.key] = el; }}
                      className={`align-top hover:bg-gray-50/50 ${invalidRowKey === row.key ? 'bg-red-50 ring-2 ring-inset ring-red-400' : ''}`}
                    >
                      <td className="px-3 py-3 text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-3 text-gray-900">{row.label}</td>
                      {commentOnly ? (
                        <td className="px-3 py-3" colSpan={2}>
                          <textarea
                            value={row.comment}
                            onChange={(e) => setEquipment(row.key, { comment: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                            placeholder="Тайлбар"
                          />
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-3">
                            <StatusRadios
                              name={`y160-eq-${row.key}`}
                              value={row.status}
                              onChange={(v) => setEquipment(row.key, { status: v })}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={row.comment}
                              onChange={(e) => setEquipment(row.key, { comment: e.target.value })}
                              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                              placeholder="Тайлбар"
                            />
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <div className="w-full rounded-xl border border-dashed border-orange-300 bg-white p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-end gap-3">
                <div className="w-full md:w-96 max-w-full">
                  <label className="block text-xs font-bold text-gray-500 uppercase">
                    Тоног төхөөрөмжийн ажиллагааны зураг хавсаргах төрөл
                  </label>
                  <select
                    value={effectiveEquipmentImageKey}
                    onChange={(e) => setSelectedEquipmentImageKey(e.target.value)}
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    {equipmentImageOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openCamera(equipmentUploadTarget)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
                  >
                    <Camera className="w-4 h-4" />
                    Камер
                  </button>
                  <button
                    type="button"
                    onClick={() => openGallery(equipmentUploadTarget)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
                  >
                    <ImagePlus className="w-4 h-4" />
                    Галерей
                  </button>
                </div>
              </div>

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
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/png,image/jpeg"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  handleImageFiles(e.target.files);
                  e.currentTarget.value = '';
                }}
              />

              <p className="text-xs text-gray-500">
                JPG/PNG формат дэмжинэ. Нэг зураг 5MB-аас ихгүй. Upload хийхийн өмнө зураг бүр дээр тайлбар бичнэ.
              </p>

              {pendingEquipmentImages.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {pendingEquipmentImages.map((img) => (
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
                              <span className="shrink-0">
                                {img.status === 'uploading' ? `${img.progress}%` : 'Upload хүлээгдэж байна'}
                              </span>
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
                    onClick={() => uploadPendingImages('y160_equipment_operation')}
                    disabled={pendingEquipmentImages.some((img) => img.status === 'uploading')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-60"
                  >
                    <Upload className="w-4 h-4" />
                    Зураг upload хийх
                  </button>
                </div>
              )}

              {uploadedEquipmentImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase">Хадгалагдсан зургууд</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {uploadedEquipmentImages.map((img) => (
                      <div
                        key={img.id}
                        className="rounded-xl border border-gray-200 overflow-hidden bg-white hover:border-orange-300"
                      >
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
                            {img.rowLabel || 'Тоног төхөөрөмжийн зураг'}
                          </p>
                          {img.caption ? <p className="text-[11px] text-gray-500 truncate">{img.caption}</p> : null}
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
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-6">
          <p className="font-bold text-gray-900 mb-2">Тэмдэглэл</p>
          <p className="text-sm text-gray-500 mb-3">
            Тэмдэглэл: Ээлжинд гарсан доголдол шийдвэрлэх асуудлыг бичнэ. Хэвийн (+), Хэвийн бус (−) тэмдэглэнэ.
          </p>
          <textarea
            value={form.shiftNotes}
            onChange={(e) => setForm((f) => ({ ...f, shiftNotes: e.target.value }))}
            rows={6}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono"
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Хүлээлгэн өгсөн оператор</label>
            <input
              type="text"
              value={operatorName}
              readOnly
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-700 font-medium"
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
            Хадгалах
          </button>
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
                  {deleteConfirmImage.rowLabel || 'Тоног төхөөрөмжийн ажиллагааны зураг'}
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
