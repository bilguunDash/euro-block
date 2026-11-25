export function ConfirmDialog({
  confirmDialog,
  setConfirmDialog,
  confirmResolveRef,
}: any) {
  if (!confirmDialog.open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-6 py-5 bg-orange-600 text-white">
          <p className="text-lg font-black">{confirmDialog.title}</p>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{confirmDialog.message}</p>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => {
                setConfirmDialog((s: any) => ({ ...s, open: false }));
                confirmResolveRef.current?.(false);
                confirmResolveRef.current = null;
              }}
              className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-800 font-bold hover:bg-gray-200"
            >
              Болих
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmDialog((s: any) => ({ ...s, open: false }));
                confirmResolveRef.current?.(true);
                confirmResolveRef.current = null;
              }}
              className="px-5 py-2.5 rounded-xl text-white font-bold bg-orange-600 hover:bg-orange-700"
            >
              {confirmDialog.confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
