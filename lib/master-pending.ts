/** Мастерын шийдвэрийг одоо хүлээж буй ээлжүүд. */
export function masterApprovalPendingWhere(actor: { id: string; role: string }) {
  const pending = {
    status: 'Хадгалсан',
    masterApproved: false,
    handoverStage: { in: ['waiting_current_master', 'waiting_next_master'] },
  };

  if (actor.role !== 'master') return pending;

  // Хүсэлт илгээх үед хадгалсан хариуцагчийг ашиглана. shiftMasterUid нь
  // waiting_next_master шатанд өмнөх мастер хэвээр байдаг.
  return {
    ...pending,
    OR: [
      { handoverStage: 'waiting_current_master', currentMasterUid: actor.id },
      { handoverStage: 'waiting_next_master', nextMasterUid: actor.id, nextOperatorUid: null },
    ],
  };
}

/** Хуучин SWR cache-ийн мөрийг ч зөв эзэмшигчээр нь шүүнэ. */
export function isMasterPendingOwner(shift: {
  handoverStage?: unknown;
  currentMasterUid?: unknown;
  nextMasterUid?: unknown;
  nextOperatorUid?: unknown;
}, masterUid: string): boolean {
  if (!masterUid) return false;
  if (shift.handoverStage === 'waiting_current_master') return shift.currentMasterUid === masterUid;
  if (shift.handoverStage === 'waiting_next_master') {
    return shift.nextMasterUid === masterUid && !shift.nextOperatorUid;
  }
  return false;
}
