import React from 'react';
import Image from 'next/image';
import { Bell, ShieldCheck, LogIn, Menu, Trash2 } from 'lucide-react';

interface DashboardHeaderProps {
  profile: any;
  activeTab: string;
  adminSection?: 'users' | 'schedules' | 'audit' | 'settings' | 'instructions' | 'announcements' | 'approvals';
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedShiftType: string;
  setSelectedShiftType: (type: any) => void;
  unreadNotifications: number;
  notifications: any[];
  showNotifPanel: boolean;
  setShowNotifPanel: (show: boolean | ((v: boolean) => boolean)) => void;
  setActiveTab: (tab: any) => void;
  logout: () => void;
  onOpenMobileNav?: () => void;
  onClearNotifications?: () => Promise<void> | void;
  onOpenNotification?: (notification: any) => Promise<void> | void;
}

export function DashboardHeader({
  profile,
  activeTab,
  adminSection,
  selectedDate,
  setSelectedDate,
  selectedShiftType,
  setSelectedShiftType,
  unreadNotifications,
  notifications,
  showNotifPanel,
  setShowNotifPanel,
  setActiveTab,
  logout,
  onOpenMobileNav,
  onClearNotifications,
  onOpenNotification,
}: DashboardHeaderProps) {
  const titleMap: Record<string, { parent: string; current: string }> = {
    dashboard: { parent: '', current: 'Нүүр' },
    'my-shifts': { parent: '', current: 'Миний ээлж' },
    'my-schedule': { parent: '', current: 'Миний хуваарь' },
    'my-entries': { parent: '', current: 'Миний бүртгэлүүд' },
    instructions: { parent: '', current: 'Заавар, ХАБ баримт' },
    announcements: { parent: '', current: 'Зарлалын самбар' },
    overview: { parent: '', current: 'Дамжлагын нэгдсэн хяналт' },
    'all-entries': { parent: '', current: 'Бүх бүртгэл харах' },
    'handover-approval': { parent: '', current: 'Ээлж хүлээлцэх баталгаажуулалт' },
    'periodic-control': { parent: '', current: 'Давтамжит хяналтын бүртгэл' },
    kpi: { parent: '', current: 'Тайлан / KPI' },
    hse: { parent: '', current: 'ХАБ асуумж / бүртгэл' },
    maintenance: { parent: '', current: 'Засвар' },
    audit: { parent: '', current: 'Аудитын лог' },
    admin: { parent: '', current: 'Админ самбар' },
  };
  const adminSectionTitleMap: Record<NonNullable<DashboardHeaderProps['adminSection']>, string> = {
    users: 'Хэрэглэгч удирдлага',
    schedules: 'Ээлжийн хуваарь',
    audit: 'Аудит лог',
    settings: 'Системийн тохиргоо',
    instructions: 'Заавар, ХАБ баримт',
    announcements: 'Зарлалын удирдлага',
    approvals: 'Давхар баталгаажуулалт',
  };
  const title =
    activeTab === 'admin' && adminSection
      ? { parent: '', current: adminSectionTitleMap[adminSection] }
      : titleMap[activeTab] || { parent: '', current: 'Хяналтын самбар' };

  return (
    <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between pl-4 pr-6 md:pl-8 md:pr-10 sticky top-0 z-10">
      <div className="flex items-center gap-2 md:hidden font-bold text-orange-600">
        {onOpenMobileNav && (
          <button
            type="button"
            onClick={onOpenMobileNav}
            className="p-2 -ml-1 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Цэс нээх"
          >
            <Menu className="w-6 h-6" />
          </button>
        )}
        <Image 
          src="https://static.wixstatic.com/media/d03e1f_4e3e335447a146419cb339ae2fa6a3ad~mv2.png/v1/crop/x_668,y_433,w_4926,h_1609/fill/w_189,h_60,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/MAK_Euro_Block.png" 
          alt="MAK Group" 
          width={100} 
          height={35} 
          referrerPolicy="no-referrer" 
          className="h-10 w-auto object-contain"
        />
      </div>
      {profile?.role !== 'master' && (
        <h2 className="hidden text-lg font-bold text-gray-900 md:flex md:items-center md:gap-2">
          {title.parent ? (
            <>
              <span className="text-sm font-bold text-gray-400">{title.parent}</span>
              <span className="text-gray-300">/</span>
            </>
          ) : null}
          <span>{title.current}</span>
        </h2>
      )}
      {profile?.role === 'master' && <div className="hidden md:block flex-1" />}
      <div className="flex items-center gap-2 md:gap-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifPanel((v: boolean) => !v)}
            className="relative p-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all"
            aria-label="Мэдэгдэл"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full bg-red-600 text-white text-xs font-black flex items-center justify-center ring-2 ring-white shadow-sm">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>
          {showNotifPanel && (
            <div className="absolute right-0 top-12 w-80 max-h-96 overflow-y-auto bg-white border border-gray-200 rounded-2xl shadow-xl z-50 text-left">
              <div className="p-3 border-b border-gray-200 flex items-center justify-between gap-3">
                <p className="font-bold text-sm text-gray-900">Мэдэгдэл</p>
                {notifications.length > 0 && onClearNotifications ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await onClearNotifications();
                      setShowNotifPanel(false);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Бүгдийг цэвэрлэх
                  </button>
                ) : null}
              </div>
              {notifications.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">Мэдэгдэл байхгүй.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {notifications.map((n) => (
                    <li key={n.id} className="p-3 hover:bg-gray-50">
                      <div className="text-left">
                        <p className="text-xs font-bold text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-600 mt-1">{n.body}</p>
                        {onOpenNotification && (
                          <button
                            type="button"
                            className="mt-2 inline-flex text-xs font-bold text-orange-600 hover:text-orange-700"
                            onClick={() => void onOpenNotification(n)}
                          >
                            Нээх
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        {profile?.role === 'admin' && (
          <button
            onClick={() => setActiveTab('admin')}
            className="p-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-bold">Админ</span>
          </button>
        )}
        <button
          onClick={logout}
          className="md:hidden p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
        >
          <LogIn className="w-5 h-5 rotate-180" />
        </button>
      </div>
    </header>
  );
}
