import type ExcelJS from 'exceljs';
import { createReportSheet, finishReportSheet, reportDate } from './report-excel';

/**
 * ProductionLog-ийг Excel рүү задлах туслах.
 *
 * ЯАГААД ХЭРЭГТЭЙ ВЭ: `/api/reports/kpi`-ийн экспорт нь ээлжийн ТОЙМ мөрийг л
 * гаргадаг байсан — оператор/мастерын бодитоор БӨГЛӨСӨН маягтын агуулга
 * (`production_logs.data`) огт ордоггүй байв. Энэ файл тэр JSON-г хүн уншиж
 * болохуйц хүснэгт болгоно.
 *
 * `data` JSON-ы бүтэц `logType` бүрд өөр (бодит прод өгөгдлөөс 3 хэлбэр илэрсэн):
 *   1. Хавтгай объект        — ж: `modal_mix_logs` {spread, pourTemp, ...}
 *   2. `rows` массив         — ж: `modal_cah02_electrical_control_form` (хэмжилт бүр нэг мөр)
 *   3. `label/value` массив  — ж: `modal_y130_handover_form`.indicators
 * Тиймээс НЭГ хавтгай sheet болгох боломжгүй — төрөл бүрд тусдаа sheet үүсгэнэ.
 */

const TIME_ZONE = 'Asia/Ulaanbaatar';

/** `logType` → sheet-ийн Монгол нэр. Нэрсийг `lib/dispatcher-compliance.ts`-ийн
 *  станц→маягтын шошготой ижил байлгав (тэр нь станцаар түлхүүрлэсэн тул шууд
 *  дахин ашиглах боломжгүй). */
export const LOG_TYPE_LABELS: Record<string, string> = {
  modal_hse_checklist: 'ХАБЭА хяналтын хуудас',
  modal_y110_start_form: 'ҮЯ-110 үндсэн бүртгэл',
  modal_y120_handover_form: 'ҮЯ-120 үндсэн бүртгэл',
  modal_y121_handover_form: 'ҮЯ-121 үндсэн бүртгэл',
  modal_y130_handover_form: 'ҮЯ-130 үндсэн бүртгэл',
  modal_y140_handover_form: 'ҮЯ-140 үндсэн бүртгэл',
  modal_y150_handover_form: 'ҮЯ-150 үндсэн бүртгэл',
  modal_y160_handover_form: 'ҮЯ-160 үндсэн бүртгэл',
  modal_y161_handover_form: 'ҮЯ-161 үндсэн бүртгэл',
  modal_y170_packing_operator_form: 'ҮЯ-170 савлах бүртгэл',
  modal_y170_trolley_rotation_handover_form: 'ҮЯ-170 тэргэнцэр бүртгэл',
  modal_y180_autoclave_operator_form: 'ҮЯ-180 автоклав бүртгэл',
  modal_y181_heat_master_handover_v1: 'ҮЯ-181 дулааны мастер',
  modal_y190_handover_form: 'ҮЯ-190 үндсэн бүртгэл',
  modal_y210_technology_kiln_operator_form: 'ҮЯ-210 үндсэн бүртгэл',
  modal_y099_master_handover_v1: 'ҮЯ-099 мастерын бүртгэл',
  modal_y310_repair_master_form: 'ҮЯ-310 үндсэн бүртгэл',
  modal_y320_electrical_automation_repair_form: 'ҮЯ-320 үндсэн бүртгэл',
  modal_factory_process_control_form: 'ҮЯ-400 процесс хяналт',
  modal_cah02_electrical_control_form: 'ҮЯ-410 үндсэн бүртгэл',
  modal_ingredient_change_record_form: 'Орц найрлагын өөрчлөлт',
  modal_mix_logs: 'Зуурмагийн бүртгэл',
  modal_quality_logs: 'Чанарын бүртгэл',
  modal_periodic_logs: 'Үечилсэн хяналт',
  modal_production_logs: 'Үйлдвэрлэлийн бүртгэл',
  modal_autoclave_logs: 'Автоклавын бүртгэл',
};

/**
 * JSON түлхүүр → баганын Монгол нэр.
 * Ихэнх нь `components/shift/**`-ийн `{ key, label }` тодорхойлолтоос (UI дээр
 * харагддагтай ЯГ ижил) автоматаар цуглуулсан; үлдсэн нь модалын `<label>`-аас.
 * Энд байхгүй түлхүүр англи нэрээрээ үлдэнэ — өгөгдөл хэзээ ч алга болохгүй.
 */
