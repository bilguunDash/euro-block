'use client';

import React from 'react';
import { signOut } from 'next-auth/react';
import Image from 'next/image';
import { Clock, LogOut, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PendingPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 rounded-full blur-[120px]" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg relative z-10"
      >
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-2xl p-12 text-center">
          <div className="flex justify-center mb-8">
            <div className="relative w-24 h-24 mb-6">
              <Image
                src="/MAK_Euro_Block.webp"
                alt="MAK Euro Block Logo"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-contain"
              />
            </div>
          </div>

          <div className="inline-flex p-4 bg-orange-500/10 rounded-full mb-8">
            <Clock className="w-10 h-10 text-orange-500 animate-pulse" />
          </div>

          <h1 className="text-3xl font-bold text-white mb-4">Бүртгэл хүлээгдэж байна</h1>
          <p className="text-slate-400 text-lg mb-10 leading-relaxed">
            Таны бүртгэл амжилттай хийгдлээ. <br/>
            Гэвч системд нэвтрэхийн тулд <strong>Админ</strong> таны эрхийг баталгаажуулах шаардлагатай.
          </p>

          <div className="p-6 bg-white/5 border border-white/5 rounded-2xl mb-10 flex items-start gap-4 text-left">
            <ShieldAlert className="w-6 h-6 text-orange-400 shrink-0 mt-1" />
            <p className="text-sm text-slate-400 italic">
              &quot;Оператор&quot; эрхээр бүртгүүлсэн тул админ таны мэдээллийг хянаж, дамжлагыг тань тохируулсны дараа систем ашиглах боломжтой болно.
            </p>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="w-full flex items-center justify-center gap-3 p-5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold transition-all border border-white/10"
          >
            <LogOut className="w-5 h-5" />
            Гарах
          </button>
        </div>
      </motion.div>
    </div>
  );
}
