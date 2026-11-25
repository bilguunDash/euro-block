'use client';

import React from 'react';
import Link from 'next/link';

export default function ErrorPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white text-center">
      <div>
        <h1 className="text-4xl font-bold text-orange-500 mb-4">Алдаа гарлаа</h1>
        <p className="text-slate-400 mb-8">Нэвтрэх үед алдаа гарлаа. Та дахин оролдоно уу.</p>
        <Link href="/auth/signin" className="px-6 py-3 bg-orange-600 rounded-xl font-bold">
          Буцах
        </Link>
      </div>
    </div>
  );
}