export const FIELD_LABELS: Record<string, string> = {
  // ── Олон маягтад нийтлэг ─────────────────────────────────────────
  sigHandingOver: 'Хүлээлгэн өгсөн',
  sigReceiving: 'Хүлээн авсан',
  sigShiftMaster: 'Хянасан: Ээлжийн мастер',
  sigEngineer: 'Инженер',
  sigMaster: 'Мастер',
  shiftNotes: 'Ээлжийн тэмдэглэл',
  submittedAt: 'Илгээсэн цаг',
  updatedAt: 'Зассан цаг',
  hseInfo: 'ХАБЭА тухай мэдээлэл, санал',
  hseComment: 'ХАБЭА тайлбар',
  equipmentInfo: 'Тоног төхөөрөмжийн мэдээлэл, санал',
  equipmentComment: 'Тоног төхөөрөмжийн тайлбар',
  equipmentInspections: 'Тоног төхөөрөмжийн үзлэг',
  inspections: 'Үзлэг',
  workPerformed: 'Гүйцэтгэсэн ажил',
  attentionNotes: 'Анхаарах зүйл',
  notes: 'Тэмдэглэл',
  remarks: 'Тайлбар',
  comment: 'Тайлбар',
  explanation: 'Тайлбар',
  attachments: 'Хавсралт',
  adminApproved: 'Админ баталсан',
  adminApprovedAt: 'Админ баталсан цаг',
  adminApprovedBy: 'Баталсан админ',
  adminRejected: 'Админ буцаасан',
  adminRejectedAt: 'Админ буцаасан цаг',
  adminRejectedBy: 'Буцаасан админ',
  label: 'Нэр',
  status: 'Төлөв',
  // ── Байгаль орчны хяналт (бүх станцад нийтлэг) ───────────────────
  environmentChecks: 'Байгаль орчны хяналт',
  answer: 'Хариулт',
  // ── ХАБЭА хяналтын хуудас ────────────────────────────────────────
  ppeComplete: 'Хамгаалах хэрэгсэл бүрэн',
  fireSafetyOk: 'Гал түймрийн аюулгүй байдал',
  guardsInPlace: 'Төхөөрөмжийн хамгаалалт',
  workplaceClean: 'Ажлын байрны цэвэрлэгээ',
  hseEngineerNote: 'ХАБ инженерийн тэмдэглэл',
  hseEngineerNoteAt: 'ХАБ инженерийн тэмдэглэлийн цаг',
  hseEngineerNoteByName: 'ХАБ инженер',
  // ── Зуурмаг / чанар (модалын <label>) ────────────────────────────
  pourCount: 'Цутгалтын №',
  risingTime: 'Хөөлт (мин)',
  spread: 'Тархалт',
  pourTemp: 'Темп (°С)',
  freshSlurryDensity: 'Шинэ зутангийн нягт (кг/м3)',
  autoclaveNum: 'Автоклав №',
  poddonNum: 'Поддон №',
  productSize: 'Хэмжээ',
  sort1M3: '1-р сорт м3',
  // ── Үечилсэн хяналт ──────────────────────────────────────────────
  isLate: 'Хоцорсон эсэх',
  logTime: 'Бүртгэлийн цаг',
  processStatus: 'Процессын төлөв',
  // ── ҮЯ-099 / ҮЯ-181 / бусад ─────────────────────────────────────
  masterName: 'Мастер',
  handedOverBy: 'Хүлээлгэн өгсөн',
  receivedBy: 'Хүлээн авсан',
  crewNumber: 'Багийн №',
  report: 'Рапорт',
  totalNote: 'Нийт тэмдэглэл',
  ingredientChangeNote: 'Орц өөрчлөлтийн тэмдэглэл',
  workplaceTidiness: 'Ажлын байрны эмх цэгц, цэвэрлэгээ',
  workplaceCleaning: 'Ажлын байрны эмх цэгц, цэвэрлэгээ',
  // ── Компонентын { key, label }-аас цуглуулсан ───────────────────
  affectedProduction: 'Үйлдвэрийн бүтээлд нөлөөлсөн эсэх',
  airPressure: 'Хийн даралт',
  castingNumber: 'Цутгалтын дугаар',
  changedValue: 'Өөрчилсөн орц',
  curingTime: 'Бэхжсэн хугацаа',
  cuttingDurationMin: 'Зүсэлтийн хугацаа, мин',
  damageCause: 'Эвдрэл гэмтлийн шалтгаан',
  damageCondition: 'Эвдрэл гэмтлийн байдал',
  density: 'Нягт',
  dieselMotorHours: 'Дизель генератор Мото/цаг',
  dieselOilTemp: 'Дизель генератор Тосны температур',
  enteredRepairDate: 'Засварт орсон',
  flow_total: 'Нийт',
  fuel: 'Дизель генератор Түлш',
  furnacePressure: 'Технологийн зуухны даралт /бар/',
  inTrack3: 'Орсон зам-3',
  inTrack4: 'Орсон зам-4',
  leftRepairDate: 'Засвараас гарсан',
  lineVoltage: 'Шугамын хүчдэл',
  lineVoltage35: '35кВ Шугамын хүчдэл',
  lubrication: 'Тосолгоо, үйлчилгээ',
  majorRepair: 'Их засвар',
  measuredTime: 'Хэмжилт авсан цаг',
  measuredTime35: '35кВ Хэмжилт авсан цаг',
  mebu1Current: 'МЕБУ-н секц-1 Гүйдэл',
  mebu1SectionSwitch: 'МЕБУ-н секц-1 Секц холбогч',
  mebu1Voltage: 'МЕБУ-н секц-1 Хүчдэл',
  mebu2Current: 'МЕБУ-н секц-2 Гүйдэл',
  mebu2SectionSwitch: 'МЕБУ-н секц-2 Секц холбогч',
  mebu2Voltage: 'МЕБУ-н секц-2 Хүчдэл',
  moldMaintenanceNote: 'Засвар үйлчилгээ хийх шаардлагатай хэв',
  moldNumber: 'Хэвний дугаар',
  originalValue: 'Орц',
  outTrack1: 'Гарсан зам-1',
  outTrack2: 'Гарсан зам-2',
  partsReceivedTime: 'Сэлбэг хүлээсэн цаг',
  performerManHours: 'Гүйцэтгэсэн - Хүн/цаг',
  performerName: 'Гүйцэтгэсэн - Нэр',
  performerPosition: 'Гүйцэтгэсэн - Албан тушаал',
  pipeline: 'Шугам хоолойн ажиллагаа',
  plannedRepair: 'Төлөвлөгөөт засвар',
  platformMaintenanceNote: 'Засвар үйлчилгээ хийх шаардлагатай тавцан',
  platformNumber: 'Тавцангийн дугаар',
  pouredTime: 'Цутгасан цаг',
  raw_cement_unload: 'Цемент буулгалт /1 вагон 65-75 тн/',
  raw_wagon_cleaning: 'Вагоны цэвэрлэгээ',
  receiverName: 'Хүлээж авсан - Нэр',
  receiverPosition: 'Хүлээж авсан - Албан тушаал',
  repairEndTime: 'Засвар дуусах',
  repairStartTime: 'Засвар эхлэх',
  repairWorkDone: 'Засварын ажлын гүйцэтгэсэн ажил',
  routineRepair: 'Урсгал засвар',
  section: 'Хэсэг',
  shift: 'Ээлж',
  shiftCut: 'Ээлж № (зүссэн)',
  shiftNumber: 'Ээлж №',
  shiftPour: 'Ээлж № (цутгасан)',
  startRoller: 'Роликны хэмжилт (эхлэх)',
  startTime: 'Эхэлсэн цаг',
  steamLinePressure: 'Уурын шугамын даралт /бар/',
  stopRoller: 'Роликны хэмжилт (зогсох)',
  stopTime: 'Зогссон цаг',
  suddenFailure: 'Гэнэтийн эвдрэл',
  temperature: 'Температур',
  toolReceivedTime: 'Багаж хүлээсэн цаг',
  totalDuration: 'Нийт хугацаа',
  totalProductIn: 'Нийт бүтээгдэхүүн - Орсон',
  totalProductOut: 'Нийт бүтээгдэхүүн - Гарсан',
  transHighCurrentT1: 'Трансформаторын өндөр талын гүйдэл T1',
  transHighCurrentT2: 'Трансформаторын өндөр талын гүйдэл T2',
  transHighCurrentWindoor: 'Трансформаторын өндөр талын гүйдэл Виндоор',
  transLowCurrentInput1: 'Трансформаторын нам талын гүйдэл Оруулга-1',
  transLowCurrentInput2: 'Трансформаторын нам талын гүйдэл Оруулга-2',
  transformerCurrentInput1: 'Трансформаторын гүйдэл Оруулга-1',
  transformerCurrentInput2: 'Трансформаторын гүйдэл Оруулга-2',
  transformerTempA: 'Трансформаторын температур A T1/T2',
  transformerTempB: 'Трансформаторын температур B T1/T2',
  transformerTempC: 'Трансформаторын температур C T1/T2',
  waitingDurationMin: 'Хүлээлгийн хугацаа, мин',
  widthSize: 'Өргөний хэмжээ',
  workerCount: 'Ажилласан хүний тоо',
  // ── ҮЯ-121 (`{ field, short, unit }` / `{ k, l }` хэлбэрээс) ────
  currentA: 'Гүйдэл (A)',
  electricityKwh: 'Цахилгаан (кВтц)',
  electricityKwhPerT: 'Цахилгаан (кВтц/тн)',
  millDensityKgM3: 'Тээрмийн нягт (кг/м³)',
  sampleTime: 'Дээжийн цаг',
  sandTh: 'Элс (тн/ц)',
  waterM3h: 'Ус (м³/ц)',
  workingStarted: 'Ажиллаж эхэлсэн',
  workingStopped: 'Зогссон',
  // ── ҮЯ-210 (`lib/y210-technology-kiln-operator-form.ts`-ийн JSDoc) ─
  time: 'Цаг',
  kilnPowerTransmissionPct: 'Зуухны цахилгаан дамжуулах (%)',
  kilnPressureBar: 'Зуухны даралт (бар)',
  kilnLevelPct: 'Зуухны түвшин (%)',
  boosterAmountPct: 'Хүчитгэгчийн хэмжээ (%)',
  screenTempMaxC: 'Экран температур /хамгийн их/ (с)',
  grateCastIronTempMaxC: 'Ул ширмийн температур /хамгийн их/ (с)',
  condensateTank3LevelPct: 'Конденсат танкны №3 хэмжээ (%)',
  condensateTank3TempC: 'Конденсат танкны №3 температур (с)',
  feedWaterToTankTempC: 'Тэжээлийн усны танкруу өгөх усны температур (с)',
  ashDischargeHours: 'Үнс асгасан цаг (цаг)',
  feedWaterBankPressurePct: 'Тэжээлийн усны банкны даралт (%)',
  feedWaterBankLevelPct: 'Тэжээлийн усны банкны түвшин (%)',
  feedWaterBankTempPct: 'Тэжээлийн усны банкны температур (%)',
  stateMeterReadingCondensateM3: 'Төрийн тоолуурын заалт /конденсат/ (м³)',
  kilnWaterReadingM3: 'Зуухны усны заалт (м³)',
  kilnFiringPct: 'Зуухны галлагааны хувь (%)',
  airSupplyPct: 'Агаар өгөх (%)',
  airSuctionPct: 'Агаар сорох (%)',
  saltConsumptionKg: 'Давсны хэрэглээ (кг)',
  kilnOperatingHours: 'Зуухны ажиллаж байгаа цагууд (М/цаг)',
  coalBuckets: 'Нүүрс (шанага)',
  // ── Орчуулсан (UI-д { key, label } хэлбэрээр шууд олдоогүй) ─────
  repairWork: 'Засварын ажил',
  repairEquipment: 'Засварласан тоног төхөөрөмж',
  compressors: 'Компрессор',
  cleaned: 'Цэвэрлэсэн',
  sections: 'Хэсгүүд',
  failureRows: 'Эвдрэл, саатал',
  equipmentRows: 'Тоног төхөөрөмж',
  requirement: 'Шаардлага',
  attendance: 'Ирц',
  // ҮЯ-099 «Ээлжийн ирц» хүснэгтийн баганын нэрс — маягтын толгойтой ижил.
  // Эдгээргүй бол `attendance` нүд "present=10" гэж АНГЛИАР гардаг байв.
  present: 'Ирц',
  coming: 'Ирэх',
  arrived: 'Ирсэн',
  sick: 'Өвчтэй',
  sickNames: 'Өвчтэй - Нэр',
  extra: 'Нэмэлт',
  absent: 'Тасалсан',
  absentNames: 'Тасалсан - Нэр',
  onLeave: 'Чөлөө',
  onLeaveNames: 'Чөлөө - Нэр',
  stopRemarks: 'Зогсолтын тайлбар',
  downtimeInfo: 'Сул зогсолтын мэдээлэл',
  nextShiftInfo: 'Дараагийн ээлжид',
  additionalWork: 'Нэмэлт ажил',
  workplaceInfo: 'Ажлын байрны мэдээлэл',
  heatingRows: 'Халаалт',
  autoclaveRows: 'Автоклав',
  waterSupplyRows: 'Ус хангамж',
  kilnRows: 'Зуух',
  timeRows: 'Цагийн бүртгэл',
  // ── ҮЯ-180 автоклавын ажилбар (MS Forms «Автоклавын операторын бүртгэл»-ийн баганууд) ──
  operationRows: 'Автоклавын ажилбар',
  blockSize: 'Бүтээгдэхүүний хэмжээ',
  loadDirection: 'Оруулсан/гаргасан',
  startedTime: 'Автоклавыг эхлүүлсэн цаг',
  openedTime: 'Автоклавыг онгойлгосон цаг',
  autoclaveCondition: 'Тухайн автоклавын ажиллагаа',
  otherFactors: 'Ажиллагаанд нөлөөлсөн бусад зүйл',
  extraWork: 'Нэмэлт ажил (засвар, цэвэрлэгээ, бусад)',
  recordedBy: 'Бүртгэл хөтөлсөн',
  milledMaterials: 'Тээрэмдсэн материал',
  silos: 'Силос',
  castingLog: 'Цутгалтын бүртгэл',
  cuttingLog: 'Зүсэлтийн бүртгэл',
  flowMetrics: 'Урсгалын үзүүлэлт',
  flowMetricsTotal: 'Урсгалын нийт',
  productSummary: 'Бүтээгдэхүүний нэгтгэл',
  rawCementUnloadTons: 'Цемент буулгалт (тн)',
  rawWagonCleaningCount: 'Вагоны цэвэрлэгээ (тоо)',
  ramNum: 'Рам №',
  pourNum: 'Цутгалтын №',
  value: 'Утга',
  unit: 'Нэгж',
  note: 'Тэмдэглэл',
  description: 'Тайлбар',
  labelMn: 'Нэр',
  statusOk: 'Төлөв',
  nextShiftWork: 'Дараагийн ээлжид хийх ажил',
  equipmentNotes: 'Тоног төхөөрөмжийн тэмдэглэл',
  scheduledDay: 'Хуваарь (өдөр)',
  scheduledNight: 'Хуваарь (шөнө)',
  no: '№',
  leftLabel: 'Түүхий эд',
  prodLabel: 'Бүтээгдэхүүн',
  leftSubRows: 'Түүхий эдийн задаргаа',
  prodSubRows: 'Бүтээгдэхүүний задаргаа',
  // ҮЯ-099 «Бүтээгдэхүүн үйлдвэрлэл» хүснэгтийн 4 багана — маягтын толгойтой ижил
  // байх ёстой (өмнө нь `milled`/`discarded` нь «Тээрэмдсэн»/«Гологдол» гэж гарч,
  // маягт дээрх «Нураасан»/«Хаясан»-тай таарахгүй байв).
  clean: 'Цэвэр',
  dirty: 'Бохир',
  milled: 'Нураасан',
  discarded: 'Хаясан',
  percent: 'Хувь (%)',
  autoclaves: 'Автоклавууд',
  totalM3: 'Нийт м3',
  recordTime: 'Бүртгэсэн цаг',
  pipePressure: 'Шугамын даралт',
  boilerPressure: 'Бойлерын даралт',
};

