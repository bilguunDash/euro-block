import React from 'react';
import Link from 'next/link';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  href?: string;
  onClick?: () => void;
}

export function NavItem({ icon, label, active = false, href, onClick }: NavItemProps) {
  const content = (
    <div
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
        active ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {icon}
      {label}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block w-full">
        {content}
      </Link>
    );
  }

  return (
    <button className="w-full text-left" onClick={onClick}>
      {content}
    </button>
  );
}
