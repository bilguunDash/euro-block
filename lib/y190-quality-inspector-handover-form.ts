import { createEmptyEnvironmentChecks, type EnvironmentCheckRow } from './environment-check-form';

/** ҮЯ-190: Чанар шалгагч — ээлж хүлээлцэх бүртгэл (Excel хувилбар 2) */

export type Y190NormStatus = '' | 'normal' | 'abnormal';

export interface Y190InspectionRow {
  key: string;
  label: string;
  status: Y190NormStatus;
  comment: string;
}

export interface Y190ProductSummaryRow {
  key: string;
  label: string;
  unit: string;
  value: string;
  comment: string;
}

export interface Y190QualityInspectorHandoverPayload {
  formVersion: 2;
  stationCode: 'ҮЯ-190';
  shiftDate: string;
  shiftType: string;
  inspections: Y190InspectionRow[];
  hseInfo: string;
  equipmentInfo: string;
  productSummary: Y190ProductSummaryRow[];
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

export const Y190_INSPECTION_LABELS: { key: string; label: string }[] = [
  { key: 'i1', label: 'Компьютер төхөөрөмжийн ажиллагаа' },
  { key: 'i2', label: 'Хамгаалалтын хашаа, хаалга, цоожийн бүрэн бүтэн байдал' },
  { key: 'i3', label: 'Ажлын байрны эмх, цэгц, цэвэрлэгээ' },
  { key: 'i4', label: 'Бүтээгдэхүүний ховил' },
  { key: 'i5', label: 'Бүтээгдэхүүний гар бариул' },
];

export const Y190_PRODUCT_SUMMARY_LABELS: { key: string; label: string; unit: string }[] = [
  { key: 'p1', label: '1-р сорт хэмжээ', unit: 'м³' },
  { key: 'p2', label: '2-р сорт хэмжээ', unit: 'м⁴' },
  { key: 'p3', label: '3-р сорт хэмжээ', unit: 'м⁵' },
  { key: 'p4', label: 'Сортолсон рамын тоо', unit: 'ш' },
];

export function createEmptyY190Payload(partial: {
  shiftDate: string;
  shiftType: string;
  operatorUid: string;
  operatorName: string;
}): Omit<Y190QualityInspectorHandoverPayload, 'submittedAt'> & { submittedAt?: string } {
  return {
    environmentChecks: createEmptyEnvironmentChecks(),
    formVersion: 2,
    stationCode: 'ҮЯ-190',
    shiftDate: partial.shiftDate,
    shiftType: partial.shiftType,
    inspections: Y190_INSPECTION_LABELS.map(({ key, label }) => ({
      key,
      label,
      status: '',
      comment: '',
    })),
    hseInfo: '',
    equipmentInfo: '',
    productSummary: Y190_PRODUCT_SUMMARY_LABELS.map(({ key, label, unit }) => ({
      key,
      label,
      unit,
      value: '',
      comment: '',
    })),
    shiftNotes: '',
    sigHandingOver: partial.operatorName,
    sigReceiving: '',
    sigShiftMaster: '',
    operatorUid: partial.operatorUid,
    operatorName: partial.operatorName,
  };
}