/**
 * Enum утга — ReadOnly маягтууд (ж: `Y120HandoverFormReadOnly`) харуулдагтай ижил.
 * Прод өгөгдөлд эдгээр утга ЗӨВХӨН `ENUM_KEYS` түлхүүрт л байдаг (шалгасан) —
 * чөлөөт текстэд "normal" гэж бичсэнийг андуурч орчуулахгүйн тулд хязгаарлав.
 */
const ENUM_KEYS = new Set(['status', 'statusOk', 'cleaned']);
const STATUS_VALUE_LABELS: Record<string, string> = {
  normal: 'Хэвийн (+)',
  abnormal: 'Хэвийн бус (−)',
  yes: 'Тийм',
  no: 'Үгүй',
};

/** Нэр болгон ашиглах түлхүүрүүд — нүдэнд "Нэр: ..." хэлбэрээр гарна. */
const TITLE_KEYS = ['label', 'labelMn'] as const;

/**
 * Массивыг БАГАНА болгоход нэр болгож авах түлхүүрүүд.
 *
 * `label`/`labelMn` нь тогтмол хяналтын жагсаалтынх (`*_LABELS`-ээс үүсдэг),
 * `description`/`unit` нь ҮЯ-099-ийн дэд мөрийнх («Цутгалт» / «Ширхэг»).
 * `TITLE_KEYS`-ээс ТУСАД НЬ байгаа шалтгаан: `compactObject`-ийн нүдэн доторх
 * гарчиг хэвээрээ үлдэх ёстой — эс бөгөөс одоо байгаа нүднүүдийн текст өөрчлөгдөнө.
 */
