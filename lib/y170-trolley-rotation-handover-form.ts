import { createEmptyEnvironmentChecks, type EnvironmentCheckRow } from './environment-check-form';

/** ҮЯ-161: Тэргэнцэр эргэлтийн операторын бүртгэл (Excel загвар) */

export type Y170NormStatus = '' | 'normal' | 'abnormal';

export interface Y170EquipmentInspectionRow {
  key: string;
  label: string;
  status: Y170NormStatus;
  comment: string;
}

export interface Y170ProductLogRow {
  id: string;
  castingNumber: string;
  shiftPour: string;
  shiftCut: string;
  frameNumber: string;
  size600x250: string;
  status: Y170NormStatus;
  comment: string;
}

export interface Y170TrolleyRotationHandoverPayload {
  formVersion: 1;
  stationCode: 'ҮЯ-161';
  shiftDate: string;
  shiftType: string;
  equipmentInspections: Y170EquipmentInspectionRow[];
  productLog: Y170ProductLogRow[];
  shiftNotes: string;
  sigHandingOver: string;
  sigReceiving: string;
  sigShiftMaster: string;
  submittedAt: string;
  operatorUid: string;
  operatorName: string;
  /** Байгаль орчны хяналт — бүх станцын маягтад нийтлэг хэсэг. */
  environmentChecks: EnvironmentCheckRow[];
}

export const Y170_PRODUCT_ATTENTION = 'Анхаарах: Бүртгэлийг 3 бүтээгдэхүүн тутамд шалгана.';

/** Зөвхөн тайлбар бүхий мөрүүд */
export const Y170_EQUIPMENT_COMMENT_ONLY_KEYS = new Set(['e5', 'e6']);

export const Y170_EQUIPMENT_LABELS: { key: string; label: string }[] = [
  { key: 'e1', label: 'Хамгаалалтын хашаа, хаалга, цоожийн бүрэн бүтэн байдал' },
  { key: 'e2', label: 'Рам тослох тосолгооны машин' },
  { key: 'e3', label: 'Тосолгооны машины тосны түвшин' },
  { key: 'e4', label: 'Ажлын байрны эмх, цэгц, цэвэрлэгээ' },
  { key: 'e5', label: 'Тоног төхөөрөмжийн мэдээлэл, санал' },
  { key: 'e6', label: 'ХАБЭА тухай мэдээлэл, санал' },
];

export function newProductRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `y170_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function emptyProductLogRow(): Y170ProductLogRow {
  return {
    id: newProductRowId(),
    castingNumber: '',
    shiftPour: '',
    shiftCut: '',
    frameNumber: '',
    size600x250: '',
    status: '',
    comment: '',
  };
}

export function createEmptyY170Payload(partial: {
  shiftDate: string;
  shiftType: string;
  operatorUid: string;
  operatorName: string;
}): Omit<Y170TrolleyRotationHandoverPayload, 'submittedAt'> & { submittedAt?: string } {
  return {
    environmentChecks: createEmptyEnvironmentChecks(),
    formVersion: 1,
    stationCode: 'ҮЯ-161',
    shiftDate: partial.shiftDate,
    shiftType: partial.shiftType,
    equipmentInspections: Y170_EQUIPMENT_LABELS.map(({ key, label }) => ({
      key,
      label,
      status: '',
      comment: '',
    })),
    productLog: [emptyProductLogRow()],
    shiftNotes: '',
    sigHandingOver: partial.operatorName,
    sigReceiving: '',
    sigShiftMaster: '',
    operatorUid: partial.operatorUid,
    operatorName: partial.operatorName,
  };
}
