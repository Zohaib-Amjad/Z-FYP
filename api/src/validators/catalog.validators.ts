import { FuelType, Transmission, VehicleType } from '@prisma/client';
import { z } from 'zod';
import {
  booleanParam,
  enumField,
  multiValue,
  optionalText,
  paginationQuerySchema,
  uuidSchema,
} from './common';

const CATALOG_SORTS = ['newest', 'priceAsc', 'priceDesc', 'manufacturerAsc', 'powerDesc'] as const;

const textValue = (label: string) =>
  z.string().trim().min(1, `${label} cannot be empty`).max(80, `${label} is too long`);

const numberParam = (label: string, schema: z.ZodNumber) =>
  z.preprocess(
    value => (value === '' ? undefined : value),
    z.coerce
      .number({ invalid_type_error: `${label} must be a number` })
      .pipe(schema)
      .optional(),
  );

const yearParam = (label: string) =>
  numberParam(label, z.number().int(`${label} must be a whole year`).min(1900).max(2100));

const priceParam = (label: string) =>
  numberParam(label, z.number().min(0, `${label} cannot be negative`));

export const catalogQuerySchema = paginationQuerySchema
  .extend({
    q: optionalText(100),
    manufacturer: multiValue(textValue('Manufacturer')),
    model: multiValue(textValue('Model')),
    vehicleType: multiValue(enumField(VehicleType, 'Vehicle type')),
    fuelType: multiValue(enumField(FuelType, 'Fuel type')),
    transmission: multiValue(enumField(Transmission, 'Transmission')),
    dealershipId: uuidSchema.optional(),
    city: optionalText(80),
    minYear: yearParam('Minimum year'),
    maxYear: yearParam('Maximum year'),
    minPrice: priceParam('Minimum price'),
    maxPrice: priceParam('Maximum price'),
    availableOnly: booleanParam,
    sort: z
      .enum(CATALOG_SORTS, {
        errorMap: () => ({ message: `Sort must be one of: ${CATALOG_SORTS.join(', ')}` }),
      })
      .default('newest'),
  })
  .strict()
  .superRefine((query, ctx) => {
    if (
      query.minYear !== undefined &&
      query.maxYear !== undefined &&
      query.minYear > query.maxYear
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minYear'],
        message: 'Minimum year cannot be later than the maximum year',
      });
    }
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minPrice'],
        message: 'Minimum price cannot be higher than the maximum price',
      });
    }
  });

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
