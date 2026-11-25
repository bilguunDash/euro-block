import type { ExportableLog } from '../../lib/kpi-log-export';

/** Synthetic data only: no database, environment variables, or real employee records. */
export const filters = {
  since: '2026-09-12',
  until: '2026-09-15',
  stationCode: 'all',
  employeeUid: '',
};

export const shifts = [
  {
    id: 'fixture-shift-001',
    shiftDate: '2026-09-15',
    shiftType: 'Өдөр',
    stationCode: 'ҮЯ-130',
    operatorName: 'Жишээ Бат-Эрдэнэ',
    status: 'Баталгаажсан',
    operatorShiftCompleted: true,
    masterApproved: true,
    masterName: 'Жишээ Нарантуяа',
    role: 'Оператор, Ээлжийн мастер',
  },
  {
    id: 'fixture-shift-002',
    shiftDate: '2026-09-15',
    shiftType: 'Шөнө',
    stationCode: 'ҮЯ-410',
    operatorName: 'Жишээ Тэмүүлэн',
    status: 'Хүлээгдэж буй',
    operatorShiftCompleted: true,
    masterApproved: false,
    masterName: '',
    role: 'Оператор',
  },
  {
    id: 'fixture-shift-003',
    shiftDate: '2026-09-14',
    shiftType: 'Өдөр',
    stationCode: 'ҮЯ-181',
    operatorName: 'Жишээ Мөнхзул',
    status: 'Ноорог',
    operatorShiftCompleted: false,
    masterApproved: false,
    masterName: '',
    role: 'Оператор',
  },
  {
    id: 'fixture-shift-004',
    shiftDate: '2026-09-13',
    shiftType: 'Шөнө',
    stationCode: 'ҮЯ-190',
    operatorName: 'Жишээ Энхжин',
    status: 'Баталгаажсан',
    operatorShiftCompleted: true,
    masterApproved: true,
    masterName: 'Жишээ Нарантуяа',
    role: 'Оператор, Ээлжийн мастер',
  },
  {
    id: 'fixture-shift-005',
    shiftDate: '2026-09-12',
    shiftType: 'Өдөр',
    stationCode: 'ҮЯ-310',
    operatorName: 'Жишээ Алтангэрэл',
    status: 'Буцаагдсан',
    operatorShiftCompleted: false,
    masterApproved: false,
    masterName: '',
    role: 'Оператор',
  },
];

export const longNotes = [
  'Ээлжийн эхэнд тоног төхөөрөмжийн хамгаалалт, ажлын байрны цэвэрлэгээ, хэмжих багажийн заалтыг шалгав.',
  '10:30 цагт насосны даралт түр буурсан тул шүүлтүүрийг цэвэрлэж, холболтын битүүмжлэлийг дахин шалгасан. Үйлдвэрлэлд саатал үүсээгүй.',
  'Дараагийн ээлжийн оператор насосны дуу чимээ болон даралтын өөрчлөлтийг хоёр цаг тутам ажиглаж, үр дүнг тэмдэглэх шаардлагатай.',
].join('\n');

