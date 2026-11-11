/**
 * Hand-maintained mirror of the API contract (api/openapi.yaml).
 * When an endpoint shape changes, update this file and api/openapi.yaml together.
 */

const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'EMAIL_TAKEN',
  'INVALID_CREDENTIALS',
  'INVALID_CURRENT_PASSWORD',
  'ACCOUNT_DISABLED',
  'SLOT_UNAVAILABLE',
  'BOOKING_CONFLICT',
  'SLOT_IN_PAST',
  'CANCELLATION_WINDOW_PASSED',
  'INVALID_STATUS_TRANSITION',
  'HAS_ACTIVE_BOOKINGS',
  'ACTIVE_BOOKING_LIMIT',
  'SLOT_OVERLAP',
  'UPLOAD_INVALID',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface FieldError {
  field: string;
  message: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
