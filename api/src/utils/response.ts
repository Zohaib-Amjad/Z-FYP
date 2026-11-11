import { Response } from 'express';

export interface ErrorDetail {
  field?: string;
  message: string;
}

export const API_ERROR_CODES = [
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

interface SuccessEnvelope<T> {
  success: true;
  data: T;
  message?: string;
}

interface ErrorEnvelope {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
}

export const ok = <T>(res: Response, data: T, message?: string, status = 200): Response => {
  const envelope: SuccessEnvelope<T> = { success: true, data, ...(message ? { message } : {}) };
  return res.status(status).json(envelope);
};

export const sendError = (
  res: Response,
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: ErrorDetail[],
): Response => {
  const envelope: ErrorEnvelope = {
    success: false,
    error: { code, message, ...(details && details.length > 0 ? { details } : {}) },
  };
  return res.status(status).json(envelope);
};
