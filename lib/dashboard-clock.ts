import { isoDateInTimeZone, minutesOfDayInTimeZone } from './handover-window';

export type DashboardShiftType = 'Өдрийн' | 'Шөнийн';

export interface DashboardSlot {
  date: string;
  shiftType: DashboardShiftType;
}

export interface DashboardClockState {
  current: DashboardSlot;
  selected: DashboardSlot;
  manuallySelected: boolean;
}

// Shift hours are 08:00–20:00 (day) and 20:00–08:00 (night).
// Handover windows are wider and must not determine the active shift.
export function currentDashboardSlot(now = new Date()): DashboardSlot {
  const minutes = minutesOfDayInTimeZone(now);
  return {
    date: isoDateInTimeZone(now),
    shiftType: minutes >= 8 * 60 && minutes < 20 * 60 ? 'Өдрийн' : 'Шөнийн',
  };
}

export function initialDashboardClockState(now = new Date()): DashboardClockState {
  const slot = currentDashboardSlot(now);
  return { current: slot, selected: slot, manuallySelected: false };
}

export function refreshDashboardClockState(
  previous: DashboardClockState,
  now = new Date(),
): DashboardClockState {
  const current = currentDashboardSlot(now);
  if (
    previous.current.date === current.date &&
    previous.current.shiftType === current.shiftType
  ) return previous;

  return {
    current,
    selected: previous.manuallySelected ? previous.selected : current,
    manuallySelected: previous.manuallySelected,
  };
}

export function selectDashboardDate(previous: DashboardClockState, date: string): DashboardClockState {
  return { ...previous, selected: { ...previous.selected, date }, manuallySelected: true };
}

export function selectDashboardShiftType(
  previous: DashboardClockState,
  shiftType: DashboardShiftType,
): DashboardClockState {
  return { ...previous, selected: { ...previous.selected, shiftType }, manuallySelected: true };
}
