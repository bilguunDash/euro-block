/** Shared query-param → Prisma `where` construction for GET /api/sort/records and its Excel export. */

const STATUS_ALIASES: Record<string, string | null> = {
  draft: 'draft',
  waiting: 'waiting_sort',
  waiting_sort: 'waiting_sort',
  pending: 'waiting_sort',
  completed: 'completed',
  deleted: 'deleted',
  all: null,
};

/**
 * Asia/Ulaanbaatar has a fixed UTC+8 offset year-round (no DST), so a plain
 * -8h arithmetic conversion from local wall-clock to UTC is exact here —
 * matching the old system's LOCAL_UTC_OFFSET_HOURS convention, expressed
 * explicitly rather than relying on a floating server timezone.
 */
function ulaanbaatarWallClockToUtc(dateStr: string, hour: number, dayOffset = 0): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dayOffset, hour - 8, 0, 0, 0));
}

export function parseStatusValues(status: string | null): string[] | null {
  if (!status) return null;
  const values: string[] = [];
  for (const raw of status.split(',')) {
    const key = raw.trim().toLowerCase();
    if (!key) continue;
    if (!(key in STATUS_ALIASES)) {
      throw new Error(`Invalid status filter: ${raw}`);
    }
    const mapped = STATUS_ALIASES[key];
    if (mapped === null) return null; // "all"
    values.push(mapped);
  }
  return values.length ? values : null;
}

export function parseLocalDatetime(value: string | null): Date | null {
  if (!value) return null;
  const text = value.trim();
  if (!text) return null;
  const normalized = text.replace('T', ' ');
  const match = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(normalized);
  if (!match) throw new Error(`Invalid datetime format: ${value}`);
  const [, y, m, d, hh, mm, ss] = match;
  return new Date(
    Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh || 0) - 8, Number(mm || 0), Number(ss || 0))
  );
}

/**
 * `dateFrom`/`dateTo` — Улаанбаатарын (UTC+8, DST-гүй) ХУАНЛИЙН өдрүүдээр хугацааны
 * интервал: [dateFrom 00:00 УБ, dateTo+1 00:00 УБ). Дээд хязгаар нь ДАРААГИЙН шөнө дунд
 * бөгөөд `lt` (хамааруулахгүй) — ингэснээр Дуусах огноо БҮХЭЛДЭЭ орно (`lte` + тухайн
 * өдрийн 00:00 бол дуусах өдрийн бүртгэлүүд чимээгүй хаягдана).
 *
 * Ээлжтэй хамт: олон өдрийн интервал + shift=day/night үед ээлжийн шүүлт нь интервалын
 * ДОТОР "цагийн" (hour-of-day) нөхцөлөөр хэрэгжинэ (raw SQL салбар: EXTRACT(HOUR ...)),
 * өөрөөр хэлбэл өдөр тутмын ээлжийн цагуудын НЭГДЭЛ — 20:00→08:00 гэсэн нэг тасралтгүй
 * цонх БИШ. Тиймээс shift=night үед dateTo-д ЭХЭЛСЭН шөнийн ээлжийн 00:00–08:00 сүүл
 * хамрагдахгүй (тэр нь dateTo+1 хуанлийн өдөрт байна), харин dateFrom-1-д эхэлсэн
 * ээлжийн 00:00–08:00 сүүл хамрагдана. Нэг өдрийн сонголтыг (Эхлэх = Дуусах) client тал
 * хуучин `date=`-аар илгээдэг тул тэнд яг [date 20:00, date+1 08:00) цонх хэвээр.
 */
function parseUlaanbaatarDateRange(searchParams: URLSearchParams): { from: Date | null; to: Date | null } {
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  if (dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) throw new Error('Invalid dateFrom format. Use YYYY-MM-DD');
  if (dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) throw new Error('Invalid dateTo format. Use YYYY-MM-DD');
  // ISO огноог мөрөөр шууд харьцуулж болно (YYYY-MM-DD нь лексикографоор эрэмбэлэгддэг).
  if (dateFrom && dateTo && dateTo < dateFrom) throw new Error('dateTo must not be earlier than dateFrom');
  return {
    from: dateFrom ? ulaanbaatarWallClockToUtc(dateFrom, 0) : null,
    to: dateTo ? ulaanbaatarWallClockToUtc(dateTo, 0, 1) : null,
  };
}

