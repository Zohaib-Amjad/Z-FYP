import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import {
  bookingReference,
  describeBookingProblem,
  describeCancelProblem,
  describeSlotProblem,
} from '@/lib/booking';
import { buildIcs, escapeIcsText, foldLine, icsTimestamp } from '@/lib/ics';

describe('bookingReference', () => {
  it('is a stable short code from the id', () => {
    expect(bookingReference('3f9a2c1b-0000-4000-8000-123456789abc')).toBe('TD-3F9A2C1B');
  });
});

describe('describeBookingProblem', () => {
  it.each([
    ['SLOT_UNAVAILABLE', 'repick'],
    ['SLOT_IN_PAST', 'repick'],
    ['BOOKING_CONFLICT', 'myBookings'],
    ['ACTIVE_BOOKING_LIMIT', 'myBookings'],
    ['UNAUTHENTICATED', 'login'],
    ['NOT_FOUND', 'repick'],
  ] as const)('maps %s to a friendly message and the %s action', (code, action) => {
    const problem = describeBookingProblem(new ApiError(409, code, 'raw server text'));

    expect(problem.action).toBe(action);
    expect(problem.title.length).toBeGreaterThan(10);
    expect(problem.message).not.toContain(code);
    expect(problem.message).not.toContain('raw server text');
  });

  it('never leaks raw codes for unknown failures', () => {
    const problem = describeBookingProblem(new ApiError(500, 'INTERNAL_ERROR', 'stack trace here'));
    expect(problem.action).toBe('none');
    expect(JSON.stringify(problem)).not.toMatch(/INTERNAL_ERROR|stack trace/);
    expect(describeBookingProblem(new Error('boom')).action).toBe('none');
  });

  it('keeps the connection message for network failures', () => {
    const problem = describeBookingProblem(
      new ApiError(0, 'NETWORK_ERROR', 'Check your connection.'),
    );
    expect(problem.message).toBe('Check your connection.');
  });
});

describe('ics', () => {
  it('formats UTC timestamps', () => {
    expect(icsTimestamp(new Date('2030-03-12T09:05:07.000Z'))).toBe('20300312T090507Z');
  });

  it('escapes the characters iCalendar reserves', () => {
    expect(escapeIcsText('A, B; C\\D\nE')).toBe('A\\, B\\; C\\\\D\\nE');
  });

  it('folds long lines at 75 characters with a leading space continuation', () => {
    const folded = foldLine(`DESCRIPTION:${'x'.repeat(200)}`);
    const lines = folded.split('\r\n');

    expect(lines.length).toBeGreaterThan(2);
    expect(lines.every(line => line.length <= 75)).toBe(true);
    expect(lines.slice(1).every(line => line.startsWith(' '))).toBe(true);
    expect(folded.replace(/\r\n /g, '')).toBe(`DESCRIPTION:${'x'.repeat(200)}`);
  });

  it('builds a complete calendar event with CRLF line endings', () => {
    const ics = buildIcs({
      uid: 'abc@prestige-testdrive',
      start: new Date('2030-03-12T10:00:00.000Z'),
      end: new Date('2030-03-12T11:00:00.000Z'),
      summary: 'Test drive: Porsche 911',
      location: 'Prestige Mayfair, 14 Berkeley Square, London',
      description: 'Reference TD-ABC12345',
      now: new Date('2030-01-01T00:00:00.000Z'),
    });

    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:abc@prestige-testdrive\r\n');
    expect(ics).toContain('DTSTART:20300312T100000Z\r\n');
    expect(ics).toContain('DTEND:20300312T110000Z\r\n');
    expect(ics).toContain('DTSTAMP:20300101T000000Z\r\n');
    expect(ics).toContain('SUMMARY:Test drive: Porsche 911\r\n');
    expect(ics).toContain('LOCATION:Prestige Mayfair\\, 14 Berkeley Square\\, London\r\n');
    expect(ics.split('\r\n').filter(line => line.startsWith('BEGIN:')).length).toBe(2);
  });
});

describe('describeCancelProblem', () => {
  it('explains the window and stale-status failures without codes', () => {
    expect(describeCancelProblem(new ApiError(409, 'CANCELLATION_WINDOW_PASSED', 'x'))).toMatch(
      /contact the showroom/,
    );
    expect(describeCancelProblem(new ApiError(409, 'INVALID_STATUS_TRANSITION', 'x'))).toMatch(
      /already changed/,
    );
  });

  it('falls back to a retry message', () => {
    expect(describeCancelProblem(new ApiError(500, 'INTERNAL_ERROR', 'x'))).toMatch(/try again/);
    expect(describeCancelProblem(new Error('boom'))).toMatch(/try again/);
  });
});

describe('describeSlotProblem', () => {
  it('rewrites overlap and past-time errors without ids or timestamps', () => {
    const overlap = describeSlotProblem(
      new ApiError(409, 'SLOT_OVERLAP', 'Overlaps slot abc (2027-03-01T04:00:00.000Z)'),
    );
    expect(overlap).toMatch(/overlaps another slot/);
    expect(overlap).not.toMatch(/abc|2027/);
    expect(describeSlotProblem(new ApiError(422, 'SLOT_IN_PAST', 'x'))).toMatch(/already passed/);
  });

  it('leaves everything else to the default handling', () => {
    expect(describeSlotProblem(new ApiError(409, 'CONFLICT', 'x'))).toBeNull();
    expect(describeSlotProblem(new Error('boom'))).toBeNull();
  });
});
