import { createEmptyEnvironmentChecks, type EnvironmentCheckRow } from './environment-check-form';

/** ҮЯ-160: Рам эргэлтийн оператор — ээлж хүлээлцэх / тоногийн бүртгэл */

export type Y160NormStatus = '' | 'normal' | 'abnormal';

export interface Y160EquipmentInspectionRow {
  key: string;
  label: string;
  status: Y160NormStatus;
  comment: string;
}

export interface Y160RamRotationHandoverPayload {
  formVersion: 1;
  stationCode: 'ҮЯ-160';
  shiftDate: string;
  shiftType: string;
  equipmentInspections: Y160EquipmentInspectionRow[];
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

/** Мөр 18, 19: зөвхөн тайлбар (хэвийн/хэвийн бусгүй) */
export const Y160_EQUIPMENT_COMMENT_ONLY_KEYS = new Set(['e18', 'e19']);

/** Excel «ҮЯ-160: Рам эргэлтийн операторын бүртгэл» хүснэгттэй ижил нэршил */
export const Y160_EQUIPMENT_LABELS: { key: string; label: string }[] = [
  { key: 'e1', label: 'Буулгах манипулятор' },
  { key: 'e2', label: 'Рам тослох тосолгооны машин' },
  { key: 'e3', label: 'Тосолгооны машины тосны түвшин' },
  { key: 'e4', label: 'Хазайлгах тавцан' },
  { key: 'e5', label: 'Ялуу зүсэгч' },
  { key: 'e6', label: 'Бүтээгдэхүүн салгах төхөөрөмж' },
  { key: 'e7', label: 'Хөндлөн конвейр' },
  { key: 'e8', label: 'Олон үйлдэлт манипулятор' },
  { key: 'e9', label: '1-5 замын үрэлтэт дугуй' },
  { key: 'e10', label: 'U1-U5 замын конвейер' },
  { key: 'e11', label: 'Рам цэвэрлэх төхөөрөмж' },
  { key: 'e12', label: 'Блок болон тосны хаягдлын банкны түвшин' },
  { key: 'e13', label: 'Хийн даралт' },
  { key: 'e14', label: 'Гидравликийн банк, даралт, түвшин' },
  { key: 'e15', label: 'Лазер мэдрэгчүүд' },
  { key: 'e16', label: 'Удирдлагын самбар' },
  { key: 'e17', label: 'Хамгаалалтын хашаа, хаалга, цоожийн бүрэн бүтэн байдал' },
  { key: 'e18', label: 'Тоног төхөөрөмжийн мэдээлэл, санал' },
  { key: 'e19', label: 'ХАБЭА тухай мэдээлэл, санал' },
  { key: 'e20', label: 'Ажлын байрны эмх, цэгц, цэвэрлэгээ' },
];

export function createEmptyY160Payload(partial: {
  shiftDate: string;
  shiftType: string;
  operatorUid: string;
  operatorName: string;
}): Omit<Y160RamRotationHandoverPayload, 'submittedAt'> & { submittedAt?: string } {
  return {
    environmentChecks: createEmptyEnvironmentChecks(),
    formVersion: 1,
    stationCode: 'ҮЯ-160',
    shiftDate: partial.shiftDate,
    shiftType: partial.shiftType,
    equipmentInspections: Y160_EQUIPMENT_LABELS.map(({ key, label }) => ({
      key,
      label,
      status: '',
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
