import { FuelType, Transmission, VehicleType } from '@prisma/client';
import { z } from 'zod';
import { booleanParam, enumField, optionalText, paginationQuerySchema, uuidSchema } from './common';

const MIN_VEHICLE_YEAR = 1990;
const MAX_FEATURES = 20;
const MAX_FEATURE_LENGTH = 60;
const MAX_DEALERSHIP_LINKS = 100;

const hasAtMostTwoDecimals = (value: number): boolean =>
  Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

const yearField = z
  .number({ invalid_type_error: 'Year must be a number' })
  .int('Year must be a whole number')
  .min(MIN_VEHICLE_YEAR, `Year must be ${MIN_VEHICLE_YEAR} or later`)
  .refine(year => year <= new Date().getFullYear() + 1, {
    message: 'Year cannot be later than next year',
  });

const dedupeFeatures = (features: string[]): string[] => {
  const seen = new Set<string>();
  return features.filter(feature => {
    const key = feature.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const featuresField = z
  .array(
    z
      .string()
      .trim()
      .min(1, 'A feature cannot be empty')
      .max(MAX_FEATURE_LENGTH, `A feature must be at most ${MAX_FEATURE_LENGTH} characters`),
  )
  .max(MAX_FEATURES, `A vehicle can list at most ${MAX_FEATURES} features`)
  .transform(dedupeFeatures);

const text = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

const vehicleFields = {
  manufacturer: text('Manufacturer', 1, 60),
  model: text('Model', 1, 80),
  year: yearField,
  vehicleType: enumField(VehicleType, 'Vehicle type'),
  fuelType: enumField(FuelType, 'Fuel type'),
  transmission: enumField(Transmission, 'Transmission'),
  engine: text('Engine', 2, 120),
  powerHp: z
    .number()
    .int('Power must be a whole number')
    .positive('Power must be greater than 0')
    .max(3000),
  topSpeedKmh: z.number().int().positive('Top speed must be greater than 0').max(600).nullable(),
  acceleration0to100: z
    .number()
    .positive('Acceleration must be greater than 0')
    .max(30, 'Acceleration must be 30 seconds or less')
    .refine(hasAtMostTwoDecimals, 'Use at most two decimal places')
    .nullable(),
  seats: z
    .number()
    .int('Seats must be a whole number')
    .min(1, 'A vehicle needs at least 1 seat')
    .max(9, 'A vehicle can have at most 9 seats'),
  color: text('Colour', 2, 40),
  priceFrom: z
    .number()
    .min(0, 'Price cannot be negative')
    .max(99_999_999, 'Price is too large')
    .refine(hasAtMostTwoDecimals, 'Use at most two decimal places')
    .nullable(),
  description: text('Description', 10, 5000),
  features: featuresField,
  availabilityNote: text('Availability note', 1, 300).nullable(),
};

export const createVehicleSchema = z
  .object({
    ...vehicleFields,
    topSpeedKmh: vehicleFields.topSpeedKmh.optional(),
    acceleration0to100: vehicleFields.acceleration0to100.optional(),
    priceFrom: vehicleFields.priceFrom.optional(),
    features: vehicleFields.features.optional(),
    availabilityNote: vehicleFields.availabilityNote.optional(),
  })
  .strict();

export const updateVehicleSchema = z
  .object({
    manufacturer: vehicleFields.manufacturer.optional(),
    model: vehicleFields.model.optional(),
    year: vehicleFields.year.optional(),
    vehicleType: vehicleFields.vehicleType.optional(),
    fuelType: vehicleFields.fuelType.optional(),
    transmission: vehicleFields.transmission.optional(),
    engine: vehicleFields.engine.optional(),
    powerHp: vehicleFields.powerHp.optional(),
    topSpeedKmh: vehicleFields.topSpeedKmh.optional(),
    acceleration0to100: vehicleFields.acceleration0to100.optional(),
    seats: vehicleFields.seats.optional(),
    color: vehicleFields.color.optional(),
    priceFrom: vehicleFields.priceFrom.optional(),
    description: vehicleFields.description.optional(),
    features: vehicleFields.features.optional(),
    availabilityNote: vehicleFields.availabilityNote.optional(),
  })
  .strict()
  .refine(data => Object.values(data).some(value => value !== undefined), {
    message: 'Provide at least one field to update',
  });

export const adminVehicleQuerySchema = paginationQuerySchema.extend({
  q: optionalText(100),
  manufacturer: optionalText(60),
  vehicleType: enumField(VehicleType, 'Vehicle type').optional(),
  fuelType: enumField(FuelType, 'Fuel type').optional(),
  isActive: booleanParam,
  dealershipId: uuidSchema.optional(),
  sortBy: z
    .enum(['createdAt', 'manufacturer', 'model', 'year', 'powerHp', 'priceFrom'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const replaceDealershipsSchema = z
  .object({
    dealerships: z
      .array(z.object({ dealershipId: uuidSchema, isAvailable: z.boolean() }).strict())
      .max(MAX_DEALERSHIP_LINKS)
      .refine(items => new Set(items.map(item => item.dealershipId)).size === items.length, {
        message: 'Each dealership can only be listed once',
      }),
  })
  .strict();

export const vehicleImageParamsSchema = z.object({ id: uuidSchema, imageId: uuidSchema }).strict();

export const uploadImagesBodySchema = z
  .object({
    altText: text('Alt text', 1, 160).optional(),
  })
  .strict();

export const updateImageSchema = z
  .object({
    altText: text('Alt text', 1, 160).optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    isPrimary: z.boolean().optional(),
  })
  .strict()
  .refine(data => Object.values(data).some(value => value !== undefined), {
    message: 'Provide at least one field to update',
  });

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type AdminVehicleQuery = z.infer<typeof adminVehicleQuerySchema>;
export type ReplaceDealershipsInput = z.infer<typeof replaceDealershipsSchema>;
export type UpdateImageInput = z.infer<typeof updateImageSchema>;