export const logs: ExportableLog[] = [
  {
    logType: 'modal_mix_logs',
    createdAt: new Date('2026-09-15T01:30:00Z'),
    shift: shifts[0],
    data: {
      pourCount: 0,
      risingTime: 42,
      spread: 23.5,
      pourTemp: 38.75,
      freshSlurryDensity: 1510,
      isLate: false,
      notes: longNotes,
      remarks: 'Мастерын тайлбар: даралтын хэмжилтийг давтан хийх.',
      comment: 'Операторын тайлбар: шүүлтүүрийг цэвэрлэсэн.',
      explanation: 'Инженерийн тайлбар: төлөвлөгөөт үзлэгт оруулах.',
    },
  },
  {
    logType: 'modal_mix_logs',
    createdAt: '2026-09-15T15:15:00+08:00',
    shift: shifts[0],
    data: {
      pourCount: 2,
      spread: 24.1,
      pourTemp: 39,
      freshSlurryDensity: 1505,
      notes: 'Давтан хэмжилт хэвийн.',
      // These visible payload labels must not overwrite the shift context.
      shift: 'Маягтын дотоод ээлж № 7',
      Огноо: 'Маягтын тусгай огноо',
      Оператор: 'Маягтад бичсэн өөр хариуцагч',
      'Бүртгэсэн цаг': 'Маягтын өөр цаг',
    },
  },
  {
    logType: 'modal_cah02_electrical_control_form',
    createdAt: '2026-09-15T14:00:00Z',
    shift: shifts[1],
    data: {
      notes: 'Ээлжийн ерөнхий тэмдэглэл.',
      rows: [
        {
          measuredTime: '2026-09-15T21:00',
          lineVoltage: 10.2,
          transHighCurrentT1: 0,
          transLowCurrentInput1: 127.6,
          status: 'normal',
          notes: 'Эхний хэмжилтийн тэмдэглэл.',
        },
        {
          measuredTime: '2026-09-15T22:00',
          lineVoltage: 10.1,
          transHighCurrentT1: 15.25,
          transLowCurrentInput1: 132,
          status: 'abnormal',
          notes: 'Хоёр дахь хэмжилтийн тэмдэглэл.',
        },
      ],
    },
  },
  {
    logType: 'modal_y181_heat_master_handover_v1',
    createdAt: '2026-09-14T02:00:00Z',
    shift: shifts[2],
    data: {
      masterName: 'Жишээ Мөнхзул',
      sections: {
        boiler: [
          { label: 'Зуух № 1', status: 'yes', note: 'Даралт 8.5 бар.' },
          { label: 'Зуух № 2', status: 'no', note: 'Нөөцөд, асаагаагүй.' },
        ],
        pumps: [
          { label: 'Насос № 1', value: 0, enabled: false },
          { label: 'Насос № 2', value: 12.75, enabled: true },
        ],
      },
      equipmentInspections: [
        { label: 'Уурын шугам', status: 'normal', comment: 'Алдагдалгүй.' },
        { label: 'Хаалт', status: 'abnormal', comment: longNotes },
      ],
      shiftNotes: longNotes,
    },
  },
  {
    logType: 'modal_y130_handover_form',
    createdAt: '2026-09-15T10:00:00Z',
    shift: shifts[0],
    data: {
      indicators: [
        { label: 'Нийт цутгалт', value: 14, unit: 'ш' },
        { label: 'Бүтээгдэхүүний хэмжээ', value: 75.6, unit: 'м³' },
        { label: 'Температур', value: 38.5, unit: '°C' },
        { label: 'Температур', value: 39.25, unit: '°C' },
        { label: 'Зогсолт', value: 0, unit: 'мин' },
        { label: 'Нэмэлт шалгалт шаардлагатай', value: false },
      ],
      notes: 'Ижил нэртэй хоёр температур нь тусдаа хэмжилт; хоёуланг хадгална.',
    },
  },
  {
    logType: 'modal_hse_checklist',
    createdAt: '2026-09-13T13:05:00Z',
    shift: shifts[3],
    data: {
      ppeComplete: true,
      fireSafetyOk: true,
      guardsInPlace: false,
      workplaceClean: false,
      hseComment: 'Хамгаалалтын хаалтыг засаж дууссаны дараа дахин шалгана.',
      attachments: [],
    },
  },
  {
    // Invalid characters and truncation collide with the following log type.
    logType: 'custom/report:[station]?very-long-name-001',
    createdAt: '2026-09-12T03:00:00Z',
    shift: shifts[4],
    data: {
      notes: 'Үл мэдэгдэх маягт A.',
      repairs: [
        { label: 'Холхивч солих', performerManHours: 2.5, completed: false },
        { label: 'Тосолгоо хийх', performerManHours: 0, completed: true },
      ],
    },
  },
  {
    logType: 'custom\\report:[station]*very-long-name-002',
    createdAt: '2026-09-12T04:00:00Z',
    shift: null,
    data: {
      notes: 'Үл мэдэгдэх маягт B; ээлжийн холбоосгүй бүртгэл.',
      remarks: 'Тусдаа тайлбар.',
      comment: 'Ижил орчуулгатай боловч тусдаа хадгалах утга.',
      measurement: 0,
      verified: false,
    },
  },
];
