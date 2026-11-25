'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { BarChart3, ClipboardCheck, ShieldAlert, Wrench, BookOpen, Factory, ShieldCheck, Users, Calendar, Settings, ListChecks, FileText, Megaphone, X, LogIn, Bell } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NavItem } from '@/components/ui/NavItem';
import { RAM_STATION_CODE, SORT_STATION_CODE } from '@/lib/sort-api-permissions';

function roleLabel(role: unknown) {
  const map: Record<string, string> = {
    operator: 'Оператор',
    master: 'Ээлжийн мастер',
    admin: 'Админ',
    hse_engineer: 'ХАБ инженер',
    dispatcher: 'Диспетчер',
    chief_engineer: 'Ерөнхий инженер',
    auditor: 'Аудитор',
    manager: 'Админ',
    sort_operator: 'Сорт оператор',
  };
  const key = String(role || '').trim().toLowerCase();
  return map[key] || String(role || '');
}

interface SidebarProps {
  profile: any;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  adminSection: 'users' | 'schedules' | 'audit' | 'settings' | 'instructions' | 'announcements' | 'approvals';
  setAdminSection: (s: 'users' | 'schedules' | 'audit' | 'settings' | 'instructions' | 'announcements' | 'approvals') => void;
  logout: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({
  profile,
  activeTab,
  setActiveTab,
  adminSection,
  setAdminSection,
  logout,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pickTab = (tab: any) => {
    setActiveTab(tab);
    onMobileClose?.();
  };

  const isOperatorView = profile?.role === 'operator';
  const isAdminPanelUser = profile?.role === 'admin' || profile?.role === 'dispatcher';
  const isAdminView = isAdminPanelUser;
  const isMaster = profile?.role === 'master';
  const isHseEngineer = profile?.role === 'hse_engineer';
  const isDispatcher = profile?.role === 'dispatcher';
  const isSortOnlyOperator =
    profile?.role !== 'admin' &&
    (profile?.role === 'sort_operator' ||
      profile?.stationCode === SORT_STATION_CODE);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localName, setLocalName] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const pickAdminSection = (s: SidebarProps['adminSection']) => {
    setAdminSection(s);
    pickTab('admin');
  };

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setDisplayName(String(profile?.displayName || profile?.name || ''));
    setProfileMessage('');
    setProfileError('');
    setSavingProfile(false);
    setPasswordMessage('');
    setPasswordError('');
    setSavingPassword(false);
  };

  const openSettings = () => {
    resetPasswordForm();
    setSettingsOpen(true);
  };

  const closeSettings = () => {
    setSettingsOpen(false);
    resetPasswordForm();
  };