const PIVOT_TITLE_KEYS = ['label', 'labelMn', 'description', 'unit'] as const;

/**
 * Багана болгохгүй түлхүүрүүд:
 *  - ээлжийн контекст баганатай давхардах (`shiftDate`, `operatorName` ...)
 *  - хүнд утгагүй дотоод талбар (`id`, `formVersion`, epoch ms ...)
 * `*Uid` төгсгөлтэй бүх түлхүүр мөн хасагдана (`isNoiseKey`).
 */
const NOISE_KEYS = new Set([
  'id',
  'key',
  'shiftDate',
  'shiftType',
  'stationCode',
  'operatorName',
  'formVersion',
  'createdAt',
  'slotDeadlineMs',
  'labelEn',
  'needsAdminApproval',
  'periodicIntervalHours',
]);

function isNoiseKey(key: string): boolean {
  return NOISE_KEYS.has(key) || /Uid$/.test(key);
}

function labelFor(key: string): string {
  // Different source fields must remain different Excel columns in every record.
  // Тодруулгыг ҮРГЭЛЖ ховор хэрэглэгддэг талбар дээр нь өгнө — маягтад харагддаг
  // талбар (ж: pourCount → «Цутгалтын №») UI-тайгаа ижил нэртэй үлдэх ёстой.
  const distinct: Record<string, string> = {
    remarks: 'Нэмэлт тайлбар', explanation: 'Тайлбар (орц өөрчлөлт)', description: 'Дэлгэрэнгүй тайлбар',
    note: 'Нэмэлт тэмдэглэл', labelMn: 'Монгол нэр', statusOk: 'Хэвийн эсэх',
    sigMaster: 'Мастерын гарын үсэг', sigHandingOver: 'Хүлээлгэн өгсөн (гарын үсэг)',
    sigReceiving: 'Хүлээн авсан (гарын үсэг)', pourNum: 'Цутгалтын № (бүртгэл)',
    workplaceCleaning: 'Ажлын байрны цэвэрлэгээ',
  };
  return distinct[key] || FIELD_LABELS[key] || key;
}

