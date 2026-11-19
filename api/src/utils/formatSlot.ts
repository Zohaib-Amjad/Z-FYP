import { env } from '../config/env';

/** Builds a slot-window formatter that writes times in the given IANA time zone. */
export const createSlotWindowFormatter = (timeZone: string) => {
  const dateFormat = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  });
  const timeFormat = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  });
  const zoneLabelFormat = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'short' });

  /** Short zone name at that instant, for example "GMT+5" for Asia/Karachi or "UTC". */
  const zoneLabel = (at: Date): string =>
    zoneLabelFormat.formatToParts(at).find(part => part.type === 'timeZoneName')?.value ?? timeZone;

  return (startAt: Date, endAt: Date): string =>
    `${dateFormat.format(startAt)}, ${timeFormat.format(startAt)} to ${timeFormat.format(endAt)} ${zoneLabel(startAt)}`;
};

/** Slot window in the showrooms' time zone, for notifications, emails and error messages. */
export const formatSlotWindow = createSlotWindowFormatter(env.BUSINESS_TIME_ZONE);
