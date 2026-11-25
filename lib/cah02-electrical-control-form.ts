import { createEmptyEnvironmentChecks, type EnvironmentCheckRow } from './environment-check-form';

/** ЦАХ-02: Цахилгаан автоматжуулалтын хэсгийн ээлж хүлээлцэх хяналтын хуудас
 *  10/0.4кВ ээз станц */

export interface CAH02TimeRow {
  id: string;
  scheduledDay: string;
  scheduledNight: string;
  measuredTime: string;
  lineVoltage: string;
  transformerTempA: string;
  transformerTempB: string;
  transformerTempC: string;
  transformerCurrentInput1: string;
  transformerCurrentInput2: string;
  dieselMotorHours: string;
  dieselOilTemp: string;
  fuel: string;
  mebu1Voltage: string;
  mebu1Current: string;
  mebu1SectionSwitch: string;
  mebu2Voltage: string;
  mebu2Current: string;
  mebu2SectionSwitch: string;
  measuredTime35: string;
  lineVoltage35: string;
  transHighCurrentT1: string;
  transHighCurrentT2: string;
  transHighCurrentWindoor: string;
  transLowCurrentInput1: string;
  transLowCurrentInput2: string;
}

export const CAH02_SCHEDULE: readonly { num: number; day: string; night: string }[] = [
  { num: 1, day: '8:30', night: '20:30' },
  { num: 2, day: '11:30', night: '23:30' },
  { num: 3, day: '14:30', night: '2:30' },
  { num: 4, day: '17:30', night: '5:30' },
  { num: 5, day: '19:30', night: '7:30' },
] as const;

export function emptyCAH02Row(s: typeof CAH02_SCHEDULE[number]): CAH02TimeRow {
  return {
    id: crypto.randomUUID(),
    scheduledDay: s.day,
    scheduledNight: s.night,
    measuredTime: '',
    lineVoltage: '',
    transformerTempA: '',
    transformerTempB: '',
    transformerTempC: '',
    transformerCurrentInput1: '',
    transformerCurrentInput2: '',
    dieselMotorHours: '',
    dieselOilTemp: '',
    fuel: '',
    mebu1Voltage: '',
    mebu1Current: '',
    mebu1SectionSwitch: '',
    mebu2Voltage: '',
    mebu2Current: '',
    mebu2SectionSwitch: '',
    measuredTime35: '',
    lineVoltage35: '',
    transHighCurrentT1: '',
    transHighCurrentT2: '',
    transHighCurrentWindoor: '',
    transLowCurrentInput1: '',
    transLowCurrentInput2: '',
  };
}

/**
 * Хэмжилтийн мөрийг бөглөж эхэлсэн эсэх.
 *
 * `id`, `scheduledDay`, `scheduledNight` нь хуваарийн тогтмол утга тул тооцохгүй.
 *
 * АНХААР — яагаад хэрэгтэй вэ: хүснэгт нь ээлжийн турш хийгдэх 5 хэмжилтийн
 * (8:30 … 19:30) мөрийг ЭХНЭЭС нь бүгдийг үүсгэдэг. Мөр болгоныг заавал шаардвал
 * сүүлийн хэмжилт хийгдтэл юу ч хадгалагдахгүй, нэг ч утга дутвал маягт бүхэлдээ
 * хадгалагдахгүй болно — ээлж дуусгах боломжгүй болно гэсэн үг. Тиймээс зөвхөн
 * бөглөж ЭХЭЛСЭН мөрийг шалгана.
 */
export function cah02RowHasData(row: CAH02TimeRow): boolean {
  return (Object.keys(row) as (keyof CAH02TimeRow)[]).some((key) => {
    if (key === 'id' || key === 'scheduledDay' || key === 'scheduledNight') return false;
    return String(row[key] ?? '').trim().length > 0;
  });
}

export interface CAH02Payload {
  formVersion: 1;
  stationCode: 'ҮЯ-410';
  shiftDate: string;
  shiftType: string;
  rows: CAH02TimeRow[];
  sigHandingOver: string;
  sigReceiving: string;
  attentionNotes: string;
  workPerformed: string;
  submittedAt: string;
  operatorUid: string;
  operatorName: string;
  /** Байгаль орчны хяналт — бүх станцын маягтад нийтлэг хэсэг. */
  environmentChecks: EnvironmentCheckRow[];
}

