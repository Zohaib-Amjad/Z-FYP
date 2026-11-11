export const VEHICLE_TYPES = [
  'SEDAN',
  'SUV',
  'COUPE',
  'CONVERTIBLE',
  'HATCHBACK',
  'SPORTS',
  'GRAND_TOURER',
  'MPV',
] as const;
export const FUEL_TYPES = ['PETROL', 'DIESEL', 'HYBRID', 'PLUG_IN_HYBRID', 'ELECTRIC'] as const;
export const TRANSMISSIONS = ['AUTOMATIC', 'MANUAL', 'DUAL_CLUTCH'] as const;

export type VehicleType = (typeof VEHICLE_TYPES)[number];
export type FuelType = (typeof FUEL_TYPES)[number];
export type Transmission = (typeof TRANSMISSIONS)[number];

export interface VehicleImage {
  id: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

interface DealershipRef {
  id: string;
  name: string;
  city: string;
}

export interface VehicleListItem {
  id: string;
  manufacturer: string;
  model: string;
  year: number;
  vehicleType: VehicleType;
  fuelType: FuelType;
  transmission: Transmission;
  priceFrom: number | null;
  primaryImage: VehicleImage | null;
  dealerships: DealershipRef[];
  nextAvailableSlotAt: string | null;
}

export interface VehicleDealership extends DealershipRef {
  address: string;
  phone: string;
  email: string;
  openingHours: string;
  upcomingAvailableSlots: number;
}

export interface VehicleDetail {
  id: string;
  manufacturer: string;
  model: string;
  year: number;
  vehicleType: VehicleType;
  fuelType: FuelType;
  transmission: Transmission;
  engine: string | null;
  powerHp: number | null;
  topSpeedKmh: number | null;
  acceleration0to100: number | null;
  seats: number | null;
  color: string | null;
  priceFrom: number | null;
  description: string | null;
  features: string[];
  availabilityNote: string | null;
  images: VehicleImage[];
  dealerships: VehicleDealership[];
}

export interface VehicleFilters {
  manufacturers: string[];
  models: { manufacturer: string; models: string[] }[];
  vehicleTypes: VehicleType[];
  fuelTypes: FuelType[];
  transmissions: Transmission[];
  yearRange: { min: number; max: number } | null;
  priceRange: { min: number; max: number } | null;
  cities: string[];
}

export interface Dealership extends DealershipRef {
  address: string;
  phone: string;
  email: string;
  openingHours: string;
  description: string | null;
}

export interface AvailableSlot {
  id: string;
  startAt: string;
  endAt: string;
  dealership: DealershipRef;
}

export interface VehicleSlots {
  vehicleId: string;
  timeZone: string;
  range: { from: string; to: string };
  dates: string[];
  slotsByDate: Record<string, AvailableSlot[]>;
}
