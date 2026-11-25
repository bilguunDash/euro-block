import type { Prisma } from '../generated/prisma/client';
import { ADMIN_APPROVAL_LOG_TYPES } from './master-stations';
import type { ApprovalMaintenanceAction, ApprovalMaintenanceRequest } from './approval-maintenance';

type Actor = { id: string; name: string | null };

export class ApprovalMaintenanceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function conflict(): never {
  throw new ApprovalMaintenanceError(409, 'Бүртгэлийн төлөв өөрчлөгдсөн. Жагсаалтыг шинэчлээд дахин оролдоно уу.');
}

function reopenedShift(actor: Actor, now: string): Prisma.ShiftUpdateInput {
  return {
    status: 'Хадгалсан', operatorShiftCompleted: false,
    adminApproved: false, adminApprovedBy: null, adminApprovedDate: null,
    masterApproved: false, masterApprovedBy: null, masterApprovedDate: null,
    handoverAwaitingAcceptance: false, handoverStage: 'returned', handoverRequestedAt: null,
    currentMasterApprovedByUid: null, currentMasterApprovedByName: null, currentMasterApprovedAt: null, currentMasterComment: null,
    nextMasterApprovedByUid: null, nextMasterApprovedByName: null, nextMasterApprovedAt: null, nextMasterComment: null,
    handoverAcceptedByUid: null, handoverAcceptedByName: null, handoverAcceptedAt: null, handoverFinalAcceptedAt: null,
    handoverReturnedByUid: actor.id, handoverReturnedByName: actor.name, handoverReturnedAt: now,
    handoverReturnReason: 'Админ баталгаажуулалтыг цуцалж, засварт буцаасан.',
    // Keep checkOut and form contents: a return must not grow the periodic-log window.
  };
}

function unapprovedData(data: Prisma.JsonValue, actor: Actor, now: string, returned: boolean): Prisma.InputJsonObject {
  const result = { ...(data as Prisma.JsonObject) };
  for (const key of ['adminApproved', 'adminApprovedBy', 'adminApprovedAt', 'adminRejected', 'adminRejectedBy', 'adminRejectedAt']) delete result[key];
  if (returned) Object.assign(result, { adminRejected: true, adminRejectedBy: actor.name || actor.id, adminRejectedAt: now });
  return result;
}

function shiftAuditSnapshot(shift: {
  id: string; operatorUid: string; operatorName: string; stationCode: string; shiftDate: string; shiftType: string;
  status: string; adminApproved: boolean; adminApprovedBy: string | null; adminApprovedDate: string | null;
  masterApproved: boolean; masterApprovedBy: string | null; masterApprovedDate: string | null; handoverStage: string | null;
}) {
  const { id, operatorUid, operatorName, stationCode, shiftDate, shiftType, status,
    adminApproved, adminApprovedBy, adminApprovedDate, masterApproved, masterApprovedBy, masterApprovedDate, handoverStage } = shift;
  return { id, operatorUid, operatorName, stationCode, shiftDate, shiftType, status,
    adminApproved, adminApprovedBy, adminApprovedDate, masterApproved, masterApprovedBy, masterApprovedDate, handoverStage };
}