function appendValue(row: FlatRow, label: string, value: string | number) {
  let name = label;
  let suffix = 2;
  while (Object.prototype.hasOwnProperty.call(row, name)) name = `${label} (${suffix++})`;
  row[name] = value;
}

/** Түлхүүрээс хамаарах утгын хөрвүүлэлт (одоогоор зөвхөн enum талбарууд). */
function valueFor(key: string, value: unknown): string | number {
  if (ENUM_KEYS.has(key) && typeof value === 'string' && STATUS_VALUE_LABELS[value]) {
    return STATUS_VALUE_LABELS[value];
  }
  return scalar(value);
}

export type ExportableLog = {
  logType: string;
  createdAt: Date | string;
  data: unknown;
  /** Аль ээлжийнх вэ, хэд дэх хадгалалт вэ — `latestFormVersions`-д хэрэгтэй. */
  shiftId?: string;
  sortOrder?: number;
  shift: {
    shiftDate: string;
    shiftType: string;
    stationCode: string;
    operatorName: string;
  } | null;
};

/**
 * Ээлж тутамд НЭГ маягттай төрлүүд. Маягтыг хадгалах бүрт `production_logs`-д шинэ мөр (хувилбар)
 * нэмэгддэг ч ээлжийн хуудас зөвхөн хамгийн сүүлийнхийг харуулдаг (`app/shift/[id]/page.tsx`,
 * `byType(...).slice(-1)[0]`). Excel ч мөн адил сүүлийн хувилбарыг л гаргана — эс бөгөөс нэг ээлжийн
 * маягт хадгалсан тоогоороо давтагдаж харагдана (ҮЯ-180: 53 «бүртгэл», 258 мөр, 2026-11).
 * Зуурмаг, чанар, үечилсэн хяналт зэрэг ээлжид олон бичигддэг бүртгэлүүд энд ОРОХГҮЙ — бүгд гарна.
 */
export const SINGLE_FORM_LOG_TYPES: ReadonlySet<string> = new Set([
  'modal_hse_checklist',
  'modal_y110_start_form',
  'modal_y099_master_handover_v1',
  'modal_y120_handover_form',
  'modal_y121_handover_form',
  'modal_y130_handover_form',
  'modal_y140_handover_form',
  'modal_y150_handover_form',
  'modal_y160_handover_form',
  'modal_y161_handover_form',
  'modal_y170_packing_operator_form',
  'modal_y180_autoclave_operator_form',
  'modal_y181_heat_master_handover_v1',
  'modal_y190_handover_form',
  'modal_y210_technology_kiln_operator_form',
  'modal_y310_repair_master_form',
  'modal_y320_electrical_automation_repair_form',
  'modal_factory_process_control_form',
  'modal_cah02_electrical_control_form',
  'modal_ingredient_change_record_form',
]);

const versionOf = (log: ExportableLog) => {
  const created = log.createdAt instanceof Date ? log.createdAt.getTime() : Date.parse(String(log.createdAt));
  return [Number.isFinite(log.sortOrder) ? Number(log.sortOrder) : -1, Number.isFinite(created) ? created : 0];
};

/**
 * Ээлж тутамд нэг маягттай төрлүүдээс ээлж бүрийн хамгийн сүүлийн хувилбарыг (хамгийн их
 * `sortOrder`, тэнцвэл хамгийн сүүлд үүссэн) үлдээнэ; бусад бүртгэл, `shiftId`-гүй мөр хэвээр.
 * Эх дарааллыг хадгална.
 */
