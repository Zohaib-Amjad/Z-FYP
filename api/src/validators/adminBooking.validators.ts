import { BookingStatus } from '@prisma/client';
import { z } from 'zod';
import {
  booleanParam,
  enumField,
  isoDateTimeSchema,
  multiValue,
  optionalText,
  paginationQuerySchema,
  uuidSchema,
} from './common';

const ADMIN_BOOKING_SORTS = ['slotStartAsc', 'slotStartDesc', 'createdDesc'] as const;

const addRangeIssue = (ctx: z.RefinementCtx, path: string, message: string): void =>
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

export const adminBookingsQuerySchema = paginationQuerySchema
  .extend({
    status: multiValue(enumField(BookingStatus, 'Status')),
    dealershipId: uuidSchema.optional(),
    vehicleId: uuidSchema.optional(),
    customerId: uuidSchema.optional(),
    q: optionalText(100),
    dateFrom: isoDateTimeSchema.optional(),
    dateTo: isoDateTimeSchema.optional(),
    createdFrom: isoDateTimeSchema.optional(),
    createdTo: isoDateTimeSchema.optional(),
    upcomingOnly: booleanParam,
    sort: z
      .enum(ADMIN_BOOKING_SORTS, {
        errorMap: () => ({ message: `Sort must be one of: ${ADMIN_BOOKING_SORTS.join(', ')}` }),
      })
      .default('createdDesc'),
  })
  .strict()
  .superRefine((query, ctx) => {
    if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
      addRangeIssue(ctx, 'dateFrom', 'The start of the date range cannot be later than its end');
    }
    if (query.createdFrom && query.createdTo && query.createdFrom > query.createdTo) {
      addRangeIssue(
        ctx,
        'createdFrom',
        'The start of the created range cannot be later than its end',
      );
    }
  });

export type AdminBookingsQuery = z.infer<typeof adminBookingsQuerySchema>;
