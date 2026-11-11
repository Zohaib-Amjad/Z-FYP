import { describe, expect, it } from 'vitest';
import {
  anchorFrom,
  dayTotals,
  groupSlotsByDay,
  shiftView,
  slotState,
  viewRange,
  viewTitle,
} from '@/lib/adminSlots';
import { toDateKey } from '@/lib/calendar';

const booked = { isActive: true, activeBooking: { id: 'b' } } as never;
const free = { isActive: true, activeBooking: null } as never;
const inactive = { isActive: false, activeBooking: null } as never;

describe('slotState', () => {
  it('classifies slots', () => {
    expect(slotState(free)).toBe('free');
    expect(slotState(booked)).toBe('booked');
    expect(slotState(inactive)).toBe('inactive');
  });

  it('treats an inactive slot as inactive even if it still carries a booking', () => {
    expect(slotState({ isActive: false, activeBooking: { id: 'b' } } as never)).toBe('inactive');
  });

  it('totals a day', () => {
    expect(dayTotals([free, free, booked, inactive])).toEqual({ free: 2, booked: 1, inactive: 1 });
    expect(dayTotals([])).toEqual({ free: 0, booked: 0, inactive: 0 });
  });
});

describe('groupSlotsByDay', () => {
  it('groups by local day and sorts each day by start time', () => {
    const slots = [
      { startAt: new Date(2026, 10, 10, 14).toISOString() },
      { startAt: new Date(2026, 10, 11, 9).toISOString() },
      { startAt: new Date(2026, 10, 10, 9).toISOString() },
    ];

    const groups = groupSlotsByDay(slots);

    expect(Object.keys(groups).sort()).toEqual(['2026-11-10', '2026-11-11']);
    expect(groups['2026-11-10'].map(slot => new Date(slot.startAt).getHours())).toEqual([9, 14]);
  });
});

describe('calendar views', () => {
  const anchor = new Date(2026, 10, 10);

  it('shows Monday to Sunday for a week', () => {
    const { from, to, days } = viewRange('week', anchor);
    expect(from).toBe('2026-11-09');
    expect(to).toBe('2026-11-15');
    expect(days).toHaveLength(7);
  });

  it('shows whole Monday-first weeks for a month', () => {
    const { from, to, days } = viewRange('month', anchor);
    expect(from).toBe('2026-10-26');
    expect(to).toBe('2026-12-06');
    expect(days.length % 7).toBe(0);
  });

  it('moves by weeks or months', () => {
    expect(toDateKey(shiftView('week', anchor, 1))).toBe('2026-11-17');
    expect(toDateKey(shiftView('week', anchor, -1))).toBe('2026-11-03');
    expect(toDateKey(shiftView('month', anchor, 1))).toBe('2026-12-10');
  });

  it('titles the view', () => {
    expect(viewTitle('month', anchor)).toBe('November 2026');
    expect(viewTitle('week', anchor)).toBe('9 Nov to 15 Nov 2026');
  });

  it('anchors on the chosen day, or today when none', () => {
    expect(toDateKey(anchorFrom('2026-11-10'))).toBe('2026-11-10');
    expect(toDateKey(anchorFrom(''))).toBe(toDateKey(new Date()));
  });
});
