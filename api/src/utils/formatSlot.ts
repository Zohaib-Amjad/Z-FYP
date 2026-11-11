const dateFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

export const formatSlotWindow = (startAt: Date, endAt: Date): string =>
  `${dateFormat.format(startAt)}, ${timeFormat.format(startAt)} to ${timeFormat.format(endAt)} UTC`;
