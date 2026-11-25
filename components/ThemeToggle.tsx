'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { applyTheme } from '@/lib/theme';

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// Одоогийн горимыг `<html class="dark">`-аас шууд уншина — класс өөрчлөгдөхөд бүх товч шинэчлэгдэнэ.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}
const isDarkNow = () => document.documentElement.classList.contains('dark');
// Сервер дээр горим тодорхойгүй — гэгээлэгээр render хийгээд, hydration-ий дараа жинхэнэ утгаараа шинэчлэгдэнэ.
const isDarkOnServer = () => false;

/** Гэгээлэг ↔ харанхуй горим сэлгэх товч. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const isDark = useSyncExternalStore(subscribe, isDarkNow, isDarkOnServer);
  const toggle = () => applyTheme(isDark ? 'light' : 'dark', document.documentElement, browserStorage());

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isDark}
      title={isDark ? 'Гэгээлэг горим руу шилжих' : 'Харанхуй горим руу шилжих'}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 ${className}`}
    >
      {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
      <span>{isDark ? 'Гэгээлэг горим' : 'Харанхуй горим'}</span>
    </button>
  );
}
