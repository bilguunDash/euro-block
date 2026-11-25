'use client';

import { useState } from 'react';
import { appendAuditLog } from '@/lib/audit-log';
import { useAuth } from '@/components/AuthProvider';
import { motion } from 'motion/react';
import { useToast } from '@/components/ui/ToastProvider';

export function MixLogModal({ shiftId, onClose }: { shiftId: string; onClose: () => void }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({
    pourCount: 1,
    risingTime: 0,
    spread: 0,
    pourTemp: 0,
    freshSlurryDensity: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'mix_logs', data: { ...formData, createdAt: new Date().toISOString() } }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'API Error');
      if (profile) {
        await appendAuditLog({
          actorUid: profile.uid,
          actorName: profile.displayName,
          action: 'mix_log_created',
          entityType: 'mix_log',
          entityId: data.id,
          details: `Pour #${formData.pourCount}`,
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
          <h3 className="text-xl font-bold text-gray-900">Цутгалтын үзүүлэлт нэмэх</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Цутгалтын №</label>
              <input 
                type="number"
                value={formData.pourCount}
                onChange={(e) => setFormData({ ...formData, pourCount: e.target.value === '' ? '' : parseInt(e.target.value) })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Хөөлт (мин)</label>
              <input 
                type="number"
                value={formData.risingTime}
                onChange={(e) => setFormData({ ...formData, risingTime: e.target.value === '' ? '' : parseInt(e.target.value) })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Тархалт (см)</label>
              <input 
                type="number"
                value={formData.spread}
                onChange={(e) => setFormData({ ...formData, spread: e.target.value === '' ? '' : parseInt(e.target.value) })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Темп (°С)</label>
              <input 
                type="number"
                value={formData.pourTemp}
                onChange={(e) => setFormData({ ...formData, pourTemp: e.target.value === '' ? '' : parseInt(e.target.value) })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <label className="text-sm font-bold text-gray-700">Шинэ зутангийн нягт (кг/м3)</label>
              <input 
                type="number"
                value={formData.freshSlurryDensity}
                onChange={(e) => setFormData({ ...formData, freshSlurryDensity: e.target.value === '' ? '' : parseInt(e.target.value) })}
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
