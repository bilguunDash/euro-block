import { createEmptyEnvironmentChecks, type EnvironmentCheckRow } from './environment-check-form';

/** ҮЯ-120: Шохойн тээрмийн оператор — ээлж хүлээлцэх бүртгэл (Excel хувилбар 2) */

export type Y120NormStatus = '' | 'normal' | 'abnormal';

export interface Y120InspectionRow {
  key: string;
  label: string;
  status: Y120NormStatus;
  comment: string;
}

export interface Y120MilledMaterialRow {
  key: string;
  label: string;
  unit: string;
  total: string;
}

export interface Y120LimeMillHandoverPayload {
  formVersion: 2;
  stationCode: 'ҮЯ-120';
  shiftDate: string;
  shiftType: string;
  inspections: Y120InspectionRow[];
  hseInfo: string;
  equipmentInfo: string;
  workplaceTidiness: { status: Y120NormStatus; comment: string };
  milledMaterials: Y120MilledMaterialRow[];
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

export const Y120_INSPECTION_LABELS: { key: string; label: string }[] = [
  { key: 'i1', label: 'Конвейрийн ажиллагаа /гадна/' },
  { key: 'i2', label: 'Конвейрийн ажиллагаа /дотор/' },
  { key: 'i3', label: 'Бутлуурын ажиллагаа' },
  { key: 'i4', label: 'Элеваторын ажиллагаа' },
  { key: 'i5', label: 'Тээрмийн ажиллагаа' },
  { key: 'i6', label: 'Шурган голын ажиллагаа' },
  { key: 'i7', label: 'Салхилуурын ажиллагаа' },
  { key: 'i8', label: 'Цахилгаан хөдөлгүүрүүдийн ажиллагаа /халалт/' },
  { key: 'i9', label: 'Хийн компрессорын ажиллагаа' },
  { key: 'i10', label: 'Тосолгоо, үйлчилгээ' },
  { key: 'i11', label: 'Ангижруулагчийн ажиллагаа' },
  { key: 'i12', label: 'Удирдлагын самбар, компьютер дагалдах хэрэгсэл' },
];

export const Y120_MILLED_MATERIAL_LABELS: { key: string; label: string; unit: string }[] = [
  { key: 'm1', label: 'Цамхагийн силос / Гөлтгөнө/', unit: '%' },
  { key: 'm2', label: 'Цамхагийн силос / Шохой/', unit: '%' },
  { key: 'm3', label: 'Тээрмийн силос / Гөлтгөнө/', unit: '%' },
  { key: 'm4', label: 'Тээрмийн силос / Шохой-1/', unit: '%' },
  { key: 'm5', label: 'Тээрмийн силос / Шохой-2/', unit: '%' },
];

export function createEmptyY120Payload(partial: {
  shiftDate: string;
  shiftType: string;
  operatorUid: string;
  operatorName: string;
}): Omit<Y120LimeMillHandoverPayload, 'submittedAt'> & { submittedAt?: string } {
  return {
    environmentChecks: createEmptyEnvironmentChecks(),
    formVersion: 2,
    stationCode: 'ҮЯ-120',
    shiftDate: partial.shiftDate,
    shiftType: partial.shiftType,
    inspections: Y120_INSPECTION_LABELS.map(({ key, label }) => ({
      key,
      label,
      status: '',
      comment: '',
    })),
    hseInfo: '',
    equipmentInfo: '',
    workplaceTidiness: { status: '', comment: '' },
    milledMaterials: Y120_MILLED_MATERIAL_LABELS.map(({ key, label, unit }) => ({
      key,
      label,
      unit,
      total: '',
    })),
    shiftNotes: '',
    sigHandingOver: '',
    sigReceiving: '',
    sigShiftMaster: '',
    operatorUid: partial.operatorUid,
    operatorName: partial.operatorName,
  };
}
