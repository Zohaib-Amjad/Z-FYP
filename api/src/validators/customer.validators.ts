import { z } from 'zod';
import { paginationQuerySchema } from './common';

const CUSTOMER_SORT_FIELDS = ['createdAt', 'lastName', 'email', 'bookingCount'] as const;

export const customerListQuerySchema = paginationQuerySchema.extend({
  q: z
    .string()
    .trim()
    .max(100, 'Search text is too long')
    .optional()
    .transform(value => value || undefined),
  isActive: z
    .enum(['true', 'false'])
    .transform(value => value === 'true')
    .optional(),
  sortBy: z.enum(CUSTOMER_SORT_FIELDS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const customerStatusSchema = z.object({ isActive: z.boolean() }).strict();

export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
