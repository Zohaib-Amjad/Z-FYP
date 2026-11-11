import type { BookingStatus } from '@prisma/client';
import { AppError } from '../utils/AppError';

export const BOOKING_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  PENDING: ['APPROVED', 'REJECTED', 'CANCELLED', 'RESCHEDULED'],
  APPROVED: ['RESCHEDULED', 'CANCELLED', 'COMPLETED'],
  RESCHEDULED: ['RESCHEDULED', 'CANCELLED', 'COMPLETED'],
  REJECTED: [],
  CANCELLED: [],
  COMPLETED: [],
};

export const canTransition = (from: BookingStatus, to: BookingStatus): boolean =>
  BOOKING_TRANSITIONS[from].includes(to);

export const assertTransition = (from: BookingStatus, to: BookingStatus): void => {
  if (canTransition(from, to)) return;
  const allowed = BOOKING_TRANSITIONS[from];
  const hint =
    allowed.length === 0
      ? `A ${from.toLowerCase()} booking is final and cannot be changed`
      : `Allowed next statuses: ${allowed.join(', ')}`;
  throw new AppError(
    409,
    'INVALID_STATUS_TRANSITION',
    `A booking cannot move from ${from} to ${to}. ${hint}`,
  );
};
