import type { BookingStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  BOOKING_TRANSITIONS,
  assertTransition,
  canTransition,
} from '../src/services/bookingStateMachine';
import { ACTIVE_BOOKING_STATUSES } from '../src/utils/bookingStatus';

const ALL: BookingStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'COMPLETED',
  'RESCHEDULED',
];

const ALLOWED: [BookingStatus, BookingStatus][] = [
  ['PENDING', 'APPROVED'],
  ['PENDING', 'REJECTED'],
  ['PENDING', 'CANCELLED'],
  ['PENDING', 'RESCHEDULED'],
  ['APPROVED', 'RESCHEDULED'],
  ['APPROVED', 'CANCELLED'],
  ['APPROVED', 'COMPLETED'],
  ['RESCHEDULED', 'RESCHEDULED'],
  ['RESCHEDULED', 'CANCELLED'],
  ['RESCHEDULED', 'COMPLETED'],
];

describe('booking state machine', () => {
  it('allows exactly the transitions listed in the business rules', () => {
    const allowed = ALL.flatMap(from =>
      ALL.filter(to => canTransition(from, to)).map(to => [from, to]),
    );

    expect(allowed).toEqual(
      expect.arrayContaining(ALLOWED.map(pair => expect.arrayContaining(pair))),
    );
    expect(allowed).toHaveLength(ALLOWED.length);
  });

  it.each(ALLOWED)('%s -> %s is allowed', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  const forbidden = ALL.flatMap(from =>
    ALL.filter(to => !ALLOWED.some(([a, b]) => a === from && b === to)).map(
      to => [from, to] as const,
    ),
  );

  it.each(forbidden)('%s -> %s is refused with INVALID_STATUS_TRANSITION', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(
      expect.objectContaining({ status: 409, code: 'INVALID_STATUS_TRANSITION' }),
    );
  });

  it.each(['REJECTED', 'CANCELLED', 'COMPLETED'] as const)('%s is final', status => {
    expect(BOOKING_TRANSITIONS[status]).toEqual([]);
    expect(() => assertTransition(status, 'PENDING')).toThrow(/final/);
  });

  it('explains the allowed next statuses', () => {
    expect(() => assertTransition('PENDING', 'COMPLETED')).toThrow(
      /Allowed next statuses: APPROVED, REJECTED, CANCELLED, RESCHEDULED/,
    );
  });

  it('defines the active statuses as the ones that occupy a slot', () => {
    expect([...ACTIVE_BOOKING_STATUSES].sort()).toEqual(['APPROVED', 'PENDING', 'RESCHEDULED']);
  });
});
