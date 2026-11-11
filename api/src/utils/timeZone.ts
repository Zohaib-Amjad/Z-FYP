export const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const DAY_MS = 86_400_000;

export const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
};

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const wallClockIn = (instant: Date, timeZone: string): WallClock => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const part = (type: string): number => Number(parts.find(item => item.type === type)?.value);
  return {
    year: part('year'),
    month: part('month'),
    day: part('day'),
    hour: part('hour'),
    minute: part('minute'),
    second: part('second'),
  };
};

const offsetMs = (instant: Date, timeZone: string): number => {
  const clock = wallClockIn(instant, timeZone);
  const asUtc = Date.UTC(
    clock.year,
    clock.month - 1,
    clock.day,
    clock.hour,
    clock.minute,
    clock.second,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
};

export const zonedTimeToUtc = (date: string, time: string, timeZone: string): Date => {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = wall - offsetMs(new Date(wall), timeZone);
  return new Date(wall - offsetMs(new Date(firstGuess), timeZone));
};

export const dateKeyInZone = (instant: Date, timeZone: string): string => {
  const { year, month, day } = wallClockIn(instant, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const toUtcMidnight = (date: string): number => {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};

export const isRealDate = (date: string): boolean => {
  const parsed = new Date(toUtcMidnight(date));
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date);
};

export const addDaysToDate = (date: string, days: number): string =>
  new Date(toUtcMidnight(date) + days * DAY_MS).toISOString().slice(0, 10);

export const daysBetween = (from: string, to: string): number =>
  Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / DAY_MS);

export const weekdayOf = (date: string): Weekday =>
  WEEKDAYS[new Date(toUtcMidnight(date)).getUTCDay()];

const MIDNIGHT = '00:00';

export const startOfDayInZone = (instant: Date, timeZone: string): Date =>
  zonedTimeToUtc(dateKeyInZone(instant, timeZone), MIDNIGHT, timeZone);

export const startOfNextDayInZone = (instant: Date, timeZone: string): Date =>
  zonedTimeToUtc(addDaysToDate(dateKeyInZone(instant, timeZone), 1), MIDNIGHT, timeZone);

export const startOfMonthInZone = (instant: Date, timeZone: string): Date =>
  zonedTimeToUtc(`${dateKeyInZone(instant, timeZone).slice(0, 7)}-01`, MIDNIGHT, timeZone);

export const startOfNextMonthInZone = (instant: Date, timeZone: string): Date => {
  const [year, month] = dateKeyInZone(instant, timeZone).split('-').map(Number);
  const next =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return zonedTimeToUtc(next, MIDNIGHT, timeZone);
};

export const dayBoundariesInZone = (
  instant: Date,
  days: number,
  timeZone: string,
): { date: string; startAt: Date }[] => {
  const today = dateKeyInZone(instant, timeZone);
  return Array.from({ length: days + 1 }, (_, index) => {
    const date = addDaysToDate(today, index - days + 1);
    return { date, startAt: zonedTimeToUtc(date, MIDNIGHT, timeZone) };
  });
};
