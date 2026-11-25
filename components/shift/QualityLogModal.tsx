'use client';

import { useState } from 'react';
import { appendAuditLog } from '@/lib/audit-log';
import { useAuth } from '@/components/AuthProvider';
import { motion } from 'motion/react';
import { useToast } from '@/components/ui/ToastProvider';

export function QualityLogModal({ shiftId, onClose }: { shiftId: string; onClose: () => void }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({
    autoclaveNum: 1,
    poddonNum: 1,
    productSize: '600x200x100',
    sort1M3: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'quality_logs', data: { ...formData, createdAt: new Date().toISOString() } }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'API Error');
      if (profile) {
        await appendAuditLog({
          actorUid: profile.uid,
          actorName: profile.displayName,
          action: 'quality_log_created',
          entityType: 'quality_log',
          entityId: data.id,
        });
      }
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Хадгалахад алдаа гарлаа.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
      >
        <div className="p-8 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">Чанарын хяналтын бүртгэл нэмэх</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Автоклав №</label>
              <input 
                type="number"
                value={formData.autoclaveNum}
                onChange={(e) => setFormData({ ...formData, autoclaveNum: e.target.value === '' ? '' : parseInt(e.target.value) })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Поддон №</label>
              <input 
                type="number"
                value={formData.poddonNum}
                onChange={(e) => setFormData({ ...formData, poddonNum: e.target.value === '' ? '' : parseInt(e.target.value) })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Хэмжээ</label>
              <select 
                value={formData.productSize}
                onChange={(e) => setFormData({ ...formData, productSize: e.target.value })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value="600x200x100">600x200x100</option>
                <option value="600x200x150">600x200x150</option>
                <option value="600x200x200">600x200x200</option>
                <option value="600x200x250">600x200x250</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">1-р сорт м3</label>
              <input 
                type="number" step="0.01"
                value={formData.sort1M3}
                onChange={(e) => setFormData({ ...formData, sort1M3: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
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
  );
}
