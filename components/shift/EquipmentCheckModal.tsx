'use client';

import { useEffect, useState } from 'react';
import { appendAuditLog } from '@/lib/audit-log';
import { useAuth } from '@/components/AuthProvider';
import { motion } from 'motion/react';
import { useToast } from '@/components/ui/ToastProvider';

export function EquipmentCheckModal({
  shiftId,
  onClose,
  initialData,
  editId,
  onSaved,
}: {
  shiftId: string;
  onClose: () => void;
  initialData?: { equipmentName?: string; equipmentStatus?: string; remark?: string } | null;
  editId?: string | null;
  onSaved?: (row: { id: string; data: any }) => void;
}) {
  const { profile } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    equipmentName: '',
    equipmentStatus: 'Хэвийн' as 'Хэвийн' | 'Асуудалтай' | 'Засвар шаардлагатай',
    remark: '',
  });

  useEffect(() => {
    if (!initialData) return;
    setFormData({
      equipmentName: String(initialData.equipmentName || ''),
      equipmentStatus: (String(initialData.equipmentStatus || 'Хэвийн') as any) || 'Хэвийн',
      remark: String(initialData.remark || ''),
    });
  }, [initialData]);

  const save = async (mode: 'draft' | 'submit') => {
    // Талбарууд ХООСОН БАЙЖ БОЛНО — «заавал бөглөх» шалгалтыг хэрэглэгчийн
    // хүсэлтээр авав (бүх станцын бүртгэлтэй нэгэн адил).
    setLoading(true);
    try {
      const payload = {
        equipmentName: formData.equipmentName,
        equipmentStatus: formData.equipmentStatus,
        isNormal: formData.equipmentStatus === 'Хэвийн',
        remark: formData.remark,
        checkTime: new Date().toISOString(),
        ...(mode === 'submit' ? { submittedAt: new Date().toISOString() } : { draftSavedAt: new Date().toISOString() }),
      };
      const res = await fetch(`/api/shifts/${shiftId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'equipment_checks', mode, data: payload, editId: editId || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'API Error');
      if (profile) {
        await appendAuditLog({
          actorUid: profile.uid,
          actorName: profile.displayName,
          action: 'equipment_check_created',
          entityType: 'equipment_check',
          entityId: data.id,
          details: `${mode === 'draft' ? 'Draft' : 'Submit'}: ${formData.equipmentName}: ${formData.equipmentStatus}`,
        });
      }
      onSaved?.({ id: String(data.id), data: payload });
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
      >
        <div className="p-8 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">Тоног төхөөрөмжийн үзлэг</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Төхөөрөмжийн нэр</label>
            <input 
              value={formData.equipmentName}
              onChange={(e) => setFormData({ ...formData, equipmentName: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
              placeholder="Жишээ: Конвейер 1"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Төлөв</label>
            <select
              value={formData.equipmentStatus}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  equipmentStatus: e.target.value as typeof formData.equipmentStatus,
                })
              }
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-bold text-sm"
            >
              <option value="Хэвийн">Хэвийн</option>
              <option value="Асуудалтай">Асуудалтай</option>
              <option value="Засвар шаардлагатай">Засвар шаардлагатай</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Тайлбар</label>
            <textarea 
              value={formData.remark}
              onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none resize-none"
              rows={3}
              placeholder="Гэмтэл, засварын шаардлага эсвэл онцлох зүйл..."
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
