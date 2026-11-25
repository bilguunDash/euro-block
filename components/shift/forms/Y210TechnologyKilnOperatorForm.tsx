'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, ChevronLeft, ClipboardList, ImagePlus, Save, Trash2, Upload, X } from 'lucide-react';
import {
  createEmptyY210Payload,
  mergeY210Rows,
  type Y210NormStatus,
  type Y210TechnologyKilnOperatorPayload,
  Y210_PARAM_COLS_MAIN,
  Y210_PARAM_COLS_TAIL,
} from '@/lib/y210-technology-kiln-operator-form';
import { useToast } from '@/components/ui/ToastProvider';
import { useAssignedShiftMaster } from '@/components/shift/forms/useAssignedShiftMaster';
import { ShiftMasterField } from '@/components/shift/forms/shared/ShiftMasterField';
import { EnvironmentCheckSection } from '@/components/shift/EnvironmentCheckSection';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const EMPTY_SHIFT_IMAGES: ShiftInspectionImage[] = [];
const Y210_IMAGE_SECTION = 'y210_technology_kiln';

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
  value: Y210NormStatus;
  onChange: (v: Y210NormStatus) => void;
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

export function Y210TechnologyKilnOperatorForm({
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
  initialPayload?: Partial<Y210TechnologyKilnOperatorPayload> | null;
  shiftId?: string;
  initialImages?: ShiftInspectionImage[];
  onImagesChange?: (images: ShiftInspectionImage[]) => void;
  onBack: () => void;
  onSubmit: (payload: Y210TechnologyKilnOperatorPayload) => Promise<void>;
  submitting: boolean;
}) {
  const toast = useToast();
  const initial = useMemo(() => {
    const empty = createEmptyY210Payload({ shiftDate, shiftType, operatorUid, operatorName });
    const p = initialPayload ?? null;
    return p ? ({ ...empty, ...p, rows: mergeY210Rows(p.rows) } as any) : empty;
  }, [shiftDate, shiftType, operatorUid, operatorName, initialPayload]);

  const [form, setForm] = useState<Y210TechnologyKilnOperatorPayload>(() => ({ ...(initial as any) }));
  const assignedMasterName = useAssignedShiftMaster({ shiftDate, shiftType, stationCode: 'ҮЯ-210', operatorUid });
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
  const [invalidRowIndex, setInvalidRowIndex] = useState<number | null>(null);
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const focusInvalidRow = (idx: number) => {
    setInvalidRowIndex(idx);
    rowRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const [selectedImageRowKey, setSelectedImageRowKey] = useState('');
  const [selectedImageColumnKey, setSelectedImageColumnKey] = useState('');
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
  const imageRowOptions = useMemo(
    () => form.rows.map((row, index) => ({ key: row.time || `row_${index + 1}`, label: `${index + 1}. ${row.time || 'Цаг'}` })),
    [form.rows]
  );
  const imageColumnOptions = useMemo(
    () => [
      ...Y210_PARAM_COLS_MAIN.map((col, index) => ({
        key: String(col.key),
        label: `${index + 1}. ${col.label}${col.unit ? ` (${col.unit})` : ''}`,
      })),
      {
        key: 'status',
        label: `${Y210_PARAM_COLS_MAIN.length + 1}. Ус зөөлрүүлэгчийн ажиллагаа`,
      },
      ...Y210_PARAM_COLS_TAIL.map((col, index) => ({
        key: String(col.key),
        label: `${Y210_PARAM_COLS_MAIN.length + 2 + index}. ${col.label}${col.unit ? ` (${col.unit})` : ''}`,
      })),
    ],
    []
  );
  const effectiveImageRowKey = selectedImageRowKey || imageRowOptions[0]?.key || '';
  const effectiveImageColumnKey = selectedImageColumnKey || imageColumnOptions[0]?.key || '';
  const selectedImageRow = imageRowOptions.find((option) => option.key === effectiveImageRowKey) ?? null;
  const selectedImageColumn = imageColumnOptions.find((option) => option.key === effectiveImageColumnKey) ?? null;
  const imageUploadTarget: UploadTarget | null = selectedImageRow
    ? {
        section: Y210_IMAGE_SECTION,
        rowKey: `${selectedImageRow.key}_${selectedImageColumn?.key || 'column'}`,
        rowLabel: selectedImageColumn ? `${selectedImageRow.label} - ${selectedImageColumn.label}` : selectedImageRow.label,
      }
    : null;
  const pendingKilnImages = pendingImages.filter((img) => img.section === Y210_IMAGE_SECTION);
  const uploadedKilnImages = uploadedImages.filter((img) => img.section === Y210_IMAGE_SECTION);
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

  const patchRow = (rowIdx: number, key: any, value: string | Y210NormStatus) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.map((r, i) => (i === rowIdx ? { ...r, [key]: value } : r)),
    }));
    if (invalidRowIndex === rowIdx && key === 'status') setInvalidRowIndex(null);
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
    const payload: Y210TechnologyKilnOperatorPayload = {
      ...(form as any),
      shiftDate: formShiftDate,
      shiftType,
      stationCode: 'ҮЯ-210',
      operatorUid,
      operatorName,
      sigHandingOver: form.sigHandingOver?.trim() || operatorName,
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
        <p className="text-xs text-gray-500 font-medium hidden sm:block">ҮЯ-210</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-4">
          <h1 className="text-lg md:text-xl font-bold text-gray-900 leading-snug flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-600" />
            ҮЯ-210: Технологийн зуухны операторын бүртгэл
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
          {/* Нэг <table>: Цаг + № нь ижил <tr> дээр — мөрийн саарам шугам яг таарна */}
          <div className="overflow-x-auto">
            <table className="text-left text-sm border-collapse w-max min-w-[1600px]">
              <colgroup>
                <col className="w-[9.25rem]" />
                <col className="w-12" />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 text-xs uppercase text-gray-500">
                  <th
                    scope="col"
                    className="sticky left-0 z-30 min-h-[4.5rem] h-[4.5rem] box-border align-middle border-b border-r border-gray-200 bg-gray-50 px-2"
                  >
                    <span className="font-bold text-gray-500">Цаг</span>
                  </th>
                  <th
                    scope="col"
                    className="sticky left-[9.25rem] z-30 min-w-12 min-h-[4.5rem] h-[4.5rem] box-border align-middle border-b border-r border-gray-200 bg-gray-50 px-2 font-bold text-gray-500"
                  >
                    №
                  </th>
                  {Y210_PARAM_COLS_MAIN.map((c) => (
                    <th
                      key={String(c.key)}
                      className="px-3 py-2 font-bold min-w-[140px] min-h-[4.5rem] h-[4.5rem] box-border align-middle border-b border-gray-200 bg-gray-50"
                    >
                      <div className="leading-tight">
                        <div className="text-gray-700 normal-case whitespace-normal break-words">{c.label}</div>
                        {c.unit ? <div className="text-[10px] text-gray-400 normal-case">{c.unit}</div> : null}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-2 font-bold min-w-[160px] min-h-[4.5rem] h-[4.5rem] box-border align-middle border-b border-gray-200 bg-gray-50">
                    <div className="leading-tight normal-case">
                      <div className="text-gray-700">Ус зөөлрүүлэгчийн ажиллагаа</div>
                      <div className="text-[10px] text-gray-400 font-normal">Хэвийн / Хэвийн бус</div>
                    </div>
                  </th>
                  {Y210_PARAM_COLS_TAIL.map((c) => (
                    <th
                      key={String(c.key)}
                      className="px-3 py-2 font-bold min-w-[120px] min-h-[4.5rem] h-[4.5rem] box-border align-middle border-b border-gray-200 bg-gray-50"
                    >
                      <div className="leading-tight">
                        <div className="text-gray-700 normal-case whitespace-normal break-words">{c.label}</div>
                        {c.unit ? <div className="text-[10px] text-gray-400 normal-case">{c.unit}</div> : null}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.rows.map((r, idx) => (
                  <tr
                    key={`${r.time}_${idx}`}
                    ref={(el) => { rowRefs.current[idx] = el; }}
                    className={`group hover:bg-gray-50/50 ${invalidRowIndex === idx ? 'bg-red-50 ring-2 ring-inset ring-red-400' : ''}`}
                  >
                    <td className="sticky left-0 z-20 box-border border-b border-r border-gray-100 bg-white px-2 py-1.5 align-middle group-hover:bg-gray-50/50">
                      <input
                        type="time"
                        value={r.time}
                        onChange={(e) => patchRow(idx, 'time', e.target.value)}
                        className="w-full min-w-0 max-w-none rounded-lg border border-gray-200 px-2 py-1.5 text-sm tabular-nums"
                      />
                    </td>
                    <td className="sticky left-[9.25rem] z-20 box-border border-b border-r border-gray-100 bg-white px-2 py-1.5 align-middle text-center text-gray-500 group-hover:bg-gray-50/50">
                      {idx + 1}
                    </td>
                    {Y210_PARAM_COLS_MAIN.map((c) => (
                      <td key={String(c.key)} className="box-border border-b border-gray-100 px-3 py-1.5 align-middle group-hover:bg-gray-50/50">
                        <input
                          type={c.key === 'ashDischargeHours' ? 'time' : 'text'}
                          value={(r as any)[c.key] ?? ''}
                          onChange={(e) => patchRow(idx, c.key, e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm tabular-nums"
                          placeholder={c.unit || ''}
                        />
                      </td>
                    ))}
                    <td className="box-border border-b border-gray-100 px-3 py-1.5 align-middle group-hover:bg-gray-50/50">
                      <StatusRadios
                        name={`y210-status-${idx}`}
                        value={r.status}
                        onChange={(v) => patchRow(idx, 'status', v)}
                      />
                    </td>
                    {Y210_PARAM_COLS_TAIL.map((c) => (
                      <td key={String(c.key)} className="box-border border-b border-gray-100 px-3 py-1.5 align-middle group-hover:bg-gray-50/50">
                        <input
                          type="text"
                          value={(r as any)[c.key] ?? ''}
                          onChange={(e) => patchRow(idx, c.key, e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm"
                          placeholder={c.unit || ''}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-4 border-t border-gray-200 bg-white">
            <div className="w-full rounded-xl border border-dashed border-orange-300 bg-white p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-end gap-3">
                <div className="w-full md:w-80 max-w-full">
                  <label className="block text-xs font-bold text-gray-500 uppercase">
                    Технологийн зуухны зураг хавсаргах төрөл
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
                <div className="w-full md:w-96 max-w-full">
                  <label className="block text-xs font-bold text-gray-500 uppercase">
                    Column сонгох
                  </label>
                  <select
                    value={effectiveImageColumnKey}
                    onChange={(e) => setSelectedImageColumnKey(e.target.value)}
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    {imageColumnOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openCamera(imageUploadTarget)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
                  >
                    <Camera className="w-4 h-4" />
                    Камер
                  </button>
                  <button
                    type="button"
                    onClick={() => openGallery(imageUploadTarget)}
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

              {pendingKilnImages.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {pendingKilnImages.map((img) => (
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
                    onClick={() => uploadPendingImages(Y210_IMAGE_SECTION)}
                    disabled={pendingKilnImages.some((img) => img.status === 'uploading')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-60"
                  >
                    <Upload className="w-4 h-4" />
                    Зураг upload хийх
                  </button>
                </div>
              )}

              {uploadedKilnImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase">Хадгалагдсан зургууд</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {uploadedKilnImages.map((img) => (
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
                            {img.rowLabel || 'Технологийн зуухны зураг'}
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
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <label className="text-xs font-bold text-gray-500 uppercase">Нийт хэрэглээ</label>
            <input
              type="text"
              value={form.totalNote}
              onChange={(e) => setForm((p) => ({ ...p, totalNote: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 text-sm"
              placeholder="Нийт хэрэглээ..."
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
          <p className="font-bold text-gray-800">РАПОРТ</p>
          <textarea
            value={form.report}
            onChange={(e) => setForm((p) => ({ ...p, report: e.target.value }))}
            rows={6}
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm font-mono"
            placeholder="Рапорт..."
          />
        </div>

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
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">Хянасан: ээлжийн мастер</p>
              <ShiftMasterField
                assignedMasterName={assignedMasterName}
                value={form.sigShiftMaster || ''}
                onChange={(v) => setForm((p) => ({ ...p, sigShiftMaster: v }))}
              />
            </div>
          </div>
          <EnvironmentCheckSection
            rows={(form as any).environmentChecks}
            onChange={(rows) => setForm((prev: any) => ({ ...prev, environmentChecks: rows }))}
            disabled={submitting}
          />

          <div className="flex items-center justify-end gap-3 pt-6">
            <button
              type="button"
              onClick={onBack}
              disabled={submitting}
              className="px-6 py-3 rounded-xl bg-gray-100 font-bold text-gray-800 hover:bg-gray-200 disabled:opacity-60"
            >
              Цуцлах
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 disabled:opacity-60"
            >
              <Save className="w-5 h-5" />
              Хадгалах
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
                  {deleteConfirmImage.rowLabel || 'Технологийн зуухны зураг'}
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
