import { describe, expect, it } from 'vitest';
import {
  addDaysToDate,
  dateKeyInZone,
  dayBoundariesInZone,
  daysBetween,
  isRealDate,
  isValidTimeZone,
  startOfDayInZone,
  startOfMonthInZone,
  startOfNextDayInZone,
  startOfNextMonthInZone,
  weekdayOf,
  zonedTimeToUtc,
} from '../src/utils/timeZone';

describe('zonedTimeToUtc', () => {
  it.each([
    ['2025-01-15', '09:00', 'UTC', '2025-01-15T09:00:00.000Z'],
    ['2025-01-15', '09:00', 'Europe/London', '2025-01-15T09:00:00.000Z'],
    ['2025-07-15', '09:00', 'Europe/London', '2025-07-15T08:00:00.000Z'],
    ['2025-07-15', '09:00', 'America/New_York', '2025-07-15T13:00:00.000Z'],
    ['2025-01-15', '09:00', 'America/New_York', '2025-01-15T14:00:00.000Z'],
    ['2025-07-15', '09:00', 'Asia/Karachi', '2025-07-15T04:00:00.000Z'],
    ['2025-07-15', '09:00', 'Asia/Kolkata', '2025-07-15T03:30:00.000Z'],
    ['2025-07-15', '09:00', 'Australia/Sydney', '2025-07-14T23:00:00.000Z'],
    ['2025-07-15', '00:00', 'Europe/London', '2025-07-14T23:00:00.000Z'],
  ])('%s %s in %s is %s', (date, time, zone, expected) => {
    expect(zonedTimeToUtc(date, time, zone).toISOString()).toBe(expected);
  });

  it('handles the days daylight saving starts and ends in London', () => {
    expect(zonedTimeToUtc('2025-03-30', '09:00', 'Europe/London').toISOString()).toBe(
      '2025-03-30T08:00:00.000Z',
    );
    expect(zonedTimeToUtc('2025-03-29', '09:00', 'Europe/London').toISOString()).toBe(
      '2025-03-29T09:00:00.000Z',
    );
    expect(zonedTimeToUtc('2025-10-26', '09:00', 'Europe/London').toISOString()).toBe(
      '2025-10-26T09:00:00.000Z',
    );
    expect(zonedTimeToUtc('2025-10-25', '09:00', 'Europe/London').toISOString()).toBe(
      '2025-10-25T08:00:00.000Z',
    );
  });
});

describe('dateKeyInZone', () => {
  const instant = new Date('2025-07-15T23:30:00.000Z');

  it.each([
    ['UTC', '2025-07-15'],
    ['Europe/London', '2025-07-16'],
    ['America/New_York', '2025-07-15'],
    ['Asia/Karachi', '2025-07-16'],
    ['Pacific/Auckland', '2025-07-16'],
  ])('groups 23:30 UTC into %s as %s', (zone, expected) => {
    expect(dateKeyInZone(instant, zone)).toBe(expected);
  });
});

describe('calendar helpers', () => {
  it('validates time zones', () => {
    expect(isValidTimeZone('Europe/London')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });

  it('validates real calendar dates', () => {
    expect(isRealDate('2028-02-29')).toBe(true);
    expect(isRealDate('2027-02-29')).toBe(false);
    expect(isRealDate('2027-13-01')).toBe(false);
    expect(isRealDate('2027-04-31')).toBe(false);
  });

  it('adds days across month and year ends', () => {
    expect(addDaysToDate('2025-12-30', 3)).toBe('2026-01-02');
    expect(addDaysToDate('2025-03-01', -1)).toBe('2025-02-28');
    expect(daysBetween('2025-01-01', '2025-01-31')).toBe(30);
  });

  it('finds the weekday of a calendar date', () => {
    expect(weekdayOf('2025-07-14')).toBe('MON');
    expect(weekdayOf('2025-07-20')).toBe('SUN');
    expect(weekdayOf('2025-07-19')).toBe('SAT');
  });
});

describe('day and month boundaries in a time zone', () => {
  const instant = new Date('2025-07-15T23:30:00.000Z');

  it.each([
    ['UTC', '2025-07-15T00:00:00.000Z', '2025-07-16T00:00:00.000Z'],
    ['Europe/London', '2025-07-15T23:00:00.000Z', '2025-07-16T23:00:00.000Z'],
    ['Asia/Karachi', '2025-07-15T19:00:00.000Z', '2025-07-16T19:00:00.000Z'],
    ['America/New_York', '2025-07-15T04:00:00.000Z', '2025-07-16T04:00:00.000Z'],
  ])('finds the day around 23:30 UTC in %s', (zone, start, nextStart) => {
    expect(startOfDayInZone(instant, zone).toISOString()).toBe(start);
    expect(startOfNextDayInZone(instant, zone).toISOString()).toBe(nextStart);
  });

  it('lasts 23 or 25 hours on daylight-saving days', () => {
    const springForward = new Date('2025-03-30T12:00:00.000Z');
    const fallBack = new Date('2025-10-26T12:00:00.000Z');
    const hours = (day: Date) =>
      (startOfNextDayInZone(day, 'Europe/London').getTime() -
        startOfDayInZone(day, 'Europe/London').getTime()) /
      3_600_000;

    expect(hours(springForward)).toBe(23);
    expect(hours(fallBack)).toBe(25);
  });

  it('finds month boundaries, including December and the zone date line', () => {
    expect(startOfMonthInZone(instant, 'UTC').toISOString()).toBe('2025-07-01T00:00:00.000Z');
    expect(startOfNextMonthInZone(instant, 'UTC').toISOString()).toBe('2025-08-01T00:00:00.000Z');
    expect(startOfNextMonthInZone(new Date('2025-12-31T12:00:00Z'), 'UTC').toISOString()).toBe(
      '2026-01-01T00:00:00.000Z',
    );
    expect(startOfMonthInZone(new Date('2025-07-31T20:00:00Z'), 'Asia/Karachi').toISOString()).toBe(
      '2025-07-31T19:00:00.000Z',
    );
  });

  it('lists the last N day boundaries plus the end boundary', () => {
    const boundaries = dayBoundariesInZone(instant, 3, 'UTC');

    expect(boundaries.map(b => b.date)).toEqual([
      '2025-07-13',
      '2025-07-14',
      '2025-07-15',
      '2025-07-16',
    ]);
    expect(boundaries[3].startAt.toISOString()).toBe('2025-07-16T00:00:00.000Z');
    expect(dayBoundariesInZone(instant, 1, 'UTC').map(b => b.date)).toEqual([
      '2025-07-15',
      '2025-07-16',
    ]);
  });
});
