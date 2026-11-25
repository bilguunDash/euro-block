'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useSession, signOut as nextSignOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { MonitorSmartphone, ShieldAlert } from 'lucide-react';
import { getDevicePayload } from '@/lib/device-client';

interface AuthContextType {
  user: { uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null } | null;
  profile: any | null;
  loading: boolean;
  loggingIn: boolean;
  authError: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [deviceAccessLoading, setDeviceAccessLoading] = useState(false);
  const [deviceAccessChecked, setDeviceAccessChecked] = useState(false);
  const [deviceAccessDenied, setDeviceAccessDenied] = useState<any | null>(null);

  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const sessionUserId = session?.user ? String((session.user as any).id || '') : '';

  const requiresDeviceCheck = sessionStatus === 'authenticated' && Boolean(sessionUserId);
  const loading = sessionStatus === 'loading' || deviceAccessLoading || (requiresDeviceCheck && !deviceAccessChecked);

  const derived = useMemo(() => {
    if (!session?.user) return { user: null, profile: null };
    const sessionUser = session.user as any;
    const user = {
      uid: String(sessionUser.id || ''),
      email: sessionUser.email ?? null,
      displayName: sessionUser.name ?? null,
      photoURL: sessionUser.image ?? null,
    };
    const profile = {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      role: sessionUser.role || 'operator',
      stationCode: sessionUser.stationCode,
      isApproved: sessionUser.isApproved ?? false,
      tabletAccessAllowed: sessionUser.tabletAccessAllowed ?? true,
      mobileAccessAllowed: sessionUser.mobileAccessAllowed ?? false,
      sortDualRole: Boolean(sessionUser.sortDualRole),
    };
    return { user, profile };
  }, [session]);

  useEffect(() => {
    if (sessionStatus === 'loading') return;

    if (sessionStatus === 'unauthenticated' && !pathname.startsWith('/auth')) {
      router.push('/auth/signin');
    }
  }, [sessionStatus, pathname, router]);

  useEffect(() => {
    let cancelled = false;

    async function registerDevice() {
      if (sessionStatus !== 'authenticated' || !sessionUserId) {
        setDeviceAccessDenied(null);
        setDeviceAccessLoading(false);
        setDeviceAccessChecked(false);
        return;
      }

      setDeviceAccessLoading(true);
      setDeviceAccessChecked(false);
      try {
        const res = await fetch('/api/device-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(getDevicePayload()),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || data?.allowed === false) {
          setDeviceAccessDenied({
            reason: data?.reason || data?.error || 'device_not_allowed',
            deviceType: data?.deviceType || 'unknown',
            tabletAccessAllowed: data?.tabletAccessAllowed ?? false,
            mobileAccessAllowed: data?.mobileAccessAllowed ?? false,
          });
        } else {
          setDeviceAccessDenied(null);
        }
      } catch (error: any) {
        if (!cancelled) {
          setDeviceAccessDenied({
            reason: error?.message || 'device_registration_failed',
            deviceType: 'unknown',
            tabletAccessAllowed: false,
            mobileAccessAllowed: false,
          });
        }
      } finally {
        if (!cancelled) {
          setDeviceAccessChecked(true);
          setDeviceAccessLoading(false);
        }
      }
    }

    registerDevice();
    return () => {
      cancelled = true;
    };
  }, [sessionStatus, sessionUserId]);

  const login = async () => {
    router.push('/auth/signin');
  };

  const logout = async () => {
    try {
      await nextSignOut({ callbackUrl: '/auth/signin' });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const clearError = () => setAuthError(null);

  if (deviceAccessDenied && session?.user) {
    const isMobile = deviceAccessDenied.deviceType === 'mobile';
    const isTabletLike =
      deviceAccessDenied.deviceType === 'tablet' ||
      deviceAccessDenied.deviceType === 'desktop' ||
      deviceAccessDenied.deviceType === 'unknown';
    return (
      <AuthContext.Provider
        value={{
          user: derived.user,
          profile: derived.profile,
          loading: false,
          loggingIn,
          authError,
          login,
          logout,
          clearError,
        }}
      >
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-200 p-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Энэ төхөөрөмжөөс систем ашиглах эрхгүй байна</h1>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              {isMobile
                ? 'Гар утаснаас ашиглах эрхийг админ нээх шаардлагатай.'
                : isTabletLike
                  ? 'Энэ төрлийн төхөөрөмжөөс ашиглах эрхийг админ нээх шаардлагатай.'
                  : 'Энэ төхөөрөмжөөс ашиглах эрхийг админ нээх шаардлагатай.'}
            </p>
            <div className="mt-5 rounded-2xl bg-gray-50 border border-gray-100 p-4 text-left">
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <MonitorSmartphone className="h-4 w-4 text-gray-500" />
                <span className="font-semibold">Төхөөрөмж:</span>
                <span className="capitalize">{deviceAccessDenied.deviceType || 'unknown'}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="mt-6 w-full rounded-xl bg-orange-600 px-4 py-3 font-bold text-white shadow-lg shadow-orange-100 hover:bg-orange-700 transition-colors"
            >
              Гарах
            </button>
          </div>
        </div>
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user: derived.user,
        profile: derived.profile,
        loading,
        loggingIn,
        authError,
        login,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
