'use client';

import { useState } from 'react';
import { appendAuditLog } from '@/lib/audit-log';
import { useAuth } from '@/components/AuthProvider';
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';

export function RecipeChangeModal({ shiftId, onClose }: { shiftId: string; onClose: () => void }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    oldRecipe: '',
    newRecipe: '',
    reason: '',
    changedBy: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/shifts/${shiftId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'recipe_changes', data: { ...formData, createdAt: new Date().toISOString() } }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'API Error');
      if (profile) {
        await appendAuditLog({
          actorUid: profile.uid,
          actorName: profile.displayName,
          action: 'recipe_change_created',
          entityType: 'recipe_change',
          entityId: data.id,
          details: `From ${formData.oldRecipe} to ${formData.newRecipe}`,
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
          <h2 className="text-xl font-bold">Жор өөрчлөлтийн бүртгэл</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Хуучин жор</label>
              <input 
                type="text"
                value={formData.oldRecipe}
                onChange={(e) => setFormData({ ...formData, oldRecipe: e.target.value })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Шинэ жор</label>
              <input 
                type="text"
                value={formData.newRecipe}
                onChange={(e) => setFormData({ ...formData, newRecipe: e.target.value })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Өөрчилсөн шалтгаан</label>
            <textarea 
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none h-24 resize-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Өөрчилсөн ажилтан</label>
            <input 
              type="text"
              value={formData.changedBy}
              onChange={(e) => setFormData({ ...formData, changedBy: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
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
