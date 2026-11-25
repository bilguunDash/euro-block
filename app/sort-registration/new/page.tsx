'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ui/ToastProvider';
import { RamHeaderForm, type RamHeaderValues } from '@/components/sort/forms/RamHeaderForm';
import { RAM_STATION_CODE } from '@/lib/sort-api-permissions';

export default function NewSortRecordPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
      </div>
    );
  }

  const canCreate = profile?.role === 'admin' || profile?.role === 'sort_operator' || profile?.stationCode === RAM_STATION_CODE || profile?.sortDualRole === true;
  if (!canCreate) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-gray-600">Танд шинэ бүртгэл үүсгэх эрх байхгүй байна.</p>
          <Link href="/sort-registration" className="mt-4 inline-block text-orange-600 font-bold hover:underline">
            Буцах
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (values: RamHeaderValues) => {
    try {
      const res = await fetch('/api/sort/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Бүртгэл үүсгэхэд алдаа гарлаа');
      toast.success('Бүртгэл амжилттай үүслээ. Сорт руу илгээгдлээ.');
      router.push(`/sort-registration/${data.data.id}`);
    } catch (error: any) {
      toast.error(error?.message || 'Алдаа гарлаа');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-xl mx-auto space-y-6">
        <Link href="/sort-registration" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors">
          <ChevronLeft className="w-5 h-5" />
          <span>Буцах</span>
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Шинэ бүртгэл</h1>
          <p className="text-sm text-gray-500 mt-1">Рамны мэдээллийг бөглөж сорт руу илгээнэ</p>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 md:p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">1) Рамны мэдээлэл</h2>
          <RamHeaderForm onSubmit={handleSubmit} />
        </div>
      </div>
    </div>
  );
}
