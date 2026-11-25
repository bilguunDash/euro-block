import type React from 'react';

export type Station = {
  code: string;
  name: string;
};

export type DashboardUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  /** Оператор бол өөрийн станц, мастер бол мастер станц — хуваарь оноох үндэс. */
  stationCode?: string | null;
  /** Ээлжийн баг: '1' | '2' | '3' | null */
  shiftGroup?: string | null;
};

export type ScheduleView = 'operator' | 'master';
export type ScheduleCalendarView = 'month' | 'week';

export type ScheduleFormState = {
  shiftDate: string;
  /** Заавал биш — бөглөвөл [shiftDate..endDate] мужийн бүх өдөрт олноор оноогдоно. */
  endDate?: string;
  /** Нэг буюу хоёр ('Өдрийн', 'Шөнийн') — сонгосон ээлж бүрээр оноогдоно. */
  shiftTypes: string[];
  stationCode: string;
  assigneeUid: string;
};

export type ScheduleFetchOptions = {
  month?: string;
  shiftType?: string;
  stationCode?: string;
  operatorUid?: string;
  masterUid?: string;
};

export type ScheduleStateSetter<T> = React.Dispatch<React.SetStateAction<T>>;
