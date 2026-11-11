import { ApiError } from '@/lib/api';

/** Short, readable reference shown to customers, e.g. TD-3F9A2C1B. */
export function bookingReference(bookingId: string): string {
  return `TD-${bookingId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

type RecoveryAction = 'repick' | 'myBookings' | 'login' | 'none';

export interface BookingProblem {
  title: string;
  message: string;
  action: RecoveryAction;
}

const PROBLEMS: Partial<Record<ApiError['code'], BookingProblem>> = {
  SLOT_UNAVAILABLE: {
    title: 'That time has just been taken',
    message:
      'Another customer reserved this appointment moments before you. Please choose a different time and we will hold it for you.',
    action: 'repick',
  },
  SLOT_IN_PAST: {
    title: 'This appointment has already started',
    message: 'Please choose a time that is still ahead of us.',
    action: 'repick',
  },
  BOOKING_CONFLICT: {
    title: 'You already have an appointment at this time',
    message:
      'You have another test drive that overlaps with this slot. Review your bookings, or choose a different time.',
    action: 'myBookings',
  },
  ACTIVE_BOOKING_LIMIT: {
    title: 'You have reached your booking limit',
    message:
      'You can hold a limited number of upcoming test drives at once. Complete or cancel one of your current bookings to make a new request.',
    action: 'myBookings',
  },
  NOT_FOUND: {
    title: 'This appointment is no longer available',
    message: 'The appointment may have been withdrawn. Please choose another time.',
    action: 'repick',
  },
  UNAUTHENTICATED: {
    title: 'Please sign in again',
    message: 'Your session has ended. Sign in to complete your booking.',
    action: 'login',
  },
};

const FALLBACK: BookingProblem = {
  title: 'We could not complete your booking',
  message: 'Something went wrong on our side. Please try again in a moment.',
  action: 'none',
};

/** Friendly wording and next step for a failed booking request; raw error codes are never shown. */
export function describeBookingProblem(error: unknown): BookingProblem {
  if (!(error instanceof ApiError)) return FALLBACK;
  if (error.code === 'NETWORK_ERROR') {
    return { ...FALLBACK, title: 'We could not reach the server', message: error.message };
  }
  return PROBLEMS[error.code] ?? FALLBACK;
}

/** Toast wording when cancelling fails; the lists are refreshed afterwards either way. */
export function describeCancelProblem(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'CANCELLATION_WINDOW_PASSED') {
      return 'It is now too close to your appointment to cancel online. Please contact the showroom.';
    }
    if (error.code === 'INVALID_STATUS_TRANSITION') {
      return 'This booking has already changed, so it can no longer be cancelled. We have refreshed your list.';
    }
    if (error.code === 'NETWORK_ERROR') return error.message;
  }
  return 'We could not cancel your booking. Please try again.';
}

/** Toast wording when a staff action fails; the affected lists are refreshed afterwards. */
export function describeAdminActionProblem(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'INVALID_STATUS_TRANSITION':
        return 'This booking was changed by someone else a moment ago. We have refreshed it, so please review and try again.';
      case 'SLOT_UNAVAILABLE':
        return 'That time has just been taken. Please choose another slot.';
      case 'BOOKING_CONFLICT':
        return 'The customer already has an appointment that overlaps that time.';
      case 'SLOT_IN_PAST':
        return 'That time has already started. Please choose a later slot.';
      case 'VALIDATION_ERROR':
        return error.details[0]?.message ?? 'Please check what you entered and try again.';
      case 'NETWORK_ERROR':
        return error.message;
      default:
        break;
    }
  }
  return 'We could not complete that action. Please try again.';
}

/** Plain-language wording for slot problems whose server message carries technical detail. */
export function describeSlotProblem(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === 'SLOT_OVERLAP') {
    return 'This time overlaps another slot for the same vehicle. Choose a time that does not clash with an existing slot.';
  }
  if (error.code === 'SLOT_IN_PAST')
    return 'That time has already passed. Choose a time in the future.';
  return null;
}
