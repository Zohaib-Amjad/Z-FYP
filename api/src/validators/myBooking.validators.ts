import { z } from 'zod';
import { paginationQuerySchema } from './common';

export const MY_BOOKING_VIEWS = [
  'pending',
  'upcoming',
  'completed',
  'cancelled',
  'previous',
  'all',
] as const;

export type MyBookingView = (typeof MY_BOOKING_VIEWS)[number];

export const myBookingsQuerySchema = paginationQuerySchema
  .extend({
    view: z
      .enum(MY_BOOKING_VIEWS, {
        errorMap: () => ({ message: `View must be one of: ${MY_BOOKING_VIEWS.join(', ')}` }),
      })
      .default('all'),
  })
  .strict();

export const cancelMyBookingSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .max(500, 'The reason can be at most 500 characters')
      .nullable()
      .optional(),
  })
  .strict();

export type MyBookingsQuery = z.infer<typeof myBookingsQuerySchema>;
export type CancelMyBookingInput = z.infer<typeof cancelMyBookingSchema>;
