import { z } from 'zod';
import {
  drivingLicenseSchema,
  emailSchema,
  nameSchema,
  passwordSchema,
  phoneSchema,
} from './common';

const optionalDrivingLicense = z.preprocess(
  value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  drivingLicenseSchema.optional(),
);

// A1: customers can never choose a role. A `role` sent with a registration is accepted and
// discarded (as the specification requires); every other unknown field is rejected.
const ignoredField = z
  .unknown()
  .optional()
  .transform(() => undefined);

export const registerSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    phone: phoneSchema,
    drivingLicenseNumber: optionalDrivingLicense,
    role: ignoredField,
  })
  .strict()
  .refine(data => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
  })
  .strict();

export const createStaffSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    phone: phoneSchema,
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
