import { z } from 'zod';
import { isValidTimeZone } from '../utils/timeZone';

const MAX_TREND_DAYS = 90;
const MAX_TOP_VEHICLE_DAYS = 365;
const MAX_TOP_VEHICLES = 20;

const timeZoneField = z
  .string()
  .refine(isValidTimeZone, 'Use an IANA time zone such as Europe/London')
  .default('UTC');

const daysField = (max: number, fallback: number) =>
  z.coerce
    .number({ invalid_type_error: 'Days must be a number' })
    .int('Days must be a whole number')
    .min(1, 'Days must be at least 1')
    .max(max, `Days can be at most ${max}`)
    .default(fallback);

export const summaryQuerySchema = z.object({ timeZone: timeZoneField }).strict();

export const trendQuerySchema = z
  .object({ days: daysField(MAX_TREND_DAYS, 14), timeZone: timeZoneField })
  .strict();

export const topVehiclesQuerySchema = z
  .object({
    days: daysField(MAX_TOP_VEHICLE_DAYS, 30),
    limit: z.coerce.number().int().min(1).max(MAX_TOP_VEHICLES).default(5),
  })
  .strict();

export type SummaryQuery = z.infer<typeof summaryQuerySchema>;
export type TrendQuery = z.infer<typeof trendQuerySchema>;
export type TopVehiclesQuery = z.infer<typeof topVehiclesQuerySchema>;
