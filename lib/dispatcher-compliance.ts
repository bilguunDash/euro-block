import { prisma } from '@/lib/prisma';
import { STATION_NAME_BY_CODE } from '@/lib/shift-db';
import { getPeriodicLogStatus } from '@/lib/shift-completeness';
import { getHandoverWindowForShift, getPeriodicIntervalHours } from '@/lib/system-settings';

const CANCELLED_STATUSES = new Set(['Цуцлагдсан']);

const REQUIRED_MAIN_FORM_BY_STATION: Record<string, { logType: string; label: string }> = {
  'ҮЯ-110': { logType: 'modal_y110_start_form', label: 'ҮЯ-110 үндсэн бүртгэл' },
  'ҮЯ-120': { logType: 'modal_y120_handover_form', label: 'ҮЯ-120 үндсэн бүртгэл' },
  'ҮЯ-121': { logType: 'modal_y121_handover_form', label: 'ҮЯ-121 үндсэн бүртгэл' },
  'ҮЯ-130': { logType: 'modal_y130_handover_form', label: 'ҮЯ-130 үндсэн бүртгэл' },
  'ҮЯ-140': { logType: 'modal_y140_handover_form', label: 'ҮЯ-140 үндсэн бүртгэл' },
  'ҮЯ-150': { logType: 'modal_y150_handover_form', label: 'ҮЯ-150 үндсэн бүртгэл' },
  'ҮЯ-160': { logType: 'modal_y160_handover_form', label: 'ҮЯ-160 үндсэн бүртгэл' },
  'ҮЯ-161': { logType: 'modal_y161_handover_form', label: 'ҮЯ-161 үндсэн бүртгэл' },
  'ҮЯ-170': { logType: 'modal_y170_packing_operator_form', label: 'ҮЯ-170 савлах төхөөрөмжийн бүртгэл' },
  'ҮЯ-180': { logType: 'modal_y180_autoclave_operator_form', label: 'ҮЯ-180 автоклавын бүртгэл' },
  'ҮЯ-190': { logType: 'modal_y190_handover_form', label: 'ҮЯ-190 үндсэн бүртгэл' },
  'ҮЯ-210': { logType: 'modal_y210_technology_kiln_operator_form', label: 'ҮЯ-210 үндсэн бүртгэл' },
  'ҮЯ-099': { logType: 'modal_y099_master_handover_v1', label: 'ҮЯ-099 мастерын бүртгэл' },
  'ҮЯ-310': { logType: 'modal_y310_repair_master_form', label: 'ҮЯ-310 үндсэн бүртгэл' },
  'ҮЯ-320': { logType: 'modal_y320_electrical_automation_repair_form', label: 'ҮЯ-320 үндсэн бүртгэл' },
  'ҮЯ-400': { logType: 'modal_factory_process_control_form', label: 'ҮЯ-400 процессын хяналтын бүртгэл' },
  'ҮЯ-410': { logType: 'modal_cah02_electrical_control_form', label: 'ҮЯ-410 үндсэн бүртгэл' },
  'ОНБ': { logType: 'modal_ingredient_change_record_form', label: 'Орц найрлагын өөрчлөлтийн бүртгэл' },
};

type ComplianceInput = {
  shiftDate: string;
  shiftType: string;
  now?: Date;
};

function slotKey(stationCode: unknown, operatorUid: unknown) {
  return `${String(stationCode || '').trim()}|${String(operatorUid || '').trim()}`;
}

