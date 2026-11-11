import { z } from 'zod';

/**
 * Client-side mirrors of the API validators (api/src/validators). The server stays the
 * authority; these give instant feedback. Keep the rules in sync with the API.
 */

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  { id: 'letter', label: 'One letter', test: (value: string) => /[A-Za-z]/.test(value) },
  { id: 'number', label: 'One number', test: (value: string) => /[0-9]/.test(value) },
] as const;

const email = z
  .string()
  .trim()
  .min(1, 'Enter your email address')
  .max(254, 'Email address is too long')
  .email('Enter a valid email address');

const name = z
  .string()
  .trim()
  .min(1, 'This field is required')
  .max(80, 'Must be at most 80 characters');

const phone = z
  .string()
  .trim()
  .min(1, 'Enter your phone number')
  .regex(/^\+?[0-9][0-9\s()-]{6,19}$/, 'Enter a valid phone number');

const drivingLicence = z
  .string()
  .trim()
  .refine(
    value => value === '' || /^[A-Za-z0-9 -]{5,30}$/.test(value),
    'Enter a valid driving licence number',
  );

const newPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});

export const registerSchema = z
  .object({
    firstName: name,
    lastName: name,
    email,
    phone,
    drivingLicenseNumber: drivingLicence,
    password: newPassword,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine(data => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const profileSchema = z.object({
  firstName: name,
  lastName: name,
  phone,
  drivingLicenseNumber: drivingLicence,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;
type ProfileValues = z.infer<typeof profileSchema>;
type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const MAX_NOTE_LENGTH = 500;

/** Booking confirmation form; the licence number is required only when the profile has none. */
export const bookingConfirmSchema = (needsLicence: boolean) =>
  z
    .object({
      customerNote: z
        .string()
        .trim()
        .max(MAX_NOTE_LENGTH, `Notes can be at most ${MAX_NOTE_LENGTH} characters`),
      licenceConfirmed: z.boolean(),
      drivingLicenseNumber: drivingLicence,
    })
    .superRefine((values, context) => {
      if (!values.licenceConfirmed) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['licenceConfirmed'],
          message: 'Please confirm that you hold a valid driving licence',
        });
      }
      if (needsLicence && values.drivingLicenseNumber === '') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['drivingLicenseNumber'],
          message: 'Enter your driving licence number',
        });
      }
    });

type BookingConfirmValues = z.infer<ReturnType<typeof bookingConfirmSchema>>;
