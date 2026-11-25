'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, ChevronLeft, ImagePlus, Save, ClipboardList, Trash2, Upload, X } from 'lucide-react';
import {
  type Y130MixingTowerHandoverPayload,
  type Y130NormStatus,
  createEmptyY130Payload,
  Y130_PERCENT_INDICATOR_KEYS,
} from '@/lib/y130-mixing-tower-handover-form';
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
  value: Y130NormStatus;
  onChange: (v: Y130NormStatus) => void;
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

export function Y130MixingTowerHandoverForm({
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
  initialPayload?: Partial<Y130MixingTowerHandoverPayload> | null;
  shiftId?: string;
  initialImages?: ShiftInspectionImage[];
  onImagesChange?: (images: ShiftInspectionImage[]) => void;
  onBack: () => void;
  onSubmit: (payload: Y130MixingTowerHandoverPayload) => Promise<void>;
  submitting: boolean;
}) {
  const toast = useToast();
  const initial = useMemo(() => {
    const empty = createEmptyY130Payload({
        shiftDate,
        shiftType,
        operatorUid,
        operatorName,
      });
    const p = initialPayload ?? null;
    if (!p) return empty;
    const savedIndicators = Array.isArray((p as any).indicators) ? ((p as any).indicators as any[]) : [];
    const indicatorByKey = new Map<string, any>(savedIndicators.map((r) => [String(r?.key ?? ''), r]));
    const savedEquipment = Array.isArray((p as any).equipmentInspections)
      ? ((p as any).equipmentInspections as any[])
      : [];
    const equipmentByKey = new Map<string, any>(savedEquipment.map((r) => [String(r?.key ?? ''), r]));
    return {
      ...empty,
      ...p,
      stationCode: 'ҮЯ-130',
      operatorUid,
      operatorName,
      shiftType,
      shiftDate: String((p as any).shiftDate || empty.shiftDate),
      indicators: empty.indicators.map((d) => {
        const saved = indicatorByKey.get(d.key);
        return { ...d, value: typeof saved?.value === 'string' ? saved.value : d.value };
      }),
      equipmentInspections: empty.equipmentInspections.map((d) => {
        const saved = equipmentByKey.get(d.key);
        return saved && typeof saved === 'object'
          ? { ...d, status: saved.status ?? d.status, comment: saved.comment ?? d.comment }
          : d;
      }),
    } as any;
  }, [shiftDate, shiftType, operatorUid, operatorName, initialPayload]);

  const [form, setForm] = useState<Y130MixingTowerHandoverPayload>(() => ({ ...(initial as any) }));
  const assignedMasterName = useAssignedShiftMaster({ shiftDate, shiftType, stationCode: 'ҮЯ-130', operatorUid });
  useEffect(() => {
    if (!assignedMasterName) return;
    setForm((current: any) =>
      String(current.sigShiftMaster || '').trim() ? current : { ...current, sigShiftMaster: assignedMasterName }
    );
  }, [assignedMasterName]);
  const [formShiftDate, setFormShiftDate] = useState(shiftDate);
  const [selectedIndicatorImageKey, setSelectedIndicatorImageKey] = useState('');
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
  const indicatorImageOptions = useMemo(
    () => form.indicators.map((row) => ({ key: row.key, label: row.label })),
    [form.indicators]
  );
  const effectiveIndicatorImageKey = selectedIndicatorImageKey || indicatorImageOptions[0]?.key || '';
  const selectedIndicatorImage =
    indicatorImageOptions.find((option) => option.key === effectiveIndicatorImageKey) ?? null;
  const indicatorUploadTarget: UploadTarget | null = selectedIndicatorImage
    ? { section: 'y130_indicators', rowKey: selectedIndicatorImage.key, rowLabel: selectedIndicatorImage.label }
    : null;
  const pendingIndicatorImages = pendingImages.filter((img) => img.section === 'y130_indicators');
  const uploadedIndicatorImages = uploadedImages.filter((img) => img.section === 'y130_indicators');
  const [selectedEquipmentImageKey, setSelectedEquipmentImageKey] = useState('');
  const equipmentImageOptions = useMemo(
    () => [
      ...form.equipmentInspections.map((row) => ({ key: row.key, label: row.label })),
      { key: 'hseInfo', label: 'ХАБЭА тухай мэдээлэл, санал' },
      { key: 'equipmentInfo', label: 'Тоног төхөөрөмжийн мэдээлэл, санал' },
      { key: 'workplaceCleaning', label: 'Ажлын байрны эмх цэгц, цэвэрлэгээ' },
    ],
    [form.equipmentInspections]
  );
  const effectiveEquipmentImageKey = selectedEquipmentImageKey || equipmentImageOptions[0]?.key || '';
  const selectedEquipmentImage =
    equipmentImageOptions.find((option) => option.key === effectiveEquipmentImageKey) ?? null;
  const equipmentUploadTarget: UploadTarget | null = selectedEquipmentImage
    ? { section: 'y130_equipment_operation', rowKey: selectedEquipmentImage.key, rowLabel: selectedEquipmentImage.label }
    : null;
  const pendingEquipmentImages = pendingImages.filter((img) => img.section === 'y130_equipment_operation');
  const uploadedEquipmentImages = uploadedImages.filter((img) => img.section === 'y130_equipment_operation');
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

  const setIndicator = (key: string, value: string) => {
    setForm((f) => ({
      ...f,
      indicators: f.indicators.map((r) => (r.key === key ? { ...r, value } : r)),
    }));
  };

  const setEquipment = (key: string, patch: Partial<(typeof form.equipmentInspections)[0]>) => {
    setForm((f) => ({
      ...f,
      equipmentInspections: f.equipmentInspections.map((r) => (r.key === key ? { ...r, ...patch } : r)),
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
    if (ready.some((img) => !img.caption.trim())) {
      toast.warning('Зураг бүр дээр тайлбар бичнэ үү.');
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
    const payload: Y130MixingTowerHandoverPayload = {
      ...form,
      workplaceCleaning: form.workplaceCleaning ?? { status: '', comment: '' },
      shiftDate: formShiftDate,
      shiftType,
      stationCode: 'ҮЯ-130',
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
        <p className="text-xs text-gray-500 font-medium hidden sm:block">Хувилбар 2 · ҮЯ-130</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-4">
          <h1 className="text-lg md:text-xl font-bold text-gray-900 leading-snug flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-600" />
            ҮЯ-130: Зуурах цамхагийн операторын ээлж хүлээлцэх бүртгэл
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
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-bold text-sm text-gray-800">Үзүүлэлтүүд</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-3 py-2 font-bold w-10">д/д</th>
                  <th className="px-3 py-2 font-bold min-w-[200px]">Үзүүлэлтүүд</th>
                  <th className="px-3 py-2 font-bold w-24">Хэмжих нэгж</th>
                  <th className="px-3 py-2 font-bold min-w-[120px]">Утга</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.indicators.map((row, idx) => (
                  <tr key={row.key} className="align-top hover:bg-gray-50/50">
                    <td className="px-3 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-3 text-gray-900">{row.label}</td>
                    <td className="px-3 py-3 text-gray-600">{row.unit}</td>
                    <td className="px-3 py-3">
                       <input
                        type="text"
                        inputMode={Y130_PERCENT_INDICATOR_KEYS.has(row.key) ? 'decimal' : 'text'}
                        value={row.value}
                        onChange={(e) => setIndicator(row.key, e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                        placeholder={Y130_PERCENT_INDICATOR_KEYS.has(row.key) ? '0–100' : '—'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <div className="w-full rounded-xl border border-dashed border-orange-300 bg-white p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-end gap-3">
                <div className="w-full md:w-96 max-w-full">
                  <label className="block text-xs font-bold text-gray-500 uppercase">
                    Үзүүлэлтүүдийн зураг хавсаргах төрөл
                  </label>
                  <select
                    value={effectiveIndicatorImageKey}
                    onChange={(e) => setSelectedIndicatorImageKey(e.target.value)}
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    {indicatorImageOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openCamera(indicatorUploadTarget)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
                  >
                    <Camera className="w-4 h-4" />
                    Камер
                  </button>
                  <button
                    type="button"
                    onClick={() => openGallery(indicatorUploadTarget)}
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
                JPG/PNG формат дэмжинэ. Нэг зураг 5MB-аас ихгүй. Upload хийхийн өмнө зураг бүр дээр тайлбар бичнэ.
              </p>

              {pendingIndicatorImages.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {pendingIndicatorImages.map((img) => (
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
                    onClick={() => uploadPendingImages('y130_indicators')}
                    disabled={pendingIndicatorImages.some((img) => img.status === 'uploading')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-60"
                  >
                    <Upload className="w-4 h-4" />
                    Зураг upload хийх
                  </button>
                </div>
              )}

              {uploadedIndicatorImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase">Хадгалагдсан зургууд</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {uploadedIndicatorImages.map((img) => (
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
                            {img.rowLabel || 'Үзүүлэлтийн зураг'}
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

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-bold text-sm text-gray-800">
            Тоног төхөөрөмжийн ажиллагаа
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-3 py-2 font-bold w-10">№</th>
                  <th className="px-3 py-2 font-bold min-w-[200px]">Тоног төхөөрөмжийн нэр</th>
                  <th className="px-3 py-2 font-bold min-w-[180px]">Хэвийн / Хэвийн бус</th>
                  <th className="px-3 py-2 font-bold min-w-[140px]">Тайлбар</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.equipmentInspections.map((row, idx) => (
                  <tr key={row.key} className="align-top hover:bg-gray-50/50">
                    <td className="px-3 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-3 text-gray-900">{row.label}</td>
                    <td className="px-3 py-3">
                      <StatusRadios
                        name={`y130-eq-${row.key}`}
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
                  </tr>
                ))}
                <tr className="align-top bg-amber-50/30">
                  <td className="px-3 py-3 text-gray-500">12</td>
                  <td className="px-3 py-3 text-gray-900 font-medium" colSpan={3}>
                    <p className="mb-2">ХАБЭА тухай мэдээлэл, санал</p>
                    <textarea
                      value={form.hseInfo}
                      onChange={(e) => setForm((f) => ({ ...f, hseInfo: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
                    />
                  </td>
                </tr>
                <tr className="align-top bg-amber-50/30">
                  <td className="px-3 py-3 text-gray-500">13</td>
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
                <tr className="align-top bg-amber-50/30">
                  <td className="px-3 py-3 text-gray-500">14</td>
                  <td className="px-3 py-3 text-gray-900 font-medium">Ажлын байрны эмх цэгц, цэвэрлэгээ</td>
                  <td className="px-3 py-3">
                    <StatusRadios
                      name="y130-workplace-cleaning"
                      value={form.workplaceCleaning?.status ?? ''}
                      onChange={(v) =>
                        setForm((f) => {
                          const cur = f.workplaceCleaning ?? { status: '' as Y130NormStatus, comment: '' };
                          return { ...f, workplaceCleaning: { ...cur, status: v } };
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="text"
                      value={form.workplaceCleaning?.comment ?? ''}
                      onChange={(e) =>
                        setForm((f) => {
                          const cur = f.workplaceCleaning ?? { status: '' as Y130NormStatus, comment: '' };
                          return { ...f, workplaceCleaning: { ...cur, comment: e.target.value } };
                        })
                      }
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                      placeholder="Тайлбар"
                    />
                  </td>
                </tr>
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
                    onClick={() => uploadPendingImages('y130_equipment_operation')}
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
                            {img.rowLabel || 'Тоног төхөөрөмжийн ажиллагааны зураг'}
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

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-6">
          <p className="font-bold text-gray-900 mb-3">Орц найрлага өөрчлөх үеийн бүртгэл :</p>
          <textarea
            value={form.ingredientChangeNote}
            onChange={(e) => setForm((f) => ({ ...f, ingredientChangeNote: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
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
                  {deleteConfirmImage.rowLabel || 'Үзүүлэлтийн зураг'}
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
