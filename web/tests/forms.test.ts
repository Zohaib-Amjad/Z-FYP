import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';

const FIELDS = ['email', 'password'] as const;

describe('applyServerErrors', () => {
  it('maps 422 details onto matching fields and returns no banner', () => {
    const setError = vi.fn();
    const error = new ApiError(422, 'VALIDATION_ERROR', 'Invalid', [
      { field: 'email', message: 'Enter a valid email' },
      { field: 'password', message: 'Too short' },
    ]);

    const banner = applyServerErrors(error, setError, FIELDS);

    expect(setError).toHaveBeenCalledWith('email', {
      type: 'server',
      message: 'Enter a valid email',
    });
    expect(setError).toHaveBeenCalledWith('password', { type: 'server', message: 'Too short' });
    expect(banner).toBeNull();
  });

  it('uses the last path segment of nested field names', () => {
    const setError = vi.fn();
    const error = new ApiError(422, 'VALIDATION_ERROR', 'Invalid', [
      { field: 'body.email', message: 'Taken' },
    ]);

    applyServerErrors(error, setError, FIELDS);

    expect(setError).toHaveBeenCalledWith('email', { type: 'server', message: 'Taken' });
  });

  it('returns the message of details that match no field', () => {
    const setError = vi.fn();
    const error = new ApiError(422, 'VALIDATION_ERROR', 'Invalid', [
      { field: 'unknown', message: 'Odd' },
    ]);

    expect(applyServerErrors(error, setError, FIELDS)).toBe('Odd');
    expect(setError).not.toHaveBeenCalled();
  });

  it('returns the error message when there are no details', () => {
    const error = new ApiError(409, 'EMAIL_TAKEN', 'That email is already registered');

    expect(applyServerErrors(error, vi.fn(), FIELDS)).toBe('That email is already registered');
  });

  it('returns a generic message for unexpected errors', () => {
    expect(applyServerErrors(new Error('boom'), vi.fn(), FIELDS)).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
