'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { appendAuditLog } from '@/lib/audit-log';
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';

export function PeriodicLogModal({
  shiftId,
  checkInIso,
  existingPeriodicCount,
  periodicIntervalHours,
  onClose,
}: {
  shiftId: string;
  checkInIso: string;
  existingPeriodicCount: number;
  periodicIntervalHours: number;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    logTime: new Date().toLocaleTimeString('mn-MN', { timeZone: 'Asia/Ulaanbaatar', hour: '2-digit', minute: '2-digit' }),
    remarks: '',
    processStatus: 'Хэвийн' as 'Хэвийн' | 'Асуудалтай',
  });

  const save = async (mode: 'draft' | 'submit') => {
    // Талбарууд ХООСОН БАЙЖ БОЛНО — «заавал бөглөх» шалгалтыг хэрэглэгчийн
    // хүсэлтээр авав (бүх станцын бүртгэлтэй нэгэн адил).
    const start = new Date(checkInIso).getTime();
    const intervalMs = periodicIntervalHours * 60 * 60 * 1000;
    const slotEnd = start + (existingPeriodicCount + 1) * intervalMs;
    const isLate = Date.now() > slotEnd;
    setLoading(true);
    try {
      const payload = {
        ...formData,
        isLate,
        slotDeadlineMs: slotEnd,
        operatorUid: profile?.uid,
        operatorName: profile?.displayName,
        createdAt: new Date().toISOString(),
        ...(mode === 'submit' ? { submittedAt: new Date().toISOString() } : { draftSavedAt: new Date().toISOString() }),
      };
      const res = await fetch(`/api/shifts/${shiftId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'periodic_logs', mode, data: payload }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'API Error');
      if (profile) {
        await appendAuditLog({
          actorUid: profile.uid,
          actorName: profile.displayName,
          action: 'periodic_log_created',
          entityType: 'periodic_log',
          entityId: data.id,
          details: `${mode === 'draft' ? 'Draft' : 'Submit'}: ${formData.logTime}`,
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-full flex items-start justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto"
      >
        <div className="bg-orange-600 p-6 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Тогтмол бүртгэл</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            Давтамж: <span className="font-bold">{periodicIntervalHours} цаг тутам</span>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Бүртгэлийн цаг</label>
            <input 
              type="time"
              value={formData.logTime}
              onChange={(e) => setFormData({ ...formData, logTime: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Процессын төлөв</label>
            <select
              value={formData.processStatus}
              onChange={(e) => setFormData({ ...formData, processStatus: e.target.value as 'Хэвийн' | 'Асуудалтай' })}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-bold text-sm"
            >
              <option value="Хэвийн">Хэвийн</option>
              <option value="Асуудалтай">Асуудалтай</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Тэмдэглэл</label>
            <textarea 
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none h-32 resize-none"
              placeholder="Процесс хэвийн эсвэл онцлох зүйл..."
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
    </div>
  );
}
