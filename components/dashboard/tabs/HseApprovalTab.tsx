import { HorizontalPagedList } from '../HorizontalPagedList';

type HseApprovalTabProps = {
  hseLogs: any[];
  profileRole?: string | null;
  handleApproveHseLog: (id: string, note?: string) => Promise<void> | void;
};

export function HseApprovalTab({
  hseLogs,
  profileRole,
  handleApproveHseLog,
}: HseApprovalTabProps) {
  const pendingHseLogs = hseLogs.filter((log) => !log.hseEngineerApproved);

  return (
    <section className="space-y-8">
      <div>
        <h3 className="text-2xl font-bold text-gray-900">ХАБ баталгаажуулалт</h3>
        <p className="text-gray-500">Инженерийн хяналт хүлээгдэж буй ХАБ-ын бүртгэлүүд</p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <HorizontalPagedList
          items={pendingHseLogs}
          renderPage={(page) => (
        <table className="w-full table-fixed text-left">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <th className="px-8 py-5 font-bold">Огноо</th>
              <th className="px-8 py-5 font-bold">Дамжлага</th>
              <th className="px-8 py-5 font-bold">Оператор</th>
              <th className="px-8 py-5 font-bold">Төлөв</th>
              <th className="px-8 py-5 font-bold">Үйлдэл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pendingHseLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-8 py-12 text-center text-gray-400">Баталгаажуулах бүртгэл байхгүй байна.</td>
              </tr>
            ) : (
              page.map(log => (
                <tr key={log.id}>
                  <td className="px-8 py-6 text-sm font-medium text-gray-900">{new Date(log.timestamp).toLocaleDateString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })}</td>
                  <td className="px-8 py-6 text-sm text-gray-600">{log.stationCode}</td>
                  <td className="px-8 py-6 text-sm text-gray-600">{log.operatorName}</td>
                  <td className="px-8 py-6">
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase">Хүлээгдэж буй</span>
                  </td>
                  <td className="px-8 py-6">
                    {profileRole === 'hse_engineer' ? (
                      <button
                        type="button"
                        onClick={() => handleApproveHseLog(log.id)}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors"
                      >
                        Баталгаажуулах
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500">Зөвхөн ХАБ инженер</span>
                    )}
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
