import React, { useState } from 'react';
import { appendAuditLog } from '@/lib/audit-log';
import { useToast } from '@/components/ui/ToastProvider';

interface MaintDetailModalProps {
  req: any;
  profile: { uid: string; displayName: string; role?: string };
  onClose: () => void;
}

export function MaintDetailModal({ req, profile, onClose }: MaintDetailModalProps) {
  const toast = useToast();
  const [status, setStatus] = useState(req.status || 'Open');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/maintenance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: req.id, status }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Failed to update request');
      await appendAuditLog({
        actorUid: profile.uid,
        actorName: profile.displayName,
        action: 'maintenance_updated',
        entityType: 'maintenance_request',
        entityId: req.id,
        details: status,
      });
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Хадгалахад алдаа.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <h3 className="font-bold text-lg">{req.equipmentName}</h3>
        <p className="text-sm text-gray-600">{req.description}</p>
        <label className="text-xs font-bold">Төлөв</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full p-3 rounded-xl border border-gray-200"
        >
          <option value="Open">Нээлттэй</option>
          <option value="In Progress">Хийгдэж буй</option>
          <option value="Closed">Хаагдсан</option>
        </select>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-gray-600 font-bold">
            Хаах
          </button>
          <button
            type="button"
            onClick={save}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold"
          >
            Хадгалах
          </button>
        </div>
      </div>
    </div>
  );
}
