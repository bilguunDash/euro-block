'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { SORT_STATION_CODE } from '@/lib/sort-api-permissions';

export default function DashboardPage() {
  const { profile, user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const isSortOnlyOperator =
    profile?.role !== 'admin' &&
    (profile?.role === 'sort_operator' ||
      profile?.stationCode === SORT_STATION_CODE);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (profile && isSortOnlyOperator) {
      router.replace('/sort-registration');
    }
  }, [profile, isSortOnlyOperator, router]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
      </div>
    );
  }

  if (isSortOnlyOperator) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
      </div>
    );
  }

  return <Dashboard profile={profile} logout={logout} />;
}