function slotDeadline(shiftDate: string, endTime: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(shiftDate) ? shiftDate : '';
  const time = /^\d{2}:\d{2}$/.test(endTime) ? endTime : '';
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}:00+08:00`);
  return Number.isFinite(value.getTime()) ? value : null;
}

function isLateTiming(value: unknown) {
  const timing = String(value || '').trim().toLowerCase();
  return timing.includes('late') || timing.includes('хоцор');
}

function isEarlyTiming(value: unknown) {
  const timing = String(value || '').trim().toLowerCase();
  return timing.includes('early') || timing.includes('эрт');
}

function parseHm(value: unknown) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

function slotWindowBounds(shiftDate: string, startTime: string, endTime: string) {
  const start = parseHm(startTime);
  const end = parseHm(endTime);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate) || !start || !end) return null;
  const startAt = new Date(
    `${shiftDate}T${String(start.hour).padStart(2, '0')}:${String(start.minute).padStart(2, '0')}:00+08:00`,
  );
  const endDate = start.hour * 60 + start.minute > end.hour * 60 + end.minute
    ? new Date(startAt.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : shiftDate;
  const endAt = new Date(
    `${endDate}T${String(end.hour).padStart(2, '0')}:${String(end.minute).padStart(2, '0')}:00+08:00`,
  );
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime())) return null;
  return { startAt, endAt };
}

function timingViolationForShift(shift: any, shiftDate: string, window: { start: string; end: string }) {
  const bounds = slotWindowBounds(shiftDate, window.start, window.end);
  const checkIn = new Date(String(shift?.checkIn || shift?.createdAt || ''));
  const hasCheckIn = Number.isFinite(checkIn.getTime());

  if (bounds && hasCheckIn) {
    if (checkIn.getTime() < bounds.startAt.getTime()) {
      return {
        direction: 'early' as const,
        deviationMinutes: Math.ceil((bounds.startAt.getTime() - checkIn.getTime()) / 60000),
        status: 'Стандарт хугацаанаас эрт бүртгэл үүсгэсэн',
        recordedAt: checkIn.toISOString(),
        source: 'checkIn' as const,
      };
    }
    if (checkIn.getTime() > bounds.endAt.getTime()) {
      return {
        direction: 'late' as const,
        deviationMinutes: Math.ceil((checkIn.getTime() - bounds.endAt.getTime()) / 60000),
        status: 'Стандарт хугацаанаас хоцорч бүртгэл үүсгэсэн',
        recordedAt: checkIn.toISOString(),
        source: 'checkIn' as const,
      };
    }
  }

  if (isLateTiming(shift?.handoverTimingStatus) || isEarlyTiming(shift?.handoverTimingStatus)) {
    return {
      direction: isLateTiming(shift?.handoverTimingStatus) ? 'late' as const : 'early' as const,
      deviationMinutes: null,
      status: shift.handoverTimingStatus,
      recordedAt: shift.handoverTimingRecordedAt || shift.checkIn || shift.createdAt || null,
      source: 'handover' as const,
    };
  }

  return null;
}

function logTypesFor(shift: any) {
  return new Set(
    (Array.isArray(shift?.productionLogs) ? shift.productionLogs : [])
      .map((log: any) => String(log?.logType || '').trim())
      .filter(Boolean),
  );
}

function missingLabelsForShift(shift: any, periodicIntervalHours: number) {
  const stationCode = String(shift?.stationCode || '').trim();
  const logTypes = logTypesFor(shift);
  const missing: string[] = [];
  const requiredMain = REQUIRED_MAIN_FORM_BY_STATION[stationCode];

  if (requiredMain && !logTypes.has(requiredMain.logType)) missing.push(requiredMain.label);
  if (!logTypes.has('modal_hse_checklist')) missing.push('ХАБЭА-н хяналтын хуудас');
  // ҮЯ-099 ээлжийн мастер процессын хяналтын хуудсыг бас бөглөнө (ҮЯ-400-д requiredMain дотор аль хэдийн орсон).
  if (stationCode === 'ҮЯ-099' && !logTypes.has('modal_factory_process_control_form')) {
    missing.push('Үйлдвэрийн процесст тавих хяналтын хуудас');
  }

  const periodicLogs = (Array.isArray(shift?.productionLogs) ? shift.productionLogs : [])
    .filter((log: any) => String(log?.logType || '') === 'modal_periodic_logs')
    .map((log: any) => ({
      id: log.id,
      createdAt: log.createdAt,
      ...((log.data as Record<string, unknown> | null) || {}),
    }));
  const periodic = getPeriodicLogStatus({
    stationCode,
    periodicLogs,
    checkInIso: shift?.checkIn,
    checkOutIso: shift?.checkOut,
    periodicIntervalHours,
  });
  if (periodic.isOverdue) {
    missing.push(`Тогтмол бүртгэл (${periodic.intervalHours} цаг тутам): ${periodic.missingCount} дутуу`);
  }

  return missing;
}

function isActiveShift(shift: any) {
  if (!shift) return false;
  if (!['Хадгалсан', 'Ноорог'].includes(String(shift.status || '').trim())) return false;
  if (shift.checkOut || shift.operatorShiftCompleted) return false;
  const stage = String(shift.handoverStage || '').trim();
  if (stage === 'accepted' || stage === 'returned') return false;
  if (shift.handoverFinalAcceptedAt || shift.masterApproved || shift.adminApproved) return false;
  return true;
}

function isApprovedShift(shift: any) {
  return Boolean(shift) && (String(shift.status || '').trim() === 'Баталгаажсан' || shift.adminApproved === true);
}

function isPendingApprovalShift(shift: any) {
  if (!shift || isApprovedShift(shift)) return false;
  return Boolean(
    shift.operatorShiftCompleted ||
      shift.checkOut ||
      shift.handoverRequestedAt ||
      shift.masterApproved ||
      shift.currentMasterApprovedAt
  );
}

const MASTER_STATION_CODES_SET = new Set(['ҮЯ-099', 'ҮЯ-310', 'ҮЯ-410']);

export async function resolveDispatcherCompliance({ shiftDate, shiftType, now = new Date() }: ComplianceInput) {
  const [handoverWindow, periodicIntervalHours, schedules, shifts, controlStations, masterSchedules] = await Promise.all([
    getHandoverWindowForShift(shiftType),
    getPeriodicIntervalHours(),
    prisma.operatorSchedule.findMany({
      where: { shiftDate, shiftType },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.shift.findMany({
      where: {
        shiftDate,
        shiftType,
        status: { notIn: Array.from(CANCELLED_STATUSES) },
      },
      include: {
        productionLogs: {
          where: { logType: { startsWith: 'modal_' } },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.$queryRawUnsafe<Array<{ code: string; name: string; isActive: boolean }>>(
      `SELECT "code", "name", "isActive"
       FROM "control_stations"
       WHERE "isActive" = TRUE
       ORDER BY "code" ASC`
    ).catch(() => []),
    prisma.masterSchedule.findMany({
      where: { shiftDate, shiftType },
      orderBy: { createdAt: 'desc' },
    }).catch(() => [] as any[]),
  ]);

  const deadline = slotDeadline(shiftDate, handoverWindow.end);
  const slotElapsed = Boolean(deadline && now.getTime() > deadline.getTime());
  const scheduleBySlot = new Map<string, any>();
  for (const schedule of schedules) {
    const key = slotKey(schedule.stationCode, schedule.operatorUid);
    if (!scheduleBySlot.has(key)) scheduleBySlot.set(key, schedule);
  }

  const shiftBySlot = new Map<string, any>();
  for (const shift of shifts) {
    const key = slotKey(shift.stationCode, shift.operatorUid);
    if (!shiftBySlot.has(key)) shiftBySlot.set(key, shift);
  }

  const missingRows: any[] = [];
  const consumedShiftIds = new Set<string>();

  for (const schedule of scheduleBySlot.values()) {
    const key = slotKey(schedule.stationCode, schedule.operatorUid);
    const shift = shiftBySlot.get(key);
    if (shift?.id) consumedShiftIds.add(String(shift.id));

    if (!shift) {
      if (slotElapsed) {
        missingRows.push({
          id: `schedule:${schedule.id}`,
          shiftId: null,
          scheduleId: schedule.id,
          shiftDate,
          shiftType,
          stationCode: schedule.stationCode,
          stationName: STATION_NAME_BY_CODE[schedule.stationCode] || null,
          operatorUid: schedule.operatorUid,
          operatorName: schedule.operatorName || null,
          status: 'Бүртгэл үүсгээгүй',
          missing: ['Ээлжийн бүртгэл үүсгээгүй'],
        });
      }
      continue;
    }

    const shouldEvaluate = slotElapsed || Boolean(shift.operatorShiftCompleted || shift.checkOut || shift.handoverRequestedAt);
    if (!shouldEvaluate) continue;
    const missing = missingLabelsForShift(shift, periodicIntervalHours);
    if (missing.length > 0) {
      missingRows.push({
        id: String(shift.id),
        shiftId: String(shift.id),
        scheduleId: schedule.id,
        shiftDate,
        shiftType,
        stationCode: shift.stationCode,
        stationName: STATION_NAME_BY_CODE[shift.stationCode] || shift.stationName || null,
        operatorUid: shift.operatorUid,
        operatorName: shift.operatorName,
        status: shift.status,
        missing,
      });
    }
  }

  for (const shift of shifts) {
    if (consumedShiftIds.has(String(shift.id))) continue;
    const shouldEvaluate = slotElapsed || Boolean(shift.operatorShiftCompleted || shift.checkOut || shift.handoverRequestedAt);
    if (!shouldEvaluate) continue;
    const missing = missingLabelsForShift(shift, periodicIntervalHours);
    if (missing.length > 0) {
      missingRows.push({
        id: String(shift.id),
        shiftId: String(shift.id),
        scheduleId: null,
        shiftDate,
        shiftType,
        stationCode: shift.stationCode,
        stationName: STATION_NAME_BY_CODE[shift.stationCode] || shift.stationName || null,
        operatorUid: shift.operatorUid,
        operatorName: shift.operatorName,
        status: shift.status,
        missing,
      });
    }
  }

  const timingRows = shifts
    .map((shift) => ({ shift, violation: timingViolationForShift(shift, shiftDate, handoverWindow) }))
    .filter((row) => Boolean(row.violation))
    .map(({ shift, violation }) => ({
      id: String(shift.id),
      shiftId: String(shift.id),
      shiftDate,
      shiftType,
      stationCode: shift.stationCode,
      stationName: STATION_NAME_BY_CODE[shift.stationCode] || shift.stationName || null,
      operatorUid: shift.operatorUid,
      operatorName: shift.operatorName,
      status: shift.status,
      handoverTimingStatus: violation?.status || shift.handoverTimingStatus,
      handoverTimingReason:
        shift.handoverTimingReason ||
        (violation?.direction === 'early'
          ? 'Ээлжийн бүртгэлийг стандарт хугацаанаас эрт үүсгэсэн.'
          : 'Ээлжийн бүртгэлийг стандарт хугацаанаас хоцорч үүсгэсэн.'),
      handoverTimingRecordedAt: violation?.recordedAt || shift.handoverTimingRecordedAt,
      timingDirection: violation?.direction || null,
      timingDeviationMinutes: violation?.deviationMinutes ?? null,
      timingSource: violation?.source || null,
      checkIn: shift.checkIn,
      checkOut: shift.checkOut,
      createdAt: shift.createdAt,
    }));
  const lateRows = timingRows.filter((row) => row.timingDirection === 'late');
  const earlyRows = timingRows.filter((row) => row.timingDirection === 'early');

  const missingBySlot = new Map<string, any>();
  for (const row of missingRows) {
    missingBySlot.set(slotKey(row.stationCode, row.operatorUid), row);
  }
  const lateBySlot = new Map<string, any>();
  for (const row of lateRows) {
    lateBySlot.set(slotKey(row.stationCode, row.operatorUid), row);
  }
  const earlyBySlot = new Map<string, any>();
  for (const row of earlyRows) {
    earlyBySlot.set(slotKey(row.stationCode, row.operatorUid), row);
  }

  const stationNames = new Map<string, string>();
  for (const station of controlStations) {
    const code = String(station.code || '').trim();
    if (code) stationNames.set(code, String(station.name || '').trim() || code);
  }
  for (const schedule of scheduleBySlot.values()) {
    const code = String(schedule.stationCode || '').trim();
    if (code && !stationNames.has(code)) stationNames.set(code, STATION_NAME_BY_CODE[code] || code);
  }
  for (const shift of shiftBySlot.values()) {
    const code = String(shift.stationCode || '').trim();
    if (code && !stationNames.has(code)) {
      stationNames.set(code, STATION_NAME_BY_CODE[code] || shift.stationName || code);
    }
  }

  const allSlotKeys = new Set<string>([...scheduleBySlot.keys(), ...shiftBySlot.keys()]);
  const operatorRows = Array.from(allSlotKeys)
    .map((key) => {
      const schedule = scheduleBySlot.get(key) || null;
      const shift = shiftBySlot.get(key) || null;
      const stationCode = String(shift?.stationCode || schedule?.stationCode || '').trim();
      const operatorUid = String(shift?.operatorUid || schedule?.operatorUid || '').trim();
      const operatorName = String(shift?.operatorName || schedule?.operatorName || '').trim();
      const missingRow = missingBySlot.get(key) || null;
      const lateRow = lateBySlot.get(key) || null;
      const earlyRow = earlyBySlot.get(key) || null;
      const pendingHandover = Boolean(shift?.handoverAwaitingAcceptance && shift?.handoverRequestedAt);
      const pendingApproval = isPendingApprovalShift(shift);
      return {
        id: key,
        shiftDate,
        shiftType,
        stationCode,
        stationName: stationNames.get(stationCode) || STATION_NAME_BY_CODE[stationCode] || stationCode,
        operatorUid,
        operatorName,
        scheduleId: schedule?.id ? String(schedule.id) : null,
        shiftId: shift?.id ? String(shift.id) : null,
        status: shift?.status || (schedule ? 'Эхлээгүй' : null),
        scheduled: Boolean(schedule),
        started: Boolean(shift),
        active: isActiveShift(shift),
        approved: isApprovedShift(shift),
        notStarted: Boolean(schedule && !shift),
        pendingApproval,
        pendingHandover,
        missing: Boolean(missingRow),
        missingCount: Array.isArray(missingRow?.missing) ? missingRow.missing.length : 0,
        late: Boolean(lateRow),
        timingDeviationMinutes: lateRow?.timingDeviationMinutes ?? null,
        early: Boolean(earlyRow),
        earlyDeviationMinutes: earlyRow?.timingDeviationMinutes ?? null,
        handoverStage: shift?.handoverStage || null,
        handoverToOperatorName: shift?.handoverToOperatorName || shift?.nextOperatorName || null,
        checkIn: shift?.checkIn || null,
        checkOut: shift?.checkOut || null,
      };
    })
    .sort((a, b) => {
      const stationCompare = a.stationCode.localeCompare(b.stationCode, 'mn');
      return stationCompare || a.operatorName.localeCompare(b.operatorName, 'mn');
    });

  const stationRows = Array.from(stationNames, ([stationCode, stationName]) => {
    const rows = operatorRows.filter((row) => row.stationCode === stationCode);
    return {
      stationCode,
      stationName,
      scheduled: rows.filter((row) => row.scheduled).length,
      started: rows.filter((row) => row.started).length,
      active: rows.filter((row) => row.active).length,
      approved: rows.filter((row) => row.approved).length,
      notStarted: rows.filter((row) => row.notStarted).length,
      pendingApproval: rows.filter((row) => row.pendingApproval).length,
      pendingHandover: rows.filter((row) => row.pendingHandover).length,
      missing: rows.filter((row) => row.missing).length,
      late: rows.filter((row) => row.late).length,
      early: rows.filter((row) => row.early).length,
      operators: rows.map((row) => row.operatorName).filter(Boolean),
    };
  });

  // Master station shifts (ҮЯ-099, ҮЯ-310, ҮЯ-410) — master-to-master handover forms
  const masterShiftByStation = new Map<string, any>();
  for (const shift of shifts) {
    const code = String(shift.stationCode || '').trim();
    if (MASTER_STATION_CODES_SET.has(code) && !masterShiftByStation.has(code)) {
      masterShiftByStation.set(code, shift);
    }
  }
  const masterScheduleByStation = new Map<string, any>();
  for (const sched of (masterSchedules as any[])) {
    const code = String(sched.stationCode || '').trim();
    if (MASTER_STATION_CODES_SET.has(code) && !masterScheduleByStation.has(code)) {
      masterScheduleByStation.set(code, sched);
    }
  }
  const masterShiftRows = Array.from(MASTER_STATION_CODES_SET).map((code) => {
    const shift = masterShiftByStation.get(code) || null;
    const schedule = masterScheduleByStation.get(code) || null;
    const logTypes = shift ? logTypesFor(shift) : new Set<string>();
    const requiredForm = REQUIRED_MAIN_FORM_BY_STATION[code];
    const formFilled = Boolean(requiredForm && logTypes.has(requiredForm.logType));
    return {
      stationCode: code,
      stationName: STATION_NAME_BY_CODE[code] || stationNames.get(code) || code,
      masterUid: shift?.operatorUid || schedule?.masterUid || null,
      masterName: shift?.operatorName || schedule?.masterName || null,
      shiftId: shift?.id ? String(shift.id) : null,
      scheduled: Boolean(schedule),
      started: Boolean(shift),
      active: isActiveShift(shift),
      approved: isApprovedShift(shift),
      formFilled,
      formLabel: requiredForm?.label || null,
      pendingHandover: Boolean(shift?.handoverAwaitingAcceptance),
    };
  });

  const totals = {
    scheduled: operatorRows.filter((row) => row.scheduled).length,
    started: operatorRows.filter((row) => row.started).length,
    active: operatorRows.filter((row) => row.active).length,
    approved: operatorRows.filter((row) => row.approved).length,
    notStarted: operatorRows.filter((row) => row.notStarted).length,
    pendingApproval: operatorRows.filter((row) => row.pendingApproval).length,
    pendingHandover: operatorRows.filter((row) => row.pendingHandover).length,
    missing: operatorRows.filter((row) => row.missing).length,
    late: operatorRows.filter((row) => row.late).length,
    early: operatorRows.filter((row) => row.early).length,
  };

  return {
    shiftDate,
    shiftType,
    slotElapsed,
    deadline: deadline?.toISOString() || null,
    window: handoverWindow,
    schedules: Array.from(scheduleBySlot.values()).map((schedule) => ({
      id: String(schedule.id),
      shiftDate: schedule.shiftDate,
      shiftType: schedule.shiftType,
      stationCode: schedule.stationCode,
      operatorUid: schedule.operatorUid,
      operatorName: schedule.operatorName,
      createdAt: schedule.createdAt,
    })),
    lateRows,
    earlyRows,
    missingRows,
    summary: {
      totals,
      stationRows,
      operatorRows,
      masterShiftRows,
      pendingApprovalRows: operatorRows.filter((row) => row.pendingApproval),
      handoverRows: operatorRows.filter((row) => row.pendingHandover),
    },
  };
}
