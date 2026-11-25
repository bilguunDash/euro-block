'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { LogIn } from 'lucide-react';

/**
 * Нүүр: нэвтэрээгүй → нэвтрэх. Нэвтэрсэн → үндсэн самбар /dashboard.
 * Шинэ ээлж эхлүүлэх: /shift/new
 */
export default function HomePage() {
  const { user, loading: authLoading, loggingIn, authError, login, clearError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !user) return;
    router.replace('/dashboard');
  }, [authLoading, user, router]);

  if (authLoading || user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-8 bg-orange-600 text-white">
          <h1 className="text-2xl font-bold">Евроблок Ээлжийн Бүртгэл</h1>
          <p className="text-orange-100 mt-2">Системд нэвтэрснээр хяналтын самбар нээгдэнэ.</p>
        </div>
        <div className="p-8 space-y-4">
          {authError && (
            <div className="p-4 rounded-xl bg-red-50 text-red-800 text-sm">
              <p className="font-bold mb-1">Нэвтрэхэд алдаа</p>
              <p>{authError}</p>
              <button type="button" onClick={clearError} className="mt-2 text-xs font-bold underline">
                Хаах
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => login()}
            disabled={loggingIn}
            className="w-full py-4 px-4 rounded-2xl border-2 border-gray-200 font-bold text-gray-800 hover:border-orange-200 hover:bg-orange-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loggingIn ? (
              <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <LogIn className="w-5 h-5 text-orange-600" />
            )}
            Нэвтрэх
          </button>
        </div>
      </div>
    </div>
  );
}
