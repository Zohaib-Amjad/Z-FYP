import { z } from 'zod';
import { uuidSchema } from './common';

const MAX_CUSTOMER_NOTE_LENGTH = 500;

export const createBookingSchema = z
  .object({
    slotId: uuidSchema,
    customerNote: z
      .string()
      .trim()
      .max(MAX_CUSTOMER_NOTE_LENGTH, `Notes can be at most ${MAX_CUSTOMER_NOTE_LENGTH} characters`)
      .nullable()
      .optional(),
  })
  .strict();

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
