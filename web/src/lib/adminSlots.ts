import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { fromDateKey, toDateKey } from '@/lib/calendar';
import type { AdminSlot } from '@/types';

export type SlotState = 'inactive' | 'booked' | 'free';

/** A slot is booked while it has an active booking; deactivated slots are shown as inactive. */
export function slotState(slot: Pick<AdminSlot, 'isActive' | 'activeBooking'>): SlotState {
  if (!slot.isActive) return 'inactive';
  return slot.activeBooking ? 'booked' : 'free';
}

export const SLOT_STATE_LABELS: Record<SlotState, string> = {
  inactive: 'Inactive',
  booked: 'Booked',
  free: 'Free',
};

/** Slots grouped by their local calendar day, each day sorted by start time. */
export function groupSlotsByDay<T extends { startAt: string }>(slots: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const slot of slots) {
    const key = toDateKey(new Date(slot.startAt));
    (groups[key] ??= []).push(slot);
  }
  for (const list of Object.values(groups)) {
    list.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }
  return groups;
}

export interface DayTotals {
  free: number;
  booked: number;
  inactive: number;
}

export function dayTotals(slots: Pick<AdminSlot, 'isActive' | 'activeBooking'>[]): DayTotals {
  return slots.reduce<DayTotals>(
    (totals, slot) => {
      totals[slotState(slot)] += 1;
      return totals;
    },
    { free: 0, booked: 0, inactive: 0 },
  );
}

export type CalendarView = 'week' | 'month';

/** First and last local day (yyyy-MM-dd) a calendar view needs to display, Monday-first. */
export function viewRange(
  view: CalendarView,
  anchor: Date,
): { from: string; to: string; days: Date[] } {
  const from =
    view === 'week'
      ? startOfWeek(anchor, { weekStartsOn: 1 })
      : startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const to =
    view === 'week'
      ? endOfWeek(anchor, { weekStartsOn: 1 })
      : endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  return {
    from: toDateKey(from),
    to: toDateKey(to),
    days: eachDayOfInterval({ start: from, end: to }),
  };
}

export function shiftView(view: CalendarView, anchor: Date, delta: number): Date {
  return view === 'week' ? addDays(anchor, delta * 7) : addMonths(anchor, delta);
}

export function viewTitle(view: CalendarView, anchor: Date): string {
  if (view === 'month') return format(anchor, 'MMMM yyyy');
  const { days } = viewRange('week', anchor);
  const first = days[0];
  const last = days[days.length - 1];
  return `${format(first, 'd MMM')} to ${format(last, 'd MMM yyyy')}`;
}

export function anchorFrom(day: string): Date {
  return day ? fromDateKey(day) : new Date();
}

/** Slot time as the label for a calendar entry, e.g. "09:00". */
export function timeLabel(iso: string): string {
  return format(new Date(iso), 'HH:mm');
}
