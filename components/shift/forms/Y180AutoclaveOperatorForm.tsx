'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, ChevronLeft, ClipboardList, ImagePlus, Save, Plus, Trash2, Upload, X } from 'lucide-react';
import {
  coerceY180TimeRow,
  createEmptyY180Payload,
  emptyY180OperationRow,
  mergeY180EquipmentRows,
  normalizeY180OperationRows,
  y180HasLegacyTimeData,
  y180OperationRowHasData,
  y180TimeRowHasData,
  Y180_AUTOCLAVE_COUNT,
  Y180_BLOCK_SIZES,
  Y180_LOAD_DIRECTIONS,
  type Y180NormStatus,
  type Y180AutoclaveOperatorPayload,
  type Y180OperationRow,
} from '@/lib/y180-autoclave-operator-form';
import { useToast } from '@/components/ui/ToastProvider';
import { useAssignedShiftMaster } from '@/components/shift/forms/useAssignedShiftMaster';
import { ShiftMasterField } from '@/components/shift/forms/shared/ShiftMasterField';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const EMPTY_SHIFT_IMAGES: ShiftInspectionImage[] = [];
// Хуучин даралтын хүснэгтийн зургууд энэ section-д хадгалагдсан тул утгыг нь өөрчлөхгүй —
// одоо ажилбарын мөр бүрийн зураг мөн энд хадгалагдана.
const Y180_OPERATION_IMAGE_SECTION = 'y180_autoclave_pressure';
const Y180_EQUIPMENT_IMAGE_SECTION = 'y180_equipment_operation';

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
  value: Y180NormStatus;
  onChange: (v: Y180NormStatus) => void;
  name: string;
}) {
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

const capitalize = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

/** Зураг хавсаргах мөрийн шошго: «2. Автоклав №3 · оруулсан · 13:50». */
function operationRowLabel(row: Y180OperationRow, index: number) {
  const time = row.loadDirection === 'гаргасан' ? row.openedTime || row.startedTime : row.startedTime || row.openedTime;
  return [
    `${index + 1}. ${row.autoclaveNum ? `Автоклав №${row.autoclaveNum}` : 'Автоклав'}`,
    row.loadDirection,
    time,
  ].filter(Boolean).join(' · ');
}

export function Y180AutoclaveOperatorForm({
  shiftDate,
  shiftType,
  operatorUid,
  operatorName,
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
  operatorUid: string;
  operatorName: string;
  initialPayload?: Partial<Y180AutoclaveOperatorPayload> | null;
  shiftId?: string;
  initialImages?: ShiftInspectionImage[];
  onImagesChange?: (images: ShiftInspectionImage[]) => void;
  onBack: () => void;
  onSubmit: (payload: Y180AutoclaveOperatorPayload) => Promise<void>;
  submitting: boolean;
}) {
  const toast = useToast();
  const initial = useMemo(() => {
    const empty = createEmptyY180Payload({ shiftDate, shiftType, operatorUid, operatorName });
    const p = initialPayload ?? null;
    const savedRows = normalizeY180OperationRows(p?.operationRows);
    return {
      ...empty,
      ...(p ?? {}),
      // Шинэ маягт нэг хоосон мөртэй нээгдэнэ; хадгалахад хоосон мөр хасагдана.
      operationRows: savedRows.length ? savedRows : [emptyY180OperationRow(operatorName)],
      // Хуучин цагийн хүснэгт засварлагдахгүй, хадгалахад хэвээр дамжина.
      timeRows: y180HasLegacyTimeData(p?.timeRows) ? (p?.timeRows ?? []).map((row) => coerceY180TimeRow(row)) : [],
      equipmentInspections: mergeY180EquipmentRows(p?.equipmentInspections),
    } as Y180AutoclaveOperatorPayload;
  }, [shiftDate, shiftType, operatorUid, operatorName, initialPayload]);

  const [form, setForm] = useState<Y180AutoclaveOperatorPayload>(() => ({ ...(initial as any) }));
  const assignedMasterName = useAssignedShiftMaster({ shiftDate, shiftType, stationCode: 'ҮЯ-180', operatorUid });
  useEffect(() => {
    if (!assignedMasterName) return;
    setForm((current) =>
      String(current.sigShiftMaster || '').trim() ? current : { ...current, sigShiftMaster: assignedMasterName }
    );
  }, [assignedMasterName]);
  useEffect(() => {
    if (!operatorName) return;
    setForm((current) =>
      String(current.sigReceiving || '').trim() ? current : { ...current, sigReceiving: operatorName }
    );
  }, [operatorName]);
  const [formShiftDate, setFormShiftDate] = useState(shiftDate);
  const [invalidRowKey, setInvalidRowKey] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const focusInvalidRow = (key: string) => {
    setInvalidRowKey(key);
    rowRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const [selectedImageRowKey, setSelectedImageRowKey] = useState('');
  const [selectedEquipmentImageKey, setSelectedEquipmentImageKey] = useState('');
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
  const legacyTimeRowCount = form.timeRows.filter(y180TimeRowHasData).length;
  const imageRowOptions = useMemo(
    () => form.operationRows.map((row, index) => ({ key: `op_${row.id}`, label: operationRowLabel(row, index) })),
    [form.operationRows]
  );
  const effectiveImageRowKey = imageRowOptions.some((option) => option.key === selectedImageRowKey)
    ? selectedImageRowKey
    : imageRowOptions[0]?.key || '';
  const selectedImageRow = imageRowOptions.find((option) => option.key === effectiveImageRowKey) ?? null;
  const operationImageUploadTarget: UploadTarget | null = selectedImageRow
    ? { section: Y180_OPERATION_IMAGE_SECTION, rowKey: selectedImageRow.key, rowLabel: selectedImageRow.label }
    : null;
  const pendingOperationImages = pendingImages.filter((img) => img.section === Y180_OPERATION_IMAGE_SECTION);
  const uploadedOperationImages = uploadedImages.filter((img) => img.section === Y180_OPERATION_IMAGE_SECTION);
  const equipmentImageOptions = useMemo(
    () => form.equipmentInspections.map((row, index) => ({ key: row.key, label: `${index + 1}. ${row.label}` })),
    [form.equipmentInspections]
  );
  const effectiveEquipmentImageKey = selectedEquipmentImageKey || equipmentImageOptions[0]?.key || '';
  const selectedEquipmentImage = equipmentImageOptions.find((option) => option.key === effectiveEquipmentImageKey) ?? null;
  const equipmentImageUploadTarget: UploadTarget | null = selectedEquipmentImage
    ? {
        section: Y180_EQUIPMENT_IMAGE_SECTION,
        rowKey: selectedEquipmentImage.key,
        rowLabel: selectedEquipmentImage.label,
      }
    : null;
  const pendingEquipmentImages = pendingImages.filter((img) => img.section === Y180_EQUIPMENT_IMAGE_SECTION);
  const uploadedEquipmentImages = uploadedImages.filter((img) => img.section === Y180_EQUIPMENT_IMAGE_SECTION);
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

  const patchOperationRow = (id: string, patch: Partial<Y180OperationRow>) => {
    setForm((prev) => ({
      ...prev,
      operationRows: prev.operationRows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    }));
  };

  const addOperationRow = () => {
    setForm((prev) => ({ ...prev, operationRows: [...prev.operationRows, emptyY180OperationRow(operatorName)] }));
  };

  const removeOperationRow = (id: string) => {
    setForm((prev) => ({ ...prev, operationRows: prev.operationRows.filter((row) => row.id !== id) }));
  };

  const setEquipment = (key: string, patch: Partial<(typeof form.equipmentInspections)[0]>) => {
    setForm((prev) => ({
      ...prev,
      equipmentInspections: prev.equipmentInspections.map((r) => (r.key === key ? { ...r, ...patch } : r)),
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
    const payload: Y180AutoclaveOperatorPayload = {
      ...(form as any),
      formVersion: 2,
      shiftDate: formShiftDate,
      shiftType,
      stationCode: 'ҮЯ-180',
      operatorUid,
      operatorName,
      sigHandingOver: operatorName,
      submittedAt: new Date().toISOString(),
      // Хоосон нэмсэн мөр хадгалагдахгүй.
      operationRows: normalizeY180OperationRows(form.operationRows).filter(y180OperationRowHasData),
      // Хуучин бүртгэлийн цагийн хүснэгт (байвал) өөрчлөгдөхгүйгээр хадгалагдана.
      timeRows: form.timeRows,
    };
    await onSubmit(payload);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} disabled={submitting} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-bold disabled:opacity-50">
          <ChevronLeft className="w-5 h-5" /> Буцах
        </button>
        <p className="text-xs text-gray-500 font-medium hidden sm:block">ҮЯ-180</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-[100rem] mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-4">
          <h1 className="text-lg md:text-xl font-bold text-gray-900 leading-snug flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-600" />
            ҮЯ-180: Автоклавын операторын бүртгэл
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
          <p className="text-sm text-gray-600">Оператор: <span className="font-bold text-gray-900">{operatorName}</span></p>
        </div>

        {/* ── Автоклавын ажилбарын бүртгэл (MS Forms загвар: мөр бүр нэг ажилбар) ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-bold text-sm text-gray-800">Автоклавын ажилбарын бүртгэл</span>
              <p className="text-xs text-gray-500 mt-0.5">Автоклав оруулах, гаргах ажилбар бүрийг тусад нь мөрөөр бүртгэнэ.</p>
            </div>
            <button type="button" onClick={addOperationRow} className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700">
              <Plus className="w-4 h-4" /> Мөр нэмэх
            </button>
          </div>

          {form.operationRows.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              Мөр байхгүй байна.{' '}
              <button type="button" onClick={addOperationRow} className="text-orange-600 font-bold hover:underline">Мөр нэмэх</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-left text-sm border-collapse w-max min-w-full">
                <thead>
                  <tr className="bg-gray-50 text-[11px] text-gray-600 border-b border-gray-200 align-bottom">
                    <th className="px-2 py-2 w-8 text-center">№</th>
                    <th className="px-2 py-2 min-w-[120px]">Бүтээгдэхүүний хэмжээ</th>
                    <th className="px-2 py-2 min-w-[140px]">Автоклав</th>
                    <th className="px-2 py-2 min-w-[190px]">Оруулсан / гаргасан</th>
                    <th className="px-2 py-2 min-w-[110px]">Автоклавыг эхлүүлсэн цаг</th>
                    <th className="px-2 py-2 min-w-[110px]">Автоклавыг онгойлгосон цаг</th>
                    <th className="px-2 py-2 min-w-[180px]">Тухайн автоклавын ажиллагаа</th>
                    <th className="px-2 py-2 min-w-[180px]">Ажиллагаанд нөлөөлсөн бусад зүйл</th>
                    <th className="px-2 py-2 min-w-[220px]">Нэмэлт ажил /засвар, цэвэрлэгээ, бусад/</th>
                    <th className="px-2 py-2 min-w-[150px]">Бүртгэл хөтөлсөн</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {form.operationRows.map((row, ri) => (
                    <tr key={row.id} className="border-b border-gray-100 align-top hover:bg-gray-50/50">
                      <td className="px-2 py-2 text-xs text-gray-400 text-center">{ri + 1}</td>
                      <td className="px-2 py-1.5">
                        <select
                          value={row.blockSize}
                          onChange={(e) => patchOperationRow(row.id, { blockSize: e.target.value })}
                          aria-label={`${ri + 1}-р мөр: Бүтээгдэхүүний хэмжээ`}
                          className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
                        >
                          <option value="">Сонгох</option>
                          {Y180_BLOCK_SIZES.map((size) => (
                            <option key={size} value={size}>{size}</option>
                          ))}
                          {row.blockSize && !(Y180_BLOCK_SIZES as readonly string[]).includes(row.blockSize) ? (
                            <option value={row.blockSize}>{row.blockSize}</option>
                          ) : null}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={row.autoclaveNum}
                          onChange={(e) => patchOperationRow(row.id, { autoclaveNum: e.target.value })}
                          aria-label={`${ri + 1}-р мөр: Автоклав`}
                          className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs"
                        >
                          <option value="">Сонгох</option>
                          {Array.from({ length: Y180_AUTOCLAVE_COUNT }, (_, i) => String(i + 1)).map((num) => (
                            <option key={num} value={num}>Автоклав №{num}</option>
                          ))}
                          {row.autoclaveNum && !/^[1-6]$/.test(row.autoclaveNum) ? (
                            <option value={row.autoclaveNum}>{row.autoclaveNum}</option>
                          ) : null}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1">
                          {Y180_LOAD_DIRECTIONS.map((direction) => {
                            const active = row.loadDirection === direction;
                            return (
                              <button
                                key={direction}
                                type="button"
                                aria-pressed={active}
                                onClick={() => patchOperationRow(row.id, { loadDirection: direction })}
                                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-bold transition-colors ${
                                  active
                                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                                    : 'border-gray-200 text-gray-600 hover:border-orange-200'
                                }`}
                              >
                                {capitalize(direction)}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="time"
                          value={row.startedTime}
                          onChange={(e) => patchOperationRow(row.id, { startedTime: e.target.value })}
                          aria-label={`${ri + 1}-р мөр: Автоклавыг эхлүүлсэн цаг`}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs tabular-nums"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="time"
                          value={row.openedTime}
                          onChange={(e) => patchOperationRow(row.id, { openedTime: e.target.value })}
                          aria-label={`${ri + 1}-р мөр: Автоклавыг онгойлгосон цаг`}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs tabular-nums"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={row.autoclaveCondition}
                          onChange={(e) => patchOperationRow(row.id, { autoclaveCondition: e.target.value })}
                          aria-label={`${ri + 1}-р мөр: Тухайн автоклавын ажиллагаа`}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={row.otherFactors}
                          onChange={(e) => patchOperationRow(row.id, { otherFactors: e.target.value })}
                          aria-label={`${ri + 1}-р мөр: Ажиллагаанд нөлөөлсөн бусад зүйл`}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={row.extraWork}
                          onChange={(e) => patchOperationRow(row.id, { extraWork: e.target.value })}
                          aria-label={`${ri + 1}-р мөр: Нэмэлт ажил`}
                          placeholder="Засвар, тосолгоо, цэвэрлэгээ..."
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={row.recordedBy}
                          onChange={(e) => patchOperationRow(row.id, { recordedBy: e.target.value })}
                          aria-label={`${ri + 1}-р мөр: Бүртгэл хөтөлсөн`}
                          className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <button
                          type="button"
                          onClick={() => removeOperationRow(row.id)}
                          className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
                          title="Мөр устгах"
                          aria-label={`${ri + 1}-р мөр устгах`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {legacyTimeRowCount > 0 ? (
            <p className="px-4 py-3 text-xs text-amber-800 bg-amber-50 border-t border-amber-200">
              Энэ бүртгэлд хуучин загварын цагийн хүснэгтийн {legacyTimeRowCount} мөр хадгалагдсан байна. Харах горимд
              харагдах бөгөөд хадгалахад хэвээр үлдэнэ.
            </p>
          ) : null}
        </div>

        <div className="bg-white rounded-2xl border border-dashed border-orange-300 shadow-sm p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="w-full md:w-80 max-w-full">
              <label className="block text-xs font-bold text-gray-500 uppercase">
                Ажилбарын бүртгэлийн зураг хавсаргах мөр
              </label>
              <select
                value={effectiveImageRowKey}
                onChange={(e) => setSelectedImageRowKey(e.target.value)}
                className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
              >
                {imageRowOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openCamera(operationImageUploadTarget)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
              >
                <Camera className="w-4 h-4" />
                Камер
              </button>
              <button
                type="button"
                onClick={() => openGallery(operationImageUploadTarget)}
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

          <p className="text-xs text-gray-500">
            JPG/PNG формат дэмжинэ. Нэг зураг 5MB-аас ихгүй. Upload хийхийн өмнө зураг бүр дээр тайлбар бичнэ.
          </p>

          {pendingOperationImages.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pendingOperationImages.map((img) => (
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
                onClick={() => uploadPendingImages(Y180_OPERATION_IMAGE_SECTION)}
                disabled={pendingOperationImages.some((img) => img.status === 'uploading')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-60"
              >
                <Upload className="w-4 h-4" />
                Зураг upload хийх
              </button>
            </div>
          )}

          {uploadedOperationImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase">Хадгалагдсан зургууд</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {uploadedOperationImages.map((img) => (
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
                      <p className="text-[11px] font-bold text-gray-700 truncate">{img.rowLabel || 'Ажилбарын бүртгэлийн зураг'}</p>
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

        {/* ── Тоног төхөөрөмжийн ажиллагаа (12 мөр) ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-bold text-sm text-gray-800">
            Тоног төхөөрөмжийн ажиллагаа
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="px-3 py-2 font-bold w-10">д/д</th>
                  <th className="px-3 py-2 font-bold min-w-[240px]">Тоног төхөөрөмж</th>
                  <th className="px-3 py-2 font-bold min-w-[170px]">Хэвийн / Хэвийн бус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.equipmentInspections.map((row, idx) => (
                  <tr
                    key={row.key}
                    ref={(el) => { rowRefs.current[row.key] = el; }}
                    className={`align-top hover:bg-gray-50/50 ${invalidRowKey === row.key ? 'bg-red-50 ring-2 ring-inset ring-red-400' : ''}`}
                  >
                    <td className="px-3 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-3 text-gray-900">{row.label}</td>
                    <td className="px-3 py-3">
                      <StatusRadios name={`y180-eq-${row.key}`} value={row.status} onChange={(v) => setEquipment(row.key, { status: v })} />
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
                    onClick={() => openCamera(equipmentImageUploadTarget)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
                  >
                    <Camera className="w-4 h-4" />
                    Камер
                  </button>
                  <button
                    type="button"
                    onClick={() => openGallery(equipmentImageUploadTarget)}
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
                    onClick={() => uploadPendingImages(Y180_EQUIPMENT_IMAGE_SECTION)}
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
                            {img.rowLabel || 'Тоног төхөөрөмжийн ажиллагааны зураг'}
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

        {/* ── Тэмдэглэгээ ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
            <span className="font-bold">Тайлбар:</span> Тэмдэглэл хэсэгт тухайн ээлжийн турш тоног төхөөрөмж дээр илэрсэн гэмтэл, шийдвэрлэх асуудал, ажлын байрны эмх цэгц цэвэрлэгээ
          </div>
          <p className="font-bold text-gray-800">Тэмдэглэгээ</p>
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={5} className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm font-mono" placeholder="Тэмдэглэгээ..." />
        </div>

        {/* ── Гарын үсэг + Submit ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">Ээлж хүлээлгэн өгсөн оператор</p>
              <input
                type="text"
                value={operatorName}
                readOnly
                className="w-full px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-700 font-medium"
                placeholder="Нэр"
              />
            </div>
            <div>
              {/* Автоклавын бүртгэлийг технологийн мастер хянадаг (ээлжийн мастер биш). */}
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">Хянасан: технологийн мастер</p>
              <ShiftMasterField
                assignedMasterName={assignedMasterName}
                value={form.sigShiftMaster || ''}
                onChange={(v) => setForm((p) => ({ ...p, sigShiftMaster: v }))}
                placeholder="Технологийн мастер сонгох..."
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
                  {deleteConfirmImage.rowLabel || 'Зураг'}
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
