'use client';

import Image from 'next/image';
import { AlertTriangle, CheckCircle2, Clock, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import type { ShiftInspectionImage } from '@/components/shift/forms/Y110CementPumpStartForm';

type ReviewStatus = 'pending_review' | 'approved' | 'rejected';

const SECTION_LABELS: Record<string, string> = {
  hse_checklist: 'ХАБЭА-н хяналтын хуудас',
  inspection: 'Үзлэгийн зураг',
  raw_material: 'Түүхий эдийн зураг',
  ingredient_change_record: 'Бүтээгдэхүүний орц найрлага өөрчилсөн бүртгэл',
  cah02_10_04_substation: 'ЦАХ-02 - 10/0.4кВ дэд станц',
  cah02_35_04_substation: 'ЦАХ-02 - 35/0.4кВ дэд станц',
  y320_repair_record: 'ҮЯ-320 засварын бүртгэл',
};

function statusInfo(status?: string | null) {
  if (status === 'approved') {
    return {
      label: 'Зөв',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: CheckCircle2,
    };
  }
  if (status === 'rejected') {
    return {
      label: 'Асуудалтай',
      className: 'bg-red-50 text-red-700 border-red-200',
      icon: AlertTriangle,
    };
  }
  return {
    label: 'Шалгаагүй',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Clock,
  };
}

function sectionLabel(section?: string | null) {
  const key = String(section || '').trim();
  return SECTION_LABELS[key] || key || 'Бусад зураг';
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

export function ShiftImageReviewPanel({
  shiftId,
  images,
  canReview,
  onImagesChange,
}: {
  shiftId: string;
  images: ShiftInspectionImage[];
  canReview: boolean;
  onImagesChange: (images: ShiftInspectionImage[]) => void;
}) {
  const toast = useToast();
  const [comments, setComments] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<string[]>([]);

  useEffect(() => {
    setComments((current) => {
      const next = { ...current };
      for (const image of images) {
        if (next[image.id] === undefined) next[image.id] = image.reviewComment || '';
      }
      return next;
    });
  }, [images]);

  const groupedImages = useMemo(() => {
    const groups = new Map<string, ShiftInspectionImage[]>();
    for (const image of images) {
      const label = sectionLabel(image.section);
      const rows = groups.get(label) || [];
      rows.push(image);
      groups.set(label, rows);
    }
    return Array.from(groups.entries());
  }, [images]);

  const counts = useMemo(() => {
    let approved = 0;
    let rejected = 0;
    let pending = 0;
    for (const image of images) {
      if (image.reviewStatus === 'approved') approved += 1;
      else if (image.reviewStatus === 'rejected') rejected += 1;
      else pending += 1;
    }
    return { approved, rejected, pending };
  }, [images]);

  const updateReview = async (image: ShiftInspectionImage, reviewStatus: ReviewStatus) => {
    const reviewComment = comments[image.id]?.trim() || '';
    if (reviewStatus === 'rejected' && !reviewComment) {
      toast.warning('Асуудалтай гэж тэмдэглэхийн өмнө тайлбар бичнэ үү.');
      return;
    }

    setSavingIds((current) => [...current, image.id]);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/images`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ imageId: image.id, reviewStatus, reviewComment }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(body?.error || 'Review failed');
      const updated = body.image as ShiftInspectionImage;
      onImagesChange(images.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(reviewStatus === 'approved' ? 'Зургийг зөвшөөрлөө.' : reviewStatus === 'rejected' ? 'Зургийг асуудалтай гэж тэмдэглэлээ.' : 'Зургийг шалгаагүй төлөвт буцаалаа.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Зураг шалгах үйлдэл амжилтгүй боллоо.');
    } finally {
      setSavingIds((current) => current.filter((id) => id !== image.id));
    }
  };

  return (
    <section id="image-review" className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden scroll-mt-24">
      <div className="p-6 border-b border-gray-200 bg-gray-50/60 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-orange-600" />
            Хавсаргасан зургуудын шалгалт
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Operator-ийн оруулсан зураг, мөр/column, тайлбар болон шалгалтын төлөв.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="px-3 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700">Шалгаагүй: {counts.pending}</span>
          <span className="px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">Зөв: {counts.approved}</span>
          <span className="px-3 py-1 rounded-full border border-red-200 bg-red-50 text-red-700">Асуудалтай: {counts.rejected}</span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {images.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Хавсаргасан зураг байхгүй байна.</p>
        ) : (
          groupedImages.map(([label, group]) => (
            <div key={label} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-black text-gray-900">{label}</h4>
                <span className="text-xs font-bold text-gray-400">{group.length} зураг</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {group.map((image) => {
                  const status = statusInfo(image.reviewStatus);
                  const StatusIcon = status.icon;
                  const isSaving = savingIds.includes(image.id);
                  return (
                    <article key={image.id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                      <a href={image.url || image.publicUrl} target="_blank" rel="noreferrer" className="block">
                        <div className="relative aspect-video bg-gray-100">
                          <Image
                            src={(image.url || image.publicUrl) as string}
                            alt={image.caption || image.rowLabel || 'Зураг'}
                            fill
                            sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      </a>
                      <div className="p-3 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-gray-800 break-words">{image.rowLabel || 'Мөр сонгоогүй зураг'}</p>
                            <p className="text-[11px] text-gray-500 mt-1">
                              {image.uploadedByName || image.uploadedByUid || 'Operator'} · {formatDate(image.createdAt)}
                            </p>
                          </div>
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${status.className}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {status.label}
                          </span>
                        </div>

                        <details className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                          <summary className="cursor-pointer text-xs font-bold text-orange-700">Тайлбар дэлгэрэнгүй харах</summary>
                          <p className="mt-2 text-xs leading-5 text-gray-700 whitespace-pre-wrap break-words">
                            {image.caption?.trim() || 'Тайлбар бичээгүй байна.'}
                          </p>
                        </details>

                        {image.reviewComment ? (
                          <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                            <p className="text-[11px] font-bold uppercase text-gray-500">Шалгалтын тайлбар</p>
                            <p className="mt-1 text-xs text-gray-700 whitespace-pre-wrap break-words">{image.reviewComment}</p>
                            {image.reviewedByName || image.reviewedAt ? (
                              <p className="mt-1 text-[11px] text-gray-400">
                                {image.reviewedByName || 'Reviewer'} {formatDate(image.reviewedAt)}
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        {canReview ? (
                          <div className="space-y-2 border-t border-gray-100 pt-3">
                            <textarea
                              value={comments[image.id] || ''}
                              onChange={(event) => setComments((current) => ({ ...current, [image.id]: event.target.value }))}
                              rows={2}
                              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-orange-500/20"
                              placeholder="Асуудалтай бол тайлбар бичнэ..."
                            />
                            <div className="grid grid-cols-3 gap-2">
                              <button
                                type="button"
                                onClick={() => updateReview(image, 'approved')}
                                disabled={isSaving}
                                className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-2 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                Зөв
                              </button>
                              <button
                                type="button"
                                onClick={() => updateReview(image, 'rejected')}
                                disabled={isSaving}
                                className="inline-flex items-center justify-center gap-1 rounded-xl bg-red-600 px-2 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
                              >
                                <AlertTriangle className="w-4 h-4" />
                                Асуудалтай
                              </button>
                              <button
                                type="button"
                                onClick={() => updateReview(image, 'pending_review')}
                                disabled={isSaving}
                                className="inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 px-2 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                              >
                                <RotateCcw className="w-4 h-4" />
                                Буцаах
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
