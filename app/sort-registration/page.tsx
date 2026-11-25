'use client';

import Link from 'next/link';
import { ChevronLeft, Plus } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { SortRecordsListView } from '@/components/sort/SortRecordsListView';
import { RAM_STATION_CODE, SORT_STATION_CODE } from '@/lib/sort-api-permissions';

export default function SortRegistrationPage() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
      </div>
    );
  }

  const canAccess =
    profile?.role === 'admin' ||
    profile?.role === 'sort_operator' ||
    profile?.stationCode === RAM_STATION_CODE ||
    profile?.stationCode === SORT_STATION_CODE ||
    profile?.sortDualRole === true;
  const canCreate = profile?.role === 'admin' || profile?.role === 'sort_operator' || profile?.stationCode === RAM_STATION_CODE || profile?.sortDualRole === true;

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-gray-600">Танд энэ хуудсанд хандах эрх байхгүй байна.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-orange-600 font-bold hover:underline">
            Нүүр рүү буцах
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors">
            <ChevronLeft className="w-5 h-5" />
            <span>Буцах</span>
          </Link>
          {canCreate && (
            <Link
              href="/sort-registration/new"
              className="inline-flex items-center gap-2 px-5 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-100"
            >
              <Plus className="w-4 h-4" />
              Шинэ бүртгэл
            </Link>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Сорт бүртгэл</h1>
          <p className="text-sm text-gray-500 mt-1">Рам болон сорт операторын бүртгэлийн жагсаалт</p>
        </div>

        <SortRecordsListView />
      </div>
    </div>
  );
}
