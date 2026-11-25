import { createEmptyEnvironmentChecks, type EnvironmentCheckRow } from './environment-check-form';

/** ҮЯ-140: Хэв эргэлтийн оператор — ээлж хүлээлцэх бүртгэл (Excel хувилбар 2) */

export type Y140NormStatus = '' | 'normal' | 'abnormal';

export interface Y140EquipmentInspectionRow {
  key: string;
  label: string;
  status: Y140NormStatus;
  comment: string;
}

/** Цутгалтын бүртгэл — мөрийг динамикаар нэмнэ */
export interface Y140CastingLogRow {
  id: string;
  moldNumber: string;
  platformNumber: string;
  castingNumber: string;
  curingTime: string;
  temperature: string;
  spread: string;
  density: string;
  shift: string;
  comment: string;
}

export interface Y140MoldRotationHandoverPayload {
  formVersion: 2;
  stationCode: 'ҮЯ-140';
  shiftDate: string;
  shiftType: string;
  equipmentInspections: Y140EquipmentInspectionRow[];
  hseInfo: string;
  equipmentInfo: string;
  platformMaintenanceNote: string;
  moldMaintenanceNote: string;
  castingLog: Y140CastingLogRow[];
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

export const Y140_EQUIPMENT_LABELS: { key: string; label: string }[] = [
  { key: 'e1', label: 'Хөндлөн тэргэнцэрийн ажиллагаа' },
  { key: 'e2', label: 'Хэвний жийрэг, гоожилт' },
  { key: 'e3', label: 'Тосолгооны машины ажиллагаа (HESS)' },
  { key: 'e4', label: 'Тосолгооны машины ажиллагаа (Хятад)' },
  { key: 'e5', label: 'Мэдрэгчүүдийн ажиллагаа' },
  { key: 'e6', label: 'Удирдлагын самбар, хамгаалалтын цоож' },
  { key: 'e7', label: 'Хөөлгөх хэсгийн температур' },
  { key: 'e8', label: 'Лазер мэдрэгчүүд, хамгаалтын цоож, хаалгануудын ажиллагаа' },
  { key: 'e9', label: 'Хийн даралт' },
  { key: 'e10', label: 'Ажлын байрны цэвэрлэгээ, эмх цэгц' },
];

export const Y140_CASTING_ATTENTION =
  'Анхаар: 5 цутгалт бүр дээр бүртгэл хөтөлнө.';

export function newCastingRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function emptyCastingLogRow(shiftType: string): Y140CastingLogRow {
  return {
    id: newCastingRowId(),
    moldNumber: '',
    platformNumber: '',
    castingNumber: '',
    curingTime: '',
    temperature: '',
    spread: '',
    density: '',
    shift: shiftType,
    comment: '',
  };
}

export function createEmptyY140Payload(partial: {
  shiftDate: string;
  shiftType: string;
  operatorUid: string;
  operatorName: string;
}): Omit<Y140MoldRotationHandoverPayload, 'submittedAt'> & { submittedAt?: string } {
  return {
    environmentChecks: createEmptyEnvironmentChecks(),
    formVersion: 2,
    stationCode: 'ҮЯ-140',
    shiftDate: partial.shiftDate,
    shiftType: partial.shiftType,
    equipmentInspections: Y140_EQUIPMENT_LABELS.map(({ key, label }) => ({
      key,
      label,
      status: '',
      comment: '',
    })),
    hseInfo: '',
    equipmentInfo: '',
    platformMaintenanceNote: '',
    moldMaintenanceNote: '',
    castingLog: [emptyCastingLogRow(partial.shiftType)],
    shiftNotes: '',
    sigHandingOver: partial.operatorName,
    sigReceiving: '',
    sigShiftMaster: '',
    operatorUid: partial.operatorUid,
    operatorName: partial.operatorName,
  };
}
