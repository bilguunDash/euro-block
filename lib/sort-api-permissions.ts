/** Server-side RBAC for sort/grading registration ("Сорт бүртгэл") APIs. */

export type SessionActor = {
  id: string;
  role: string;
  stationCode: string | null | undefined;
  name: string | null | undefined;
  sortDualRole?: boolean | null;
};

// Reuses the existing "Рам эргэлтийн оператор" station — confirmed to be the
// same real person/role as the sort program's РАМ operator, just a second,
// separate registration duty. Do not introduce a distinct "РАМ" station code.
export const RAM_STATION_CODE = 'ҮЯ-160';
export const SORT_STATION_CODE = 'СОРТ';

const NON_EDITABLE_STATUSES = new Set(['completed', 'deleted']);

// The `sort_operator` role is the station-less "pure sort" account: it performs both the
// РАМ and the СОРТ halves of a record, so it is true for BOTH helpers below —
// semantically equivalent to `sortDualRole === true`.
export function isRamOperator(actor: SessionActor): boolean {
  return actor.role === 'admin' || actor.role === 'sort_operator' || actor.stationCode === RAM_STATION_CODE || actor.sortDualRole === true;
}

export function isSortOperator(actor: SessionActor): boolean {
  return actor.role === 'admin' || actor.role === 'sort_operator' || actor.stationCode === SORT_STATION_CODE || actor.sortDualRole === true;
}

/** Old system let any authenticated role view all records — no per-record ownership filter. */
export function canViewSortRecords(actor: SessionActor): boolean {
  return isRamOperator(actor) || isSortOperator(actor);
}

export function canCreateSortRecord(actor: SessionActor): boolean {
  return isRamOperator(actor);
}

/** Full header edit (shiftNo, headerCNumber, headerPoured, headerCut, autoclaveNo, sort1FrameNo, sort1SizeMm, sort1Desc). */
export function canEditSortHeader(actor: SessionActor, status: string): boolean {
  if (actor.role === 'admin') return true;
  if (!isRamOperator(actor)) return false;
  return !NON_EDITABLE_STATUSES.has(status);
}

/** Narrow allowance: СОРТ may edit sort1FrameNo + sort1SizeMm even though they don't own the header. */
export function canEditSortFrameAndSize(actor: SessionActor, status: string): boolean {
  if (actor.role === 'admin') return true;
  if (!isSortOperator(actor)) return false;
  return !NON_EDITABLE_STATUSES.has(status);
}

export function canEditSortCounts(actor: SessionActor, status: string): boolean {
  if (actor.role === 'admin') return true;
  if (!isSortOperator(actor)) return false;
  return !NON_EDITABLE_STATUSES.has(status);
}

export function canDeleteSortRecord(actor: SessionActor): boolean {
  return actor.role === 'admin';
}
