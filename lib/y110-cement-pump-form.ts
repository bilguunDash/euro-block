import { createEmptyEnvironmentChecks, type EnvironmentCheckRow } from './environment-check-form';

/** ҮЯ-110: Цемент шахах төхөөрөмжийн оператор — ээлж эхлэх үзлэг / хүлээлцэх (Excel хувилбар 2) */

export type Y110NormStatus = '' | 'normal' | 'abnormal';

export interface Y110CompressorRow {
  key: string;
  label: string;
  status: Y110NormStatus;
  comment: string;
}

export interface Y110SiloRow {
  key: string;
  label: string;
  percent: string;
  comment: string;
}

export interface Y110StatusCommentRow {
  key: string;
  label: string;
  status: Y110NormStatus;
  comment: string;
}

export interface Y110CementPumpStartPayload {
  formVersion: 2;
  stationCode: 'ҮЯ-110';
  shiftDate: string;
  shiftType: string;
  compressors: Y110CompressorRow[];
  silos: Y110SiloRow[];
  pipeline: { status: Y110NormStatus; comment: string };
  airPressure: { status: Y110NormStatus; comment: string };
  lubrication: { status: Y110NormStatus; comment: string };
  hseInfo: string;
  hseComment: string;
  equipmentInfo: string;
  equipmentComment: string;
  workplaceTidiness: { status: Y110NormStatus; comment: string };
  rawCementUnloadTons: string;
  rawWagonCleaningCount: string;
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

export const Y110_COMPRESSOR_LABELS: { key: string; label: string }[] = [
  { key: 'c1', label: 'Компрессор-1 (цамхагт цемент шахах) ажиллагаа' },
  { key: 'c2', label: 'Компрессор-2 (цемент буулгах урд) ажиллагаа' },
  { key: 'c3', label: 'Компрессор-3 (цемент буулгах хойд) ажиллагаа' },
  { key: 'c4', label: 'Компрессор-4 (700тн-цемент) ажиллагаа' },
  { key: 'c5', label: 'Компрессор-5 (700тн-шохой) ажиллагаа' },
];

export const Y110_SILO_LABELS: { key: string; label: string }[] = [
  { key: 's1', label: '1-р сило хэмжээ (500тн) — Хэмжээ, %' },
  { key: 's2', label: '2-р сило хэмжээ (500тн) — Хэмжээ, %' },
  { key: 's3', label: 'Цементийн сило хэмжээ (700тн) — Хэмжээ, %' },
  { key: 's4', label: 'Шохойн сило хэмжээ (700тн) — Хэмжээ, %' },
];

export function createEmptyY110Payload(partial: {
  shiftDate: string;
  shiftType: string;
  operatorUid: string;
  operatorName: string;
}): Omit<Y110CementPumpStartPayload, 'submittedAt'> & { submittedAt?: string } {
  return {
    environmentChecks: createEmptyEnvironmentChecks(),
    formVersion: 2,
    stationCode: 'ҮЯ-110',
    shiftDate: partial.shiftDate,
    shiftType: partial.shiftType,
    compressors: Y110_COMPRESSOR_LABELS.map(({ key, label }) => ({
      key,
      label,
      status: '',
      comment: '',
    })),
    silos: Y110_SILO_LABELS.map(({ key, label }) => ({
      key,
      label,
      percent: '',
      comment: '',
    })),
    pipeline: { status: '', comment: '' },
    airPressure: { status: '', comment: '' },
    lubrication: { status: '', comment: '' },
    hseInfo: '',
    hseComment: '',
    equipmentInfo: '',
    equipmentComment: '',
    workplaceTidiness: { status: '', comment: '' },
    rawCementUnloadTons: '',
    rawWagonCleaningCount: '',
    shiftNotes: '',
    sigHandingOver: '',
    sigReceiving: '',
    sigShiftMaster: '',
    operatorUid: partial.operatorUid,
    operatorName: partial.operatorName,
  };
}
