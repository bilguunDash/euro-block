'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, FileText, ImagePlus, Paperclip, Plus, Trash2, Upload } from 'lucide-react';
import { appendAuditLog } from '@/lib/audit-log';
import { useAuth } from '@/components/AuthProvider';
import { motion } from 'motion/react';
import { useToast } from '@/components/ui/ToastProvider';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const EMPTY_IMAGES: ShiftHseImage[] = [];
const HSE_IMAGE_OPTIONS = [
  { key: 'ppeComplete', label: 'Хамгаалах хэрэгсэл бүрэн' },
  { key: 'workplaceClean', label: 'Ажлын байрны цэвэрлэгээ' },
  { key: 'guardsInPlace', label: 'Төхөөрөмжийн хамгаалалт' },
  { key: 'fireSafetyOk', label: 'Гал түймрийн аюулгүй байдал' },
];

export type ShiftHseImage = {
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
  rowKey: string;
  rowLabel: string;
  caption: string;
  progress: number;
  status: 'ready' | 'uploading' | 'done' | 'error';
  error?: string;
};

type HseAttachment = {
  id: string;
  name: string;
  url: string;
  storagePath?: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedAt?: string;
  uploadedByName?: string | null;
};

export function HseChecklistModal({
  shiftId,
  initialData,
  initialImages,
  onImagesChange,
  onClose,
}: {
  shiftId: string;
  initialData: any;
  initialImages?: ShiftHseImage[];
  onImagesChange?: (images: ShiftHseImage[]) => void;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedImageKey, setSelectedImageKey] = useState(HSE_IMAGE_OPTIONS[0].key);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [uploadedImages, setUploadedImages] = useState<ShiftHseImage[]>(initialImages ?? EMPTY_IMAGES);
  const [attachments, setAttachments] = useState<HseAttachment[]>(
    Array.isArray(initialData?.attachments) ? initialData.attachments : []
  );
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [deletingImageIds, setDeletingImageIds] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const pendingImagesRef = useRef<PendingImage[]>([]);
  const uploadedImagesRef = useRef<ShiftHseImage[]>(initialImages ?? EMPTY_IMAGES);
  // Шинэ хуудас ХАРИУЛААГҮЙ (null) төлөвөөр нээгдэнэ. Өмнө нь `true`-гээр
  // нээгддэг байсан тул бөглөөгүй маягт бөглөгдсөн мэт харагдаж байв.
  const [formData, setFormData] = useState<any>(
    initialData || {
      ppeComplete: null,
      workplaceClean: null,
      guardsInPlace: null,
      fireSafetyOk: null,
      remarks: '',
    }
  );
  const isNewRecord = !initialData;
  const selectedImageOption =
    HSE_IMAGE_OPTIONS.find((option) => option.key === selectedImageKey) ?? HSE_IMAGE_OPTIONS[0];

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(() => {
    const next = initialImages ?? EMPTY_IMAGES;
    const nextIds = next.map((img) => img.id).join(',');
    const currentIds = uploadedImagesRef.current.map((img) => img.id).join(',');
    if (nextIds !== currentIds) {
      uploadedImagesRef.current = next;
      setUploadedImages(next);
    }
  }, [initialImages]);

  useEffect(() => {
    setAttachments(Array.isArray(initialData?.attachments) ? initialData.attachments : []);
  }, [initialData]);

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

  const addPendingFiles = (files: File[]) => {
    if (!files.length) return;

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
        rowKey: selectedImageOption.key,
        rowLabel: selectedImageOption.label,
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
    addPendingFiles(Array.from(files));
  };

  const closeCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    setCameraOpen(false);
    setCameraError('');
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.warning('Энэ browser camera preview дэмжихгүй байна. "Зураг сонгох" товч ашиглана уу.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      closeCamera();
      cameraStreamRef.current = stream;
      setCameraError('');
      setCameraOpen(true);
    } catch (e: unknown) {
      const name = e instanceof Error ? e.name : '';
      const message =
        name === 'NotAllowedError'
          ? 'Камер ашиглах зөвшөөрөл өгөөгүй байна.'
          : name === 'NotFoundError'
            ? 'Камер олдсонгүй.'
            : 'Камер нээхэд алдаа гарлаа.';
      setCameraError(message);
      toast.warning(message);
    }
  };

  const captureCameraImage = async () => {
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
    addPendingFiles([file]);
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

  const uploadPendingImages = async () => {
    const ready = pendingImages.filter((img) => img.status === 'ready' || img.status === 'error');
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
            formData.append('section', 'hse_checklist');
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
                const uploaded = Array.isArray(data.images) ? (data.images as ShiftHseImage[]) : [];
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

  const uploadAttachmentFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;

    const oversized = files.find((file) => file.size > MAX_ATTACHMENT_BYTES);
    if (oversized) {
      toast.warning(`${oversized.name}: 20MB-аас их байна.`);
      return;
    }

    setAttachmentUploading(true);
    try {
      const uploaded: HseAttachment[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('context', 'shift_hse_attachment');
        formData.append('shiftId', shiftId);
        const res = await fetch('/api/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          console.warn('HSE file upload failed', { status: res.status, data });
          throw new Error([data?.error, data?.hint].filter(Boolean).join('\n\n') || 'File upload failed');
        }
        uploaded.push({
          id: crypto.randomUUID(),
          name: file.name,
          url: data.url,
          storagePath: data.filename,
          mimeType: file.type || undefined,
          sizeBytes: data.size ?? file.size,
          uploadedAt: new Date().toISOString(),
          uploadedByName: profile?.displayName || profile?.email || null,
        });
      }

      setAttachments((current) => [...uploaded, ...current]);
      toast.success('Файл хавсаргалаа. Хадгалах дарж бүртгэлд хадгална.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'File upload failed';
      toast.warning(message);
    } finally {
      setAttachmentUploading(false);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) => current.filter((item) => item.id !== id));
  };

  const CHECK_FIELDS: Array<[string, string]> = [
    ['ppeComplete', 'Хамгаалах хэрэгсэл бүрэн'],
    ['workplaceClean', 'Ажлын байрны цэвэрлэгээ'],
    ['guardsInPlace', 'Төхөөрөмжийн хамгаалалт'],
    ['fireSafetyOk', 'Гал түймрийн аюулгүй байдал'],
  ];

  const save = async () => {
    // Хариулаагүй асуултыг хадгалуулахгүй — эс бөгөөс «бөглөсөн» гэж бүртгэгдээд
    // агуулга нь хоосон үлдэнэ.
    const unanswered = CHECK_FIELDS.filter(([key]) => typeof formData[key] !== 'boolean').map(([, label]) => label);
    if (unanswered.length > 0) {
      toast.warning(`Дараах асуултад хариулна уу:\n• ${unanswered.join('\n• ')}`);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        attachments,
        updatedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
      };
      const res = await fetch(`/api/shifts/${shiftId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'hse_checklist',
          mode: 'submit',
          // Байгаа бүртгэлийг ЗАСНА. Өмнө нь `editId` дамжуулдаггүй байсан тул
          // засах бүрт ШИНЭ мөр үүсч, 40 ээлжид 2-3 хуудас давхардсан байв.
          ...(initialData?.id ? { editId: String(initialData.id) } : {}),
          data: payload,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || `Сервер ${res.status} буцаалаа`);
      if (profile) {
        await appendAuditLog({
          actorUid: profile.uid,
          actorName: profile.displayName,
          action: 'hse_checklist_updated',
          entityType: 'hse_checklist',
          entityId: shiftId,
          details: 'Save',
        });
      }
      toast.success('ХАБЭА-н хяналтын хуудас хадгалагдлаа.');
      onClose();
    } catch (error) {
      console.error(error);
      // Серверийн жинхэнэ шалтгааныг харуулна — «алдаа гарлаа» гэдгээс оператор
      // юу буруу болсныг ойлгох боломжгүй байв.
      toast.error('Хадгалахад алдаа гарлаа.\n\n' + (error instanceof Error ? error.message : ''));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await save();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-full flex items-start justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto"
        >
          <div className="bg-orange-600 p-6 text-white flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">ХАБЭА-н хяналтын хуудас</h2>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <Plus className="w-6 h-6 rotate-45" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {isNewRecord && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
                <span>
                  Энэ ээлжийн ХАБЭА-н хуудас хараахан бүртгэгдээгүй байна. Асуулт бүрт хариулж,
                  доод талын <span className="underline">Хадгалах</span> товчийг дарж дуусгана уу.
                </span>
              </div>
            )}
            <div className="space-y-4">
              <CheckItem
                label="Хамгаалах хэрэгсэл бүрэн"
                checked={formData.ppeComplete}
                onChange={(v) => setFormData({ ...formData, ppeComplete: v })}
              />
              <CheckItem
                label="Ажлын байрны цэвэрлэгээ"
                checked={formData.workplaceClean}
                onChange={(v) => setFormData({ ...formData, workplaceClean: v })}
              />
              <CheckItem
                label="Төхөөрөмжийн хамгаалалт"
                checked={formData.guardsInPlace}
                onChange={(v) => setFormData({ ...formData, guardsInPlace: v })}
              />
              <CheckItem
                label="Гал түймрийн аюулгүй байдал"
                checked={formData.fireSafetyOk}
                onChange={(v) => setFormData({ ...formData, fireSafetyOk: v })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Тэмдэглэл</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none h-24 resize-none"
                placeholder="Нэмэлт тайлбар..."
              />
            </div>

            <div className="rounded-2xl border border-dashed border-orange-300 bg-orange-50/20 p-4 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-bold text-gray-900">Зураг хавсаргах</p>
                  <p className="text-xs text-gray-500">JPG/PNG формат, нэг зураг 5MB-аас ихгүй.</p>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      Зураг хавсаргах ХАБЭА-н төрөл
                    </label>
                    <select
                      value={selectedImageKey}
                      onChange={(e) => setSelectedImageKey(e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                    >
                      {HSE_IMAGE_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openCamera}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
                  >
                    <Camera className="w-4 h-4" />
                    Камер
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
                  >
                    <ImagePlus className="w-4 h-4" />
                    Зураг сонгох
                  </button>
                </div>
                <input
                  ref={fileInputRef}
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

              {pendingImages.length > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {pendingImages.map((img) => (
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
                              <span className="shrink-0">
                                {img.status === 'uploading' ? `${img.progress}%` : 'Upload хүлээгдэж байна'}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => removePendingImage(img.id)}
                              disabled={img.status === 'uploading'}
                              className="p-1 rounded-lg text-gray-400 hover:text-orange-700 hover:bg-orange-50 disabled:opacity-50"
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
                    disabled={pendingImages.some((img) => img.status === 'uploading')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-60"
                  >
                    <Upload className="w-4 h-4" />
                    Зураг upload хийх
                  </button>
                </div>
              )}

              {uploadedImages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase">Хадгалагдсан зургууд</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {uploadedImages.map((img) => (
                      <div
                        key={img.id}
                        className="relative rounded-xl border border-gray-200 overflow-hidden bg-white hover:border-orange-300"
                      >
                        <a href={img.url || img.publicUrl} target="_blank" rel="noreferrer" className="block">
                          <div className="relative aspect-video bg-gray-100">
                            <Image
                              src={(img.url || img.publicUrl) as string}
                              alt={img.caption || img.rowLabel || 'Зураг'}
                              fill
                              sizes="(min-width: 640px) 33vw, 50vw"
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
                          <button
                            type="button"
                            onClick={() => deleteUploadedImage(img.id)}
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

            <div className="rounded-2xl border border-dashed border-orange-300 bg-orange-50/20 p-4 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-bold text-gray-900">Файл хавсаргах</p>
                  <p className="text-xs text-gray-500">PDF, DOCX, XLSX болон бусад файл 20MB-аас ихгүй.</p>
                </div>
                <button
                  type="button"
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={attachmentUploading}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 disabled:opacity-60"
                >
                  <Paperclip className="w-4 h-4" />
                  {attachmentUploading ? 'Upload хийж байна...' : 'Файл сонгох'}
                </button>
                <input
                  ref={attachmentInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    uploadAttachmentFiles(e.target.files);
                    e.currentTarget.value = '';
                  }}
                />
              </div>

              {attachments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase">Хавсаргасан файлууд</p>
                  <div className="space-y-2">
                    {attachments.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2"
                      >
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="min-w-0 flex flex-1 items-center gap-3 hover:text-orange-700"
                        >
                          <span className="shrink-0 rounded-lg bg-orange-50 p-2 text-orange-700">
                            <FileText className="w-4 h-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-gray-800">{file.name}</span>
                            <span className="text-xs text-gray-500">
                              {formatBytes(file.sizeBytes)}{file.mimeType ? ` • ${file.mimeType}` : ''}
                            </span>
                          </span>
                        </a>
                        <button
                          type="button"
                          onClick={() => removeAttachment(file.id)}
                          className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-orange-50 hover:text-orange-700"
                          aria-label="Файл устгах"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors"
              >
                Цуцлах
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all disabled:opacity-50"
              >
                {loading ? 'Хадгалж байна...' : 'Хадгалах'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
      {cameraOpen && (
        <div className="fixed inset-0 z-[220] bg-black/70 p-4 flex items-center justify-center">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-gray-900">Камер</p>
                <p className="text-xs text-gray-500">{selectedImageOption.label}</p>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                aria-label="Камер хаах"
              >
                <Plus className="w-5 h-5 rotate-45" />
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

function formatBytes(value?: number) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/**
 * Тийм/Үгүй сонголт — ХАРИУЛААГҮЙ төлөвтэй.
 *
 * Өмнө нь ганц товч байсан бөгөөд шинэ хуудас `true`-гээр нээгддэг тул дөрвүүлээ
 * ногоон «Тийм» харагдаж, оператор аль хэдийн бөглөгдсөн гэж эндүүрч хадгалалгүй
 * хаадаг байв — улмаар ээлжийн 15-20%-д ХАБЭА-н хуудас огт үүсдэггүй байсан.
 * Одоо хариулаагүй үед аль аль товч сонгогдоогүй байна.
 */
function CheckItem({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean | null;
  onChange: (v: boolean) => void;
}) {
  const base = 'px-4 py-2 rounded-lg text-xs font-bold transition-all border';
  return (
    <div
      className={`flex items-center justify-between gap-3 p-4 rounded-2xl border ${
        checked === null ? 'bg-amber-50/60 border-amber-200' : 'bg-gray-50 border-gray-100'
      }`}
    >
      <span className="text-sm font-bold text-gray-700">
        {label}
        {checked === null && <span className="ml-2 text-[11px] font-bold text-amber-600">хариулаагүй</span>}
      </span>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`${base} ${checked === true ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'}`}
        >
          Тийм
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`${base} ${checked === false ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'}`}
        >
          Үгүй
        </button>
      </div>
    </div>
  );
}
