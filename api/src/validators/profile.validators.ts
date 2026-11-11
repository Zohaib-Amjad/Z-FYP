import { z } from 'zod';
import { drivingLicenseSchema, nameSchema, passwordSchema, phoneSchema } from './common';

export const updateProfileSchema = z
  .object({
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional(),
    phone: phoneSchema.optional(),
    drivingLicenseNumber: drivingLicenseSchema.nullable().optional(),
  })
  .strict()
  .refine(data => Object.values(data).some(value => value !== undefined), {
    message: 'Provide at least one field to update',
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .strict()
  .refine(data => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine(data => data.newPassword !== data.currentPassword, {
    path: ['newPassword'],
    message: 'New password must be different from your current password',
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
