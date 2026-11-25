/** Server-side RBAC for shift APIs (PRD-aligned). */

export const PRIVILEGED_SHIFT_READ = new Set([
  'admin',
  'master',
  'chief_engineer',
  'dispatcher',
  'auditor',
  'hse_engineer',
]);

export const MANAGEMENT_READ_ONLY = new Set(['auditor']);

export type SessionActor = {
  id: string;
  role: string;
  stationCode: string | null | undefined;
  name: string | null | undefined;
};

export function canReadShift(shift: {
  operatorUid: string;
  stationCode: string;
  handoverToOperatorUid: string | null;
  nextOperatorUid?: string | null;
}, actor: SessionActor): boolean {
  const role = actor.role || 'operator';
  if (PRIVILEGED_SHIFT_READ.has(role)) return true;
  if (role === 'operator') {
    if (shift.operatorUid === actor.id) return true;
    if (shift.handoverToOperatorUid && shift.handoverToOperatorUid === actor.id) return true;
    if (shift.nextOperatorUid && shift.nextOperatorUid === actor.id) return true;
    if (actor.stationCode && actor.stationCode === shift.stationCode) return true;
  }
  return false;
}

const OPERATOR_SELF_PATCH_KEYS = new Set([
  'checkOut',
  'operatorShiftCompleted',
  'notes',
  'handoverRequestedAt',
  'handoverToOperatorUid',
  'handoverToOperatorName',
  // Master self-handover-д хуваарьгүй үед гараар сонгосон дараагийн master.
  // Эцсийн утгыг PATCH-ийн handover салбарууд тодорхой удирддаг (operator салбар
  // null болгоно), тиймээс allowlist-д байх нь аюулгүй.
  'nextMasterUid',
  'nextMasterName',
  // Ээлж дуусгагч өөрөө сонгосон дараагийн оператор ба баталгаажуулах мастер.
  // Чөлөө/ажил таслалт хуваарьт тусдаггүй тул гараар сонгох боломж заавал хэрэгтэй.
  // Эцсийн утгыг PATCH-ийн handover салбар шалгаж (role, идэвхтэй, өөрөө биш) шийднэ.
  'nextOperatorUid',
  'nextOperatorName',
  'confirmMasterUid',
  'confirmMasterName',
  // Мастер өөрийн ээлжээ хүлээлцэхдээ сонгосон «батлах админ» (чиглүүлэлт).
  'approvalAdminUid',
  'approvalAdminName',
]);

/**
 * ЗӨВХӨН ОРОЛТ — эдгээр нь `shifts` хүснэгтийн багана БИШ. Хүсэлтэд зөвшөөрөгдөнө
 * (route дотор `body`-оос уншиж, хэнийг баталгаажуулах мастер болгохыг шийднэ),
 * гэхдээ `data`-д хэзээ ч орохгүй — эс бөгөөс `prisma.shift.update` унана.
 */
const INPUT_ONLY_KEYS = new Set(['confirmMasterUid', 'confirmMasterName']);

const MASTER_APPROVAL_KEYS = new Set(['masterApproved', 'masterApprovedBy', 'masterApprovedDate']);
const ADMIN_APPROVAL_KEYS = new Set(['adminApproved', 'adminApprovedBy', 'adminApprovedDate']);
const STATUS_PATCH_KEYS = new Set(['status']);

const HANDOVER_ACCEPT_PATCH_KEYS = new Set([
  'handoverAwaitingAcceptance',
  'handoverAcceptedByUid',
  'handoverAcceptedByName',
  'handoverAcceptedAt',
  'attentionNotes',
  // waiting_current_master баталгаажуулахад дараагийн операторын хуваарь олдоогүй бол
  // мастерын гараар сонгосон дараагийн оператор (nextMasterUid/Name-ийн адил хэв маяг).
  'nextOperatorUid',
  'nextOperatorName',
]);
const HANDOVER_TIMING_KEYS = new Set([
  'handoverTimingStatus',
  'handoverTimingReason',
  'handoverTimingRecordedAt',
]);

function isMasterLike(role: string) {
  return role === 'admin' || role === 'master' || role === 'chief_engineer';
}

