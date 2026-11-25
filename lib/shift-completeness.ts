/**
 * «Тогтмол бүртгэл» — 2 цаг тутмын давтамжит бүртгэл хийдэг дамжлагууд.
 *
 * 2026-08: ЭЭЛЖИЙН МАСТЕР (`ҮЯ-099`)-ыг ЭНЭ ЖАГСААЛТААС ХАССАН (хэрэглэгчийн
 * шийдвэр). Мастер ээлжийнхээ туршид 2 цаг тутам бүртгэл хөтлөх шаардлагагүй
 * болсон. Түүний «Үйлдвэрийн процесст тавих хяналтын хуудас» нь ХЭВЭЭР —
 * `PROCESS_CONTROL_FORM_STATIONS`-ыг үзнэ үү.
 */
export const PERIODIC_STATIONS = ['ҮЯ-400'] as const;

/**
 * «Үйлдвэрийн процесст тавих хяналтын хуудас» (`factory_process_control_form`)
 * заавал шаардагдах дамжлагууд. Энэ нь 2 цаг тутмын тогтмол бүртгэлээс ӨӨР зүйл —
 * ээлжид нэг удаа бөглөдөг маягт. Урьд нь хоёулаа нэг жагсаалтаар удирдагддаг
 * байсан тул нэгийг нь хасахад нөгөө нь дагаад алга болох эрсдэлтэй байв.
 */
export const PROCESS_CONTROL_FORM_STATIONS = ['ҮЯ-400', 'ҮЯ-099'] as const;

export function stationUsesProcessControlForm(stationCode: unknown): boolean {
  return (PROCESS_CONTROL_FORM_STATIONS as readonly string[]).includes(String(stationCode || '').trim());
}

/** @deprecated PERIODIC_STATIONS / stationUsesPeriodicLogs-г ашиглана уу. */
export const PERIODIC_STATION = 'ҮЯ-400';

export function stationUsesPeriodicLogs(stationCode: unknown): boolean {
  return (PERIODIC_STATIONS as readonly string[]).includes(String(stationCode || '').trim());
}

type PeriodicStatusInput = {
  stationCode?: unknown;
  periodicLogs?: any[];
  checkInIso?: unknown;
  checkOutIso?: unknown;
  periodicIntervalHours?: unknown;
  nowMs?: number;
};

export function getPeriodicLogStatus({
  stationCode,
  periodicLogs,
  checkInIso,
  checkOutIso,
  periodicIntervalHours,
  nowMs = Date.now(),
}: PeriodicStatusInput) {
  const applies = stationUsesPeriodicLogs(stationCode);
  const interval = Number(periodicIntervalHours);
  const intervalHours = Number.isFinite(interval) && interval > 0 ? interval : 2;
  const intervalMs = intervalHours * 60 * 60 * 1000;
  const checkInMs = new Date(String(checkInIso || '')).getTime();
  const checkOutMs = new Date(String(checkOutIso || '')).getTime();
  const endMs = Number.isFinite(checkOutMs) ? checkOutMs : nowMs;
  const elapsedMs = Number.isFinite(checkInMs) ? Math.max(0, endMs - checkInMs) : 0;
  const submittedLogs = (Array.isArray(periodicLogs) ? periodicLogs : []).filter(
    (log) => Boolean(log?.submittedAt) || !log?.draftSavedAt
  );
  const requiredCount =
    applies && Number.isFinite(checkInMs) ? Math.max(0, Math.floor(elapsedMs / intervalMs)) : 0;
  const completedCount = applies ? submittedLogs.length : 0;
  const missingCount = Math.max(0, requiredCount - completedCount);
  const nextDeadlineMs =
    applies && Number.isFinite(checkInMs) ? checkInMs + (completedCount + 1) * intervalMs : null;

  return {
    applies,
    intervalHours,
    requiredCount,
    completedCount,
    missingCount,
    isOverdue: applies && missingCount > 0,
    nextDeadlineMs,
  };
}

