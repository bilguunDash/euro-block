import { Plus } from 'lucide-react';
import { HorizontalPagedList } from '../HorizontalPagedList';

type MaintenanceTabProps = {
  maintenanceRequests: any[];
  setShowMaintCreateModal: (show: boolean) => void;
  setMaintDetail: (req: any) => void;
};

export function MaintenanceTab({
  maintenanceRequests,
  setShowMaintCreateModal,
  setMaintDetail,
}: MaintenanceTabProps) {
  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Засвар үйлчилгээ</h3>
          <p className="text-gray-500">Тоног төхөөрөмжийн засварын хүсэлтүүд</p>
        </div>
        <button
          type="button"
          onClick={() => setShowMaintCreateModal(true)}
          className="px-6 py-3 bg-orange-600 text-white rounded-xl font-bold shadow-lg shadow-orange-100 hover:bg-orange-700 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Засварын хүсэлт
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <HorizontalPagedList
          items={maintenanceRequests}
          renderPage={(page) => (
        <table className="w-full table-fixed text-left">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <th className="px-8 py-5 font-bold">Тоног төхөөрөмж</th>
              <th className="px-8 py-5 font-bold">Дамжлага</th>
              <th className="px-8 py-5 font-bold">Тайлбар</th>
              <th className="px-8 py-5 font-bold">Төлөв</th>
              <th className="px-8 py-5 font-bold">Үйлдэл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {maintenanceRequests.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-8 py-12 text-center text-gray-400">Засварын хүсэлт байхгүй байна.</td>
              </tr>
            ) : (
              page.map(req => (
                <tr key={req.id}>
                  <td className="px-8 py-6 text-sm font-bold text-gray-900">{req.equipmentName}</td>
                  <td className="px-8 py-6 text-sm text-gray-600">{req.stationCode}</td>
                  <td className="px-8 py-6 text-sm text-gray-600 truncate max-w-xs">{req.description}</td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${req.status === 'Open' ? 'bg-red-100 text-red-700' :
                      req.status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                      {req.status === 'Open' ? 'Нээлттэй' : req.status === 'In Progress' ? 'Хийгдэж буй' : 'Хаагдсан'}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <button
                      type="button"
                      onClick={() => setMaintDetail(req)}
                      className="text-orange-600 font-bold text-xs hover:underline"
                    >
                      Дэлгэрэнгүй
                    </button>
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
