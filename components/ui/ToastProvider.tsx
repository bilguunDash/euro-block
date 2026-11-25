"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastVariant = "success" | "error" | "info" | "warning";

export type ToastInput = {
  title?: string;
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastItem = ToastInput & {
  id: string;
  createdAt: number;
};

type ToastApi = {
  show: (t: ToastInput) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

function uid() {
  // small, non-crypto id is fine for UI keys
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function variantStyles(v: ToastVariant) {
  switch (v) {
    case "success":
      return { ring: "ring-emerald-200", bg: "bg-emerald-50", text: "text-emerald-900", sub: "text-emerald-800" };
    case "error":
      return { ring: "ring-red-200", bg: "bg-red-50", text: "text-red-900", sub: "text-red-800" };
    case "warning":
      return { ring: "ring-amber-200", bg: "bg-amber-50", text: "text-amber-900", sub: "text-amber-800" };
    case "info":
    default:
      return { ring: "ring-gray-200", bg: "bg-white", text: "text-gray-900", sub: "text-gray-700" };
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, any>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const tm = timers.current[id];
    if (tm) {
      clearTimeout(tm);
      delete timers.current[id];
    }
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const item: ToastItem = {
        id: uid(),
        createdAt: Date.now(),
        variant: input.variant || "info",
        durationMs: input.durationMs ?? (input.variant === "error" ? 7000 : 4500),
        title: input.title,
        message: input.message,
      };
      setToasts((prev) => [item, ...prev].slice(0, 4));
      if (item.durationMs && item.durationMs > 0) {
        timers.current[item.id] = setTimeout(() => dismiss(item.id), item.durationMs);
      }
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message, title) => show({ message, title, variant: "success" }),
      error: (message, title) => show({ message, title, variant: "error" }),
      info: (message, title) => show({ message, title, variant: "info" }),
      warning: (message, title) => show({ message, title, variant: "warning" }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed right-4 top-4 z-[1000] flex w-[92vw] max-w-[420px] flex-col gap-3 md:right-6 md:top-6">
        {toasts.map((t) => {
          const s = variantStyles(t.variant || "info");
          return (
            <div
              key={t.id}
              className={`rounded-2xl shadow-lg ring-1 ${s.ring} ${s.bg} overflow-hidden backdrop-blur`}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  {t.title ? <div className={`text-sm font-black ${s.text}`}>{t.title}</div> : null}
                  <div className={`text-sm font-medium whitespace-pre-wrap break-words ${s.sub}`}>{t.message}</div>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-black text-gray-600 hover:bg-black/5"
                  aria-label="Хаах"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

