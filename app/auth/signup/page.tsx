'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Lock, Mail, User } from 'lucide-react';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit = useMemo(() => email.trim().length > 0 && password.length >= 6, [email, password]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || null, email, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Бүртгэл үүсгэхэд алдаа гарлаа.');
        setSubmitting(false);
        return;
      }
      setSuccess(true);
      setSubmitting(false);
    } catch (e) {
      setError('Бүртгэл үүсгэхэд алдаа гарлаа.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6 relative overflow-hidden">
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
          <div className="flex flex-col items-center mb-10">
            <div className="relative w-28 h-28 mb-5 p-2 bg-white rounded-3xl shadow-sm ring-4 ring-orange-500/10">
              <Image
                src="/MAK_Euro_Block.webp"
                alt="MAK Euro Block Logo"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-contain p-2"
                priority
              />
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-1">Бүртгүүлэх</h1>
            <p className="text-gray-500 font-medium">Евроблок Ээлжийн Бүртгэлийн Систем</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest font-bold text-gray-500">Нэр (сонголттой)</label>
              <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-4 focus-within:ring-2 focus-within:ring-orange-500/30">
                <User className="w-5 h-5 text-orange-600 shrink-0" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  type="text"
                  autoComplete="name"
                  placeholder="Нэр"
                  className="w-full bg-transparent outline-none text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>

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
                  autoComplete="new-password"
                  placeholder="Хамгийн багадаа 6 тэмдэгт"
                  className="w-full bg-transparent outline-none text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Амжилттай бүртгэгдлээ. Админ баталгаажуулсны дараа нэвтрэх боломжтой.{' '}
                <Link href="/auth/signin" className="font-bold underline text-emerald-900">
                  Нэвтрэх
                </Link>
              </div>
            )}

            <motion.button
              whileHover={{ scale: submitting ? 1 : 1.01 }}
              whileTap={{ scale: submitting ? 1 : 0.98 }}
              disabled={!canSubmit || submitting}
              type="submit"
              className="w-full group flex items-center justify-center py-3.5 px-6 bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-2xl font-bold transition-all shadow-sm"
            >
              <span className="text-base">{submitting ? 'Түр хүлээнэ үү…' : 'Бүртгүүлэх'}</span>
            </motion.button>

            <div className="pt-2 text-center text-sm text-gray-500">
              Аль хэдийн бүртгэлтэй юу?{' '}
              <Link href="/auth/signin" className="text-orange-700 hover:text-orange-600 font-bold">
                Нэвтрэх
              </Link>
            </div>
          </form>
        </div>

        <p className="mt-8 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
          © {new Date().getFullYear()} MAK Euro Block LLC.
        </p>
      </motion.div>
    </div>
  );
}

