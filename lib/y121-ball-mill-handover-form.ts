import { createEmptyEnvironmentChecks, type EnvironmentCheckRow } from './environment-check-form';

/** ҮЯ-121: Бөмбөлөгт тээрмийн оператор — ээлж хүлээлцэх бүртгэл (Excel хувилбар 2) */

export type Y121NormStatus = '' | 'normal' | 'abnormal';

/** Урсгалын хэмжээ — нэг мөр (Excel-ийн дээжийн мөр) */
export interface Y121FlowMetricsRow {
  key: string;
  label: string;
  /** Ажилласан цаг — эхэлсөн (YYYY-MM-DDTHH:mm, локаль цаг) */
  workingStarted: string;
  /** Ажилласан цаг — зогссон (YYYY-MM-DDTHH:mm) */
  workingStopped: string;
  /** Дээж авсан цаг (YYYY-MM-DDTHH:mm) */
  sampleTime: string;
  /** Гүйдэл, A */
  currentA: string;
  /** Цахилгаан, кВтц */
  electricityKwh: string;
  /** Ус, м³/ц */
  waterM3h: string;
  /** Элс, тн/ц */
  sandTh: string;
  /** Тээрмийн нягт, кг/м³ */
  millDensityKgM3: string;
  /** Цахилгаан, кВтц/тн */
  electricityKwhPerT: string;
}

export type Y121FlowMetricsTotal = Omit<Y121FlowMetricsRow, 'key' | 'label'>;

export interface Y121InspectionRow {
  key: string;
  label: string;
  status: Y121NormStatus;
  comment: string;
}

export interface Y121BallMillHandoverPayload {
  formVersion: 2;
  stationCode: 'ҮЯ-121';
  shiftDate: string;
  shiftType: string;
  flowMetrics: Y121FlowMetricsRow[];
  flowMetricsTotal: Y121FlowMetricsTotal;
  inspections: Y121InspectionRow[];
  equipmentInfo: string;
  hseInfo: string;
  workplaceTidiness: { status: Y121NormStatus; comment: string };
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

export const Y121_FLOW_METRIC_ROW_COUNT = 5;

export const Y121_INSPECTION_LABELS: { key: string; label: string }[] = [
  { key: 'i1', label: 'Конвейерын ажиллагаа' },
  { key: 'i2', label: 'Тосны насосны ажиллагаа' },
  { key: 'i3', label: 'Хөргүүрийн ус өгөлт' },
  { key: 'i4', label: 'Зутангийн насосны ажиллагаа' },
  { key: 'i5', label: 'Тоног төхөөрөмжийг тосолгоо' },
  { key: 'i6', label: 'Ган бөмбөлөг тэжээгүүр' },
  { key: 'i7', label: 'Тоног төхөөрөмжийн халалт' },
  { key: 'i8', label: 'Хийн даралт' },
  { key: 'i9', label: 'Мэдрэгч' },
  { key: 'i10', label: 'Тээрмийн хөдөлгүүр, редуктор, араа' },
  { key: 'i11', label: 'Элс тэжээгүүр' },
  { key: 'i12', label: 'Удирдлагын самбар, хамгаалалтын цоож' },
];

export function emptyMetricsFields(): Y121FlowMetricsTotal {
  return {
    workingStarted: '',
    workingStopped: '',
    sampleTime: '',
    currentA: '',
    electricityKwh: '',
    waterM3h: '',
    sandTh: '',
    millDensityKgM3: '',
    electricityKwhPerT: '',
  };
}

export function createEmptyY121Payload(partial: {
  shiftDate: string;
  shiftType: string;
  operatorUid: string;
  operatorName: string;
}): Omit<Y121BallMillHandoverPayload, 'submittedAt'> & { submittedAt?: string } {
  const flowMetrics: Y121FlowMetricsRow[] = Array.from({ length: Y121_FLOW_METRIC_ROW_COUNT }, (_, i) => ({
    key: `fm${i + 1}`,
    label: `Дээж ${i + 1}`,
    ...emptyMetricsFields(),
  }));

  return {
    environmentChecks: createEmptyEnvironmentChecks(),
    formVersion: 2,
    stationCode: 'ҮЯ-121',
    shiftDate: partial.shiftDate,
    shiftType: partial.shiftType,
    flowMetrics,
    flowMetricsTotal: emptyMetricsFields(),
    inspections: Y121_INSPECTION_LABELS.map(({ key, label }) => ({
      key,
      label,
      status: '',
      comment: '',
    })),
    equipmentInfo: '',
    hseInfo: '',
    workplaceTidiness: { status: '', comment: '' },
    shiftNotes: '',
    sigHandingOver: partial.operatorName,
    sigReceiving: '',
    sigShiftMaster: '',
    operatorUid: partial.operatorUid,
    operatorName: partial.operatorName,
  };
}

const Y121_DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Бөглөхдөө `datetime-local` оролтонд тохируулах (хуучин ISO эсвэл хоосон). */
export function y121ToDatetimeLocalValue(stored: string): string {
  if (!stored?.trim()) return '';
  const s = stored.trim();
  if (Y121_DATETIME_LOCAL.test(s)) return s.slice(0, 16);
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

/** Хадгалсан утгыг унших харагцаанд (жишээ нь 2026.04.07, 14:30). */
export function y121FormatDateTimeDisplay(value: string): string {
  if (!value?.trim()) return '—';
  const s = value.trim();
  if (Y121_DATETIME_LOCAL.test(s)) {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
      return d.toLocaleString('mn-MN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    return new Date(t).toLocaleString('mn-MN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return s;
}

export const Y121_DATETIME_METRIC_FIELDS = ['workingStarted', 'workingStopped', 'sampleTime'] as const;
export type Y121DatetimeMetricField = (typeof Y121_DATETIME_METRIC_FIELDS)[number];

export function y121IsDatetimeMetricField(field: string): field is Y121DatetimeMetricField {
  return (Y121_DATETIME_METRIC_FIELDS as readonly string[]).includes(field);
}
