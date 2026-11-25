'use client';

import Image from 'next/image';
import { Camera, ImagePlus, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const EMPTY_IMAGES: ShiftSectionImage[] = [];
const EMPTY_TARGETS: ShiftImageTarget[] = [];

export type ShiftSectionImage = {
  id: string;
  section?: string | null;
  rowKey?: string | null;
  rowLabel?: string | null;
  caption?: string | null;
  url: string;
  publicUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedByUid?: string | null;
  uploadedByName?: string | null;
  reviewStatus?: 'pending_review' | 'approved' | 'rejected' | string;
  reviewComment?: string | null;
  reviewedByUid?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
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

export type ShiftImageTarget = {
  key: string;
  label: string;
};

type UploadTarget = {
  section: string;
  rowKey: string;
  rowLabel: string;
};

export function ShiftSectionImageUploader({
  shiftId,
  images,
  onImagesChange,
  section,
  title,
  targets,
  columns,
  columnTitle = 'Column сонгох',
  helpText,
  fallbackLabel,
}: {
  shiftId?: string;
  images?: ShiftSectionImage[];
  onImagesChange?: (images: ShiftSectionImage[]) => void;
  section: string;
  title: string;
  targets: ShiftImageTarget[];
  columns?: ShiftImageTarget[];
  columnTitle?: string;
  helpText?: string;
  fallbackLabel: string;
}) {
  const toast = useToast();
  const safeImages = images ?? EMPTY_IMAGES;
  const [selectedTargetKey, setSelectedTargetKey] = useState('');
  const [selectedColumnKey, setSelectedColumnKey] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [uploadedImages, setUploadedImages] = useState<ShiftSectionImage[]>(safeImages);
  const [deletingImageIds, setDeletingImageIds] = useState<string[]>([]);
  const [deleteConfirmImageId, setDeleteConfirmImageId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraTarget, setCameraTarget] = useState<UploadTarget | null>(null);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const fileUploadTargetRef = useRef<UploadTarget | null>(null);
  const pendingImagesRef = useRef<PendingImage[]>([]);
  const uploadedImagesRef = useRef<ShiftSectionImage[]>(safeImages);

  const effectiveTargetKey = selectedTargetKey || targets[0]?.key || '';
  const selectedTarget = useMemo(
    () => targets.find((target) => target.key === effectiveTargetKey) ?? targets[0] ?? null,
    [effectiveTargetKey, targets]
  );
  const safeColumns = columns ?? EMPTY_TARGETS;
  const effectiveColumnKey = selectedColumnKey || safeColumns[0]?.key || '';
  const selectedColumn = useMemo(
    () => safeColumns.find((column) => column.key === effectiveColumnKey) ?? safeColumns[0] ?? null,
    [effectiveColumnKey, safeColumns]
  );
  const uploadTarget: UploadTarget | null = selectedTarget
    ? {
        section,
        rowKey: selectedColumn ? `${selectedTarget.key}_${selectedColumn.key}` : selectedTarget.key,
        rowLabel: selectedColumn ? `${selectedTarget.label} - ${selectedColumn.label}` : selectedTarget.label,
      }
    : null;
  const pendingSectionImages = pendingImages.filter((img) => img.section === section);
  const uploadedSectionImages = uploadedImages.filter((img) => img.section === section);
  const deleteConfirmImage = deleteConfirmImageId
    ? uploadedImages.find((img) => img.id === deleteConfirmImageId) ?? null
    : null;

  useEffect(() => {
    const nextImages = images ?? EMPTY_IMAGES;
    uploadedImagesRef.current = nextImages;
    setUploadedImages(nextImages);
  }, [images]);

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

  const updatePendingCaption = (imageId: string, caption: string) => {
    setPendingImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, caption } : img)));
  };

  const removePendingImage = (imageId: string) => {
    setPendingImages((prev) => {
      const found = prev.find((img) => img.id === imageId);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((img) => img.id !== imageId);
    });
  };

  const uploadPendingImages = async () => {
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
        const uploaded = (body.images ?? []) as ShiftSectionImage[];
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

  return (
    <div className="w-full rounded-xl border border-dashed border-orange-300 bg-white p-4 space-y-4">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="w-full md:w-96 max-w-full">
          <label className="block text-xs font-bold text-gray-500 uppercase">{title}</label>
          <select
            value={effectiveTargetKey}
            onChange={(e) => setSelectedTargetKey(e.target.value)}
            className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
          >
            {targets.map((target) => (
              <option key={target.key} value={target.key}>
                {target.label}
              </option>
            ))}
          </select>
        </div>
        {safeColumns.length > 0 && (
          <div className="w-full md:w-96 max-w-full">
            <label className="block text-xs font-bold text-gray-500 uppercase">{columnTitle}</label>
            <select
              value={effectiveColumnKey}
              onChange={(e) => setSelectedColumnKey(e.target.value)}
              className="mt-2 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
            >
              {safeColumns.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openCamera(uploadTarget)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
          >
            <Camera className="w-4 h-4" />
            Камер
          </button>
          <button
            type="button"
            onClick={() => openGallery(uploadTarget)}
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
        {helpText || 'JPG/PNG формат дэмжинэ. Нэг зураг 5MB-аас ихгүй. Upload хийхийн өмнө зураг бүр дээр тайлбар бичнэ.'}
      </p>

      {pendingSectionImages.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pendingSectionImages.map((img) => (
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
            onClick={uploadPendingImages}
            disabled={pendingSectionImages.some((img) => img.status === 'uploading')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-60"
          >
            <Upload className="w-4 h-4" />
            Зураг upload хийх
          </button>
        </div>
      )}

      {uploadedSectionImages.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase">Хадгалагдсан зургууд</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {uploadedSectionImages.map((img) => (
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
                  <p className="text-[11px] font-bold text-gray-700 truncate">{img.rowLabel || fallbackLabel}</p>
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

      {deleteConfirmImage && (
        <div className="fixed inset-0 z-[220] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-orange-600 text-white">
              <p className="text-lg font-black">Зураг устгах</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-800">Энэ зургийг устгах уу?</p>
                <p className="text-xs font-bold text-gray-500 truncate">{deleteConfirmImage.rowLabel || fallbackLabel}</p>
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
                <p className="text-xs text-gray-500">{cameraTarget?.rowLabel || fallbackLabel}</p>
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
              <video ref={cameraVideoRef} className="w-full max-h-[70vh] object-contain" playsInline muted autoPlay />
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
