import { createEmptyEnvironmentChecks, type EnvironmentCheckRow } from './environment-check-form';

/** ҮЯ-170: Савлах төхөөрөмжийн операторын бүртгэл (Excel загвар) */

export type Y170PackingNormStatus = '' | 'normal' | 'abnormal';

export interface Y170PackingEquipmentRow {
  key: string;
  label: string;
  status: Y170PackingNormStatus;
  comment: string;
}

export interface Y170PackingOperatorPayload {
  formVersion: 1;
  stationCode: 'ҮЯ-170';
  shiftDate: string;
  shiftType: string;
  equipmentInspections: Y170PackingEquipmentRow[];
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

/** Зөвхөн тайлбар бүхий мөрүүд (Excel дээр +/- багана бөглөхгүй) */
export const Y170_PACKING_COMMENT_ONLY_KEYS = new Set(['e12', 'e13', 'e14']);

export const Y170_PACKING_EQUIPMENT_LABELS: { key: string; label: string }[] = [
  { key: 'e1', label: 'Хазайлгах төхөөрөмжийн ажиллагаа' },
  { key: 'e2', label: 'Гинжин дамжууурга' },
  { key: 'e3', label: 'Мэдрэгчүүдийн ажиллагаа' },
  { key: 'e4', label: 'Уутлах машины ажиллагаа' },
  { key: 'e5', label: 'Конвейрийн редукторын ажиллагаа' },
  { key: 'e6', label: 'Өдөр тутмын тосолгоо, үйлчилгээ' },
  { key: 'e7', label: 'Подон тавих төхөөрөмжийн ажиллагаа' },
  { key: 'e8', label: 'Хий даралт' },
  { key: 'e9', label: 'Удирдлагын самбарын ажиллагаа' },
  { key: 'e10', label: 'Подоны эмх цэгц' },
  { key: 'e11', label: 'Хамгаалалтын хашаа, хаалга, цоожийн бүрэн бүтэн байдал' },
  { key: 'e12', label: 'ХАБЭА тухай мэдээлэл, санал' },
  { key: 'e13', label: 'Тоног төхөөрөмжийн мэдээлэл, санал' },
  { key: 'e14', label: 'Тавангийн цэвэрлэгээ, ш' },
  { key: 'e15', label: 'Ажлын байрны, эмх цэгц, цэвэрлэгээ' },
];

export function createEmptyY170PackingPayload(partial: {
  shiftDate: string;
  shiftType: string;
  operatorUid: string;
  operatorName: string;
}): Omit<Y170PackingOperatorPayload, 'submittedAt'> & { submittedAt?: string } {
  return {
    environmentChecks: createEmptyEnvironmentChecks(),
    formVersion: 1,
    stationCode: 'ҮЯ-170',
    shiftDate: partial.shiftDate,
    shiftType: partial.shiftType,
    equipmentInspections: Y170_PACKING_EQUIPMENT_LABELS.map(({ key, label }) => ({
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

