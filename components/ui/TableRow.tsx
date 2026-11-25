import React from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';

interface TableRowProps {
  id: string;
  date: string;
  station: string;
  stationName?: string | null;
  type: string;
  status: string;
  checkIn?: string | null;
  checkOut?: string | null;
}

export function TableRow({ id, date, station, stationName, type, status, checkIn, checkOut }: TableRowProps) {
  const checkInLabel = checkIn ? new Date(checkIn).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' }) : '—';
  const checkOutLabel = checkOut ? new Date(checkOut).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' }) : '—';
  const stationNameLabel = String(stationName || '').trim();
  return (
    <tr className="hover:bg-gray-50 transition-colors group">
      <td className="px-4 py-5 text-sm font-medium text-gray-900 lg:px-5">{date}</td>
      <td className="px-4 py-5 lg:px-5">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm text-gray-900 font-bold">{station}</span>
          <span className="text-xs leading-5 text-gray-400 whitespace-normal break-words">
            {stationNameLabel || 'Дамжлагын код'}
          </span>
        </div>
      </td>
      <td className="px-4 py-5 text-sm font-medium text-gray-600 lg:px-5">{type}</td>
      <td className="px-4 py-5 lg:px-5">
        <span
          className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
            status === 'Баталгаажсан' 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
              : 'bg-amber-50 text-amber-700 border border-amber-100'
          }`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${status === 'Баталгаажсан' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {status}
        </span>
      </td>
      <td className="px-4 py-5 text-xs text-gray-600 whitespace-nowrap lg:px-5">{checkInLabel}</td>
      <td className="px-4 py-5 text-xs text-gray-600 whitespace-nowrap lg:px-5">{checkOutLabel}</td>
      <td className="px-4 py-5 text-right lg:px-5">
        <Link 
          href={`/shift/${id}`}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700 transition-colors hover:bg-orange-100 hover:text-orange-800"
          title="Бүртгэлийн хуудас нээх"
        >
          <FileText className="h-4 w-4 shrink-0" />
          Нээх
        </Link>
      </td>
    </tr>
  );
}