export function latestFormVersions<T extends ExportableLog>(logs: readonly T[]): T[] {
  const latest = new Map<string, T>();
  for (const log of logs) {
    if (!SINGLE_FORM_LOG_TYPES.has(log.logType) || !log.shiftId) continue;
    const key = `${log.shiftId}|${log.logType}`;
    const current = latest.get(key);
    if (!current) { latest.set(key, log); continue; }
    const [a1, a2] = versionOf(log);
    const [b1, b2] = versionOf(current);
    if (a1 > b1 || (a1 === b1 && a2 > b2)) latest.set(key, log);
  }
  return logs.filter((log) =>
    !SINGLE_FORM_LOG_TYPES.has(log.logType) || !log.shiftId || latest.get(`${log.shiftId}|${log.logType}`) === log);
}

type FlatRow = Record<string, string | number>;

const localDateTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Date → Улаанбаатарын цагаар "YYYY-MM-DD HH:mm". */
function formatLocal(date: Date): string {
  return Number.isFinite(date.getTime()) ? localDateTime.format(date) : '';
}

/** Бүсийн тэмдэгтэй ISO (`...Z`, `+08:00`) — UTC тул орон нутгийн цаг руу хөрвүүлнэ. */
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;
/** Бүсгүй `datetime-local` (`2026-06-30T20:12`) — аль хэдийн орон нутгийн цаг, хөрвүүлэхгүй. */
const ISO_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Аль ч утгыг нэг нүдэнд багтах текст/тоо болгоно. */
function scalar(value: unknown): string | number {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Тийм' : 'Үгүй';
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (ISO_WITH_ZONE.test(value)) return formatLocal(new Date(value));
    if (ISO_LOCAL.test(value)) return value.replace('T', ' ').slice(0, 16);
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        if (!isPlainObject(item)) return String(scalar(item));
        const text = compactObject(item);
        const named = TITLE_KEYS.some((key) => typeof item[key] === 'string' && String(item[key]).trim());
        // Preserve position: the sixth autoclave must still be identifiable as №6.
        return named ? text : `${index + 1}. ${text || '—'}`;
      })
      .filter(Boolean)
      .join('\n');
  }
  if (isPlainObject(value)) return compactObject(value);
  return String(value);
}

/**
 * Нүдэнд багтаах объект: `{label:'Компрессор-1', status:'normal'}` →
 * "Компрессор-1: Төлөв=normal". Хоосон утга, дотоод түлхүүрийг алгасна.
 */
function compactObject(value: Record<string, unknown>): string {
  const titleKey = TITLE_KEYS.find((k) => typeof value[k] === 'string' && String(value[k]).trim());
  const title = titleKey ? String(value[titleKey]).trim() : '';
  const parts = Object.entries(value)
    .filter(
      ([k, v]) =>
        !(TITLE_KEYS as readonly string[]).includes(k) &&
        !isNoiseKey(k) &&
        v !== '' &&
        v !== null &&
        v !== undefined
    )
    .map(([k, v]) => `${labelFor(k)}=${valueFor(k, v)}`);
  if (title) return parts.length ? `${title}: ${parts.join(', ')}` : title;
  return parts.join(', ');
}

/**
 * Массив ДАЯАР нэг л нэрийн түлхүүр сонгоно — мөр БҮРД нь дүүрсэн эхнийхийг.
 *
 * Мөр тус бүрээр сонговол нэг массив дотор багана хоёр янзаар нэрлэгдэнэ: бодит
 * ҮЯ-099-д `description` нь зарим автоклавт бөглөгдсөн, заримд нь үгүй байсан тул
 * «Автоклав (Автоклав-1)» ба «Автоклав-2» гэсэн зөрүүтэй багана үүсэж байв.
 */
function pivotTitleKey(rows: Array<Record<string, unknown>>): string | null {
  for (const key of PIVOT_TITLE_KEYS) {
    if (rows.every((item) => typeof item[key] === 'string' && String(item[key]).trim())) return key;
  }
  return null;
}

/**
 * Мөр бүр нь НЭРТЭЙ массивыг багана болгож эргүүлнэ.
 *
 * ЯАГААД НЭРЭЭР ЯЛГАХ ВЭ: `pickExpandKey` нь НЭГ массивыг л мөр болгож задалдаг,
 * үлдсэн нь ганц нүдэнд шахагдана. Өмнө нь зөвхөн `{label, value}` хэлбэрийг
 * багана болгодог байсан тул ҮЯ-140/150-ийн хяналтын жагсаалт (`equipmentInspections`,
 * payload-д эхэнд тодорхойлогдсон) мөр болж ялаад, оператор бөглөсөн цутгалт/зүсэлтийн
 * бүртгэл ганц нүдэнд шахагддаг байв — Excel дээр хэмжихэд 2810 тэмдэгт нэг нүдэнд орж,
 * мөрийн өндрийн хязгаар (409.6pt) дээр таслагдаж, 10-20 мөрөнд давхардаж хуулагдаж байсан.
 *
 * Өгөгдөл өөрөө хоёрыг ялгаж өгдөг: тогтмол хяналтын жагсаалтын мөр бүр НЭРТЭЙ
 * (`*_LABELS`-ээс үүсдэг), динамик бүртгэлийнх нэргүй (`id`-тай). Нэртэйг нь багана
 * болгосноор шүүх/эрэмбэлэх боломжтой болж, задлах массив нь бодит бүртгэлд үлдэнэ.
 *
 * Багана нэр:
 *   • ганц утгатай талбартай бол  → «Нийт цутгалт (ш)», «Хийн даралт»
 *   • хэд хэдэн талбартай бол     → «Хаалт: Төлөв», «Хаалт: Тайлбар»
 */