/** Дараагийн оператор эсвэл мастер/ерөнхий инженер хүлээн авах эрхтэй эсэх */
export function canAcceptHandover(
  shift: {
    operatorUid: string;
    stationCode: string;
    shiftMasterUid: string | null;
    handoverToOperatorUid: string | null;
    handoverStage?: string | null;
    currentMasterUid?: string | null;
    nextMasterUid?: string | null;
    nextOperatorUid?: string | null;
  },
  actor: SessionActor
): boolean {
  const role = actor.role || 'operator';
  if (role === 'admin' || role === 'chief_engineer') return true;
  const stage = String(shift.handoverStage || '').trim();
  if (stage === 'waiting_current_master') {
    return role === 'master' && !!shift.currentMasterUid && shift.currentMasterUid === actor.id;
  }
  if (stage === 'waiting_next_master') {
    if (shift.nextOperatorUid) return shift.nextOperatorUid === actor.id;
    return role === 'master' && !!shift.nextMasterUid && shift.nextMasterUid === actor.id;
  }
  if (stage === 'waiting_next_operator') {
    return !!shift.nextOperatorUid && shift.nextOperatorUid === actor.id;
  }
  if (role === 'master') {
    if (shift.shiftMasterUid) return shift.shiftMasterUid === actor.id;
    return shift.handoverToOperatorUid === actor.id;
  }
  if (shift.handoverToOperatorUid) return shift.handoverToOperatorUid === actor.id;
  if (role === 'operator' && actor.stationCode && actor.stationCode === shift.stationCode && actor.id !== shift.operatorUid)
    return true;
  return false;
}

export function buildAuthorizedPatchData(
  shift: {
    operatorUid: string;
    stationCode: string;
    shiftMasterUid: string | null;
    handoverToOperatorUid: string | null;
    handoverStage?: string | null;
    currentMasterUid?: string | null;
    nextMasterUid?: string | null;
    nextOperatorUid?: string | null;
    adminApproved?: boolean | null;
    status?: string | null;
  },
  actor: SessionActor,
  body: Record<string, unknown>
): { data: Record<string, unknown> | null; error: string | null } {
  const role = actor.role || 'operator';
  if (MANAGEMENT_READ_ONLY.has(role) || role === 'dispatcher' || role === 'hse_engineer') {
    return { data: null, error: 'Засварлах эрхгүй' };
  }

  const requestedKeys = Object.keys(body || {}).filter((k) => body[k] !== undefined);
  if (requestedKeys.length === 0) return { data: null, error: 'No updatable fields provided' };

  const allowedUnion = new Set([
    ...OPERATOR_SELF_PATCH_KEYS,
    ...MASTER_APPROVAL_KEYS,
    ...ADMIN_APPROVAL_KEYS,
    ...STATUS_PATCH_KEYS,
    ...HANDOVER_ACCEPT_PATCH_KEYS,
    ...HANDOVER_TIMING_KEYS,
  ]);
  for (const k of requestedKeys) {
    if (!allowedUnion.has(k)) return { data: null, error: `Forbidden field: ${k}` };
  }

  const data: Record<string, unknown> = {};
  const isOwner = shift.operatorUid === actor.id;

  const handoverFlag = body.handoverAwaitingAcceptance;
  const isHandoverAccept =
    handoverFlag === false ||
    handoverFlag === 'false' ||
    requestedKeys.some((k) => k.startsWith('handoverAccepted'));
  const isHandoverRequest = handoverFlag === true || handoverFlag === 'true';

  const wantsMaster = requestedKeys.some((k) => MASTER_APPROVAL_KEYS.has(k));
  const wantsAdmin = requestedKeys.some((k) => ADMIN_APPROVAL_KEYS.has(k));
  const wantsStatus = requestedKeys.some((k) => STATUS_PATCH_KEYS.has(k));
  // `nextOperatorUid/Name` нь ХОЁР олонлогт хамаарна: оператор ээлж дуусгахдаа
  // сонгоно, МӨН мастер баталгаажуулахдаа дарж сонгож болно. Хүлээн авах хүсэлтэд
  // эдгээрийг «операторын үйлдэл» гэж тоолвол intentCount 2 болж, «Нэг HTTP хүсэлтэнд
  // нэг төрлийн үйлдлийг илгээнэ үү» гэж ХАЖУУГААР нь хаадаг байсан — мастер
  // дараагийн операторыг сольж баталгаажуулах боломжгүй болж байв.
  const wantsOperatorScalars = requestedKeys.some(
    (k) => OPERATOR_SELF_PATCH_KEYS.has(k) && !(isHandoverAccept && HANDOVER_ACCEPT_PATCH_KEYS.has(k))
  );
  const wantsOperatorPatch = isHandoverRequest || wantsOperatorScalars;
  const statusValue = String(body.status || '').trim();
  const statusWithAdminApproval = wantsAdmin && wantsStatus && statusValue === 'Баталгаажсан';
  const wantsStandaloneStatus = wantsStatus && !statusWithAdminApproval;

  const intentCount =
    (wantsMaster ? 1 : 0) +
    (wantsAdmin || statusWithAdminApproval ? 1 : 0) +
    (wantsStandaloneStatus ? 1 : 0) +
    (isHandoverAccept ? 1 : 0) +
    (wantsOperatorPatch ? 1 : 0);
  if (intentCount > 1) {
    return { data: null, error: 'Нэг HTTP хүсэлтэнд нэг төрлийн үйлдлийг илгээнэ үү' };
  }

  if (wantsAdmin) {
    if (role !== 'admin' && role !== 'chief_engineer') return { data: null, error: 'Админ баталгаажуулах эрхгүй' };
    for (const k of requestedKeys) {
      if (ADMIN_APPROVAL_KEYS.has(k) || (k === 'status' && statusWithAdminApproval)) data[k] = body[k];
    }
  } else if (wantsMaster) {
    if (!isMasterLike(role)) return { data: null, error: 'Ээлж баталгаажуулах эрхгүй' };
    for (const k of requestedKeys) {
      if (MASTER_APPROVAL_KEYS.has(k)) data[k] = body[k];
    }
  } else if (wantsStandaloneStatus) {
    if (role !== 'admin' && role !== 'chief_engineer') return { data: null, error: 'Төлөв өөрчлөх эрхгүй' };
    for (const k of requestedKeys) {
      if (STATUS_PATCH_KEYS.has(k)) data[k] = body[k];
    }
  } else if (isHandoverAccept) {
    if (!canAcceptHandover(shift, actor)) return { data: null, error: 'Ээлж хүлээн авах эрхгүй' };
    // nextOperatorUid/Name зөвхөн waiting_current_master шатанд л утга учиртай (гараар
    // сонгосон дараагийн оператор). Бусад шатанд эдгээр талбарыг үл тоож, гадуур орж ирсэн
    // дурын утга бусад шатны бичлэгт үлдэхээс сэргийлнэ.
    const stage = String(shift.handoverStage || '').trim();
    for (const k of requestedKeys) {
      if ((k === 'nextOperatorUid' || k === 'nextOperatorName') && stage !== 'waiting_current_master') continue;
      if (HANDOVER_ACCEPT_PATCH_KEYS.has(k)) data[k] = body[k];
    }
  } else if (wantsOperatorPatch) {
    if (!isOwner && role !== 'admin') return { data: null, error: 'Зөвхөн ээлжийн оператор засварлана' };
    // Эцэслэн баталгаажсаны дараа эзэн нь тэмдэглэл/цаг/хүлээлцэх талбарыг шууд API-аар
    // өөрчилж чадвал баталгаажсан бүртгэлийн бүрэн бүтэн байдал алдагдана.
    const isFinalized = shift.adminApproved === true || String(shift.status || '').trim() === 'Баталгаажсан';
    if (isFinalized && role !== 'admin') {
      return { data: null, error: 'Эцэслэн баталгаажсан ээлжийг засварлах боломжгүй' };
    }
    for (const k of requestedKeys) {
      if (INPUT_ONLY_KEYS.has(k)) continue;
      if (OPERATOR_SELF_PATCH_KEYS.has(k) || k === 'handoverAwaitingAcceptance') data[k] = body[k];
    }
  }

  if ((isHandoverAccept || wantsOperatorPatch) && requestedKeys.some((k) => HANDOVER_TIMING_KEYS.has(k))) {
    for (const k of requestedKeys) {
      if (HANDOVER_TIMING_KEYS.has(k)) data[k] = body[k];
    }
  }

  if (Object.keys(data).length === 0) return { data: null, error: 'No authorized fields' };
  return { data, error: null };
}

