export interface CalendarEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location: string;
  description: string;
  now?: Date;
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** iCalendar UTC timestamp, e.g. 20301231T093000Z. */
export function icsTimestamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

const FOLD_AT = 74;

/** Lines longer than 75 characters are folded with CRLF + space, as RFC 5545 requires. */
export function foldLine(line: string): string {
  if (line.length <= FOLD_AT) return line;
  const parts = [line.slice(0, FOLD_AT)];
  for (let index = FOLD_AT; index < line.length; index += FOLD_AT - 1) {
    parts.push(line.slice(index, index + FOLD_AT - 1));
  }
  return parts.join('\r\n ');
}

export function buildIcs(event: CalendarEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Prestige Test Drive//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${icsTimestamp(event.now ?? new Date())}`,
    `DTSTART:${icsTimestamp(event.start)}`,
    `DTEND:${icsTimestamp(event.end)}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    'STATUS:TENTATIVE',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

/** Triggers a browser download of the event as an .ics file, generated entirely client-side. */
export function downloadIcs(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
