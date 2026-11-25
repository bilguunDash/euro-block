'use client';

import { useState } from 'react';
import { appendAuditLog } from '@/lib/audit-log';
import { useAuth } from '@/components/AuthProvider';
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';

export function ProcessCheckModal({ shiftId, onClose }: { shiftId: string; onClose: () => void }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    rawMaterialCheck: true,
    productionLineCheck: true,
    qualityCheck: true,
    safetyCheck: true,
    observations: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'process_checks', data: { ...formData, createdAt: new Date().toISOString() } }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'API Error');
      if (profile) {
        await appendAuditLog({
          actorUid: profile.uid,
          actorName: profile.displayName,
          action: 'process_check_created',
          entityType: 'process_check',
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="bg-orange-600 p-6 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold">Процесс хяналтын хуудас</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer">
              <input 
                type="checkbox"
                checked={formData.rawMaterialCheck}
                onChange={(e) => setFormData({ ...formData, rawMaterialCheck: e.target.checked })}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
              <span className="text-sm font-bold text-gray-700">Түүхий эд</span>
            </label>
            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer">
              <input 
                type="checkbox"
                checked={formData.productionLineCheck}
                onChange={(e) => setFormData({ ...formData, productionLineCheck: e.target.checked })}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
              <span className="text-sm font-bold text-gray-700">Шугам</span>
            </label>
            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer">
              <input 
                type="checkbox"
                checked={formData.qualityCheck}
                onChange={(e) => setFormData({ ...formData, qualityCheck: e.target.checked })}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
              <span className="text-sm font-bold text-gray-700">Чанар</span>
            </label>
            <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer">
              <input 
                type="checkbox"
                checked={formData.safetyCheck}
                onChange={(e) => setFormData({ ...formData, safetyCheck: e.target.checked })}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
              <span className="text-sm font-bold text-gray-700">Аюулгүй</span>
            </label>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Ажиглалт/Тэмдэглэл</label>
            <textarea 
              value={formData.observations}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none h-32 resize-none"
            />
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