/** Builds the Prisma `where` clause for SortWorkRecord from request query params. Throws on invalid input. */
export function buildSortRecordsWhere(
  searchParams: URLSearchParams
): { where: any; date: string | null; shiftTimeOfDay: 'day' | 'night' | null } {
  const where: any = {};

  const statuses = parseStatusValues(searchParams.get('status'));
  const includeDeleted = searchParams.get('includeDeleted') === 'true';
  if (statuses) {
    where.status = { in: statuses };
  } else if (!includeDeleted) {
    where.status = { not: 'deleted' };
  }

  // The date/shift window and createdFrom/To are independent AND conditions (the
  // old system added them as separate WHERE clauses) — merging them into one
  // createdAt object would let one bound overwrite the other instead of narrowing.
  const createdAtWindows: Array<Record<string, Date>> = [];

  const date = searchParams.get('date');
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date format. Use YYYY-MM-DD');
    const shiftKey = (searchParams.get('shift') || '').trim().toLowerCase();
    let start: Date;
    let end: Date;
    if (shiftKey === 'day') {
      start = ulaanbaatarWallClockToUtc(date, 8);
      end = ulaanbaatarWallClockToUtc(date, 20);
    } else if (shiftKey === 'night') {
      start = ulaanbaatarWallClockToUtc(date, 20);
      end = ulaanbaatarWallClockToUtc(date, 8, 1);
    } else {
      start = ulaanbaatarWallClockToUtc(date, 0);
      end = ulaanbaatarWallClockToUtc(date, 0, 1);
    }
    createdAtWindows.push({ gte: start, lt: end });
  }

  // Хугацааны интервал (нэг өдрөөс илүү) — семантикийг parseUlaanbaatarDateRange дээр бичсэн.
  const dateRange = parseUlaanbaatarDateRange(searchParams);
  if (dateRange.from || dateRange.to) {
    createdAtWindows.push({
      ...(dateRange.from ? { gte: dateRange.from } : {}),
      ...(dateRange.to ? { lt: dateRange.to } : {}),
    });
  }

  const createdFrom = parseLocalDatetime(searchParams.get('createdFrom'));
  const createdTo = parseLocalDatetime(searchParams.get('createdTo'));
  if (createdFrom || createdTo) {
    createdAtWindows.push({
      ...(createdFrom ? { gte: createdFrom } : {}),
      ...(createdTo ? { lte: createdTo } : {}),
    });
  }

  if (createdAtWindows.length === 1) {
    where.createdAt = createdAtWindows[0];
  } else if (createdAtWindows.length > 1) {
    where.AND = createdAtWindows.map((createdAt) => ({ createdAt }));
  }

  const headerPoured = (searchParams.get('headerPoured') || '').trim();
  if (headerPoured) where.headerPoured = headerPoured;

  const autoclave = (searchParams.get('autoclave') || '').trim();
  if (autoclave) where.autoclaveNo = autoclave;

  const frameNo = (searchParams.get('frameNo') || '').trim();
  if (frameNo) where.sort1FrameNo = { contains: frameNo };

  // Excel татахдаа шүүх нэмэлт нөхцөлүүд (жагсаалтад ч ажиллана).
  const sizeMm = (searchParams.get('sizeMm') || '').trim();
  if (sizeMm) where.sort1SizeMm = sizeMm;

  // `dual=only` — зөвхөн хос горим (600x250x200 + 600x250x100),
  // `dual=none` — зөвхөн энгийн бүртгэл.
  const dual = (searchParams.get('dual') || '').trim().toLowerCase();
  if (dual === 'only') where.specialDualMode = true;
  else if (dual === 'none') where.specialDualMode = false;

  // Огноогүйгээр Ээлж (Өдөр/Шөнө) шүүх боломж — Prisma-ийн where API-аар "аль ч
  // өдрийн 08:00–20:00" гэсэн огнооноос үл хамаарсан цагийн нөхцөл илэрхийлэх
  // боломжгүй тул энэ тохиолдолд дуудагч талд raw SQL (buildSortRecordsRawFilter)
  // ашиглана. Тэгэхээр date хоосон, shift бөглөгдсэн бол where-г хоосоор буцаана.
  const shiftOnly = !date ? (searchParams.get('shift') || '').trim().toLowerCase() : '';
  const shiftTimeOfDay: 'day' | 'night' | null =
    shiftOnly === 'day' ? 'day' : shiftOnly === 'night' ? 'night' : null;

  return { where, date: date || null, shiftTimeOfDay };
}

