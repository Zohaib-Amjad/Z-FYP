import { z } from 'zod';
import { booleanParam, isoDateTimeSchema, paginationQuerySchema, uuidSchema } from './common';
import { WEEKDAYS, daysBetween, isRealDate, isValidTimeZone } from '../utils/timeZone';

const MAX_BULK_RANGE_DAYS = 92;
export const MAX_BULK_SLOTS = 500;

const optionalDateTime = isoDateTimeSchema.optional();

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine(isRealDate, 'Enter a real calendar date');

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use the 24-hour format HH:mm');

const timeZoneField = z
  .string()
  .refine(isValidTimeZone, 'Use an IANA time zone such as Europe/London');

export const vehicleSlotsParamsSchema = z.object({ vehicleId: uuidSchema }).strict();

export const availableSlotsQuerySchema = z
  .object({
    dealershipId: uuidSchema.optional(),
    from: optionalDateTime,
    to: optionalDateTime,
    timeZone: timeZoneField.default('UTC'),
  })
  .strict();

export const adminSlotQuerySchema = paginationQuerySchema
  .extend({
    dealershipId: uuidSchema.optional(),
    vehicleId: uuidSchema.optional(),
    from: optionalDateTime,
    to: optionalDateTime,
    isActive: booleanParam,
    hasBooking: booleanParam,
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  })
  .strict()
  .refine(query => !query.from || !query.to || query.from <= query.to, {
    path: ['from'],
    message: 'The start of the range cannot be later than its end',
  });

export const createSlotSchema = z
  .object({
    dealershipId: uuidSchema,
    vehicleId: uuidSchema,
    startAt: isoDateTimeSchema,
    endAt: isoDateTimeSchema,
  })
  .strict();

export const updateSlotSchema = z
  .object({ startAt: optionalDateTime, endAt: optionalDateTime })
  .strict()
  .refine(data => data.startAt !== undefined || data.endAt !== undefined, {
    message: 'Provide a new start time, end time or both',
  });

export const bulkQuerySchema = z.object({ dryRun: booleanParam }).strict();

export const bulkSlotsSchema = z
  .object({
    dealershipId: uuidSchema,
    vehicleId: uuidSchema,
    dateFrom: dateString,
    dateTo: dateString,
    daysOfWeek: z
      .array(
        z.enum(WEEKDAYS, { errorMap: () => ({ message: `Use one of: ${WEEKDAYS.join(', ')}` }) }),
      )
      .min(1, 'Choose at least one day of the week')
      .refine(days => new Set(days).size === days.length, 'List each day only once'),
    dailyStartTime: timeString,
    dailyEndTime: timeString,
    durationMinutes: z
      .number()
      .int()
      .min(15, 'At least 15 minutes')
      .max(240, 'At most 240 minutes'),
    breakMinutes: z.number().int().min(0).max(240).default(0),
    timeZone: timeZoneField.default('UTC'),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.dateTo < input.dateFrom) {
      ctx.addIssue({
        code: 'custom',
        path: ['dateTo'],
        message: 'The end date cannot be before the start date',
      });
    } else if (daysBetween(input.dateFrom, input.dateTo) + 1 > MAX_BULK_RANGE_DAYS) {
      ctx.addIssue({
        code: 'custom',
        path: ['dateTo'],
        message: `The date range can cover at most ${MAX_BULK_RANGE_DAYS} days`,
      });
    }
    if (input.dailyEndTime <= input.dailyStartTime) {
      ctx.addIssue({
        code: 'custom',
        path: ['dailyEndTime'],
        message: 'The daily end time must be after the daily start time',
      });
    }
  });

export type AvailableSlotsQuery = z.infer<typeof availableSlotsQuerySchema>;
export type AdminSlotQuery = z.infer<typeof adminSlotQuerySchema>;
export type CreateSlotInput = z.infer<typeof createSlotSchema>;
export type UpdateSlotInput = z.infer<typeof updateSlotSchema>;
export type BulkSlotsInput = z.infer<typeof bulkSlotsSchema>;
