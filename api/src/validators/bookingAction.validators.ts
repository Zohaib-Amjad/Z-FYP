import { z } from 'zod';
import { uuidSchema } from './common';

const MIN_REASON_LENGTH = 5;
const MAX_NOTE_LENGTH = 500;

const reasonField = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(MIN_REASON_LENGTH, `${label} must be at least ${MIN_REASON_LENGTH} characters`)
    .max(MAX_NOTE_LENGTH, `${label} must be at most ${MAX_NOTE_LENGTH} characters`);

const optionalNote = z
  .string()
  .trim()
  .max(MAX_NOTE_LENGTH, `Notes can be at most ${MAX_NOTE_LENGTH} characters`)
  .nullable()
  .optional();

export const approveSchema = z.object({ staffNote: optionalNote }).strict();

export const rejectSchema = z
  .object({ rejectionReason: reasonField('The rejection reason') })
  .strict();

export const cancelSchema = z
  .object({ cancellationReason: reasonField('The cancellation reason') })
  .strict();

export const completeSchema = z.object({ staffNote: optionalNote }).strict();

export const rescheduleSchema = z.object({ newSlotId: uuidSchema, note: optionalNote }).strict();

export type ApproveInput = z.infer<typeof approveSchema>;
export type RejectInput = z.infer<typeof rejectSchema>;
export type CancelInput = z.infer<typeof cancelSchema>;
export type CompleteInput = z.infer<typeof completeSchema>;
export type RescheduleInput = z.infer<typeof rescheduleSchema>;
