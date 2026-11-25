'use client';

import { ClipboardList } from 'lucide-react';
import { sortStatusLabel } from '@/lib/sort-status-labels';
import { toUlaanbaatarLocalInput } from '@/lib/sort-work-calc';

/** Хадгалагдсан UTC цагийг Улаанбаатарын цагаар «YYYY-MM-DD HH:mm» болгоно. */
function ulaanbaatarClock(value: string | Date | null | undefined): string {
  const local = toUlaanbaatarLocalInput(value);
  return local ? local.replace('T', ' ') : '—';
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs font-bold text-gray-500 uppercase">{label}</span>
      <span className="text-sm font-bold text-gray-900 text-right">{value ?? '—'}</span>
    </div>
  );
}

function GradeSection({ title, code, cutMm, qty, qty200, qty100, m3, desc, dualMode }: {
  title: string;
  code?: string;
  cutMm: string;
  qty: number;
  qty200: number;
  qty100: number;
  m3: number;
  desc?: string;
  dualMode: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-1">
      <h4 className="text-sm font-bold text-gray-900 mb-1">{title}</h4>
      {code !== undefined && <Row label="Код" value={code || '—'} />}
      <Row label="Хэмжээ" value={cutMm || '—'} />
      {dualMode ? (
        <>
          <Row label="600x250x200 тоо" value={qty200} />
          <Row label="600x250x100 тоо" value={qty100} />
        </>
      ) : (
        <Row label="Тоо" value={qty} />
      )}
      <Row label="М³" value={m3.toFixed(3)} />
      {desc !== undefined && <Row label="Тайлбар" value={desc || '—'} />}
    </div>
  );
}

export function SortRecordReadOnly({ data }: { data: any }) {
  const dualMode = Boolean(data.specialDualMode);
  const totalM3 = (data.sort1M3 || 0) + (data.sort2M3 || 0) + (data.sort3M3 || 0) + (data.deficitM3 || 0);

  return (
    <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-orange-50/40">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-orange-600" />
          Сорт бүртгэл — {sortStatusLabel(data.status)}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Ц.дугаар: {data.headerCNumber || '—'} · Рам №: {data.sort1FrameNo || '—'} · Нийт: {totalM3.toFixed(3)} м³
        </p>
      </div>
      <div className="p-4 md:p-6 space-y-6 max-h-[480px] overflow-y-auto text-sm">
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-1">
          <h4 className="text-sm font-bold text-gray-900 mb-1">Рамны мэдээлэл</h4>
          <Row label="Ээлжийн дугаар" value={data.shiftNo} />
          <Row label="Цутгасан ээлж" value={data.headerPoured} />
          <Row label="Цутгасан цаг" value={ulaanbaatarClock(data.pouredAt)} />
          <Row label="Зүссэн ээлж" value={data.headerCut} />
          <Row label="Зүссэн цаг" value={ulaanbaatarClock(data.cutAt)} />
          <Row label="Автоклав" value={data.autoclaveNo} />
          <Row label="Рамын дугаар" value={data.sort1FrameNo} />
          <Row label="Хэмжээ" value={data.sort1SizeMm} />
          <Row label="Алдааны код (РАМ)" value={data.ramDefectCode || '—'} />
          <Row label="Тайлбар" value={data.sort1Desc} />
        </div>

        <GradeSection title="I-р сорт" cutMm={data.sort1CutMm} qty={data.sort1Qty} qty200={data.sort1Qty200} qty100={data.sort1Qty100} m3={data.sort1M3 || 0} dualMode={dualMode} />
        <GradeSection title="II-р сорт" code={data.sort2Code} cutMm={data.sort2CutMm} qty={data.sort2Qty} qty200={data.sort2Qty200} qty100={data.sort2Qty100} m3={data.sort2M3 || 0} desc={data.sort2Desc} dualMode={dualMode} />
        <GradeSection title="III-р сорт" code={data.sort3Code} cutMm={data.sort3CutMm} qty={data.sort3Qty} qty200={data.sort3Qty200} qty100={data.sort3Qty100} m3={data.sort3M3 || 0} desc={data.sort3Desc} dualMode={dualMode} />
        <GradeSection title="Дутагдал" cutMm={data.deficitCutMm} qty={data.deficitQty} qty200={data.deficitQty200} qty100={data.deficitQty100} m3={data.deficitM3 || 0} desc={data.deficitDesc} dualMode={dualMode} />

        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-1">
          <Row label="Үүсгэсэн" value={data.createdByName || '—'} />
          <Row label="Сортолсон" value={data.sortedByName || '—'} />
          <Row label="Үүсгэсэн огноо" value={data.createdAt ? new Date(data.createdAt).toLocaleString('mn-MN') : '—'} />
          <Row label="Дууссан огноо" value={data.completedAt ? new Date(data.completedAt).toLocaleString('mn-MN') : '—'} />
        </div>
      </div>
    </section>
  );
}
