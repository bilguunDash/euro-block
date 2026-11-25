/**
 * Pure calculation/validation logic for sort/grading registration, ported 1:1
 * from the old system's server/main.py (_calc_m3_from_size, _update_totals_for_record,
 * TOTAL_M3/EPS validation). No DB/session dependency — safe to import client-side too.
 */

export const TOTAL_M3 = 5.4;
export const EPS = 1e-3;
export const DUAL_BASE = '600x250x200';
export const DUAL_200 = '600x250x200';
export const DUAL_100 = '600x250x100';

export function isSpecialDualSize(sizeValue: string | null | undefined): boolean {
  return (sizeValue || '').trim() === DUAL_BASE;
}

/** Port of _calc_m3_from_size: parses "AxBxC"/"BxC"/"C" size strings (мм/×/х/x/=/spaces all normalized to 'x'). */
export function calcM3FromSize(sizeStr: string | null | undefined, qty: number): number {
  try {
    if (qty <= 0) return 0;
    let s = (sizeStr || '').toLowerCase().replace(/мм/g, '').replace(/\s+/g, '');
    for (const sep of ['*', '×', 'х', 'x', '=']) {
      s = s.split(sep).join('x');
    }
    const parts = s.split('x').filter((p) => p.length > 0);
    if (parts.length === 0) return 0;
    let a: number, b: number, c: number;
    if (parts.length === 1) {
      a = 600.0;
      b = 250.0;
      c = parseFloat(parts[0]);
    } else if (parts.length === 2) {
      a = parseFloat(parts[0]);
      b = 250.0;
      c = parseFloat(parts[1]);
    } else {
      a = parseFloat(parts[0]);
      b = parseFloat(parts[1]);
      c = parseFloat(parts[2]);
    }
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return 0;
    const m3 = (a / 1000.0) * (b / 1000.0) * (c / 1000.0) * qty;
    return Math.round(m3 * 1000) / 1000;
  } catch {
    return 0;
  }
}

export type SortCountsInput = {
  sort1Qty?: number;
  sort1Qty200?: number;
  sort1Qty100?: number;
  sort2Code?: string;
  sort2Qty?: number;
  sort2Qty200?: number;
  sort2Qty100?: number;
  sort2Desc?: string;
  sort3Code?: string;
  sort3Qty?: number;
  sort3Qty200?: number;
  sort3Qty100?: number;
  sort3Desc?: string;
  deficitQty?: number;
  deficitQty200?: number;
  deficitQty100?: number;
  deficitDesc?: string;
};

export type SortTotals = {
  sort2Code: string;
  sort2Desc: string;
  sort3Code: string;
  sort3Desc: string;
  deficitDesc: string;
  sort1CutMm: string;
  sort1Qty: number;
  sort1M3: number;
  sort1Qty200: number;
  sort1M3200: number;
  sort1Qty100: number;
  sort1M3100: number;
  sort2CutMm: string;
  sort2Qty: number;
  sort2M3: number;
  sort2Qty200: number;
  sort2M3200: number;
  sort2Qty100: number;
  sort2M3100: number;
  sort3CutMm: string;
  sort3Qty: number;
  sort3M3: number;
  sort3Qty200: number;
  sort3M3200: number;
  sort3Qty100: number;
  sort3M3100: number;
  deficitCutMm: string;
  deficitQty: number;
  deficitM3: number;
  deficitQty200: number;
  deficitM3200: number;
  deficitQty100: number;
  deficitM3100: number;
};

const NON_NEGATIVE_QTY_FIELDS: Array<keyof SortCountsInput> = [
  'sort1Qty', 'sort1Qty200', 'sort1Qty100',
  'sort2Qty', 'sort2Qty200', 'sort2Qty100',
  'sort3Qty', 'sort3Qty200', 'sort3Qty100',
  'deficitQty', 'deficitQty200', 'deficitQty100',
];

