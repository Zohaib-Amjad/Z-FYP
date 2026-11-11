import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

export interface CalendarCell {
  key: string;
  date: Date;
  inMonth: boolean;
}

/** Monday-first month grid, padded with the neighbouring months' days. */
export function monthGrid(month: Date): CalendarCell[] {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  return days.map(date => ({
    key: format(date, 'yyyy-MM-dd'),
    date,
    inMonth: isSameMonth(date, month),
  }));
}

export function shiftMonth(month: Date, delta: number): Date {
  return startOfMonth(addMonths(month, delta));
}

export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Parses a yyyy-MM-dd key as a local calendar date (never shifted by the time zone). */
export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}
