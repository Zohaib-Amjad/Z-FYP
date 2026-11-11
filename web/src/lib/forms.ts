import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/lib/api';

/** Pins a whole error code to one field, e.g. EMAIL_TAKEN -> email. */
export type CodeFieldMap = Partial<Record<ApiError['code'], string>>;

/**
 * Form convention: react-hook-form + zodResolver for client validation; whatever the server
 * still rejects (422 details) is mapped back onto the matching fields with this helper.
 * Returns a message for errors that belong to no field so the form can show it as a banner.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly string[],
  codeFields: CodeFieldMap = {},
): string | null {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }
  const pinned = codeFields[error.code];
  if (pinned && knownFields.includes(pinned)) {
    setError(pinned as Path<T>, { type: 'server', message: error.message });
    return null;
  }
  const unmatched: string[] = [];
  for (const detail of error.details) {
    const field = detail.field.split('.').pop() ?? detail.field;
    if (knownFields.includes(field)) {
      setError(field as Path<T>, { type: 'server', message: detail.message });
    } else {
      unmatched.push(detail.message);
    }
  }
  const hasFieldErrors = error.details.length > unmatched.length;
  if (hasFieldErrors && unmatched.length === 0) return null;
  return unmatched[0] ?? error.message;
}