/**
 * Port of the WorkRecordInU2 pydantic non-negative-int validator. Pydantic
 * coerced numeric strings to int before checking, so coerce here too — a raw
 * JSON body like {"sort1Qty": "-5"} must be rejected, not silently skipped.
 */
export function validateNonNegativeQuantities(payload: SortCountsInput): { ok: boolean; error?: string } {
  for (const field of NON_NEGATIVE_QTY_FIELDS) {
    const raw = payload[field];
    if (raw == null) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return { ok: false, error: 'Тоо хэмжээ буруу байна.' };
    }
    if (value < 0) {
      return { ok: false, error: 'Тоо хэмжээ сөрөг байж болохгүй.' };
    }
  }
  return { ok: true };
}

export type RamHeaderInput = {
  headerCNumber?: string;
  headerPoured?: string;
  headerCut?: string;
  autoclaveNo?: string;
  sort1FrameNo?: string;
  sort1SizeMm?: string;
};

// Улаанбаатарын цагийн хөрвүүлэлт нь зарлал зэрэг бусад хэсэгт ч хэрэгтэй тул
// `lib/ulaanbaatar-time.ts`-д шилжсэн. Одоо байгаа импортууд эвдрэхгүйн тулд
// эндээс дахин экспортлов.
export { parseUlaanbaatarLocal, toUlaanbaatarLocalInput } from './ulaanbaatar-time';

/** Port of the old client's validate_u1 required-field checks, exact messages and order. */
export function validateRamHeaderRequired(payload: RamHeaderInput): { ok: boolean; error?: string } {
  if (!String(payload.headerCNumber ?? '').trim()) return { ok: false, error: 'Ц. дугаар оруулна уу.' };
  if (!String(payload.headerPoured ?? '').trim()) return { ok: false, error: 'Цутгасан ээлж сонгоно уу.' };
  if (!String(payload.headerCut ?? '').trim()) return { ok: false, error: 'Зүссэн ээлж сонгоно уу.' };
  if (!String(payload.autoclaveNo ?? '').trim()) return { ok: false, error: 'Автоклавын дугаар сонгоно уу.' };
  if (!String(payload.sort1FrameNo ?? '').trim()) return { ok: false, error: 'Рам № оруулна уу.' };
  if (!String(payload.sort1SizeMm ?? '').trim()) return { ok: false, error: 'Суурь хэмжээ сонгоно уу.' };
  return { ok: true };
}

/** Coerce a qty payload value the way Python's int(x or 0) did — never NaN. */
function toQty(value: number | undefined): number {
  const n = Math.trunc(Number(value) || 0);
  return Number.isFinite(n) ? n : 0;
}