export function canCreateShiftFor(actor: SessionActor, bodyOperatorUid: string): boolean {
  const role = actor.role || 'operator';
  if (role === 'admin' || role === 'master') return true;
  return bodyOperatorUid === actor.id;
}

export function canQueryShifts(actor: SessionActor, queryType: string, operatorUid: string): boolean {
  const role = actor.role || 'operator';
  if (queryType === 'handover') {
    if (PRIVILEGED_SHIFT_READ.has(role)) return true;
    if (role === 'operator') return true;
    return false;
  }
  if (['master_overview', 'dispatcher_compliance', 'pending', 'kpi', 'kpi_trend', 'active_all', 'admin_pending', 'admin_approved', 'handover_context'].includes(queryType)) {
    if (queryType === 'handover_context' && role === 'operator') return true;
    return PRIVILEGED_SHIFT_READ.has(role);
  }
  if (['slots', 'active', 'operator'].includes(queryType)) {
    if (role === 'admin' || role === 'master' || role === 'dispatcher' || role === 'chief_engineer') return true;
    return operatorUid === actor.id;
  }
  return false;
}

export function canAppendShiftLog(actor: SessionActor, shiftOperatorUid: string): boolean {
  const role = actor.role || 'operator';
  if (role === 'admin' || role === 'master' || role === 'chief_engineer') return true;
  return shiftOperatorUid === actor.id;
}