  const submitPasswordChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Бүх талбарыг бөглөнө үү.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Шинэ нууц үг хамгийн багадаа 6 тэмдэгт байна.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Шинэ нууц үг давталттайгаа таарахгүй байна.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || 'Нууц үг солиход алдаа гарлаа.');
      }
      setPasswordMessage('Нууц үг амжилттай солигдлоо.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setPasswordError(error?.message || 'Нууц үг солиход алдаа гарлаа.');
    } finally {
      setSavingPassword(false);
    }
  };

  const submitProfileUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError('');
    setProfileMessage('');

    const name = displayName.trim();
    if (name.length < 2) {
      setProfileError('Нэр хамгийн багадаа 2 тэмдэгт байна.');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || 'Нэр шинэчлэхэд алдаа гарлаа.');
      }
      setLocalName(name);
      setProfileMessage('Нэр амжилттай шинэчлэгдлээ.');
    } catch (error: any) {
      setProfileError(error?.message || 'Нэр шинэчлэхэд алдаа гарлаа.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`fixed inset-0 z-40 bg-black/40 md:hidden transition-opacity ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-label="Цэс хаах"
        onClick={onMobileClose}
      />
      <aside
        className={`
          isolate w-64 shrink-0 overflow-hidden [contain:paint] bg-white border-r border-gray-200 flex flex-col z-50 md:w-72
          md:sticky md:top-0 md:h-screen md:translate-x-0
          fixed left-0 top-0 h-full max-h-screen max-md:shadow-xl max-md:transition-transform
          ${mobileOpen ? 'translate-x-0' : 'max-md:-translate-x-full'}
        `}
      >
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3 font-bold text-xl text-orange-600">
          <Image 
            src="https://static.wixstatic.com/media/d03e1f_4e3e335447a146419cb339ae2fa6a3ad~mv2.png/v1/crop/x_668,y_433,w_4926,h_1609/fill/w_189,h_60,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/MAK_Euro_Block.png" 
            alt="MAK Group" 
            width={140} 
            height={50} 
            referrerPolicy="no-referrer" 
            className="h-12 w-auto object-contain"
          />
        </div>
      </div>
      <nav className="min-h-0 flex-1 p-4 space-y-2 overflow-y-auto">
        {profile?.role !== 'admin' && (profile?.role === 'sort_operator' || profile?.stationCode === RAM_STATION_CODE || profile?.stationCode === SORT_STATION_CODE || profile?.sortDualRole === true) && (
          <NavItem
            icon={<ListChecks className="w-5 h-5" />}
            label="Сорт бүртгэл"
            href="/sort-registration"
          />
        )}
        {!isSortOnlyOperator && (
        <>
        {isDispatcher ? (
          <>
            <div className="px-2 py-2 text-xs font-black uppercase tracking-wider text-gray-400">
              Dispatcher
            </div>
            <NavItem
              icon={<BarChart3 className="w-5 h-5" />}
              label="Нүүр"
              active={activeTab === 'dashboard'}
              onClick={() => pickTab('dashboard')}
            />
            <NavItem
              icon={<Calendar className="w-5 h-5" />}
              label="Ээлжийн хуваарь"
              active={activeTab === 'admin' && adminSection === 'schedules'}
              onClick={() => pickAdminSection('schedules')}
            />
            <NavItem
              icon={<ClipboardCheck className="w-5 h-5" />}
              label="Хоцролт, дутуу бүртгэл"
              active={activeTab === 'overview'}
              onClick={() => pickTab('overview')}
            />
            <NavItem
              icon={<ListChecks className="w-5 h-5" />}
              label="Бүх бүртгэл харах"
              active={activeTab === 'all-entries'}
              onClick={() => pickTab('all-entries')}
            />
            <NavItem
              icon={<FileText className="w-5 h-5" />}
              label="Тайлан / KPI"
              active={activeTab === 'kpi'}
              onClick={() => pickTab('kpi')}
            />
            <NavItem
              icon={<ClipboardCheck className="w-5 h-5" />}
              label="Аудитын лог"
              active={activeTab === 'audit'}
              onClick={() => pickTab('audit')}
            />
            <NavItem
              icon={<Bell className="w-5 h-5" />}
              label="Мэдэгдэл"
              active={activeTab === 'notifications'}
              onClick={() => pickTab('notifications')}
            />
            <NavItem
              icon={<Megaphone className="w-5 h-5" />}
              label="Зарлалын удирдлага"
              active={activeTab === 'admin' && adminSection === 'announcements'}
              onClick={() => pickAdminSection('announcements')}
            />
          </>
        ) : isAdminView && isAdminPanelUser ? (
          <>
            <div className="px-2 py-2 text-xs font-black uppercase tracking-wider text-gray-400">
              Админ панел
            </div>
            <NavItem
              icon={<BarChart3 className="w-5 h-5" />}
              label="Нүүр"
              active={activeTab === 'dashboard'}
              onClick={() => pickTab('dashboard')}
            />
            <NavItem
              icon={<Users className="w-5 h-5" />}
              label="Хэрэглэгч удирдлага"
              active={activeTab === 'admin' && adminSection === 'users'}
              onClick={() => pickAdminSection('users')}
            />
            <NavItem
              icon={<Calendar className="w-5 h-5" />}
              label="Ээлжийн хуваарь"
              active={activeTab === 'admin' && adminSection === 'schedules'}
              onClick={() => pickAdminSection('schedules')}
            />
            <NavItem
              icon={<FileText className="w-5 h-5" />}
              label="Тайлан / KPI"
              active={activeTab === 'kpi'}
              onClick={() => pickTab('kpi')}
            />
            <NavItem
              icon={<ClipboardCheck className="w-5 h-5" />}
              label="Аудит лог"
              active={activeTab === 'admin' && adminSection === 'audit'}
              onClick={() => pickAdminSection('audit')}
            />
            <NavItem
              icon={<Bell className="w-5 h-5" />}
              label="Мэдэгдэл"
              active={activeTab === 'notifications'}
              onClick={() => pickTab('notifications')}
            />
            <NavItem
              icon={<Settings className="w-5 h-5" />}
              label="Системийн тохиргоо"
              active={activeTab === 'admin' && adminSection === 'settings'}
              onClick={() => pickAdminSection('settings')}
            />
            {profile?.role === 'admin' && (
              <NavItem
                icon={<BookOpen className="w-5 h-5" />}
                label="Заавар, ХАБ баримт"
                active={activeTab === 'admin' && adminSection === 'instructions'}
                onClick={() => pickAdminSection('instructions')}
              />
            )}
            {(profile?.role === 'admin' || profile?.role === 'master') && (
              <NavItem
                icon={<Megaphone className="w-5 h-5" />}
                label="Зарлалын удирдлага"
                active={activeTab === 'admin' && adminSection === 'announcements'}
                onClick={() => pickAdminSection('announcements')}
              />
            )}
            {(profile?.role === 'admin' || profile?.role === 'chief_engineer') && (
              <NavItem
                icon={<ShieldCheck className="w-5 h-5" />}
                label="Давхар баталгаажуулалт"
                active={activeTab === 'admin' && adminSection === 'approvals'}
                onClick={() => pickAdminSection('approvals')}
              />
            )}
          </>
        ) : (
          <>
            {isOperatorView ? (
              <>
                <NavItem
                  icon={<BarChart3 className="w-5 h-5" />}
                  label="Нүүр"
                  active={activeTab === 'dashboard'}
                  onClick={() => pickTab('dashboard')}
                />
                <NavItem
                  icon={<ClipboardCheck className="w-5 h-5" />}
                  label="Миний ээлж"
                  active={activeTab === 'my-shifts'}
                  onClick={() => pickTab('my-shifts')}
                />
                <NavItem
                  icon={<Calendar className="w-5 h-5" />}
                  label="Миний хуваарь"
                  active={activeTab === 'my-schedule'}
                  onClick={() => pickTab('my-schedule')}
                />
                <NavItem
                  icon={<ShieldAlert className="w-5 h-5" />}
                  label="Миний бүртгэлүүд"
                  active={activeTab === 'my-entries'}
                  onClick={() => pickTab('my-entries')}
                />
                <NavItem
                  icon={<Bell className="w-5 h-5" />}
                  label="Мэдэгдэл"
                  active={activeTab === 'notifications'}
                  onClick={() => pickTab('notifications')}
                />
                <NavItem
                  icon={<BookOpen className="w-5 h-5" />}
                  label="Заавар, ХАБ баримт"
                  active={activeTab === 'instructions'}
                  onClick={() => pickTab('instructions')}
                />
                <NavItem
                  icon={<Megaphone className="w-5 h-5" />}
                  label="Зарлалын самбар"
                  active={activeTab === 'announcements'}
                  onClick={() => pickTab('announcements')}
                />
              </>
            ) : (
              <>
                {isHseEngineer ? (
                  <>
                    <NavItem
                      icon={<BarChart3 className="w-5 h-5" />}
                      label="Нүүр"
                      active={activeTab === 'dashboard'}
                      onClick={() => pickTab('dashboard')}
                    />
                    <NavItem
                      icon={<ShieldAlert className="w-5 h-5" />}
                      label="ХАБ асуумж / бүртгэл"
                      active={activeTab === 'hse'}
                      onClick={() => pickTab('hse')}
                    />
                    <NavItem
                      icon={<Bell className="w-5 h-5" />}
                      label="Мэдэгдэл"
                      active={activeTab === 'notifications'}
                      onClick={() => pickTab('notifications')}
                    />
                    <NavItem
                      icon={<BookOpen className="w-5 h-5" />}
                      label="Заавар, ХАБ баримт"
                      active={activeTab === 'instructions'}
                      onClick={() => pickTab('instructions')}
                    />
                  </>
                ) : (
                  <>
                {isMaster ? (
                  <>
                    <NavItem
                      icon={<BarChart3 className="w-5 h-5" />}
                      label="Нүүр"
                      active={activeTab === 'dashboard'}
                      onClick={() => pickTab('dashboard')}
                    />
                    <NavItem
                      icon={<LogIn className="w-5 h-5" />}
                      label="Ээлж эхлүүлэх"
                      href="/shift/new"
                    />
                    <NavItem
                      icon={<Calendar className="w-5 h-5" />}
                      label="Миний хуваарь"
                      active={activeTab === 'my-schedule'}
                      onClick={() => pickTab('my-schedule')}
                    />
                    <NavItem
                      icon={<Factory className="w-5 h-5" />}
                      label="Ээлжийн хяналт"
                      active={activeTab === 'overview'}
                      onClick={() => pickTab('overview')}
                    />
                    <NavItem
                      icon={<ListChecks className="w-5 h-5" />}
                      label="Бүх операторын бүртгэл"
                      active={activeTab === 'all-entries'}
                      onClick={() => pickTab('all-entries')}
                    />
                    <NavItem
                      icon={<ShieldCheck className="w-5 h-5" />}
                      label="Ээлж хүлээлцэх баталгаажуулалт"
                      active={activeTab === 'handover-approval'}
                      onClick={() => pickTab('handover-approval')}
                    />
                    <NavItem
                      icon={<FileText className="w-5 h-5" />}
                      label="Тайлан"
                      active={activeTab === 'kpi'}
                      onClick={() => pickTab('kpi')}
                    />
                    <NavItem
                      icon={<Bell className="w-5 h-5" />}
                      label="Мэдэгдэл"
                      active={activeTab === 'notifications'}
                      onClick={() => pickTab('notifications')}
                    />
                    <NavItem
                      icon={<BookOpen className="w-5 h-5" />}
                      label="Заавар, ХАБ баримт"
                      active={activeTab === 'instructions'}
                      onClick={() => pickTab('instructions')}
                    />
                    <NavItem
                      icon={<Megaphone className="w-5 h-5" />}
                      label="Зарлалын самбар"
                      active={activeTab === 'announcements'}
                      onClick={() => pickTab('announcements')}
                    />
                  </>
                ) : (
                  <>
                    <NavItem
                      icon={<BarChart3 className="w-5 h-5" />}
                      label="Хяналтын самбар"
                      active={activeTab === 'dashboard'}
                      onClick={() => pickTab('dashboard')}
                    />
                    <NavItem
                      icon={<ShieldAlert className="w-5 h-5" />}
                      label="ХАБЭА"
                      active={activeTab === 'hse'}
                      onClick={() => pickTab('hse')}
                    />
                    <NavItem
                      icon={<Wrench className="w-5 h-5" />}
                      label="Засвар"
                      active={activeTab === 'maintenance'}
                      onClick={() => pickTab('maintenance')}
                    />
                    <NavItem
                      icon={<Bell className="w-5 h-5" />}
                      label="Мэдэгдэл"
                      active={activeTab === 'notifications'}
                      onClick={() => pickTab('notifications')}
                    />
                  </>
                )}
                  </>
                )}
              </>
            )}
            {!isMaster && ['master', 'dispatcher', 'chief_engineer'].includes(profile?.role || '') && (
              <NavItem
                icon={<Factory className="w-5 h-5" />}
                label="Ээлжийн хяналт"
                active={activeTab === 'overview'}
                onClick={() => pickTab('overview')}
              />
            )}
            {profile?.role === 'chief_engineer' && (
              <NavItem
                icon={<ShieldCheck className="w-5 h-5" />}
                label="Давхар баталгаажуулалт"
                active={activeTab === 'admin' && adminSection === 'approvals'}
                onClick={() => pickAdminSection('approvals')}
              />
            )}
            {!isMaster && !isHseEngineer && ['auditor', 'admin', 'dispatcher', 'chief_engineer', 'master', 'hse_engineer'].includes(
              profile?.role || ''
            ) && (
              <NavItem
                icon={<BarChart3 className="w-5 h-5" />}
                label="Тайлан / KPI"
                active={activeTab === 'kpi'}
                onClick={() => pickTab('kpi')}
              />
            )}
            {(profile?.role === 'auditor' ||
              profile?.role === 'admin' ||
              profile?.role === 'dispatcher' ||
              profile?.role === 'chief_engineer') && (
              <NavItem
                icon={<ClipboardCheck className="w-5 h-5" />}
                label="Аудитын лог"
                active={activeTab === 'audit'}
                onClick={() => pickTab('audit')}
              />
            )}
            {profile?.role === 'dispatcher' && (
              <NavItem
                icon={<Megaphone className="w-5 h-5" />}
                label="Зарлалын самбар"
                active={activeTab === 'announcements'}
                onClick={() => pickTab('announcements')}
              />
            )}
          </>
        )}
        </>
        )}
      </nav>
      <div className="shrink-0 overflow-hidden border-t border-gray-200 bg-white p-4">
        <div className="relative mb-4 max-w-full overflow-hidden rounded-xl bg-gray-50 p-3 pr-12">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-600 text-sm font-bold uppercase text-white shadow-sm">
              {String(localName ?? profile?.displayName ?? profile?.name ?? profile?.email ?? '?').charAt(0)}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="line-clamp-2 max-w-full break-words text-sm font-bold leading-5 text-gray-900 [overflow-wrap:anywhere]">{localName ?? profile?.displayName ?? profile?.name ?? profile?.email}</p>
              <p className="truncate text-xs font-medium text-gray-500">{roleLabel(profile?.role)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openSettings}
            className="absolute right-3 top-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-orange-50 hover:text-orange-700"
            aria-label="Профайлын тохиргоо"
            title="Профайлын тохиргоо"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
        <ThemeToggle className="mb-1 w-full" />
        <button
          onClick={() => {
            onMobileClose?.();
            logout();
          }}
          className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left font-medium"
        >
          Гарах
        </button>
      </div>
    </aside>
    {settingsOpen && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 px-4">
        <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-base font-bold text-gray-900">Профайлын тохиргоо</h2>
              <p className="text-xs text-gray-500">Нууц үгээ шинэчлэх</p>
            </div>
            <button
              type="button"
              onClick={closeSettings}
              className="h-9 w-9 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 flex items-center justify-center transition-colors"
              aria-label="Хаах"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-5 py-5 space-y-5">
          <form onSubmit={submitProfileUpdate} className="space-y-3">
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">Нэр</span>
              <input
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </label>
            {profileError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{profileError}</p>
            )}
            {profileMessage && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{profileMessage}</p>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gray-800 hover:bg-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingProfile ? 'Хадгалж байна...' : 'Нэр хадгалах'}
              </button>
            </div>
          </form>
          <div className="h-px bg-gray-200" />
          <form onSubmit={submitPasswordChange} className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">Одоогийн нууц үг</span>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">Шинэ нууц үг</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700">Шинэ нууц үг давтах</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </label>
            {passwordError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{passwordError}</p>
            )}
            {passwordMessage && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{passwordMessage}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeSettings}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Болих
              </button>
              <button
                type="submit"
                disabled={savingPassword}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingPassword ? 'Хадгалж байна...' : 'Нууц үг солих'}
              </button>
            </div>
          </form>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
