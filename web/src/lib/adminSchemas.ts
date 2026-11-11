import { z } from 'zod';
import { FUEL_TYPES, TRANSMISSIONS, VEHICLE_TYPES } from '@/types';

/**
 * Client-side mirrors of the administration validators (api/src/validators). The server remains
 * the authority; these give instant feedback. Number fields are held as strings in the forms and
 * converted by the `to...Payload` functions below.
 */

const MIN_VEHICLE_YEAR = 1990;
export const MAX_FEATURES = 20;
export const MAX_FEATURE_LENGTH = 60;

const text = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

const optionalText = (label: string, max: number) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`);

const blank = (value: string) => value.trim() === '';

const wholeNumber = (label: string, min: number, max: number, required: boolean) =>
  z
    .string()
    .trim()
    .superRefine((value, context) => {
      if (blank(value)) {
        if (required) context.addIssue({ code: 'custom', message: `${label} is required` });
        return;
      }
      const number = Number(value);
      if (!/^\d+$/.test(value) || !Number.isInteger(number)) {
        context.addIssue({ code: 'custom', message: `${label} must be a whole number` });
      } else if (number < min || number > max) {
        context.addIssue({ code: 'custom', message: `${label} must be between ${min} and ${max}` });
      }
    });

const twoDecimals = (value: number): boolean =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

const decimalNumber = (label: string, min: number, max: number, exclusiveMin = false) =>
  z
    .string()
    .trim()
    .superRefine((value, context) => {
      if (blank(value)) return;
      const number = Number(value);
      if (!/^\d+(\.\d+)?$/.test(value)) {
        context.addIssue({ code: 'custom', message: `${label} must be a number` });
      } else if (exclusiveMin ? number <= min : number < min) {
        context.addIssue({
          code: 'custom',
          message: exclusiveMin
            ? `${label} must be greater than ${min}`
            : `${label} cannot be negative`,
        });
      } else if (number > max) {
        context.addIssue({ code: 'custom', message: `${label} is too large` });
      } else if (!twoDecimals(number)) {
        context.addIssue({ code: 'custom', message: 'Use at most two decimal places' });
      }
    });

/* ---------------------------------------------------------------- vehicle */

export const vehicleSchema = z.object({
  manufacturer: text('Manufacturer', 1, 60),
  model: text('Model', 1, 80),
  year: wholeNumber('Year', MIN_VEHICLE_YEAR, new Date().getFullYear() + 1, true),
  vehicleType: z.enum(VEHICLE_TYPES, { errorMap: () => ({ message: 'Choose a vehicle type' }) }),
  fuelType: z.enum(FUEL_TYPES, { errorMap: () => ({ message: 'Choose a fuel type' }) }),
  transmission: z.enum(TRANSMISSIONS, { errorMap: () => ({ message: 'Choose a transmission' }) }),
  engine: text('Engine', 2, 120),
  powerHp: wholeNumber('Power', 1, 3000, true),
  topSpeedKmh: wholeNumber('Top speed', 1, 600, false),
  acceleration0to100: decimalNumber('Acceleration', 0, 30, true),
  seats: wholeNumber('Seats', 1, 9, true),
  color: text('Colour', 2, 40),
  priceFrom: decimalNumber('Price', 0, 99_999_999),
  description: text('Description', 10, 5000),
  features: z
    .array(text('A feature', 1, MAX_FEATURE_LENGTH))
    .max(MAX_FEATURES, `A vehicle can list at most ${MAX_FEATURES} features`),
  availabilityNote: optionalText('Availability note', 300),
});

export type VehicleFormValues = z.infer<typeof vehicleSchema>;

export interface VehiclePayload {
  manufacturer: string;
  model: string;
  year: number;
  vehicleType: string;
  fuelType: string;
  transmission: string;
  engine: string;
  powerHp: number;
  topSpeedKmh: number | null;
  acceleration0to100: number | null;
  seats: number;
  color: string;
  priceFrom: number | null;
  description: string;
  features: string[];
  availabilityNote: string | null;
}

const optionalNumber = (value: string): number | null => (blank(value) ? null : Number(value));

export function toVehiclePayload(values: VehicleFormValues): VehiclePayload {
  return {
    manufacturer: values.manufacturer.trim(),
    model: values.model.trim(),
    year: Number(values.year),
    vehicleType: values.vehicleType,
    fuelType: values.fuelType,
    transmission: values.transmission,
    engine: values.engine.trim(),
    powerHp: Number(values.powerHp),
    topSpeedKmh: optionalNumber(values.topSpeedKmh),
    acceleration0to100: optionalNumber(values.acceleration0to100),
    seats: Number(values.seats),
    color: values.color.trim(),
    priceFrom: optionalNumber(values.priceFrom),
    description: values.description.trim(),
    features: values.features,
    availabilityNote: blank(values.availabilityNote) ? null : values.availabilityNote.trim(),
  };
}

/* ------------------------------------------------------------- dealership */

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s()-]{6,19}$/, 'Enter a valid phone number');

export const dealershipSchema = z.object({
  name: text('Name', 2, 120),
  address: text('Address', 5, 200),
  city: text('City', 2, 80),
  phone,
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address')
    .max(254),
  openingHours: text('Opening hours', 3, 200),
  description: optionalText('Description', 1000),
});

export type DealershipFormValues = z.infer<typeof dealershipSchema>;

export function toDealershipPayload(values: DealershipFormValues) {
  return {
    name: values.name.trim(),
    address: values.address.trim(),
    city: values.city.trim(),
    phone: values.phone.trim(),
    email: values.email.trim().toLowerCase(),
    openingHours: values.openingHours.trim(),
    description: blank(values.description) ? null : values.description.trim(),
  };
}

/* ------------------------------------------------------------------ slots */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const dateField = (label: string) => z.string().regex(DATE, `Choose ${label}`);
const timeField = (label: string) => z.string().regex(TIME, `Enter ${label} as HH:mm`);

export const slotSchema = z
  .object({
    dealershipId: z.string().min(1, 'Choose a showroom'),
    vehicleId: z.string().min(1, 'Choose a vehicle'),
    date: dateField('a date'),
    startTime: timeField('the start time'),
    endTime: timeField('the end time'),
  })
  .refine(values => values.endTime > values.startTime, {
    path: ['endTime'],
    message: 'The end time must be after the start time',
  });

type SlotFormValues = z.infer<typeof slotSchema>;

export const slotTimesSchema = z
  .object({
    date: dateField('a date'),
    startTime: timeField('the start time'),
    endTime: timeField('the end time'),
  })
  .refine(values => values.endTime > values.startTime, {
    path: ['endTime'],
    message: 'The end time must be after the start time',
  });

type SlotTimesValues = z.infer<typeof slotTimesSchema>;

/** A local calendar date and clock time as the matching UTC instant (ISO string). */
export function localToIso(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes).toISOString();
}

export const WEEKDAY_OPTIONS = [
  { value: 'MON', label: 'Mon' },
  { value: 'TUE', label: 'Tue' },
  { value: 'WED', label: 'Wed' },
  { value: 'THU', label: 'Thu' },
  { value: 'FRI', label: 'Fri' },
  { value: 'SAT', label: 'Sat' },
  { value: 'SUN', label: 'Sun' },
] as const;

const MAX_BULK_RANGE_DAYS = 92;

const daysInclusive = (from: string, to: string): number => {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000) + 1;
};

export const bulkSchema = z
  .object({
    dealershipId: z.string().min(1, 'Choose a showroom'),
    vehicleId: z.string().min(1, 'Choose a vehicle'),
    dateFrom: dateField('a start date'),
    dateTo: dateField('an end date'),
    daysOfWeek: z.array(z.string()).min(1, 'Choose at least one day of the week'),
    dailyStartTime: timeField('the daily start time'),
    dailyEndTime: timeField('the daily end time'),
    durationMinutes: wholeNumber('Slot length', 15, 240, true),
    breakMinutes: wholeNumber('Break', 0, 240, false),
  })
  .superRefine((values, context) => {
    if (DATE.test(values.dateFrom) && DATE.test(values.dateTo)) {
      if (values.dateTo < values.dateFrom) {
        context.addIssue({
          code: 'custom',
          path: ['dateTo'],
          message: 'The end date cannot be before the start date',
        });
      } else if (daysInclusive(values.dateFrom, values.dateTo) > MAX_BULK_RANGE_DAYS) {
        context.addIssue({
          code: 'custom',
          path: ['dateTo'],
          message: `The date range can cover at most ${MAX_BULK_RANGE_DAYS} days`,
        });
      }
    }
    if (
      TIME.test(values.dailyStartTime) &&
      TIME.test(values.dailyEndTime) &&
      values.dailyEndTime <= values.dailyStartTime
    ) {
      context.addIssue({
        code: 'custom',
        path: ['dailyEndTime'],
        message: 'The daily end time must be after the daily start time',
      });
    }
  });

export type BulkFormValues = z.infer<typeof bulkSchema>;

export function toBulkPayload(values: BulkFormValues, timeZone: string) {
  return {
    dealershipId: values.dealershipId,
    vehicleId: values.vehicleId,
    dateFrom: values.dateFrom,
    dateTo: values.dateTo,
    daysOfWeek: values.daysOfWeek,
    dailyStartTime: values.dailyStartTime,
    dailyEndTime: values.dailyEndTime,
    durationMinutes: Number(values.durationMinutes),
    breakMinutes: blank(values.breakMinutes) ? 0 : Number(values.breakMinutes),
    timeZone,
  };
}

/* ------------------------------------------------------------------ staff */

export const staffSchema = z.object({
  firstName: text('First name', 1, 80),
  lastName: text('Last name', 1, 80),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address')
    .max(254),
  phone,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

type StaffFormValues = z.infer<typeof staffSchema>;

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** A random temporary password that satisfies the password rules (letters and numbers). */
export function generateTemporaryPassword(random: (max: number) => number, length = 14): string {
  const chars = Array.from({ length }, () => PASSWORD_ALPHABET[random(PASSWORD_ALPHABET.length)]);
  chars[0] = 'ABCDEFGHJKLMNPQRSTUVWXYZ'[random(24)];
  chars[1] = 'abcdefghijkmnpqrstuvwxyz'[random(24)];
  chars[2] = '23456789'[random(8)];
  return chars.join('');
}

/** Cryptographically random integer below `max`, for the browser. */
export function randomBelow(max: number): number {
  const buffer = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
}
