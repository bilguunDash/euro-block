import React, { useState } from 'react';
import { appendAuditLog } from '@/lib/audit-log';
import { useToast } from '@/components/ui/ToastProvider';

interface MaintRequestModalProps {
  profile: { uid: string; displayName: string; stationCode?: string };
  onClose: () => void;
}

export function MaintRequestModal({ profile, onClose }: MaintRequestModalProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [equipmentName, setEquipmentName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipmentName.trim() || !description.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentName: equipmentName.trim(),
          description: description.trim(),
          stationCode: profile.stationCode || '',
          status: 'Open',
          reportedByName: profile.displayName,
          reportedByUid: profile.uid,
        })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Failed to create request');

      await appendAuditLog({
        actorUid: profile.uid,
        actorName: profile.displayName,
        action: 'maintenance_created',
        entityType: 'maintenance_request',
        entityId: data.id,
      });
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Алдаа гарлаа.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <h3 className="text-lg font-bold text-gray-900">Засварын хүсэлт</h3>
        <input
          required
          value={equipmentName}
          onChange={(e) => setEquipmentName(e.target.value)}
          placeholder="Тоног төхөөрөмж"
          className="w-full p-3 rounded-xl border border-gray-200"
        />
        <textarea
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Асуудлын тайлбар"
          className="w-full p-3 rounded-xl border border-gray-200 min-h-[100px]"
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-gray-600 font-bold">
            Цуцлах
          </button>
          <button type="submit" disabled={loading} className="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold">
            Илгээх
          </button>
        </div>
      </form>
    </div>
  );
}
