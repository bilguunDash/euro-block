import Link from 'next/link';
import { HorizontalPagedList } from '../HorizontalPagedList';

type ApproveTabProps = {
  pendingShifts: any[];
  masterLoading: boolean;
};

export function ApproveTab({ pendingShifts, masterLoading }: ApproveTabProps) {
  return (
    <section>
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-xl text-gray-900">Баталгаажуулах хүлээгдэж буй бүх бүртгэлүүд</h3>
            <p className="text-sm text-gray-500 mt-1">Нийт {pendingShifts.length} бүртгэл хүлээгдэж байна</p>
          </div>
        </div>
        <HorizontalPagedList
          items={masterLoading ? [] : pendingShifts}
          renderPage={(page) => (
          <table className="w-full table-fixed text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-5 font-bold">Огноо</th>
                <th className="px-4 py-5 font-bold">Дамжлага</th>
                <th className="px-4 py-5 font-bold">Оператор</th>
                <th className="px-4 py-5 font-bold">Ээлж</th>
                <th className="px-4 py-5 font-bold text-right">Үйлдэл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {masterLoading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-gray-400">Уншиж байна...</td>
                </tr>
              ) : pendingShifts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-gray-400">Баталгаажуулах бүртгэл байхгүй байна.</td>
                </tr>
              ) : (
                page.map((shift) => (
                  <tr key={shift.id} className="hover:bg-gray-50 transition-colors">
                    <td className="break-words px-4 py-6 text-sm text-gray-900 font-medium">{shift.shiftDate}</td>
                    <td className="break-words px-4 py-6 text-sm text-gray-900 font-bold">{shift.stationCode}</td>
                    <td className="break-words px-4 py-6 text-sm text-gray-800 font-medium">{shift.operatorName}</td>
                    <td className="break-words px-4 py-6 text-sm text-gray-600">{shift.shiftType}</td>
                    <td className="px-4 py-6">
                      <Link
                        href={`/shift/${shift.id}`}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors"
                      >
                        Хянах
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          )}
        />
      </div>
    </section>
  );
}