export function getShiftCompleteness({
  stationCode,
  hseChecklist,
  equipmentChecks,
  periodicLogs,
  handovers,
  mixLogs,
  qualityLogs,
  processChecks,
  recipeChanges,
  repairs,
  stationForms,
  checkInIso,
  checkOutIso,
  periodicIntervalHours,
  requireEquipmentChecks = true,
  requirePeriodicLogs = true,
}: any) {
  const missing: string[] = [];


  if (!hseChecklist) missing.push('ХАБЭА-н хяналтын хуудас');

  // Station-specific main form requirements
  if (stationCode === 'ҮЯ-099') {
    if (!stationForms?.y099_master_handover_v1) missing.push('ҮЯ-099 Мастерын ээлж хүлээлцэх бүртгэл');
  }
  if (stationCode === 'ҮЯ-181') {
    if (!stationForms?.y181_heat_master_handover_v1) missing.push('ҮЯ-181 Дулааны мастерын бүртгэл');
  }
  if (stationCode === 'ҮЯ-310') {
    if (!stationForms?.y310_repair_master_form) missing.push('ҮЯ-310 Засварын мастерын бүртгэл');
  }
  if (stationCode === 'ҮЯ-120') {
    if (!stationForms?.y120_handover_form) missing.push('ҮЯ-120 Шохойн тээрмийн бүртгэл');
  }
  if (stationCode === 'ҮЯ-121') {
    if (!stationForms?.y121_handover_form) missing.push('ҮЯ-121 Бөмбөлөгт тээрмийн бүртгэл');
  }
  if (stationCode === 'ҮЯ-130') {
    if (!stationForms?.y130_handover_form) missing.push('ҮЯ-130 Зуурмагийн хэсгийн бүртгэл');
    if (mixLogs.length === 0) missing.push('Цутгалтын үзүүлэлт');
  }
  if (stationCode === 'ҮЯ-140') {
    if (!stationForms?.y140_handover_form) missing.push('ҮЯ-140 Хэв эргэлтийн бүртгэл');
  }
  if (stationCode === 'ҮЯ-150') {
    if (!stationForms?.y150_handover_form) missing.push('ҮЯ-150 Зүсэлтийн шугамын бүртгэл');
  }
  if (stationCode === 'ҮЯ-160') {
    if (!stationForms?.y160_handover_form) missing.push('ҮЯ-160 Рам эргэлтийн бүртгэл');
  }
  // ҮЯ-161 нь UI-д (`app/shift/[id]/page.tsx`) маягттай, `stationForms`-д ачаалагддаг
  // атлаа энд шалгагдахгүй байсан — тэргэнцэр эргэлтийн оператор маягтаа огт
  // бөглөлгүй ээлжээ дуусгаж чаддаг байв (бусад бүх операторын станц шаарддаг).
  if (stationCode === 'ҮЯ-161') {
    if (!stationForms?.y161_handover_form) missing.push('ҮЯ-161 Тэргэнцэр эргэлтийн бүртгэл');
  }
  if (stationCode === 'ҮЯ-170') {
    if (!stationForms?.y170_packing_operator_form) missing.push('ҮЯ-170 Савлах төхөөрөмжийн бүртгэл');
  }
  if (stationCode === 'ҮЯ-180') {
    if (!stationForms?.y180_autoclave_operator_form) missing.push('ҮЯ-180 Автоклавын бүртгэл');
  }
  if (stationCode === 'ҮЯ-190') {
    if (!stationForms?.y190_handover_form) missing.push('ҮЯ-190 Чанарын хяналтын бүртгэл');
    if (qualityLogs.length === 0) missing.push('Чанарын лабораторийн бүртгэл');
  }
  if (stationCode === 'ҮЯ-210') {
    if (!stationForms?.y210_technology_kiln_operator_form) missing.push('ҮЯ-210 Технологийн зуухны бүртгэл');
  }
  if (stationCode === 'ҮЯ-320') {
    if (!stationForms?.y320_electrical_automation_repair_form) missing.push('ҮЯ-320 Цахилгаан автоматжуулалтын бүртгэл');
  }
  if (stationUsesProcessControlForm(stationCode)) {
    if (!stationForms?.factory_process_control_form) missing.push('Үйлдвэрийн процесст тавих хяналтын хуудас');
  }
  if (stationCode === 'ҮЯ-410' || stationCode === 'CAH-02') {
    if (!stationForms?.cah02_electrical_control_form) missing.push('CAH-02 Цахилгааны хяналтын бүртгэл');
  }
  if (stationCode === 'ОНБ') {
    if (!stationForms?.ingredient_change_record_form) missing.push('Орц найрлагын өөрчлөлтийн бүртгэл');
  }

  const periodicStatus = getPeriodicLogStatus({
    stationCode,
    periodicLogs,
    checkInIso,
    checkOutIso,
    periodicIntervalHours,
  });
  if (requirePeriodicLogs && periodicStatus.isOverdue) {
    missing.push(
      `Тогтмол бүртгэл (${periodicStatus.intervalHours} цаг тутам): ${periodicStatus.missingCount} дутуу`
    );
  }

  return {
    ok: missing.length === 0,
    missing,
    periodicStatus,
  };
}

