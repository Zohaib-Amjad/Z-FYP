import type { Prisma } from '@prisma/client';

export const VEHICLE_SELECT = {
  id: true,
  manufacturer: true,
  model: true,
  year: true,
  vehicleType: true,
  fuelType: true,
  transmission: true,
  engine: true,
  powerHp: true,
  topSpeedKmh: true,
  acceleration0to100: true,
  seats: true,
  color: true,
  priceFrom: true,
  description: true,
  features: true,
  availabilityNote: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VehicleSelect;

export const PUBLIC_VEHICLE_SELECT = {
  id: true,
  manufacturer: true,
  model: true,
  year: true,
  vehicleType: true,
  fuelType: true,
  transmission: true,
  engine: true,
  powerHp: true,
  topSpeedKmh: true,
  acceleration0to100: true,
  seats: true,
  color: true,
  priceFrom: true,
  description: true,
  features: true,
  availabilityNote: true,
} satisfies Prisma.VehicleSelect;

export const IMAGE_SELECT = {
  id: true,
  url: true,
  altText: true,
  isPrimary: true,
  sortOrder: true,
} satisfies Prisma.VehicleImageSelect;

export const IMAGE_ORDER: Prisma.VehicleImageOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
];

type VehicleRow = Prisma.VehicleGetPayload<{ select: typeof VEHICLE_SELECT }>;

export const toVehicleDto = (row: VehicleRow) => ({
  ...row,
  acceleration0to100: row.acceleration0to100?.toNumber() ?? null,
  priceFrom: row.priceFrom?.toNumber() ?? null,
});

type PublicVehicleRow = Prisma.VehicleGetPayload<{ select: typeof PUBLIC_VEHICLE_SELECT }>;

export const toPublicVehicle = (row: PublicVehicleRow) => ({
  ...row,
  acceleration0to100: row.acceleration0to100?.toNumber() ?? null,
  priceFrom: row.priceFrom?.toNumber() ?? null,
});
