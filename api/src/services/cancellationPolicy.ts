import type { BookingStatus } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { canTransition } from './bookingStateMachine';

export interface CancellableBooking {
  status: BookingStatus;
  slotStartAt: Date;
}

export type CancellationEligibility =
  | { canCancel: true }
  | {
      canCancel: false;
      code: 'CANCELLATION_WINDOW_PASSED' | 'INVALID_STATUS_TRANSITION';
      reason: string;
    };

const HOUR_MS = 3_600_000;

const FINAL_STATUS_REASONS: Partial<Record<BookingStatus, string>> = {
  CANCELLED: 'This booking has already been cancelled',
  REJECTED: 'This request was declined and there is nothing left to cancel',
  COMPLETED: 'This test drive has already been completed',
};

const describeHours = (hours: number): string => `${hours} hour${hours === 1 ? '' : 's'}`;

export const getCancellationEligibility = (
  booking: CancellableBooking,
  now: Date = new Date(),
): CancellationEligibility => {
  if (!canTransition(booking.status, 'CANCELLED')) {
    return {
      canCancel: false,
      code: 'INVALID_STATUS_TRANSITION',
      reason: FINAL_STATUS_REASONS[booking.status] ?? 'This booking can no longer be cancelled',
    };
  }
  const untilStart = booking.slotStartAt.getTime() - now.getTime();
  if (untilStart <= 0) {
    return {
      canCancel: false,
      code: 'CANCELLATION_WINDOW_PASSED',
      reason: 'This test drive has already started, so it can no longer be cancelled online',
    };
  }
  if (untilStart < env.CANCELLATION_WINDOW_HOURS * HOUR_MS) {
    return {
      canCancel: false,
      code: 'CANCELLATION_WINDOW_PASSED',
      reason: `Bookings can only be cancelled at least ${describeHours(env.CANCELLATION_WINDOW_HOURS)} before the test drive starts. Please contact the dealership for help`,
    };
  }
  return { canCancel: true };
};

export const assertCancellable = (booking: CancellableBooking, now: Date = new Date()): void => {
  const eligibility = getCancellationEligibility(booking, now);
  if (!eligibility.canCancel) {
    throw new AppError(409, eligibility.code, eligibility.reason);
  }
};