/** Port of _update_totals_for_record. */
export function updateSortTotals(sizeMm: string | null | undefined, dualMode: boolean, payload: SortCountsInput): SortTotals {
  const base = (sizeMm || '').trim();

  const sort2Code = (payload.sort2Code || '').trim();
  const sort2Desc = (payload.sort2Desc || '').trim();
  const sort3Code = (payload.sort3Code || '').trim();
  const sort3Desc = (payload.sort3Desc || '').trim();
  const deficitDesc = (payload.deficitDesc || '').trim();

  if (dualMode) {
    const cutLabel = `${DUAL_200}+${DUAL_100}`;

    const sort1Qty200 = toQty(payload.sort1Qty200);
    const sort1Qty100 = toQty(payload.sort1Qty100);
    const sort1M3200 = calcM3FromSize(DUAL_200, sort1Qty200);
    const sort1M3100 = calcM3FromSize(DUAL_100, sort1Qty100);

    const sort2Qty200 = toQty(payload.sort2Qty200);
    const sort2Qty100 = toQty(payload.sort2Qty100);
    const sort2M3200 = calcM3FromSize(DUAL_200, sort2Qty200);
    const sort2M3100 = calcM3FromSize(DUAL_100, sort2Qty100);

    const sort3Qty200 = toQty(payload.sort3Qty200);
    const sort3Qty100 = toQty(payload.sort3Qty100);
    const sort3M3200 = calcM3FromSize(DUAL_200, sort3Qty200);
    const sort3M3100 = calcM3FromSize(DUAL_100, sort3Qty100);

    const deficitQty200 = toQty(payload.deficitQty200);
    const deficitQty100 = toQty(payload.deficitQty100);
    const deficitM3200 = calcM3FromSize(DUAL_200, deficitQty200);
    const deficitM3100 = calcM3FromSize(DUAL_100, deficitQty100);

    return {
      sort2Code, sort2Desc, sort3Code, sort3Desc, deficitDesc,
      sort1CutMm: cutLabel,
      sort1Qty: sort1Qty200 + sort1Qty100,
      sort1M3: Math.round((sort1M3200 + sort1M3100) * 1000) / 1000,
      sort1Qty200, sort1M3200, sort1Qty100, sort1M3100,
      sort2CutMm: cutLabel,
      sort2Qty: sort2Qty200 + sort2Qty100,
      sort2M3: Math.round((sort2M3200 + sort2M3100) * 1000) / 1000,
      sort2Qty200, sort2M3200, sort2Qty100, sort2M3100,
      sort3CutMm: cutLabel,
      sort3Qty: sort3Qty200 + sort3Qty100,
      sort3M3: Math.round((sort3M3200 + sort3M3100) * 1000) / 1000,
      sort3Qty200, sort3M3200, sort3Qty100, sort3M3100,
      deficitCutMm: cutLabel,
      deficitQty: deficitQty200 + deficitQty100,
      deficitM3: Math.round((deficitM3200 + deficitM3100) * 1000) / 1000,
      deficitQty200, deficitM3200, deficitQty100, deficitM3100,
    };
  }

  const inheritedSize = base;
  const sort1Qty = toQty(payload.sort1Qty);
  const sort2Qty = toQty(payload.sort2Qty);
  const sort3Qty = toQty(payload.sort3Qty);
  const deficitQty = toQty(payload.deficitQty);

  return {
    sort2Code, sort2Desc, sort3Code, sort3Desc, deficitDesc,
    sort1CutMm: inheritedSize,
    sort1Qty,
    sort1M3: calcM3FromSize(inheritedSize, sort1Qty),
    sort1Qty200: 0, sort1M3200: 0, sort1Qty100: 0, sort1M3100: 0,
    sort2CutMm: inheritedSize,
    sort2Qty,
    sort2M3: calcM3FromSize(inheritedSize, sort2Qty),
    sort2Qty200: 0, sort2M3200: 0, sort2Qty100: 0, sort2M3100: 0,
    sort3CutMm: inheritedSize,
    sort3Qty,
    sort3M3: calcM3FromSize(inheritedSize, sort3Qty),
    sort3Qty200: 0, sort3M3200: 0, sort3Qty100: 0, sort3M3100: 0,
    deficitCutMm: inheritedSize,
    deficitQty,
    deficitM3: calcM3FromSize(inheritedSize, deficitQty),
    deficitQty200: 0, deficitM3200: 0, deficitQty100: 0, deficitM3100: 0,
  };
}

/**
 * `calcM3FromSize`-ийн БӨӨРӨНХИЙЛӨӨГҮЙ хувилбар — зөвхөн нийлбэр бодоход.
 * @see computeTotalM3
 */
function rawM3FromSize(sizeStr: string | null | undefined, qty: number): number {
  if (qty <= 0) return 0;
  let s = (sizeStr || '').toLowerCase().replace(/мм/g, '').replace(/\s+/g, '');
  for (const sep of ['*', '×', 'х', 'x', '=']) {
    s = s.split(sep).join('x');
  }
  const parts = s.split('x').filter((p) => p.length > 0);
  if (parts.length === 0) return 0;
  let a: number, b: number, c: number;
  if (parts.length === 1) {
    a = 600.0; b = 250.0; c = parseFloat(parts[0]);
  } else if (parts.length === 2) {
    a = parseFloat(parts[0]); b = 250.0; c = parseFloat(parts[1]);
  } else {
    a = parseFloat(parts[0]); b = parseFloat(parts[1]); c = parseFloat(parts[2]);
  }
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return 0;
  return (a / 1000.0) * (b / 1000.0) * (c / 1000.0) * qty;
}