/** Map GET /api/shifts/[id] payload (incl. modalLogs) into getShiftCompleteness() input. */
export function buildCompletenessInputFromShiftApi(shift: any, periodicIntervalHours: number) {
  const modalLogs = Array.isArray(shift?.modalLogs) ? shift.modalLogs : [];
  const byType = (t: string) =>
    modalLogs
      .filter((l: any) => String(l?.logType || '') === `modal_${t}`)
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((l: any) => ({ id: l.id, createdAt: l.createdAt, ...(l.data || {}) }));
  const hse = byType('hse_checklist');
  const hseChecklist = hse.length ? hse[hse.length - 1] : null;

  const stationForms = {
    y099_master_handover_v1: (byType('y099_master_handover_v1').slice(-1)[0] as any) ?? null,
    // ҮЯ-181 (Дулааны мастер) — дүрэм нь энэ түлхүүрийг шалгадаг тул ЗААВАЛ бөглөнө.
    // Дутуу байсан үед ээлжийг хэзээ ч дуусгах боломжгүй байсан.
    y181_heat_master_handover_v1: (byType('y181_heat_master_handover_v1').slice(-1)[0] as any) ?? null,
    y120_handover_form: (byType('y120_handover_form').slice(-1)[0] as any) ?? null,
    y121_handover_form: (byType('y121_handover_form').slice(-1)[0] as any) ?? null,
    y130_handover_form: (byType('y130_handover_form').slice(-1)[0] as any) ?? null,
    y140_handover_form: (byType('y140_handover_form').slice(-1)[0] as any) ?? null,
    y150_handover_form: (byType('y150_handover_form').slice(-1)[0] as any) ?? null,
    y160_handover_form: (byType('y160_handover_form').slice(-1)[0] as any) ?? null,
    y161_handover_form: (byType('y161_handover_form').slice(-1)[0] as any) ?? null,
    y170_packing_operator_form: (byType('y170_packing_operator_form').slice(-1)[0] as any) ?? null,
    y180_autoclave_operator_form: (byType('y180_autoclave_operator_form').slice(-1)[0] as any) ?? null,
    y190_handover_form: (byType('y190_handover_form').slice(-1)[0] as any) ?? null,
    y210_technology_kiln_operator_form: (byType('y210_technology_kiln_operator_form').slice(-1)[0] as any) ?? null,
    y310_repair_master_form: (byType('y310_repair_master_form').slice(-1)[0] as any) ?? null,
    y320_electrical_automation_repair_form: (byType('y320_electrical_automation_repair_form').slice(-1)[0] as any) ?? null,
    factory_process_control_form: (byType('factory_process_control_form').slice(-1)[0] as any) ?? null,
    cah02_electrical_control_form: (byType('cah02_electrical_control_form').slice(-1)[0] as any) ?? null,
    ingredient_change_record_form: (byType('ingredient_change_record_form').slice(-1)[0] as any) ?? null,
  };

  return {
    stationCode: shift.stationCode,
    hseChecklist,
    stationForms,
    equipmentChecks: byType('equipment_checks'),
    periodicLogs: byType('periodic_logs'),
    handovers: byType('handovers'),
    mixLogs: byType('mix_logs'),
    qualityLogs: byType('quality_logs'),
    processChecks: byType('process_checks'),
    recipeChanges: byType('recipe_changes'),
    repairs: byType('repairs'),
    checkInIso: shift.checkIn,
    checkOutIso: shift.checkOut,
    periodicIntervalHours,
  };
}