export type CAH02Draft = Omit<CAH02Payload, 'submittedAt'> & {
  submittedAt?: string;
};

function str(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function hydrateCAH02Rows(incoming: unknown): CAH02TimeRow[] {
  const incomingRows = Array.isArray(incoming) ? incoming : [];

  return CAH02_SCHEDULE.map((schedule, index) => {
    const base = emptyCAH02Row(schedule);
    const saved =
      incomingRows.find(
        (row: any) =>
          row?.scheduledDay === schedule.day &&
          row?.scheduledNight === schedule.night,
      ) ??
      incomingRows[index] ??
      {};

    return {
      ...base,
      id: str((saved as any).id) || base.id,
      scheduledDay: str((saved as any).scheduledDay) || schedule.day,
      scheduledNight: str((saved as any).scheduledNight) || schedule.night,
      measuredTime: str((saved as any).measuredTime),
      lineVoltage: str((saved as any).lineVoltage),
      transformerTempA: str((saved as any).transformerTempA),
      transformerTempB: str((saved as any).transformerTempB),
      transformerTempC: str((saved as any).transformerTempC),
      transformerCurrentInput1: str((saved as any).transformerCurrentInput1),
      transformerCurrentInput2: str((saved as any).transformerCurrentInput2),
      dieselMotorHours: str((saved as any).dieselMotorHours),
      dieselOilTemp: str((saved as any).dieselOilTemp),
      fuel: str((saved as any).fuel),
      mebu1Voltage: str((saved as any).mebu1Voltage),
      mebu1Current: str((saved as any).mebu1Current),
      mebu1SectionSwitch: str((saved as any).mebu1SectionSwitch),
      mebu2Voltage: str((saved as any).mebu2Voltage),
      mebu2Current: str((saved as any).mebu2Current),
      mebu2SectionSwitch: str((saved as any).mebu2SectionSwitch),
      measuredTime35: str((saved as any).measuredTime35),
      lineVoltage35: str((saved as any).lineVoltage35),
      transHighCurrentT1: str((saved as any).transHighCurrentT1),
      transHighCurrentT2: str((saved as any).transHighCurrentT2),
      transHighCurrentWindoor: str((saved as any).transHighCurrentWindoor),
      transLowCurrentInput1: str((saved as any).transLowCurrentInput1),
      transLowCurrentInput2: str((saved as any).transLowCurrentInput2),
    };
  });
}

export function createEmptyCAH02Payload(partial: {
  shiftDate: string;
  shiftType: string;
  operatorUid: string;
  operatorName: string;
}): CAH02Draft {
  return {
    environmentChecks: createEmptyEnvironmentChecks(),
    formVersion: 1,
    stationCode: 'ҮЯ-410',
    shiftDate: partial.shiftDate,
    shiftType: partial.shiftType,
    rows: CAH02_SCHEDULE.map(emptyCAH02Row),
    sigHandingOver: partial.operatorName,
    sigReceiving: '',
    attentionNotes: '',
    workPerformed: '',
    operatorUid: partial.operatorUid,
    operatorName: partial.operatorName,
  };
}

export function normalizeCAH02Payload(
  payload: Partial<CAH02Payload> | null | undefined,
  fallback: {
    shiftDate: string;
    shiftType: string;
    operatorUid: string;
    operatorName: string;
  },
): CAH02Draft {
  const empty = createEmptyCAH02Payload(fallback);
  const p = payload ?? {};

  return {
    ...empty,
    ...p,
    formVersion: 1,
    stationCode: 'ҮЯ-410',
    shiftDate: str(p.shiftDate) || empty.shiftDate,
    shiftType: str(p.shiftType) || empty.shiftType,
    rows: hydrateCAH02Rows(p.rows),
    sigHandingOver: str(p.sigHandingOver) || empty.sigHandingOver,
    sigReceiving: str(p.sigReceiving),
    attentionNotes: str(p.attentionNotes),
    workPerformed: str(p.workPerformed),
    operatorUid: str(p.operatorUid) || empty.operatorUid,
    operatorName: str(p.operatorName) || empty.operatorName,
    submittedAt: p.submittedAt,
  };
}
