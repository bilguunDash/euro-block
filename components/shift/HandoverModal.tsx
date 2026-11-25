'use client';

import { useState } from 'react';
import { appendAuditLog } from '@/lib/audit-log';
import { useAuth } from '@/components/AuthProvider';
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';

export function HandoverModal({ shiftId, onClose }: { shiftId: string; onClose: () => void }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    equipmentStatus: 'Хэвийн',
    safetyStatus: 'Хэвийн',
    cleanlinessStatus: 'Хэвийн',
    pendingTasks: '',
    itemsPassed: '',
    remarks: ''
  });

  const save = async (mode: 'draft' | 'submit') => {
    setLoading(true);
    try {
      const payload = {
        ...formData,
        createdAt: new Date().toISOString(),
        ...(mode === 'submit' ? { submittedAt: new Date().toISOString() } : { draftSavedAt: new Date().toISOString() }),
      };
      const res = await fetch(`/api/shifts/${shiftId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'handovers', mode, data: payload }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'API Error');
      if (profile) {
        await appendAuditLog({
          actorUid: profile.uid,
          actorName: profile.displayName,
          action: 'handover_created',
          entityType: 'handover',
          entityId: data.id,
          details: mode === 'draft' ? 'Draft' : 'Submit',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await save('submit');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="bg-orange-600 p-6 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold">Ээлж хүлээлцэх бүртгэл</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Төхөөрөмжийн төлөв</label>
            <input 
              type="text"
              value={formData.equipmentStatus}
              onChange={(e) => setFormData({ ...formData, equipmentStatus: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Аюулгүй ажиллагаа</label>
              <input 
                type="text"
                value={formData.safetyStatus}
                onChange={(e) => setFormData({ ...formData, safetyStatus: e.target.value })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Цэвэрлэгээ</label>
              <input 
                type="text"
                value={formData.cleanlinessStatus}
                onChange={(e) => setFormData({ ...formData, cleanlinessStatus: e.target.value })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Дараагийн ээлжинд</label>
            <textarea 
              value={formData.pendingTasks}
              onChange={(e) => setFormData({ ...formData, pendingTasks: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none h-20 resize-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Хүлээлгэн өгсөн эд зүйлс</label>
            <input 
              type="text"
              value={formData.itemsPassed}
              onChange={(e) => setFormData({ ...formData, itemsPassed: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Тэмдэглэл</label>
            <textarea 
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none h-20 resize-none"
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
              type="button"
              disabled={loading}
              onClick={() => save('draft')}
              className="flex-1 py-3 bg-gray-100 text-gray-800 rounded-xl font-bold hover:bg-gray-200 transition-all disabled:opacity-50"
            >
              {loading ? 'Хадгалж байна...' : 'Түр хадгалах'}
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Илгээж байна...' : 'Илгээх'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
