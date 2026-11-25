import { isoDateInTimeZone, minutesOfDayInTimeZone } from './handover-window';

/** «Эхлээгүй» жагсаалтад эхлэх цаг нь болсон хуваарь л орно (УБ цаг). */
export function startedScheduleCutoff(now = new Date()) {
  const minutes = minutesOfDayInTimeZone(now);
  // shiftDate нь ээлж ЭХЛЭХ өдөр: шөнө дундаас 08:00 хүртэл өчигдрийн
  // шөнийн ээлж эхэлсэн, харин өнөөдрийн хоёр ээлж хоёулаа ирээдүйд байна.
  const shiftTypes: string[] = [];
  if (minutes >= 8 * 60) shiftTypes.push('Өдрийн');
  if (minutes >= 20 * 60) shiftTypes.push('Шөнийн');
  return { date: isoDateInTimeZone(now), shiftTypes };
}
