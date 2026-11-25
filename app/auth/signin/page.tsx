'use client';

import React, { useMemo, useState } from 'react';
import { signIn } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { Lock, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

function getAuthErrorMessage(code?: string | null) {
  const value = String(code || '').trim();
  if (!value) return 'Нэвтрэх үед алдаа гарлаа. Дахин оролдоно уу.';
  if (value === 'CredentialsSignin') return 'Имэйл эсвэл нууц үг буруу байна.';
  if (value === 'ACCOUNT_NOT_APPROVED') return 'Таны бүртгэл баталгаажаагүй байна. Админтай холбогдоно уу.';
  if (value === 'PASSWORD_NOT_SET') return 'Энэ хэрэглэгч дээр нууц үг тохируулаагүй байна. Админтай холбогдоно уу.';
  if (value === 'Configuration' || value === 'CallbackRouteError') {
    return 'Нэвтрэх үйлчилгээний тохиргоонд алдаа байна. Админд мэдэгдэнэ үү.';
  }
  return `Нэвтрэх үед алдаа гарлаа (${value}).`;
}

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => email.trim().length > 0 && password.length > 0, [email, password]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await signIn('credentials', {
      email,
      password,
      callbackUrl: '/',
      redirect: false,
    });
    setSubmitting(false);
    if (!res?.ok) {
      setError(getAuthErrorMessage(res?.error));
      return;
    }
    window.location.href = res.url || '/';
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6 relative overflow-hidden">
      {/* Soft background matching site */}
      <div className="absolute inset-0 bg-gradient-to-b from-orange-50/60 via-white to-white" />
      <div className="absolute top-[-12%] left-[-12%] w-[42%] h-[42%] bg-orange-200/40 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-12%] right-[-12%] w-[42%] h-[42%] bg-slate-200/50 rounded-full blur-[120px]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white border border-gray-200 rounded-[2.5rem] shadow-xl p-10 overflow-hidden">
          {/* Logo Section */}
          <div className="flex flex-col items-center mb-12">
            <div className="relative w-28 h-28 mb-6 p-2 bg-white rounded-3xl shadow-sm ring-4 ring-orange-500/10">
              <Image
                src="/MAK_Euro_Block.webp"
                alt="MAK Euro Block Logo"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-contain p-2"
                priority
              />
            </div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">MAK Euro Block</h1>
            <p className="text-gray-500 font-medium">Ээлжийн Бүртгэлийн Систем</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest font-bold text-gray-500">Имэйл</label>
              <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-4 focus-within:ring-2 focus-within:ring-orange-500/30">
                <Mail className="w-5 h-5 text-orange-600 shrink-0" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder="Имэйл хаяг"
                  className="w-full bg-transparent outline-none text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest font-bold text-gray-500">Нууц үг</label>
              <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-4 focus-within:ring-2 focus-within:ring-orange-500/30">
                <Lock className="w-5 h-5 text-orange-600 shrink-0" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="Нууц үг"
                  className="w-full bg-transparent outline-none text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <motion.button
              whileHover={{ scale: submitting ? 1 : 1.01 }}
              whileTap={{ scale: submitting ? 1 : 0.98 }}
              disabled={!canSubmit || submitting}
              type="submit"
              className="w-full group flex items-center justify-center py-3.5 px-6 bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-2xl font-bold transition-all shadow-sm"
            >
              <span className="text-base">{submitting ? 'Түр хүлээнэ үү…' : 'Нэвтрэх'}</span>
            </motion.button>

            <Link
              href="/auth/signup"
              className="flex w-full items-center justify-center rounded-2xl border border-orange-600 px-6 py-3.5 text-base font-bold text-orange-700 transition-colors hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
            >
              Бүртгүүлэх
            </Link>

          </form>

          <div className="mt-12 text-center">
            <p className="text-gray-500 text-sm font-medium">
              Зөвхөн эрх бүхий ажилтнууд нэвтрэх боломжтой
            </p>
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-8 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
          © {new Date().getFullYear()} MAK Euro Block LLC.
        </p>
      </motion.div>
    </div>
  );
}
