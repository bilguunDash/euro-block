/** Мастерын дамжлага — ээлжийн бүртгэл, form, хүлээлцэх процесс */

export const MASTER_STATION_CODES = ['ҮЯ-099', 'ҮЯ-181', 'ҮЯ-310', 'ҮЯ-400', 'ҮЯ-410'] as const;

export type MasterStationCode = (typeof MASTER_STATION_CODES)[number];

export function isMasterStationCode(code: unknown): code is MasterStationCode {
  const normalized = String(code || '').trim();
  return (MASTER_STATION_CODES as readonly string[]).includes(normalized);
}

export type MasterStationFormConfig = {
  stationCode: MasterStationCode;
  formKind: string;
  title: string;
  missingLabel: string;
  legacyKey?: string;
};

/**
 * Мастер станц бүр checklist маягттай байх шаардлагагүй — `masterStationFormConfig()`
 * `null` буцаах үед дуудагч тал (`MasterStationFormSection.tsx` гэх мэт) маягтын
 * хэсгийг render хийхгүй, харин тухайн станц мастер-эрхийн бусад бүх боломжийг
 * (хуваарь авах, ээлж баталгаажуулах) хэвийн ашиглана. Жишээ: ҮЯ-181.
 */
export const MASTER_STATION_FORMS: Partial<Record<MasterStationCode, MasterStationFormConfig>> = {
  'ҮЯ-099': {
    stationCode: 'ҮЯ-099',
    formKind: 'y099_master_handover_v1',
    title: 'ҮЯ-099: Ээлжийн мастерын ээлж хүлээлцэх бүртгэл',
    missingLabel: 'ҮЯ-099 Мастерын ээлж хүлээлцэх бүртгэл',
  },
  'ҮЯ-181': {
    stationCode: 'ҮЯ-181',
    formKind: 'y181_heat_master_handover_v1',
    title: 'ҮЯ-181: Дулааны мастерын ээлж хүлээлцэх бүртгэлийн хуудас (ДУХ-05)',
    missingLabel: 'ҮЯ-181 Дулааны мастерын бүртгэл',
  },
  'ҮЯ-310': {
    stationCode: 'ҮЯ-310',
    formKind: 'y310_repair_master_form',
    title: 'ҮЯ-310: Засварын мастерын ээлж хүлээлцэх бүртгэл',
    missingLabel: 'ҮЯ-310 Засварын мастерын бүртгэл',
    legacyKey: 'y310RepairMasterForm',
  },
  'ҮЯ-400': {
    stationCode: 'ҮЯ-400',
    formKind: 'factory_process_control_form',
    title: 'ҮЯ-400: Үйлдвэрийн процесст тавих хяналтын хуудас',
    missingLabel: 'ҮЯ-400 Үйлдвэрийн хяналтын бүртгэл',
  },
  'ҮЯ-410': {
    stationCode: 'ҮЯ-410',
    formKind: 'cah02_electrical_control_form',
    title: 'ҮЯ-410: Цахилгаан автоматжуулалтын мастерын бүртгэл',
    missingLabel: 'CAH-02 Цахилгааны хяналтын бүртгэл',
    legacyKey: 'cah02ElectricalControlForm',
  },
};

export function masterStationFormConfig(code: unknown): MasterStationFormConfig | null {
  const normalized = String(code || '').trim();
  if (!isMasterStationCode(normalized)) return null;
  return MASTER_STATION_FORMS[normalized] ?? null;
}

/**
 * `needsAdminApproval` дэмждэг modal log төрлүүд — Admin/chief_engineer эцсийн
 * баталгаажуулалт хийх ёстой бүртгэлийн жагсаалт (`/api/y310-approvals`,
 * `app/api/shifts/[id]/logs/route.ts`). Шинэ мастер станцын форм
 * `needsAdminApproval` дэмжвэл ЭНД нэмэх ёстой.
 */
export const ADMIN_APPROVAL_LOG_TYPES = [
  'modal_y310_repair_master_form',
  'modal_y099_master_handover_v1',
  'modal_cah02_electrical_control_form',
  'modal_y181_heat_master_handover_v1',
] as const;

/**
 * ТЭМДЭГЛЭЛ: «станц → хариуцах мастер станц» гэсэн ойлголт БАЙХГҮЙ.
 *
 * Багийн аль ч мастер тухайн багийн аль ч операторыг хариуцаж болно —
 * холбоос нь зөвхөн `users.shiftGroup` (ижил баг) дээр тогтоно.
 * Хариуцагчийг сонгох дүрэм: `lib/crew-master.ts`.
 */