function pivotLabelledValues(items: unknown[]): FlatRow | null {
  if (!items.length || !items.every(isPlainObject)) return null;
  const rows = items as Array<Record<string, unknown>>;
  const titleKey = pivotTitleKey(rows);
  if (!titleKey) return null;

  // Талбарын жагсаалтыг БАЙГАА ТҮЛХҮҮРЭЭР (хоосон эсэхийг үл хармаар) массив даяар
  // цуглуулна. Хоосон биш утгаар нь шүүвэл НЭГ маягтын төрөл дотор хуудас бүрд өөр
  // багана үүснэ: бодит ҮЯ-140-ийн 22 маягт бүгд `[status, comment]` бүтэцтэй атал
  // 13 нь «X: Төлөв»+«X: Тайлбар», 8 нь «X», 1 нь огт задраагүй байв.
  // `unit` нь багана НЭРЭНД ороод өөрөө багана болохгүй.
  const fields: string[] = [];
  for (const item of rows) {
    for (const key of Object.keys(item)) {
      if (key === titleKey || key === 'unit' || isNoiseKey(key)) continue;
      if (!fields.includes(key)) fields.push(key);
    }
  }
  if (!fields.length) return null;

  const out: FlatRow = {};
  for (const item of rows) {
    const title = String(item[titleKey]).trim();
    // `unit` өөрөө нэр болсон бол ("Силос/цамхаг/") дахин хашилтанд оруулахгүй.
    const unit = titleKey === 'unit' ? '' : String(item.unit ?? '').trim();
    const header = unit ? `${title} (${unit})` : title;
    for (const field of fields) {
      // `value` нь мөрийн ҮНДСЭН утга — түүнийг нэрээр нь шууд («Нийт цутгалт (ш)»),
      // бусдыг тодруулгатай («Хаалт: Тайлбар») харуулна.
      const solo = fields.length === 1 || field === 'value';
      appendValue(out, solo ? header : `${header}: ${labelFor(field)}`, valueFor(field, item[field]));
    }
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Мөр доторх НЭРГҮЙ объект-массивыг БАЙРЛАЛААР нь багана болгоно.
 *
 * ЯАГААД: ҮЯ-180-ийн цагийн мөр бүр 6 автоклавын 8 үзүүлэлт агуулдаг бөгөөд тэдгээр
 * объект нь нэргүй (`{inTrack3, startTime, ...}`) тул `pivotLabelledValues` барьж
 * чадахгүй. Бодит өгөгдөл дээр нэг нүдэнд 943 тэмдэгт орж, 12/12 мөр Excel-ийн
 * мөрийн өндрийн хязгаарт (409.6pt) таслагдаж байв.
 *
 * Байрлалыг нэрэнд нь хадгална — 6 дахь автоклав «Автоклавууд 6: ...» хэвээр.
 */
function pivotPositional(label: string, items: unknown[]): FlatRow | null {
  if (!items.length || !items.every(isPlainObject)) return null;
  const rows = items as Array<Record<string, unknown>>;

  const fields: string[] = [];
  for (const item of rows) {
    for (const key of Object.keys(item)) {
      if (isNoiseKey(key)) continue;
      if (!fields.includes(key)) fields.push(key);
    }
  }
  // Урт массив баганыг үлэмж олшруулна — тийм тохиолдолд нүдэнд багтаах нь дээр.
  if (!fields.length || rows.length * fields.length > 200) return null;

  const out: FlatRow = {};
  rows.forEach((item, index) => {
    for (const field of fields) {
      appendValue(out, `${label} ${index + 1}: ${labelFor(field)}`, valueFor(field, item[field]));
    }
  });
  return out;
}

/**
 * Мөр болгон задлах массивыг сонгоно: `rows` байвал түүнийг, эс бол эхний объект-массив.
 * Багана болгож эргүүлж болох (мөр бүр нь нэртэй) массивыг алгасна — тиймээс
 * хяналтын жагсаалт биш, оператор бөглөсөн бүртгэл л мөр болж задарна.
 */
function pickExpandKey(data: Record<string, unknown>): string | null {
  const isRowArray = (v: unknown) => Array.isArray(v) && v.length > 0 && v.every(isPlainObject);
  if (isRowArray(data.rows) && !pivotLabelledValues(data.rows as unknown[])) return 'rows';
  for (const [key, value] of Object.entries(data)) {
    if (isNoiseKey(key)) continue;
    if (isRowArray(value) && !pivotLabelledValues(value as unknown[])) return key;
  }
  return null;
}

/**
 * Нэг log-ийн `data`-г 1 буюу хэд хэдэн хавтгай мөр болгоно (баганын нэр нь
 * Монгол шошго). Нэг объект-массивыг мөр тус бүрээр задална; бусад массив нүдэнд
 * багтана (хоёрыг зэрэг задалбал мөрийн тоо үржиж, уншигдахаа болино).
 */
export function flattenLogData(data: unknown): FlatRow[] {
  if (!isPlainObject(data)) return [{ Утга: scalar(data) }];

  const expandKey = pickExpandKey(data);
  const shared: FlatRow = {};

  for (const [key, value] of Object.entries(data)) {
    if (key === expandKey || isNoiseKey(key)) continue;
    if (Array.isArray(value)) {
      const pivoted = pivotLabelledValues(value);
      if (pivoted) {
        for (const [label, val] of Object.entries(pivoted)) appendValue(shared, label, val);
        continue;
      }
    }
    appendValue(shared, labelFor(key), valueFor(key, value));
  }

  if (!expandKey) return [shared];

  const items = data[expandKey] as Array<Record<string, unknown>>;
  return items.map((item, index) => {
    const row: FlatRow = { ...shared, 'Мөр №': index + 1 };
    // Ээлжийн түвшний ижил нэртэй талбараас ялгахын тулд мөрийнхийг «Мөр: ...» болгоно.
    const put = (label: string, value: string | number) =>
      appendValue(row, Object.prototype.hasOwnProperty.call(shared, label) ? `Мөр: ${label}` : label, value);
    for (const [key, value] of Object.entries(item)) {
      if (isNoiseKey(key)) continue;
      // Мөр доторх массив ч мөн багана болно — нэртэй бол нэрээр нь (ҮЯ-099-ийн
      // «Цутгалт (Ширхэг)»), нэргүй бол байрлалаар нь (ҮЯ-180-ийн «Автоклавууд 6: ...»).
      if (Array.isArray(value)) {
        const pivoted = pivotLabelledValues(value) || pivotPositional(labelFor(key), value);
        if (pivoted) {
          for (const [label, val] of Object.entries(pivoted)) put(label, val);
          continue;
        }
      }
      put(labelFor(key), valueFor(key, value));
    }
    return row;
  });
}

/** Excel-ийн sheet нэрийн хязгаар: 31 тэмдэгт, `\ / ? * [ ] :` хориотой. */
function safeSheetName(label: string, used: Set<string>): string {
  const base = label.replace(/[\\/?*[\]:]/g, '-').trim().replace(/^'+|'+$/g, '').trim().replace(/'/g, '’') || 'Бүртгэл';
  let name = base.slice(0, 31).replace(/'+$/g, '');
  let suffix = 2;
  while (used.has(name.toLowerCase()) || name.toLowerCase() === 'history') {
    const ending = `-${suffix++}`;
    name = `${base.slice(0, 31 - ending.length)}${ending}`;
  }
  used.add(name.toLowerCase());
  return name;
}

const CONTEXT_COLUMNS = ['Огноо', 'Ээлж', 'Дамжлага', 'Оператор', 'Бүртгэсэн цаг', 'Бүртгэл №'] as const;

function contextFor(log: ExportableLog, number: number): Record<string, string | number | Date> {
  const created = log.createdAt instanceof Date ? log.createdAt : new Date(String(log.createdAt));
  return {
    Огноо: log.shift?.shiftDate ? reportDate(log.shift.shiftDate) : '',
    Ээлж: log.shift?.shiftType ?? '',
    Дамжлага: log.shift?.stationCode ?? '',
    Оператор: log.shift?.operatorName ?? '',
    'Бүртгэсэн цаг': Number.isFinite(created.getTime()) ? reportDate(created, true) : '',
    'Бүртгэл №': number,
  };
}

/**
 * One sheet per form, with source-log and expanded-row counts for the contents page.
 */
export function addLogSheets(workbook: ExcelJS.Workbook, logs: ExportableLog[], options: { subtitle?: string } = {}) {
  const byType = new Map<string, ExportableLog[]>();
  for (const log of logs) {
    const bucket = byType.get(log.logType);
    if (bucket) bucket.push(log);
    else byType.set(log.logType, [log]);
  }

  // Stable tab order by form/station, independent of the selected period's volume.
  const ordered = [...byType.entries()].sort(([a], [b]) =>
    (LOG_TYPE_LABELS[a] || a).localeCompare(LOG_TYPE_LABELS[b] || b, 'mn', { numeric: true }));

  const usedNames = new Set(workbook.worksheets.map((sheet) => sheet.name.toLowerCase()));
  const contents: Array<{ logType: string; sheetName: string; logCount: number; rowCount: number }> = [];

  for (const [logType, typeLogs] of ordered) {
    const rows: Array<Record<string, string | number | Date>> = [];
    const columnKeys: string[] = [...CONTEXT_COLUMNS];
    const seen = new Set<string>(columnKeys);

    for (const [index, log] of typeLogs.entries()) {
      const context = contextFor(log, index + 1);
      for (const flat of flattenLogData(log.data)) {
        const fields: FlatRow = {};
        for (const [label, value] of Object.entries(flat)) {
          // A form's own "shift"/"recordTime" is not the shift's context.
          const key = (CONTEXT_COLUMNS as readonly string[]).includes(label) ? `Маягт: ${label}` : label;
          appendValue(fields, key, value);
        }
        for (const key of Object.keys(fields)) {
          if (!seen.has(key)) {
            seen.add(key);
            columnKeys.push(key);
          }
        }
        rows.push({ ...fields, ...context });
      }
    }

    const widths: Record<string, number> = { Огноо: 14, Ээлж: 12, Дамжлага: 14, Оператор: 28, 'Бүртгэсэн цаг': 22, 'Бүртгэл №': 12, 'Мөр №': 10 };
    const columns = columnKeys.map((key) => {
      const longest = rows.reduce((max, row) => Math.max(max, ...String(row[key] ?? '').split('\n').map((line) => line.length)), 0);
      const width = widths[key] || Math.min(48, Math.max(20, Math.ceil(key.length / 2), Math.min(longest + 2, 36)));
      return { header: key, key, width,
        numFmt: key === 'Огноо' ? 'yyyy-mm-dd' : key === 'Бүртгэсэн цаг' ? 'yyyy-mm-dd hh:mm' : undefined };
    });
    const sheetName = safeSheetName(LOG_TYPE_LABELS[logType] || logType, usedNames);
    const sheet = createReportSheet(workbook, sheetName, columns, {
      title: LOG_TYPE_LABELS[logType] || logType,
      subtitle: options.subtitle || 'Бөглөсөн маягтын дэлгэрэнгүй',
      note: `${typeLogs.length} маягтын бүртгэл • ${rows.length} дэлгэрэнгүй мөр • Ижил «Бүртгэл №»-тэй мөрүүд нэг маягтад хамаарна.` +
        (SINGLE_FORM_LOG_TYPES.has(logType) ? ' Ээлж бүрээс маягтын хамгийн сүүлд хадгалсан хувилбар орсон.' : ''),
    });
    for (const row of rows) sheet.addRow(row);
    finishReportSheet(sheet, columns.length);
    contents.push({ logType, sheetName, logCount: typeLogs.length, rowCount: rows.length });
  }

  return contents;
}
