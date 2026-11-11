import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../utils/pagination';

export const uuidSchema = z.string().uuid('Must be a valid identifier');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email address is too long')
  .email('Enter a valid email address')
  // Plain addresses only: no quoted local parts, routing characters or extra @ signs, which some mail
  // libraries interpret differently from validators (see docs/security.md, nodemailer advisory).
  .regex(/^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/, 'Enter a valid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'This field is required')
  .max(80, 'Must be at most 80 characters');

export const drivingLicenseSchema = z
  .string()
  .trim()
  .min(5, 'Enter a valid driving licence number')
  .max(30, 'Enter a valid driving licence number')
  .regex(/^[A-Za-z0-9 -]+$/, 'Enter a valid driving licence number');

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s()-]{6,19}$/, 'Enter a valid phone number');

export const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: 'Must be an ISO 8601 date-time' })
  .transform(value => new Date(value));

export const idParamsSchema = z.object({ id: uuidSchema }).strict();

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .strict();

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .transform(value => value || undefined);

export const booleanParam = z.preprocess(
  value => (value === '' ? undefined : value),
  z
    .enum(['true', 'false'], { errorMap: () => ({ message: 'Must be true or false' }) })
    .transform(value => value === 'true')
    .optional(),
);

export const enumField = <T extends Record<string, string>>(values: T, label: string) =>
  z.nativeEnum(values, {
    errorMap: () => ({ message: `${label} must be one of: ${Object.values(values).join(', ')}` }),
  });

const MAX_FILTER_VALUES = 20;

const toList = (value: unknown): unknown => {
  const items = Array.isArray(value) ? value : [value];
  if (!items.every((item): item is string => typeof item === 'string')) return value;
  const parts = items
    .flatMap(item => item.split(','))
    .map(part => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
};

export const multiValue = <T extends z.ZodTypeAny>(element: T) =>
  z.preprocess(
    value => (value === undefined ? undefined : toList(value)),
    z
      .array(element)
      .max(MAX_FILTER_VALUES, `Provide at most ${MAX_FILTER_VALUES} values`)
      .optional(),
  );
