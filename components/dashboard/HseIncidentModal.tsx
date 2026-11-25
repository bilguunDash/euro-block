import React, { useRef, useState } from 'react';
import { appendAuditLog } from '@/lib/audit-log';
import { useToast } from '@/components/ui/ToastProvider';
import { Paperclip, Trash2, Upload } from 'lucide-react';

interface HseIncidentModalProps {
  profile: { uid: string; displayName: string; stationCode?: string; email?: string };
  onClose: () => void;
}

type HseAttachment = {
  id: string;
  name: string;
  url: string;
  storagePath?: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedAt: string;
  uploadedByName?: string | null;
};

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

function formatBytes(value?: number) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

export function HseIncidentModal({ profile, onClose }: HseIncidentModalProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasViolation, setHasViolation] = useState(true);
  const [description, setDescription] = useState('');
  const [generalComment, setGeneralComment] = useState('');
  const [severity, setSeverity] = useState('Дунд');
  const [attachments, setAttachments] = useState<HseAttachment[]>([]);

  const uploadFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    const oversized = files.find((file) => file.size > MAX_ATTACHMENT_BYTES);
    if (oversized) {
      toast.warning(`${oversized.name}: 20MB-аас их байна.`);
      return;
    }

    setUploading(true);
    try {
      const uploaded: HseAttachment[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('context', 'shift_hse_attachment');
        const res = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          throw new Error([data?.error, data?.hint].filter(Boolean).join('\n\n') || 'Файл байршуулахад алдаа гарлаа');
        }
        uploaded.push({
          id: crypto.randomUUID(),
          name: file.name,
          url: data.url,
          storagePath: data.filename,
          mimeType: file.type || undefined,
          sizeBytes: data.size ?? file.size,
          uploadedAt: new Date().toISOString(),
          uploadedByName: profile.displayName || profile.email || null,
        });
      }
      setAttachments((current) => [...uploaded, ...current]);
      toast.success('Файл хавсаргалаа.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Файл байршуулахад алдаа гарлаа.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasViolation && !description.trim()) {
      toast.warning('Зөрчлийн тайлбар оруулна уу.');
      return;
    }
    if (!hasViolation && !generalComment.trim() && attachments.length === 0) {
      toast.warning('ХАБ тэмдэглэл эсвэл хавсралт оруулна уу.');
      return;
    }
    setLoading(true);
    try {
      const images = attachments.filter((file) => String(file.mimeType || '').startsWith('image/'));
      const files = attachments.filter((file) => !String(file.mimeType || '').startsWith('image/'));
      const payload = {
        operatorUid: profile.uid,
        operatorName: profile.displayName,
        stationCode: profile.stationCode || '',
        generalComment: generalComment.trim(),
        incidents: [
          {
            description: description.trim() || generalComment.trim() || 'ХАБ тэмдэглэл',
            severity: hasViolation ? severity : 'Мэдээлэл',
            violation: hasViolation,
            reportedAt: new Date().toISOString(),
            attachments,
            images,
            files,
          },
        ],
      };
      
      const res = await fetch('/api/hse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'ХАБ бүртгэл үүсгэхэд алдаа гарлаа');

      await appendAuditLog({
        actorUid: profile.uid,
        actorName: profile.displayName,
        action: 'hse_log_created',
        entityType: 'hse_log',
        entityId: data.id,
      });
      toast.success('ХАБ бүртгэл илгээгдлээ.');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Хадгалахад алдаа гарлаа.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4"
      >
        <h3 className="text-lg font-bold text-gray-900">ХАБ мэдээлэл бүртгэх</h3>
        <p className="text-xs text-gray-500">
          Зөрчил, зураг, файл, нэмэлт тэмдэглэл илгээсний дараа зөвхөн унших горимд хадгалагдана.
        </p>
        <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3">
          <input
            type="checkbox"
            checked={hasViolation}
            onChange={(e) => setHasViolation(e.target.checked)}
            className="h-4 w-4 accent-red-600"
          />
          <span className="text-sm font-bold text-gray-800">Зөрчил байгаа эсэх</span>
        </label>
        <div>
          <label className="text-xs font-bold text-gray-600">Нөхцөлт</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="mt-1 w-full p-3 rounded-xl border border-gray-200"
            disabled={!hasViolation}
          >
            <option value="Бага">Бага</option>
            <option value="Дунд">Дунд</option>
            <option value="Өндөр">Өндөр</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600">Зөрчлийн тайлбар</label>
          <textarea
            required={hasViolation}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full p-3 rounded-xl border border-gray-200 min-h-[120px]"
            placeholder="Юу болсон, газар, цаг…"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600">ХАБ тэмдэглэл / нэмэлт тайлбар</label>
          <textarea
            value={generalComment}
            onChange={(e) => setGeneralComment(e.target.value)}
            className="mt-1 w-full p-3 rounded-xl border border-gray-200 min-h-[90px]"
            placeholder="ХАБ-тай холбоотой нэмэлт мэдээлэл..."
          />
        </div>
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-gray-600">Зураг / файл хавсаргах</p>
              <p className="text-[11px] text-gray-500 mt-1">JPG, PNG болон баримт файлууд, нэг файл 20MB хүртэл.</p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Байршуулж байна...' : 'Сонгох'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => uploadFiles(e.target.files)}
            />
          </div>
          {attachments.length > 0 && (
            <ul className="mt-3 space-y-2">
              {attachments.map((file) => (
                <li key={file.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <Paperclip className="h-4 w-4 shrink-0 text-gray-500" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-gray-800">{file.name}</p>
                      <p className="text-[10px] text-gray-500">{formatBytes(file.sizeBytes)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachments((current) => current.filter((item) => item.id !== file.id))}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                    aria-label="Хавсралт устгах"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-gray-600 font-bold">
            Цуцлах
          </button>
          <button
            type="submit"
            disabled={loading || uploading}
            className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold disabled:opacity-50"
          >
            {loading ? '…' : 'Илгээх'}
          </button>
        </div>
      </form>
    </div>
  );
}
