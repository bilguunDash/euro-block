import { createEmptyEnvironmentChecks, type EnvironmentCheckRow } from './environment-check-form';

/** ҮЯ-320: Цахилгаан автоматжуулалтын засварын бүртгэл */

export type Y320RepairType = '' | 'major' | 'routine' | 'planned' | 'sudden';

export interface Y320RepairRow {
  id: string;
  section: string;
  enteredRepairDate: string;
  leftRepairDate: string;
  shift: string;
  repairStartTime: string;
  repairEndTime: string;
  toolReceivedTime: string;
  partsReceivedTime: string;
  affectedProduction: string;
  shiftNumber: string;
  repairType: Y320RepairType;
  damageCondition: string;
  damageCause: string;
  repairWorkDone: string;
  performerName: string;
  performerPosition: string;
  performerManHours: string;
  receiverName: string;
  receiverPosition: string;
  totalDuration: string;
  workerCount: string;
}

export function emptyY320Row(shift: string): Y320RepairRow {
  return {
    id: crypto.randomUUID(),
    section: '',
    enteredRepairDate: '',
    leftRepairDate: '',
    shift,
    repairStartTime: '',
    repairEndTime: '',
    toolReceivedTime: '',
    partsReceivedTime: '',
    affectedProduction: '',
    shiftNumber: '',
    repairType: '',
    damageCondition: '',
    damageCause: '',
    repairWorkDone: '',
    performerName: '',
    performerPosition: '',
    performerManHours: '',
    receiverName: '',
    receiverPosition: '',
    totalDuration: '',
    workerCount: '',
  };
}

/**
 * Мөр бодитоор бөглөгдсөн эсэх.
 *
 * `id` нь автоматаар үүсдэг, `shift` нь ээлжийн төрлөөс урьдчилан бөглөгддөг тул
 * хоёуланг нь тооцохгүй. Ингэснээр ЗАСВАР ГАРААГҮЙ ээлжид үлдсэн хоосон мөрийг
 * «бөглөөгүй» гэж үзэж, шалгалтаас алгасна — өмнө нь маягт нэг хоосон мөртэй
 * эхэлж, сүүлийн мөрийг устгах боломжгүй, мөр бүрийн 16 талбар заавал шаардагддаг
 * байсан тул засвар гараагүй ээлжид маягтыг хадгалах арга байгаагүй.
 */
export function y320RowHasData(row: Y320RepairRow): boolean {
  return (Object.keys(row) as (keyof Y320RepairRow)[]).some((key) => {
    if (key === 'id' || key === 'shift') return false;
    return String(row[key] ?? '').trim().length > 0;
  });
}

export interface Y320ElectricalAutomationRepairPayload {
  formVersion: 1;
  stationCode: 'ҮЯ-320';
  shiftDate: string;
  shiftType: string;
  rows: Y320RepairRow[];
  sigHandingOver: string;
  sigReceiving: string;
  submittedAt: string;
  operatorUid: string;
  operatorName: string;
  /** Байгаль орчны хяналт — бүх станцын маягтад нийтлэг хэсэг. */
  environmentChecks: EnvironmentCheckRow[];
}

export function createEmptyY320Payload(partial: {
  shiftDate: string;
  shiftType: string;
  operatorUid: string;
  operatorName: string;
}): Omit<Y320ElectricalAutomationRepairPayload, 'submittedAt'> & { submittedAt?: string } {
  return {
    environmentChecks: createEmptyEnvironmentChecks(),
    formVersion: 1,
    stationCode: 'ҮЯ-320',
    shiftDate: partial.shiftDate,
    shiftType: partial.shiftType,
    rows: [emptyY320Row(partial.shiftType)],
    sigHandingOver: '',
    sigReceiving: '',
    operatorUid: partial.operatorUid,
    operatorName: partial.operatorName,
  };
}
