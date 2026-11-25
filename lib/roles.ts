/**
 * Системийн бүх role (хэрэглэгчийн эрх)-ийн эх сурвалж — зөвшөөрөгдсөн утгууд +
 * тэдгээрийн монгол нэршил. `lib/shift-crew.ts`-ийн загварыг дагасан.
 *
 * Өмнө нь `UserEditModal.tsx`, `app/api/users/route.ts`, `app/api/user-directory/route.ts`
 * тус бүр өөрсдийн (өөр өөр, зарим нь дутуу) жагсаалттай байсан тул `chief_engineer`/
 * `auditor` role-той хэрэглэгчийг засах цонхонд нээхэд чимээгүй "Админ" болж хадгалагддаг
 * алдаа гарч байв. Энэ файл тэдгээрийн ганц эх сурвалж.
 *
 * Зөвшөөрлийн (permission) шалгалт үүнийг ашиглахгүй — `lib/shift-api-permissions.ts`
 * зэрэг файлууд өөрсдийн шаардлагатай литералуудаа тусад нь шалгадаг хэвээр.
 */

export const ALLOWED_ROLES = [
  'operator',
  'sort_operator',
  'master',
  'admin',
  'hse_engineer',
  'dispatcher',
  'chief_engineer',
  'auditor',
] as const;

export type AllowedRole = (typeof ALLOWED_ROLES)[number];

export const ROLE_OPTIONS: Array<{ value: AllowedRole; label: string }> = [
  { value: 'operator', label: 'Оператор' },
  { value: 'sort_operator', label: 'Сорт оператор' },
  { value: 'master', label: 'Ээлжийн мастер' },
  { value: 'admin', label: 'Админ' },
  { value: 'hse_engineer', label: 'ХАБ инженер' },
  { value: 'dispatcher', label: 'Диспетчер' },
  { value: 'chief_engineer', label: 'Ерөнхий инженер' },
  { value: 'auditor', label: 'Аудитор' },
];

export function isAllowedRole(value: unknown): value is AllowedRole {
  return (ALLOWED_ROLES as readonly string[]).includes(String(value ?? '').trim().toLowerCase());
}

/**
 * Хадгалахад бэлэн утга буцаана: хуучин `manager` нэрийг `admin` болгоно, бусад
 * утгыг (танигдахгүй байсан ч) өөрчлөхгүй буцаана — тодорхойгүй role-ыг чимээгүй
 * `admin`-д унагахгүй байхын тулд.
 */
export function normalizeRole(value: unknown): string {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'manager') return 'admin';
  return normalized;
}

export function roleLabel(value: unknown): string {
  const normalized = normalizeRole(value);
  return ROLE_OPTIONS.find((o) => o.value === normalized)?.label ?? String(value || '');
}
