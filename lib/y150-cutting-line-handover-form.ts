import { createEmptyEnvironmentChecks, type EnvironmentCheckRow } from './environment-check-form';

/** ҮЯ-150: Зүсэх дамжлагын оператор — ээлж хүлээлцэх бүртгэл */

export type Y150NormStatus = '' | 'normal' | 'abnormal';

export interface Y150EquipmentInspectionRow {
  key: string;
  label: string;
  status: Y150NormStatus;
  comment: string;
}

export interface Y150CuttingLogRow {
  id: string;
  moldNumber: string;
  platformNumber: string;
  pouredTime: string;
  cuttingDurationMin: string;
  waitingDurationMin: string;
  castingNumber: string;
  shiftPour: string;
  shiftCut: string;
  widthSize: string;
  comment: string;
}

export interface Y150CuttingLineHandoverPayload {
  formVersion: 1;
  stationCode: 'ҮЯ-150';
  shiftDate: string;
  shiftType: string;
  equipmentInspections: Y150EquipmentInspectionRow[];
  cuttingLog: Y150CuttingLogRow[];
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

export const Y150_CUTTING_ATTENTION =
  'Анхаарах: Бүртгэлийг 3 бүтээгдэхүүн тутамд шалгана.';

/** Эдгээр мөрөнд хэвийн/хэвийн бус байхгүй — зөвхөн тайлбар */
export const Y150_EQUIPMENT_COMMENT_ONLY_KEYS = new Set(['e18', 'e19']);

export const Y150_EQUIPMENT_LABELS: { key: string; label: string }[] = [
  { key: 'e1', label: 'Хазайлгах манипуляторын ажиллагаа' },
  { key: 'e2', label: 'Тээвэрлэх вагоны ажиллагаа' },
  { key: 'e3', label: 'Урьдчилан зүсэгчийн ажиллагаа' },
  { key: 'e4', label: 'Босоо ховил гаргагчийн ажиллагаа' },
  { key: 'e5', label: 'Хэвтээ зүсэгчийн ажиллагаа' },
  { key: 'e6', label: 'Хөндлөн зүсэгчийн ажиллагаа' },
  { key: 'e7', label: 'Вакуум сорогчийн ажиллагаа' },
  { key: 'e8', label: 'Тавцангийн манипуляторын ажиллагаа' },
  { key: 'e9', label: 'Тавцангийн конвейерийн ажиллагаа' },
  { key: 'e10', label: 'Хаягдлын конвейрийн ажиллагаа' },
  { key: 'e11', label: 'Утас тавлагчийн ажиллагаа' },
  { key: 'e12', label: 'Зүсэх худгийн сэнсний ажиллагаа' },
  { key: 'e13', label: 'Зүсэх худгийн насосны ажиллагаа' },
  { key: 'e14', label: 'Хийн даралт' },
  { key: 'e15', label: 'Лазер мэдрэгчүүдийн ажиллагаа' },
  { key: 'e16', label: 'Удирдлагын самбар, хамгаалалтын цоож' },
  { key: 'e17', label: 'Хамгаалалтын хашаа, хаалга, цоожийн бүрэн бүтэн байдал ' },
  { key: 'e18', label: 'ХАБЭА тухай мэдээлэл, санал' },
  { key: 'e19', label: 'Тоног төхөөрөмжийн мэдээлэл, санал' },
  { key: 'e20', label: 'Ажлын байрны эмх цэгц, цэвэрлэгээ' },
];

export function newCuttingRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `y150_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function emptyCuttingLogRow(): Y150CuttingLogRow {
  return {
    id: newCuttingRowId(),
    moldNumber: '',
    platformNumber: '',
    pouredTime: '',
    cuttingDurationMin: '',
    waitingDurationMin: '',
    castingNumber: '',
    shiftPour: '',
    shiftCut: '',
    widthSize: '',
    comment: '',
  };
}

export function createEmptyY150Payload(partial: {
  shiftDate: string;
  shiftType: string;
  operatorUid: string;
  operatorName: string;
}): Omit<Y150CuttingLineHandoverPayload, 'submittedAt'> & { submittedAt?: string } {
  return {
    environmentChecks: createEmptyEnvironmentChecks(),
    formVersion: 1,
    stationCode: 'ҮЯ-150',
    shiftDate: partial.shiftDate,
    shiftType: partial.shiftType,
    equipmentInspections: Y150_EQUIPMENT_LABELS.map(({ key, label }) => ({
      key,
      label,
      status: '',
      comment: '',
    })),
    cuttingLog: [emptyCuttingLogRow()],
    shiftNotes: '',
    sigHandingOver: partial.operatorName,
    sigReceiving: '',
    sigShiftMaster: '',
    operatorUid: partial.operatorUid,
    operatorName: partial.operatorName,
  };
}
