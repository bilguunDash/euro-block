import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  subValue: string;
  icon: React.ReactNode;
}

export function StatCard({ title, value, subValue, icon }: StatCardProps) {
  return (
    <div className="p-8 bg-white rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">{title}</p>
        <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
      </div>
      <h4 className="text-4xl font-black text-gray-900 mb-2">{value}</h4>
      <p className="text-sm text-gray-400 font-medium">{subValue}</p>
    </div>
  );
}
