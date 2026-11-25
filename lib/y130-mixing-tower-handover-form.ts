import { createEmptyEnvironmentChecks, type EnvironmentCheckRow } from './environment-check-form';

/** ҮЯ-130: Зуурах цамхагийн оператор — ээлж хүлээлцэх бүртгэл (Excel хувилбар 2) */

export type Y130NormStatus = '' | 'normal' | 'abnormal';

export interface Y130IndicatorRow {
  key: string;
  label: string;
  unit: string;
  value: string;
}

export interface Y130EquipmentInspectionRow {
  key: string;
  label: string;
  status: Y130NormStatus;
  comment: string;
}

export interface Y130MixingTowerHandoverPayload {
  formVersion: 2;
  stationCode: 'ҮЯ-130';
  shiftDate: string;
  shiftType: string;
  indicators: Y130IndicatorRow[];
  equipmentInspections: Y130EquipmentInspectionRow[];
  hseInfo: string;
  equipmentInfo: string;
  /** Хуучин баримтад байхгүй байж болно */
  workplaceCleaning?: {
    status: Y130NormStatus;
    comment: string;
  };
  /** Хуучин хадгалалт (textarea) — зөвхөн унших */
  workplaceCleaningNote?: string;
  shiftNotes: string;
  ingredientChangeNote: string;
  sigHandingOver: string;
  sigReceiving: string;
  sigShiftMaster: string;
  submittedAt: string;
  operatorUid: string;
  operatorName: string;
  /** Байгаль орчны хяналт — бүх станцын маягтад нийтлэг хэсэг. */
  environmentChecks: EnvironmentCheckRow[];
}

/** Мөр 8–18: хувь (%) — илгээхээс өмнө 0–100 шалгана */
export const Y130_PERCENT_INDICATOR_KEYS = new Set([
  'i8',
  'i9',
  'i10',
  'i11',
  'i12',
  'i13',
  'i14',
  'i15',
  'i16',
  'i17',
  'i18',
]);

export const Y130_INDICATOR_DEFS: { key: string; label: string; unit: string }[] = [
  { key: 'i1', label: 'Нийт цутгалт', unit: 'ш' },
  { key: 'i2', label: 'Цутгалтын хугацаа', unit: 'мин' },
  { key: 'i3', label: 'Эхэн үеийн бэхжилт', unit: 'мин' },
  { key: 'i4', label: 'Тархалт', unit: 'см' },
  { key: 'i5', label: 'Цутгалтын температур', unit: '°C' },
  { key: 'i6', label: 'Шинэ зутангийн нягт', unit: 'кг/м3' },
  { key: 'i7', label: 'Буцах зутангийн нягт', unit: 'кг/м3' },
  { key: 'i8', label: 'Ш/зутангийн танк 1', unit: '%' },
  { key: 'i9', label: 'Ш/зутангийн танк 2', unit: '%' },
  { key: 'i10', label: 'Б/зутангийн танк 1', unit: '%' },
  { key: 'i11', label: 'Б/зутангийн танк 2', unit: '%' },
  { key: 'i12', label: 'Цемент сило 1', unit: '%' },
  { key: 'i13', label: 'Цемент сило 2', unit: '%' },
  { key: 'i14', label: 'Шохой сило', unit: '%' },
  { key: 'i15', label: 'Гөлтгөнө сило', unit: '%' },
  { key: 'i16', label: 'Цамхагийн худаг', unit: '%' },
  { key: 'i17', label: 'Зүсэхийн худаг', unit: '%' },
  { key: 'i18', label: 'Аваарын худаг', unit: '%' },
];

export const Y130_EQUIPMENT_LABELS: { key: string; label: string }[] = [
  { key: 'e1', label: 'Тугнууруудын ажиллагаа' },
  { key: 'e2', label: 'Холигчийн ажиллагаа' },
  { key: 'e3', label: 'Шинэ, буцах зутангийн танкны ажиллагаа' },
  { key: 'e4', label: 'Фильтрүүдийн ажиллагаа' },
  { key: 'e5', label: 'Хийн даралт' },
  { key: 'e6', label: 'Хөдөлгүүрүүдийн ажиллагаа, халалт' },
  { key: 'e7', label: 'Мэдрэгчүүдийн ажиллагаа' },
  { key: 'e8', label: 'Компьютер, принтер ажиллагаа' },
  { key: 'e9', label: 'Силоснуудын ажиллагаа' },
  { key: 'e10', label: 'Насосуудын ажиллагаа' },
  { key: 'e11', label: 'Худагнуудын ажиллагаа' },
];

export function createEmptyY130Payload(partial: {
  shiftDate: string;
  shiftType: string;
  operatorUid: string;
  operatorName: string;
}): Omit<Y130MixingTowerHandoverPayload, 'submittedAt'> & { submittedAt?: string } {
  return {
    environmentChecks: createEmptyEnvironmentChecks(),
    formVersion: 2,
    stationCode: 'ҮЯ-130',
    shiftDate: partial.shiftDate,
    shiftType: partial.shiftType,
    indicators: Y130_INDICATOR_DEFS.map((d) => ({ ...d, value: '' })),
    equipmentInspections: Y130_EQUIPMENT_LABELS.map(({ key, label }) => ({
      key,
      label,
      status: '',
      comment: '',
    })),
    hseInfo: '',
    equipmentInfo: '',
    workplaceCleaning: { status: '', comment: '' },
    shiftNotes: '',
    ingredientChangeNote: '',
    sigHandingOver: partial.operatorName,
    sigReceiving: '',
    sigShiftMaster: '',
    operatorUid: partial.operatorUid,
    operatorName: partial.operatorName,
  };
}
