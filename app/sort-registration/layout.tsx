'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { Sidebar } from '@/components/dashboard/Sidebar';

export default function SortRegistrationLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading, logout } = useAuth();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        profile={profile}
        activeTab=""
        setActiveTab={() => router.push('/dashboard')}
        adminSection="users"
        setAdminSection={() => {}}
        logout={logout}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <main className="flex-1 min-w-0">
        <div className="sticky top-0 z-30 flex items-center border-b border-gray-200 bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="p-2 -ml-1 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Цэс нээх"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