/** Runs inside one serializable transaction so the mutation and its audit commit together. */
export async function maintainApprovalRecord(tx: Prisma.TransactionClient, request: ApprovalMaintenanceRequest, action: ApprovalMaintenanceAction, actor: Actor) {
  const { kind, id, state } = request;
  const now = new Date().toISOString();
  let snapshot: unknown;
  let entityType: string;

  if (kind === 'shift' || kind === 'master_form') {
    const log = kind === 'master_form' ? await tx.productionLog.findUnique({ where: { id } }) : null;
    if (kind === 'master_form' && (!log || !(ADMIN_APPROVAL_LOG_TYPES as readonly string[]).includes(log.logType))) {
      throw new ApprovalMaintenanceError(404, 'Мастерын маягт олдсонгүй.');
    }
    const shift = await tx.shift.findUnique({ where: { id: log?.shiftId || id } });
    if (!shift) throw new ApprovalMaintenanceError(404, 'Ээлжийн бүртгэл олдсонгүй.');
    if (shift.status === 'Цуцлагдсан') conflict();
    if (log) {
      const data = log.data as Prisma.JsonObject;
      if (state === 'approved') {
        if (data.adminApproved !== true) conflict();
      } else {
        const latest = await tx.productionLog.findFirst({ where: { shiftId: shift.id, logType: log.logType }, orderBy: { sortOrder: 'desc' } });
        const rejected = data.adminRejected === true && (!data.adminRejectedAt || String(data.adminRejectedAt) >= log.createdAt.toISOString());
        if (latest?.id !== id || data.needsAdminApproval !== true || data.adminApproved === true || rejected ||
          shift.adminApproved || shift.status === 'Баталгаажсан' || shift.masterApproved ||
          (shift.currentMasterApprovedAt && (shift.handoverStage === 'accepted' || shift.handoverFinalAcceptedAt))) conflict();
      }
      const versions = await tx.productionLog.findMany({ where: { shiftId: shift.id, logType: log.logType } });
      snapshot = { shift: shiftAuditSnapshot(shift), logType: log.logType, versionIds: versions.map((version) => version.id) };
      entityType = 'production_log';
      if (action === 'delete') {
        // Deleting only the newest version would resurrect an older form and approval.
        await tx.productionLog.deleteMany({ where: { shiftId: shift.id, logType: log.logType } });
      } else {
        for (const version of versions) {
          await tx.productionLog.update({ where: { id: version.id }, data: { data: unapprovedData(version.data, actor, now, true) } });
        }
      }
      await tx.shift.update({ where: { id: shift.id }, data: reopenedShift(actor, now) });
    } else {
      const masterApproved = shift.masterApproved || (shift.currentMasterApprovedAt && (shift.handoverStage === 'accepted' || shift.handoverFinalAcceptedAt));
      if (state === 'approved' ? !shift.adminApproved || !shift.masterApproved : shift.adminApproved || !masterApproved) conflict();
      snapshot = shiftAuditSnapshot(shift);
      entityType = 'shift';
      if (action === 'delete') {
        // HseLog stores a shiftId without a foreign key, so DB cascades cannot
        // remove it. Delete only this shift's HSE records in the same transaction.
        await tx.hseLog.deleteMany({ where: { shiftId: id } });
        await tx.shift.delete({ where: { id } });
      } else {
        await tx.shift.update({ where: { id }, data: reopenedShift(actor, now) });
        const forms = await tx.productionLog.findMany({ where: { shiftId: id, logType: { in: [...ADMIN_APPROVAL_LOG_TYPES] } } });
        for (const form of forms) {
          await tx.productionLog.update({ where: { id: form.id }, data: { data: unapprovedData(form.data, actor, now, true) } });
        }
      }
    }
    if (action === 'cancel' || kind === 'master_form') {
      await tx.shiftHandoverApproval.create({ data: { shiftId: shift.id, stage: shift.handoverStage || 'none', action: 'admin_reopened', actorUid: actor.id, actorName: actor.name } });
      // The original owner keeps the record and gets a direct link to correct it,
      // even when an old shift no longer appears on the first history page.
      // Commit the notification with the return and audit; failed delivery must
      // not leave the owner unaware of a successfully returned record.
      await tx.notification.create({ data: {
        userId: shift.operatorUid, kind: 'approval_returned',
        title: 'Бүртгэл засварт буцаагдлаа',
        body: `${shift.stationCode} (${shift.shiftDate}, ${shift.shiftType}) — ${actor.name || 'Админ'} бүртгэлийг засварт буцаалаа. Засаж, дахин илгээнэ үү.`,
        link: `/shift/${shift.id}`,
      } });
    }
  } else {
    const schedule = kind === 'operator_schedule'
      ? await tx.operatorSchedule.findUnique({ where: { id } })
      : await tx.masterSchedule.findUnique({ where: { id } });
    if (!schedule) throw new ApprovalMaintenanceError(404, 'Хуваарийн оноолт олдсонгүй.');
    const assigneeUid = 'masterUid' in schedule ? schedule.masterUid : schedule.operatorUid;
    const started = await tx.shift.findFirst({ where: {
      operatorUid: assigneeUid, stationCode: schedule.stationCode, shiftDate: schedule.shiftDate, shiftType: schedule.shiftType,
      status: { not: 'Цуцлагдсан' },
    } });
    if (started) conflict();
    snapshot = schedule;
    entityType = kind;
    if (kind === 'operator_schedule') await tx.operatorSchedule.delete({ where: { id } });
    else await tx.masterSchedule.delete({ where: { id } });
    // Pending swap requests must not continue referring to a removed assignment.
    if (kind === 'operator_schedule') await tx.shiftSwapRequest.updateMany({
      where: { status: 'pending', OR: [{ requesterScheduleId: id }, { targetScheduleId: id }] },
      data: { status: 'cancelled', decidedAt: new Date(now), decidedByUid: actor.id, decidedByName: actor.name, decisionNote: 'Хуваарийн оноолтыг админ хассан.' },
    });
  }

  await tx.auditLog.create({ data: {
    actorUid: actor.id, actorName: actor.name, action: `approval_${kind}_${action === 'cancel' ? 'cancelled' : 'deleted'}`,
    entityType, entityId: id, details: JSON.stringify({ previousState: state, snapshot }),
  } });
}