type TotalRow = { cutMm: string; qty: number; qty200: number; qty100: number };

/** Хос горимд 200мм/100мм мөрүүд тусдаа тоологдоно (`cutMm` нь "A+B" шошго тул задлагдахгүй). */
function rawRowM3(row: TotalRow): number {
  if (row.qty200 > 0 || row.qty100 > 0 || String(row.cutMm || '').includes('+')) {
    return rawM3FromSize(DUAL_200, row.qty200) + rawM3FromSize(DUAL_100, row.qty100);
  }
  return rawM3FromSize(row.cutMm, row.qty);
}

/**
 * Нийт м³.
 *
 * ЧУХАЛ: мөр бүрийн бөөрөнхийлсөн (`sort*M3`) утгыг НЭМЖ БОЛОХГҮЙ. Нэгж эзэлхүүн нь
 * 3-аас олон аравтын оронтой хэмжээнүүд (600x250x75 = 0.01125, 600x250x125 = 0.01875,
 * 600x250x150 = 0.0225, 600x250x250 = 0.0375, 600x250x375 = 0.05625) дээр мөр тус бүрийн
 * бөөрөнхийлөлт хуримтлагдаж, бүх блок зөв бүртгэгдсэн байхад нийлбэр нь 5.399 / 5.401
 * болж `validateTotalM3` (EPS = 0.001) унадаг байв — оператор ээлжээ хадгалж чаддаггүй.
 * Тиймээс нийлбэрийг бөөрөнхийлөөгүй утгуудаас бодож, ЗӨВХӨН эцэст нь нэг удаа
 * бөөрөнхийлнө. Мөр бүрийн хадгалагдах/харагдах утга нь урьдын адил 3 оронтой хэвээр.
 */
export function computeTotalM3(
  totals: Pick<
    SortTotals,
    | 'sort1M3' | 'sort2M3' | 'sort3M3' | 'deficitM3'
    | 'sort1CutMm' | 'sort1Qty' | 'sort1Qty200' | 'sort1Qty100'
    | 'sort2CutMm' | 'sort2Qty' | 'sort2Qty200' | 'sort2Qty100'
    | 'sort3CutMm' | 'sort3Qty' | 'sort3Qty200' | 'sort3Qty100'
    | 'deficitCutMm' | 'deficitQty' | 'deficitQty200' | 'deficitQty100'
  >
): number {
  const rows: TotalRow[] = [
    { cutMm: totals.sort1CutMm, qty: totals.sort1Qty, qty200: totals.sort1Qty200, qty100: totals.sort1Qty100 },
    { cutMm: totals.sort2CutMm, qty: totals.sort2Qty, qty200: totals.sort2Qty200, qty100: totals.sort2Qty100 },
    { cutMm: totals.sort3CutMm, qty: totals.sort3Qty, qty200: totals.sort3Qty200, qty100: totals.sort3Qty100 },
    { cutMm: totals.deficitCutMm, qty: totals.deficitQty, qty200: totals.deficitQty200, qty100: totals.deficitQty100 },
  ];
  const sum = rows.reduce((acc, row) => acc + rawRowM3(row), 0);
  return Math.round(sum * 1000) / 1000;
}

/** Port of the TOTAL_M3/EPS check, exact Mongolian error message from main.py. */
export function validateTotalM3(totalM3: number): { ok: boolean; error?: string } {
  if (Math.abs(totalM3 - TOTAL_M3) > EPS) {
    return { ok: false, error: `Нийт м³ (${totalM3.toFixed(3)}) нь ${TOTAL_M3}-тай тэнцүү байх ёстой.` };
  }
  return { ok: true };
}
