export const MN_WEEKDAYS = ['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба', 'Ням'];

export function dateFromIso(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function isoFromDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function addDaysIso(value: string, days: number) {
  const d = dateFromIso(value);
  d.setUTCDate(d.getUTCDate() + days);
  return isoFromDate(d);
}

export function addMonthsIso(value: string, months: number) {
  const d = dateFromIso(`${value.slice(0, 7)}-01`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return isoFromDate(d);
}

export function startOfWeekIso(value: string) {
  const d = dateFromIso(value);
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  return isoFromDate(d);
}

export function endOfWeekIso(value: string) {
  return addDaysIso(startOfWeekIso(value), 6);
}

export function monthGridRange(month: string) {
  const [yearRaw, monthRaw] = month.split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  return {
    start: startOfWeekIso(isoFromDate(first)),
    end: endOfWeekIso(isoFromDate(last)),
  };
}

export function datesBetween(startIso: string, endIso: string) {
  const days: string[] = [];
  for (let d = startIso; d <= endIso; d = addDaysIso(d, 1)) {
    days.push(d);
  }
  return days;
}

export function isWeekendIso(value: string) {
  const day = dateFromIso(value).getUTCDay();
  return day === 0 || day === 6;
}

export function monthTitle(value: string) {
  const d = dateFromIso(`${value}-01`);
  if (!Number.isFinite(d.getTime())) return value;
  return `${d.getUTCFullYear()} оны ${d.getUTCMonth() + 1}-р сар`;
}

export function dayTitle(value: string) {
  const d = dateFromIso(value);
  if (!Number.isFinite(d.getTime())) return value;
  return `${d.getUTCMonth() + 1}-р сарын ${d.getUTCDate()}`;
}

export function compactDayTitle(value: string) {
  const d = dateFromIso(value);
  if (!Number.isFinite(d.getTime())) return value;
  return `${d.getUTCMonth() + 1}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function mnDateLabel(value: string) {
  const d = dateFromIso(String(value || '').slice(0, 10));
  if (!Number.isFinite(d.getTime())) return String(value || '');
  return `${d.getUTCMonth() + 1}-р сарын ${d.getUTCDate()}`;
}

export function mnDateTimeCompact(value: any) {
  const d = new Date(String(value || ''));
  if (!Number.isFinite(d.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}`;
}

export function dashboardRoleLabel(role: unknown) {
  const map: Record<string, string> = {
    operator: 'Оператор',
    master: 'Ээлжийн мастер',
    admin: 'Админ',
    hse_engineer: 'ХАБЭА инженер',
    dispatcher: 'Диспетчер',
    chief_engineer: 'Ерөнхий инженер',
    auditor: 'Аудитор',
    manager: 'Админ',
  };
  const key = String(role || '').trim().toLowerCase();
  return map[key] || String(role || '—');
}

export function shiftTypeSortOrder(value: unknown) {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'өдрийн' || type.includes('өдр')) return 1;
  if (type === 'шөнийн' || type.includes('шөн')) return 2;
  return 99;
}

export function compareScheduleRows(a: any, b: any) {
  const dateCompare = String(a?.shiftDate || '').slice(0, 10).localeCompare(String(b?.shiftDate || '').slice(0, 10));
  if (dateCompare !== 0) return dateCompare;
  const typeCompare = shiftTypeSortOrder(a?.shiftType) - shiftTypeSortOrder(b?.shiftType);
  if (typeCompare !== 0) return typeCompare;
  return String(a?.createdAt || '').localeCompare(String(b?.createdAt || ''));
}

export function handoverStageDisplay(value: unknown, fallback?: unknown) {
  const stage = String(value || '').trim();
  if (stage === 'waiting_current_master') return 'Одоогийн мастер хүлээгдэж байна';
  if (stage === 'waiting_next_master') return 'Дараагийн мастер хүлээгдэж байна';
  if (stage === 'waiting_next_operator') return 'Дараагийн operator хүлээн авах';
  if (stage === 'accepted') return 'Баталгаажсан';
  if (stage === 'returned') return 'Буцаагдсан';
  return String(fallback || 'Хүлээгдэж буй');
}

export const AUDIT_FILTER_ACTIONS: { value: string; label: string }[] = [
  { value: 'autoclave_log_created', label: 'Автоклав тэмдэглэл нэмсэн' },
  { value: 'equipment_check_created', label: 'Тоног төхөөрөмжийн шалгалт нэмсэн' },
  { value: 'handover_created', label: 'Хүлээлцэх бүртгэл нэмсэн' },
  { value: 'hse_checklist_updated', label: 'ХАБ checklist шинэчилсэн' },
  { value: 'hse_document_created', label: 'ХАБ баримт нэмсэн' },
  { value: 'hse_document_deleted', label: 'ХАБ баримт устгасан' },
  { value: 'hse_log_approved', label: 'ХАБ бүртгэл баталгаажуулсан' },
  { value: 'hse_log_created', label: 'ХАБ бүртгэл үүсгэсэн' },
  { value: 'maintenance_created', label: 'Засварын хүсэлт үүсгэсэн' },
  { value: 'maintenance_updated', label: 'Засварын хүсэлт шинэчилсэн' },
  { value: 'mix_log_created', label: 'Холимогийн тэмдэглэл нэмсэн' },
  { value: 'operator_schedule_created', label: 'Операторын хуваарь нэмсэн' },
  { value: 'operator_schedule_updated', label: 'Операторын хуваарь зассан' },
  { value: 'periodic_log_created', label: 'Periodic тэмдэглэл нэмсэн' },
  { value: 'process_check_created', label: 'Процессын шалгалт нэмсэн' },
  { value: 'production_log_created', label: 'Үйлдвэрлэлийн тэмдэглэл нэмсэн' },
  { value: 'quality_log_created', label: 'Чанарын тэмдэглэл нэмсэн' },
  { value: 'recipe_change_created', label: 'Жорын өөрчлөлт нэмсэн' },
  { value: 'repair_created', label: 'Засварын бүртгэл нэмсэн' },
  { value: 'settings_updated', label: 'Тохиргоо шинэчилсэн' },
  { value: 'shift_assigned', label: 'Ээлж оноосон' },
  { value: 'shift_created', label: 'Ээлж үүсгэсэн' },
  { value: 'shift_handover_accepted', label: 'Хүлээлцэх хүлээн авсан' },
  { value: 'shift_handover_auto_accepted', label: 'Хүлээлцэх автоматаар хүлээн авсан' },
  { value: 'shift_handover_requested', label: 'Хүлээлцэх хүссэн' },
  { value: 'shift_log_created', label: 'Ээлжийн тэмдэглэл нэмсэн' },
  { value: 'shift_master_approved', label: 'Ээлжийн мастер баталсан' },
  { value: 'shift_operator_completed', label: 'Оператор ээлж дуусгасан' },
  { value: 'shift_patch', label: 'Ээлж засварласан' },
  { value: 'shift_started', label: 'Ээлж эхлүүлсэн' },
  { value: 'schedule_deleted', label: 'Хуваарь устгасан' },
  { value: 'operator_schedule_deleted', label: 'Хуваарь устгасан' },
  { value: 'system_settings_updated', label: 'Системийн тохиргоо шинэчилсэн' },
  { value: 'user_approved_changed', label: 'Зөвшөөрөл өөрчлөгдсөн' },
  { value: 'user_created', label: 'Хэрэглэгч үүсгэгдсэн' },
  { value: 'user_deleted', label: 'Хэрэглэгч устгагдсан' },
  { value: 'user_registration_rejected', label: 'Бүртгэлийн хүсэлт татгалзсан' },
  { value: 'user_role_changed', label: 'Үүрэг өөрчлөгдсөн' },
  { value: 'user_station_changed', label: 'Дамжлага өөрчлөгдсөн' },
  { value: 'user_updated', label: 'Хэрэглэгч шинэчлэгдсэн' },
].sort((a, b) => a.label.localeCompare(b.label, 'mn'));

export const AUDIT_FILTER_ENTITY_TYPES: { value: string; label: string }[] = [
  { value: 'autoclave_log', label: 'Автоклав тэмдэглэл' },
  { value: 'equipment_check', label: 'Тоног төхөөрөмжийн шалгалт' },
  { value: 'handover', label: 'Хүлээлцэх' },
  { value: 'hse_checklist', label: 'ХАБ checklist' },
  { value: 'hse_document', label: 'ХАБ баримт' },
  { value: 'hse_log', label: 'ХАБ бүртгэл' },
  { value: 'maintenance_request', label: 'Засварын хүсэлт' },
  { value: 'master_schedule', label: 'Үндсэн ээлжийн хуваарь' },
  { value: 'mix_log', label: 'Холимогийн тэмдэглэл' },
  { value: 'notification', label: 'Мэдэгдэл' },
  { value: 'operator_schedule', label: 'Операторын хуваарь' },
  { value: 'periodic_log', label: 'Periodic тэмдэглэл' },
  { value: 'process_check', label: 'Процессын шалгалт' },
  { value: 'production_log', label: 'Үйлдвэрлэлийн тэмдэглэл' },
  { value: 'quality_log', label: 'Чанарын тэмдэглэл' },
  { value: 'recipe_change', label: 'Жорын өөрчлөлт' },
  { value: 'repair', label: 'Засварын бүртгэл' },
  { value: 'shift', label: 'Ээлж' },
  { value: 'shift_log', label: 'Ээлжийн тэмдэглэл' },
  { value: 'system_setting', label: 'Системийн тохиргоо' },
  { value: 'user', label: 'Хэрэглэгч' },
].sort((a, b) => a.label.localeCompare(b.label, 'mn'));

export function mnEntityType(t: any): string {
  const s = String(t || '').toLowerCase();
  const map: Record<string, string> = {
    user: 'Хэрэглэгч',
    operator_schedule: 'Ээлжийн хуваарь',
    master_schedule: 'Ээлжийн хуваарь',
    system_setting: 'Тохиргоо',
    hse_document: 'ХАБ баримт',
    hse_log: 'ХАБ бүртгэл',
    shift: 'Ээлж',
    shift_log: 'Ээлжийн тэмдэглэл',
    notification: 'Мэдэгдэл',
    production_log: 'Үйлдвэрлэлийн тэмдэглэл',
    recipe_change: 'Жорын өөрчлөлт',
    handover: 'Хүлээлцэх',
    equipment_check: 'Тоног төхөөрөмжийн шалгалт',
    mix_log: 'Холимогийн тэмдэглэл',
    autoclave_log: 'Автоклав тэмдэглэл',
    hse_checklist: 'ХАБ checklist',
    maintenance_request: 'Засварын хүсэлт',
    repair: 'Засварын бүртгэл',
    periodic_log: 'Periodic тэмдэглэл',
    process_check: 'Процессын шалгалт',
    quality_log: 'Чанарын тэмдэглэл',
  };
  return map[s] || (s ? s : '—');
}

export function mnAction(a: any): string {
  const s0 = String(a || '');
  const s = s0.trim().toLowerCase();
  const map: Record<string, string> = {
    user_updated: 'Хэрэглэгч шинэчлэгдсэн',
    user_role_changed: 'Үүрэг өөрчлөгдсөн',
    user_station_changed: 'Дамжлага өөрчлөгдсөн',
    user_approved_changed: 'Зөвшөөрөл өөрчлөгдсөн',
    user_deleted: 'Хэрэглэгч устгагдсан',
    user_registration_rejected: 'Бүртгэлийн хүсэлт татгалзсан',
    user_created: 'Хэрэглэгч үүсгэгдсэн',
    shift_assigned: 'Ээлж оноосон',
    operator_schedule_created: 'Хуваарь нэмсэн',
    operator_schedule_updated: 'Хуваарь зассан',
    schedule_deleted: 'Хуваарь устгасан',
    operator_schedule_deleted: 'Хуваарь устгасан',
    settings_updated: 'Тохиргоо шинэчилсэн',
    system_settings_updated: 'Системийн тохиргоо шинэчилсэн',
    hse_document_created: 'ХАБ баримт нэмсэн',
    hse_document_deleted: 'ХАБ баримт устгасан',
    hse_log_approved: 'ХАБ бүртгэл баталгаажуулсан',
    hse_log_created: 'ХАБ бүртгэл үүсгэсэн',
    hse_checklist_updated: 'ХАБ шалгах хуудас шинэчилсэн',
    shift_created: 'Ээлж үүсгэсэн',
    shift_patch: 'Ээлж засварласан',
    shift_log_created: 'Тэмдэглэл нэмсэн',
    shift_started: 'Ээлж эхлүүлсэн',
    shift_master_approved: 'Ээлжийн мастер баталсан',
    shift_operator_completed: 'Оператор ээлж дуусгасан',
    shift_handover_requested: 'Хүлээлцэх хүссэн',
    shift_handover_accepted: 'Хүлээлцэх хүлээн авсан',
    shift_handover_auto_accepted: 'Хүлээлцэх автоматаар хүлээн авсан',
    maintenance_created: 'Засварын хүсэлт үүсгэсэн',
    maintenance_updated: 'Засварын хүсэлт шинэчилсэн',
    repair_created: 'Засварын бүртгэл нэмсэн',
    mix_log_created: 'Холимогийн тэмдэглэл нэмсэн',
    autoclave_log_created: 'Автоклав тэмдэглэл нэмсэн',
    production_log_created: 'Үйлдвэрлэлийн тэмдэглэл нэмсэн',
    quality_log_created: 'Чанарын тэмдэглэл нэмсэн',
    recipe_change_created: 'Жорын өөрчлөлт нэмсэн',
    process_check_created: 'Процессын шалгалт нэмсэн',
    equipment_check_created: 'Тоног төхөөрөмжийн шалгалт нэмсэн',
    handover_created: 'Хүлээлцэх бүртгэл нэмсэн',
    periodic_log_created: 'Давтамжит тэмдэглэл нэмсэн',
    // Ээлжийн баг
    user_shift_group_changed: 'Ээлжийн баг өөрчилсөн',
    crew_schedule_created: 'Багаар хуваарь оноосон',
    // Хуучин Хяналтын бүтэц — 2026-07-29-нд устгагдсан. Түүхэн мөрийг унших зорилгоор үлдээв.
    control_assignment_upserted: 'Хяналтын бүтэц оноосон (хуучин)',
    control_assignment_disabled: 'Хяналтын бүтэц идэвхгүй болгосон (хуучин)',
    control_station_upserted: 'Дамжлага шинэчилсэн',
    control_station_disabled: 'Дамжлага идэвхгүй болгосон',
    control_limit_updated: 'Мастерын хязгаар шинэчилсэн (хуучин)',
    assignment: 'Ээлж оноосон',
  };
  if (map[s]) return map[s];
  return 'Бүртгэгдсэн үйлдэл';
}

export function formatAuditWhen(iso: any): string {
  return mnDateTimeCompact(iso);
}

export function auditActionTone(action: any): string {
  const s = String(action || '').trim().toLowerCase();
  if (s.includes('delete') || s.includes('deleted') || s.includes('disabled') || s.includes('cancel')) {
    return 'bg-red-50 text-red-700 border-red-200';
  }
  if (s.includes('approved') || s.includes('accepted') || s.includes('started') || s.includes('created') || s.includes('assigned')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (s.includes('updated') || s.includes('changed') || s.includes('patch') || s.includes('settings')) {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export function mnDetails(action: any, details: any): string {
  const a = String(action || '').trim().toLowerCase();
  const d = String(details || '').trim();
  if (!d) return '—';

  if (/^user changed own password from profile settings$/i.test(d)) {
    return 'Хэрэглэгч профайл тохиргооноос нууц үгээ солив';
  }
  if (/^user updated own display name/i.test(d)) {
    return 'Хэрэглэгч профайл тохиргооноос нэрээ шинэчилсэн';
  }

  const mnRole = (r: string) => {
    const s = String(r || '').trim().toLowerCase();
    const map: Record<string, string> = {
      operator: 'Оператор',
      master: 'Ээлжийн мастер',
      auditor: 'Аудитор',
      admin: 'Админ',
      dispatcher: 'Диспетчер',
      chief_engineer: 'Ерөнхий инженер',
      hse_engineer: 'ХАБ инженер',
    };
    if (s === 'manager') return 'Админ';
    return map[s] || r;
  };

  const mnBool = (v: string) => {
    const s = String(v || '').trim().toLowerCase();
    if (s === 'true') return 'Зөвшөөрсөн';
    if (s === 'false') return 'Цуцалсан';
    return v;
  };

  const mnYesNo = (v: string) => {
    const s = String(v || '').trim().toLowerCase();
    if (s === 'true') return 'Тийм';
    if (s === 'false') return 'Үгүй';
    return v;
  };

  const fieldLabel = (key: string) => {
    const map: Record<string, string> = {
      shiftDate: 'Огноо',
      shiftType: 'Ээлж',
      stationCode: 'Дамжлага',
      stationName: 'Дамжлагын нэр',
      masterStationCode: 'Мастерын хэсэг',
      masterStationName: 'Мастерын хэсгийн нэр',
      operatorUid: 'Оператор',
      operatorName: 'Оператор',
      masterUid: 'Мастер',
      masterName: 'Мастер',
      shiftMasterUid: 'Ээлжийн мастер',
      currentMasterUid: 'Одоогийн мастер',
      nextMasterUid: 'Дараагийн мастер',
      nextOperatorUid: 'Дараагийн оператор',
      handoverAwaitingAcceptance: 'Хүлээн авах хүлээлт',
      handoverAcceptedByUid: 'Хүлээн авсан хэрэглэгч',
      handoverAcceptedByName: 'Хүлээн авсан нэр',
      handoverAcceptedAt: 'Хүлээн авсан цаг',
      handoverToOperatorUid: 'Хүлээлгэн өгөх оператор',
      handoverToOperatorName: 'Хүлээлгэн өгөх операторын нэр',
      handoverRequestedAt: 'Хүлээлцэх хүсэлт илгээсэн цаг',
      handoverFinalAcceptedAt: 'Хүлээлцэх эцэслэн баталсан цаг',
      handoverStage: 'Хүлээлцэх үе шат',
      handoverStatus: 'Хүлээлцэх төлөв',
      masterApproved: 'Мастер баталсан эсэх',
      adminApproved: 'Админ баталсан эсэх',
      completedAt: 'Дууссан цаг',
      isActive: 'Идэвхтэй эсэх',
      limit: 'Дээд хязгаар',
      key: 'Тохиргоо',
      value: 'Утга',
      code: 'Код',
      name: 'Нэр',
    };
    return map[key] || 'Нэмэлт мэдээлэл';
  };

  const compactId = (value: any) => {
    const s = String(value ?? '').trim();
    if (/^[a-z][a-z0-9]{14,}$/i.test(s)) return `дугаар: ${s.slice(0, 8)}...`;
    return s;
  };

  const formatValue = (key: string, value: any): string => {
    if (value === null || value === undefined || value === '') return 'хоосон';
    if (typeof value === 'boolean') return value ? 'Тийм' : 'Үгүй';
    if (Array.isArray(value)) return value.map((item) => fieldLabel(String(item))).join(', ');
    if (typeof value === 'object') return Object.entries(value).map(([k, v]) => `${fieldLabel(k)}: ${formatValue(k, v)}`).join(', ');
    const s = String(value);
    if (key.toLowerCase().includes('role')) return mnRole(s);
    if (key.toLowerCase().includes('approved')) return mnYesNo(s);
    return compactId(s);
  };

  // Pattern: "email: old -> new"
  const mArrow = /^(.+?):\s*(.+?)\s*->\s*(.+)$/.exec(d);
  if (mArrow && a === 'user_role_changed') return `${mArrow[1]}: үүрэг ${mnRole(mArrow[2])} → ${mnRole(mArrow[3])}`;
  if (mArrow && a === 'user_station_changed') return `${mArrow[1]}: дамжлага ${mArrow[2]} → ${mArrow[3]}`;
  if (mArrow && a === 'user_approved_changed') return `${mArrow[1]}: зөвшөөрөл ${mnBool(mArrow[2])} → ${mnBool(mArrow[3])}`;

  // Pattern: "Updated email (role=..., station=..., approved=...)"
  if (a === 'user_updated') {
    const mm = /^Updated\s+(.+?)\s+\(role=(.+?),\s*station=(.+?),\s*approved=(.+?)\)$/.exec(d);
    if (mm) return `Үүрэг: ${mnRole(mm[2])}, Станц: ${mm[3]}, Зөвшөөрөл: ${mnYesNo(mm[4])}`;

    // Pattern: "Updated role to operator, station to УЯ-110, approved: true"
    const mm2 =
      /^Updated\s+role\s+to\s+(.+?),\s*station\s+to\s+(.+?),\s*approved:\s*(true|false)\s*$/i.exec(d);
    if (mm2) return `Үүрэг: ${mnRole(mm2[1])}, Станц: ${mm2[2]}, Зөвшөөрөл: ${mnYesNo(mm2[3])}`;
  }

  // Pattern: "Assigned email to STATION on YYYY-MM-DD (Өдрийн)"
  if (a === 'shift_assigned') {
    const mm = /^Assigned\s+(.+?)\s+to\s+(.+?)\s+on\s+(\d{4}-\d{2}-\d{2})\s+\((.+?)\)\s*$/i.exec(d);
    if (mm) return `${mm[1]} → ${mm[2]} | ${mm[3]} (${mm[4]}) ээлж оноосон`;
  }

  if (a === 'shift_started') {
    const mm = /^Started\s+shift\s+at\s+(.+?)\s+\((.+?)\)\s*$/i.exec(d);
    if (mm) return `${mm[1]} дамжлагад ${mm[2]} ээлж эхлүүлсэн`;
  }

  if (a === 'shift_created') {
    const mm = /^(.+?)\s+(\d{4}-\d{2}-\d{2})\s+(.+?)\s*$/.exec(d);
    if (mm) return `${mm[1]} дамжлагад ${mm[2]} өдрийн ${mm[3]} ээлж үүсгэсэн`;
  }

  if (a === 'shift_handover_accepted' && (d === '—' || d === '-')) {
    return 'Ээлж хүлээлцэх хүсэлтийг хүлээн авсан';
  }

  if (d.startsWith('[') && d.endsWith(']')) {
    try {
      const arr = JSON.parse(d);
      if (Array.isArray(arr)) {
        return `Шинэчилсэн мэдээлэл: ${arr.map((item) => fieldLabel(String(item))).join(', ')}`;
      }
    } catch {
      // ignore
    }
  }

  // JSON details (operator_schedule_created etc.)
  if (d.startsWith('{') && d.endsWith('}')) {
    try {
      const obj = JSON.parse(d);
      if (obj && typeof obj === 'object') {
        if (a === 'control_assignment_upserted') {
          const masterStation = obj.masterStationCode || obj.masterStationName;
          const operatorStation = obj.stationCode || obj.stationName;
          const parts = [
            masterStation ? `Мастерын хариуцах хэсэг: ${masterStation}` : '',
            operatorStation ? `Операторын дамжлага: ${operatorStation}` : '',
            obj.masterName ? `Мастер: ${obj.masterName}` : '',
            obj.operatorName ? `Оператор: ${obj.operatorName}` : '',
          ].filter(Boolean);
          if (parts.length) return parts.join(' | ');
        }

        if (a === 'control_limit_updated' && 'limit' in obj) {
          return `Нэг мастерт оноох дээд дамжлага: ${obj.limit}`;
        }

        const pairs = Object.entries(obj)
          .slice(0, 8)
          .map(([k, v]) => `${fieldLabel(k)}: ${formatValue(k, v)}`);
        return pairs.join(' | ');
      }
    } catch {
      // ignore
    }
  }

  return d;
}
// Users come from PostgreSQL via /api/users (stored in localUsers)