/**
 * "Ээлж" (Өдөр/Шөнө)-г Огноогүйгээр шүүхэд ашиглах raw SQL WHERE — Asia/Ulaanbaatar
 * UTC+8 (DST-гүй) тогтмол offset-оор орон нутгийн цагийг тооцоолно (ulaanbaatarWallClockToUtc-тэй
 * ижил зарчим, эсрэг чиглэлд). buildSortRecordsWhere-ийн бүх бусад шүүлтүүрийг мөн эндээс давтана,
 * учир нь энэ функцийг зөвхөн shiftTimeOfDay эсэхэд нь дуудагч тал бүрэн орлуулж ашиглана.
 */
export function buildSortRecordsRawFilter(
  searchParams: URLSearchParams,
  shiftTimeOfDay: 'day' | 'night'
): { whereSql: string; params: any[] } {
  const clauses: string[] = [];
  const params: any[] = [];
  const next = (v: any) => {
    params.push(v);
    return `$${params.length}`;
  };

  const statuses = parseStatusValues(searchParams.get('status'));
  const includeDeleted = searchParams.get('includeDeleted') === 'true';
  if (statuses) {
    clauses.push(`"status" = ANY(${next(statuses)})`);
  } else if (!includeDeleted) {
    clauses.push(`"status" <> ${next('deleted')}`);
  }

  const localHour = `EXTRACT(HOUR FROM ("createdAt" + INTERVAL '8 hours'))`;
  clauses.push(shiftTimeOfDay === 'day' ? `${localHour} >= 8 AND ${localHour} < 20` : `(${localHour} < 8 OR ${localHour} >= 20)`);

  // Хугацааны интервал — buildSortRecordsWhere-тэй ижил нөхцөл (parseUlaanbaatarDateRange).
  // Огноог SQL мөрт хэзээ ч шууд хийхгүй — зөвхөн next() параметрээр.
  const dateRange = parseUlaanbaatarDateRange(searchParams);
  if (dateRange.from) clauses.push(`"createdAt" >= ${next(dateRange.from)}`);
  if (dateRange.to) clauses.push(`"createdAt" < ${next(dateRange.to)}`);

  const createdFrom = parseLocalDatetime(searchParams.get('createdFrom'));
  const createdTo = parseLocalDatetime(searchParams.get('createdTo'));
  if (createdFrom) clauses.push(`"createdAt" >= ${next(createdFrom)}`);
  if (createdTo) clauses.push(`"createdAt" <= ${next(createdTo)}`);

  const headerPoured = (searchParams.get('headerPoured') || '').trim();
  if (headerPoured) clauses.push(`"headerPoured" = ${next(headerPoured)}`);

  const autoclave = (searchParams.get('autoclave') || '').trim();
  if (autoclave) clauses.push(`"autoclaveNo" = ${next(autoclave)}`);

  const frameNo = (searchParams.get('frameNo') || '').trim();
  if (frameNo) clauses.push(`"sort1FrameNo" ILIKE ${next(`%${frameNo}%`)}`);

  // buildSortRecordsWhere-тэй ижил нөхцөлүүд — энэ функц түүнийг БҮРЭН орлуулдаг тул
  // шинэ шүүлтүүр нэмэхдээ ЗААВАЛ хоёуланд нь нэмнэ.
  const sizeMm = (searchParams.get('sizeMm') || '').trim();
  if (sizeMm) clauses.push(`"sort1SizeMm" = ${next(sizeMm)}`);

  const dual = (searchParams.get('dual') || '').trim().toLowerCase();
  if (dual === 'only') clauses.push(`"specialDualMode" = TRUE`);
  else if (dual === 'none') clauses.push(`"specialDualMode" = FALSE`);

  return { whereSql: clauses.length ? clauses.join(' AND ') : 'TRUE', params };
}

