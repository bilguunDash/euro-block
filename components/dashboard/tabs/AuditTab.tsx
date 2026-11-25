import { HorizontalPagedList } from '../HorizontalPagedList';

type AuditTabProps = {
  auditLogs: any[];
};

export function AuditTab({ auditLogs }: AuditTabProps) {
  return (
    <section className="space-y-8">
      <div>
        <h3 className="text-2xl font-bold text-gray-900">Аудитын лог</h3>
        <p className="text-gray-500">Системд хийгдсэн бүх үйлдлүүдийн түүх</p>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <HorizontalPagedList
          items={auditLogs}
          renderPage={(page) => (
          <table className="w-full table-fixed text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-5 font-bold">Хэзээ</th>
                <th className="px-4 py-5 font-bold">Хэн</th>
                <th className="px-4 py-5 font-bold">Үйлдэл</th>
                <th className="px-4 py-5 font-bold">Төрөл</th>
                <th className="px-4 py-5 font-bold">Дэлгэрэнгүй</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-gray-400">Лог одоогоор байхгүй байна.</td>
                </tr>
              ) : (
                page.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="break-words px-4 py-6 text-sm text-gray-600">
                      {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'Уншиж байна...'}
                    </td>
                    <td className="break-words px-4 py-6 text-sm font-bold text-gray-900">{log.actorName}</td>
                    <td className="break-words px-4 py-6 text-sm text-gray-700">
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-bold uppercase">
                        {log.action}
                      </span>
                    </td>
                    <td className="break-words px-4 py-6 text-sm text-gray-500 capitalize">{log.entityType}</td>
                    <td className="break-words px-4 py-6 text-sm text-gray-600">{log.details || '-'}</td>
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
