import { createEmptyEnvironmentChecks, type EnvironmentCheckRow } from './environment-check-form';

/** Бүтээгдэхүүний орц найрлага өөрчилсөн бүртгэл (Mongo: stationCode ОНБ) */

export interface IngredientChangeRecordRow {
  key: string;
  label: string;
  originalValue: string;
  changedValue: string;
}

export interface IngredientChangeRecordPayload {
  formVersion: 1;
  stationCode: 'ОНБ';
  shiftDate: string;
  shiftType: string;
  rows: IngredientChangeRecordRow[];
  explanation: string;
  sigOperator: string;
  sigTechnologistEngineer: string;
  sigChiefTechnologist: string;
  sigQualitySpecialist: string;
  submittedAt: string;
  operatorUid: string;
  operatorName: string;
  /** Байгаль орчны хяналт — бүх станцын маягтад нийтлэг хэсэг. */
  environmentChecks: EnvironmentCheckRow[];
}

export const INGREDIENT_CHANGE_ATTENTION =
  'Анхаарах: Бат бэх, нягт, бэлэн бүтээгдэхүүний төлөв байдлыг орц найрлага өөрчилснөөс хойших бэлэн бүтээгдэхүүн гарсны дараа тэмдэглэх ба 10 хүртэлх дээжийн дунджаар бичнэ. Цутгалт болон үйлдвэрлэлийн процесст нөлөөлсөн бусад хүчин зүйл, орц найрлага өөрчилсөн шалтгааны талаар тайлбар хэсэгт бичиж болно.';

export const INGREDIENT_CHANGE_ROW_DEFS: { key: string; label: string }[] = [
  { key: 'ic1', label: 'Шохой' },
  { key: 'ic2', label: 'Гөлтгөнө' },
  { key: 'ic3', label: 'Цемент' },
  { key: 'ic4', label: 'Хөнгөн цагаан (HAP2)' },
  { key: 'ic5', label: 'Хөнгөн цагаан (RA30)' },
  { key: 'ic6', label: 'Ус' },
  { key: 'ic7', label: 'Ус хатуугийн харьцаа' },
  { key: 'ic8', label: 'Шинэ зутангийн хатуу хэсэг' },
  { key: 'ic9', label: 'Буцах зутангийн хатуу хэсэг' },
  { key: 'ic10', label: 'Тархалт' },
  { key: 'ic11', label: 'Цутгалтын температур' },
  { key: 'ic12', label: 'Хөөлгөхөөс гарсан хугацаа' },
  { key: 'ic13', label: 'Бат бэх' },
  { key: 'ic14', label: 'Нягт' },
  { key: 'ic15', label: 'Бэлэн бүтээгдэхүүний төлөв' },
];

export function createEmptyIngredientChangeRecordPayload(partial: {
  shiftDate: string;
  shiftType: string;
  operatorUid: string;
  operatorName: string;
}): Omit<IngredientChangeRecordPayload, 'submittedAt'> & { submittedAt?: string } {
  return {
    environmentChecks: createEmptyEnvironmentChecks(),
    formVersion: 1,
    stationCode: 'ОНБ',
    shiftDate: partial.shiftDate,
    shiftType: partial.shiftType,
    rows: INGREDIENT_CHANGE_ROW_DEFS.map((d) => ({
      ...d,
      originalValue: '',
      changedValue: '',
    })),
    explanation: '',
    sigOperator: '',
    sigTechnologistEngineer: '',
    sigChiefTechnologist: '',
    sigQualitySpecialist: '',
    operatorUid: partial.operatorUid,
    operatorName: partial.operatorName,
  };
}
