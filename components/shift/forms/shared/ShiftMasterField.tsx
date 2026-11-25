'use client';

import { RoleUserSelect } from '@/components/ui/RoleUserSelect';

const MASTER_ROLES = ['master'];

/**
 * «Хянасан: Ээлжийн мастер» талбар — операторын бүх дамжлагын маягтад хэрэглэнэ.
 *
 * Багийн хариуцах мастер олдвол (`assignedMasterName`, `resolveCrewMasterForShift`)
 * зөвхөн харуулна. ОЛДООГҮЙ үед л гараар сонгуулна.
 *
 * АНХААР — яагаад гараар сонгох боломж ЗААВАЛ хэрэгтэй вэ: маягт бүрийн submit нь
 * мастерын нэрийг заавал шаарддаг (`shiftMasterName` хоосон бол toast-оор хаана).
 * Урьд нь энэ талбар үргэлж `readOnly` байсан тул операторт `users.shiftGroup`
 * оноогдоогүй, эсвэл багт нь идэвхтэй мастер байхгүй үед нүд хоосон үлдэж,
 * оператор маягтаа ХЭЗЭЭ Ч хадгалж чадахгүй → маягт нь ээлж дуусгахад заавал
 * шаардагддаг тул ээлжээ ч хаах боломжгүй болж байсан.
 */
export function ShiftMasterField({
  assignedMasterName,
  value,
  onChange,
  className = '',
  placeholder = 'Ээлжийн мастер сонгох...',
}: {
  assignedMasterName: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  /** Гараар сонгох үеийн бичиг (ж: ҮЯ-180 дээр технологийн мастер хянадаг). */
  placeholder?: string;
}) {
  if (assignedMasterName) {
    return (
      <input
        type="text"
        value={assignedMasterName}
        readOnly
        className={`w-full px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-700 font-medium ${className}`}
      />
    );
  }

  return (
    <div className="space-y-1">
      <RoleUserSelect
        roles={MASTER_ROLES}
        value={value}
        onChange={(_id, user) => onChange(user?.label || '')}
        placeholder={placeholder}
      />
      <p className="text-[11px] leading-4 text-amber-700">
        Багийн хариуцах мастер олдсонгүй. Хянасан мастераа гараар сонгоно уу
        (админ таны ээлжийн багийг тохируулаагүй байж болзошгүй).
      </p>
    </div>
  );
}
