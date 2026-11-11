import { z } from 'zod';
import {
  booleanParam,
  emailSchema,
  optionalText,
  paginationQuerySchema,
  phoneSchema,
  uuidSchema,
} from './common';

const nameField = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(120, 'Name must be at most 120 characters');
const addressField = z
  .string()
  .trim()
  .min(5, 'Address must be at least 5 characters')
  .max(200, 'Address must be at most 200 characters');
const cityField = z
  .string()
  .trim()
  .min(2, 'City must be at least 2 characters')
  .max(80, 'City must be at most 80 characters');
const openingHoursField = z
  .string()
  .trim()
  .min(3, 'Opening hours must be at least 3 characters')
  .max(200, 'Opening hours must be at most 200 characters');
const descriptionField = z
  .string()
  .trim()
  .min(1, 'Description cannot be empty')
  .max(1000, 'Description must be at most 1000 characters');

export const createDealershipSchema = z
  .object({
    name: nameField,
    address: addressField,
    city: cityField,
    phone: phoneSchema,
    email: emailSchema,
    openingHours: openingHoursField,
    description: descriptionField.nullable().optional(),
  })
  .strict();

export const updateDealershipSchema = z
  .object({
    name: nameField.optional(),
    address: addressField.optional(),
    city: cityField.optional(),
    phone: phoneSchema.optional(),
    email: emailSchema.optional(),
    openingHours: openingHoursField.optional(),
    description: descriptionField.nullable().optional(),
  })
  .strict()
  .refine(data => Object.values(data).some(value => value !== undefined), {
    message: 'Provide at least one field to update',
  });

export const publicDealershipQuerySchema = z
  .object({
    vehicleId: uuidSchema.optional(),
    city: optionalText(80),
  })
  .strict();

export const adminDealershipQuerySchema = paginationQuerySchema.extend({
  q: optionalText(100),
  isActive: booleanParam,
  sortBy: z.enum(['name', 'city', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type CreateDealershipInput = z.infer<typeof createDealershipSchema>;
export type UpdateDealershipInput = z.infer<typeof updateDealershipSchema>;
export type PublicDealershipQuery = z.infer<typeof publicDealershipQuerySchema>;
export type AdminDealershipQuery = z.infer<typeof adminDealershipQuerySchema>;
