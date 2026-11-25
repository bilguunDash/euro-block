/**
 * Байгаль орчны хяналтын асуулт — БҮХ станцын маягтад (мастер, оператор) нийтлэг хэсэг.
 *
 * Маягтын өгөгдөл `production_logs.data`-д JSON-оор бүтнээр хадгалагддаг тул энэ
 * хэсэг нэмэхэд DB миграц шаардахгүй — зөвхөн payload-д `environmentChecks` нэмнэ.
 *
 * ТАЛБАРЫН НЭР: `{ key, label, ... }` нь энэ төслийн хяналтын жагсаалтын жишиг
 * (`equipmentInspections`, `inspections` ...). Ингэснээр Excel экспорт нь
 * `label`-ийг баганын нэр болгож, мөрийг нүдэнд шахахгүй.
 */

export type EnvironmentCheckAnswer = '' | 'Тийм' | 'Үгүй';

export type EnvironmentCheckRow = {
  key: string;
  /** Асуулт. Оператор засаж болно. */
  label: string;
  answer: EnvironmentCheckAnswer;
  comment: string;
};

/** Хоосон сонголт эхэнд — хариулт ЗААВАЛ биш. */
export const ENVIRONMENT_CHECK_ANSWERS: EnvironmentCheckAnswer[] = ['', 'Тийм', 'Үгүй'];

export const ENVIRONMENT_CHECK_TITLE = 'Байгаль орчны хяналтын асуулт';

/**
 * Стандарт 3 асуулт. `key` нь ТОГТМОЛ — налуу туслах текстийг үүгээр хайна,
 * оператор асуултын текстийг өөрчилсөн ч туслах текст нь хэвээр үлдэнэ.
 */
export const ENVIRONMENT_CHECK_DEFAULTS: ReadonlyArray<{ key: string; label: string; hint: string }> = [
  {
    key: 'env1',
    label: 'Тос, химийн бодис, ус зэрэг асгаралт, алдагдал илэрсэн эсэх?',
    hint: 'Илэрсэн бол: төрөл, байршил, ойролцоо хэмжээ, авсан арга хэмжээг тэмдэглэх.',
  },
  {
    key: 'env2',
    label: 'Танай ээлжийн хугацаанд хог хаягдлын ачилт хийгдсэн эсэх?',
    hint: 'Хийгдсэн бол: огноо/цаг ______, хогийн төрөл ______, хэмжээ ______',
  },
  {
    key: 'env3',
    label: 'Үйлдвэрийн талбайд зэрлэг амьтан, шувуу ажиглагдсан эсэх?',
    hint: 'Ажиглагдсан бол: төрөл, тоо, байршилыг тэмдэглэх.',
  },
];

const DEFAULT_BY_KEY = new Map(ENVIRONMENT_CHECK_DEFAULTS.map((row) => [row.key, row]));

/** Стандарт мөрийн налуу туслах текст. Нэмэлт мөрд хоосон. */
export function environmentCheckHint(key: string): string {
  return DEFAULT_BY_KEY.get(key)?.hint ?? '';
}

/** Стандарт 3 мөрийн аль нэг эсэх — цэвэрлэгээнд хоосон ч байсан хадгална. */
export function isStandardEnvironmentCheck(key: string): boolean {
  return DEFAULT_BY_KEY.has(key);
}

export function newEnvironmentCheckId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `env_${crypto.randomUUID()}`;
  }
  return `env_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function emptyEnvironmentCheckRow(): EnvironmentCheckRow {
  return { key: newEnvironmentCheckId(), label: '', answer: '', comment: '' };
}

export function createEmptyEnvironmentChecks(): EnvironmentCheckRow[] {
  return ENVIRONMENT_CHECK_DEFAULTS.map(({ key, label }) => ({ key, label, answer: '', comment: '' }));
}

const answerOf = (raw: unknown): EnvironmentCheckAnswer => {
  const text = String(raw ?? '').trim();
  return text === 'Тийм' || text === 'Үгүй' ? text : '';
};

/**
 * Хадгалсан утгыг маягтад буцаан ачаална.
 *
 * Энэ хэсгийг нэвтрүүлэхээс ӨМНӨ бөглөсөн бүртгэлд `environmentChecks` огт
 * байхгүй — тэр үед стандарт 3 мөрийг хоосноор үзүүлнэ. Хэсэгчлэн хадгалсан
 * (ж: зөвхөн env1) бол дутуу стандарт мөрийг эх дарааллаар нь нөхнө.
 */
export function mergeEnvironmentChecks(saved: unknown): EnvironmentCheckRow[] {
  if (!Array.isArray(saved) || saved.length === 0) return createEmptyEnvironmentChecks();

  const rows: EnvironmentCheckRow[] = [];
  const seen = new Set<string>();
  for (const raw of saved) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const key = String(item.key ?? '').trim() || newEnvironmentCheckId();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      key,
      label: String(item.label ?? '').trim(),
      answer: answerOf(item.answer),
      comment: String(item.comment ?? ''),
    });
  }

  // Дутуу стандарт мөрийг эх байрлалд нь буцааж оруулна.
  ENVIRONMENT_CHECK_DEFAULTS.forEach(({ key, label }, index) => {
    if (seen.has(key)) return;
    rows.splice(Math.min(index, rows.length), 0, { key, label, answer: '', comment: '' });
  });

  return rows.length ? rows : createEmptyEnvironmentChecks();
}

/** ҮЯ-099-ийн үндсэн маягтад хоосон байвал хуучин процессын маягтын хариуг харуулна. */
export function preferEnvironmentChecks(primary: unknown, fallback: unknown): EnvironmentCheckRow[] {
  const primaryRows = mergeEnvironmentChecks(primary);
  const hasEnteredData = (rows: EnvironmentCheckRow[]) => rows.some((row) => {
    const standard = DEFAULT_BY_KEY.get(row.key);
    return Boolean(
      row.answer || row.comment.trim() ||
      (standard ? row.label.trim() !== standard.label : row.label.trim())
    );
  });
  if (hasEnteredData(primaryRows)) return primaryRows;
  const fallbackRows = mergeEnvironmentChecks(fallback);
  return hasEnteredData(fallbackRows) ? fallbackRows : primaryRows;
}

const isBlankRow = (row: EnvironmentCheckRow) =>
  !row.label.trim() && !row.answer.trim() && !row.comment.trim();

/**
 * Илгээхийн өмнөх цэвэрлэгээ.
 *
 *  • Огт бөглөөгүй НЭМЭЛТ мөрийг хаяна — оператор «Мөр нэмэх» дараад бөглөөгүй
 *    орхивол хог өгөгдөл үүсгэхгүй.
 *  • Стандарт 3 мөр нь хоосон ч ҮЛДЭНЭ — Excel-ийн багана бүх ээлжид ижил
 *    байх ёстой.
 *  • Асуултын текст хоосон бол нөхнө: стандартад анхны асуулт, нэмэлтэд
 *    «Нэмэлт асуулт N». Хоосон нэртэй мөр Excel-д багана болж чаддаггүй.
 */
export function normalizeEnvironmentChecks(rows: unknown): EnvironmentCheckRow[] {
  const merged = mergeEnvironmentChecks(rows);
  let extra = 0;
  return merged
    .filter((row) => isStandardEnvironmentCheck(row.key) || !isBlankRow(row))
    .map((row) => {
      if (row.label.trim()) return { ...row, label: row.label.trim() };
      const fallback = DEFAULT_BY_KEY.get(row.key)?.label ?? `Нэмэлт асуулт ${(extra += 1)}`;
      return { ...row, label: fallback };
    });
}
