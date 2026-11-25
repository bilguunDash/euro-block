import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { unsentCompletedShifts } from '@/lib/handover-unsent';

const MAX_VISIBLE = 5;

/**
 * Хэрэглэгчийн өөрийн, хүлээлцэх хүсэлт нь хэнд ч очоогүй ээлжүүд: «Ээлж дуусгах» дарсан ч илгээгээгүй,
 * эсвэл буцаагдаад дахин илгээгээгүй. Ийм ээлж «Идэвхтэй»-гаас алга болдог тул энд үлдээж, ээлж рүү нь
 * буцах холбоос өгнө. `ownMasterShift` — мастерын өөрийн дамжлагын ээлж (дараагийн мастерт хүлээлгэнэ).
 */
export function UnsentHandoverShifts({
  shifts,
  today,
  ownMasterShift = false,
}: {
  shifts: any[] | null | undefined;
  today: string;
  ownMasterShift?: boolean;
}) {
  const items = unsentCompletedShifts(shifts, today);
  if (items.length === 0) return null;
  const recipient = ownMasterShift ? 'дараагийн мастерт' : 'мастерт';

  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5">
      <p className="flex items-center gap-2 font-bold text-red-800">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {ownMasterShift ? 'Хүлээлцэх хүсэлт илгээгээгүй ээлж' : 'Мастерт хүсэлт илгээгээгүй ээлж'} ({items.length})
      </p>
      <p className="mt-1 text-sm text-red-700">
        «Ээлж дуусгах» нь {recipient} юу ч илгээдэггүй. Ээлжээ нээгээд «Хүлээлцэх хүсэлт илгээх» товчийг дарна уу.
      </p>
      <ul className="mt-3 space-y-2">
        {items.slice(0, MAX_VISIBLE).map(({ shift, kind, duplicateOfSent }) => (
          <li key={String(shift.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2">
            <span className="text-sm font-semibold text-gray-900">
              {shift.shiftDate} · {shift.shiftType} · {shift.stationCode}
              {kind === 'returned' ? (
                <span className="ml-2 text-xs font-bold text-red-700">
                  Буцаагдсан — засаад дахин илгээнэ үү
                  {shift.handoverReturnReason ? ` (шалтгаан: ${shift.handoverReturnReason})` : ''}
                </span>
              ) : null}
              {duplicateOfSent ? (
                <span className="ml-2 text-xs font-medium text-gray-500">
                  (энэ ээлжийн өөр бүртгэл илгээгдсэн — давхар байж магадгүй)
                </span>
              ) : null}
            </span>
            <Link href={`/shift/${shift.id}`} className="text-sm font-bold text-red-700 hover:underline">
              Нээх →
            </Link>
          </li>
        ))}
      </ul>
      {items.length > MAX_VISIBLE ? (
        <p className="mt-2 text-xs font-medium text-red-700">+{items.length - MAX_VISIBLE} бусад</p>
      ) : null}
    </div>
  );
}
