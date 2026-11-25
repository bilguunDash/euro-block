'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { appendAuditLog } from '@/lib/audit-log';
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';

export function RepairModal({ shiftId, shift, onClose }: { shiftId: string; shift: any; onClose: () => void }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    equipmentName: '',
    problem: '',
    actionTaken: '',
    performedBy: '',
    status: 'Дууссан'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const repairData = {
        ...formData,
        shiftId,
        stationCode: shift.stationCode,
        createdAt: new Date().toISOString(),
      };
      
      // Save to shift logs
      const repairRes = await fetch(`/api/shifts/${shiftId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'repairs', data: repairData }),
      });
      const repairJson = await repairRes.json().catch(() => null);
      if (!repairRes.ok || !repairJson?.ok) throw new Error(repairJson?.error || 'API Error');
      if (profile) {
        await appendAuditLog({
          actorUid: profile.uid,
          actorName: profile.displayName,
          action: 'repair_created',
          entityType: 'repair',
          entityId: repairJson.id,
          details: formData.equipmentName,
        });
      }
      
      // Save to PostgreSQL maintenance_requests via API
      const maintRes = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationCode: shift.stationCode,
          equipmentName: formData.equipmentName,
          reportedByUid: profile?.uid || '',
          reportedByName: profile?.displayName || profile?.email || '',
          description: formData.problem,
          priority: 'normal',
          status: formData.status === 'Дууссан' ? 'Closed' : 'Open',
          notes: formData.actionTaken || null,
        }),
      });
      const maintJson = await maintRes.json().catch(() => null);
      if (!maintRes.ok || !maintJson?.ok) throw new Error(maintJson?.error || 'API Error');
      if (profile) {
        await appendAuditLog({
          actorUid: profile.uid,
          actorName: profile.displayName,
          action: 'maintenance_created',
          entityType: 'maintenance_request',
          entityId: maintJson.id,
          details: formData.equipmentName,
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
          <h2 className="text-xl font-bold">Засвар үйлчилгээний бүртгэл</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Төхөөрөмжийн нэр</label>
            <input 
              type="text"
              value={formData.equipmentName}
              onChange={(e) => setFormData({ ...formData, equipmentName: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Гэмтэл/Асуудал</label>
            <textarea 
              value={formData.problem}
              onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none h-20 resize-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Авсан арга хэмжээ</label>
            <textarea 
              value={formData.actionTaken}
              onChange={(e) => setFormData({ ...formData, actionTaken: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none h-20 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Гүйцэтгэсэн</label>
              <input 
                type="text"
                value={formData.performedBy}
                onChange={(e) => setFormData({ ...formData, performedBy: e.target.value })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Төлөв</label>
              <select 
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value="Дууссан">Дууссан</option>
                <option value="Үргэлжилж байна">Үргэлжилж байна</option>
                <option value="Сэлбэг хүлээж байна">Сэлбэг хүлээж байна</option>
              </select>
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
