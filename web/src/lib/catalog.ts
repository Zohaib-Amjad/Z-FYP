import {
  FUEL_TYPES,
  TRANSMISSIONS,
  VEHICLE_TYPES,
  type FuelType,
  type Transmission,
  type VehicleFilters,
  type VehicleType,
} from '@/types';
import { enumLabel, formatPrice } from '@/lib/format';

export const CATALOG_PAGE_SIZE = 12;

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'priceAsc', label: 'Price: low to high' },
  { value: 'priceDesc', label: 'Price: high to low' },
  { value: 'manufacturerAsc', label: 'Manufacturer A to Z' },
  { value: 'powerDesc', label: 'Most powerful' },
] as const;

export type CatalogSort = (typeof SORT_OPTIONS)[number]['value'];

export interface CatalogFilters {
  q: string;
  manufacturer: string;
  model: string;
  vehicleType: VehicleType | '';
  fuelType: FuelType | '';
  transmission: Transmission | '';
  city: string;
  minYear: string;
  maxYear: string;
  minPrice: string;
  maxPrice: string;
  availableOnly: boolean;
  sort: CatalogSort;
  page: number;
}

export const DEFAULT_FILTERS: CatalogFilters = {
  q: '',
  manufacturer: '',
  model: '',
  vehicleType: '',
  fuelType: '',
  transmission: '',
  city: '',
  minYear: '',
  maxYear: '',
  minPrice: '',
  maxPrice: '',
  availableOnly: false,
  sort: 'newest',
  page: 1,
};

type RawParams = { get: (name: string) => string | null };

const oneOf = <T extends string>(value: string | null, allowed: readonly T[]): T | '' =>
  allowed.includes(value as T) ? (value as T) : '';

const wholeNumber = (value: string | null): string =>
  value !== null && /^\d{1,9}$/.test(value) ? value : '';

/** Reads filters from a query string, ignoring anything invalid so a hand-edited URL never breaks the page. */
export function parseFilters(params: RawParams): CatalogFilters {
  const sort = SORT_OPTIONS.find(option => option.value === params.get('sort'))?.value;
  const page = Number(params.get('page'));
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    manufacturer: (params.get('manufacturer') ?? '').slice(0, 80),
    model: (params.get('model') ?? '').slice(0, 80),
    vehicleType: oneOf(params.get('vehicleType'), VEHICLE_TYPES),
    fuelType: oneOf(params.get('fuelType'), FUEL_TYPES),
    transmission: oneOf(params.get('transmission'), TRANSMISSIONS),
    city: (params.get('city') ?? '').slice(0, 80),
    minYear: wholeNumber(params.get('minYear')),
    maxYear: wholeNumber(params.get('maxYear')),
    minPrice: wholeNumber(params.get('minPrice')),
    maxPrice: wholeNumber(params.get('maxPrice')),
    availableOnly: params.get('availableOnly') === 'true',
    sort: sort ?? DEFAULT_FILTERS.sort,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

type QueryValue = string | number | boolean;

/** Only values that differ from the defaults, so shareable URLs stay short. */
export function toSearchParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  (Object.keys(DEFAULT_FILTERS) as (keyof CatalogFilters)[]).forEach(key => {
    const value = filters[key];
    if (value === DEFAULT_FILTERS[key]) return;
    params.set(key, String(value));
  });
  return params;
}

export function toApiQuery(filters: CatalogFilters): Record<string, QueryValue | undefined> {
  return {
    q: filters.q.trim() || undefined,
    manufacturer: filters.manufacturer || undefined,
    model: filters.model || undefined,
    vehicleType: filters.vehicleType || undefined,
    fuelType: filters.fuelType || undefined,
    transmission: filters.transmission || undefined,
    city: filters.city || undefined,
    minYear: filters.minYear || undefined,
    maxYear: filters.maxYear || undefined,
    minPrice: filters.minPrice || undefined,
    maxPrice: filters.maxPrice || undefined,
    availableOnly: filters.availableOnly ? true : undefined,
    sort: filters.sort,
    page: filters.page,
    pageSize: CATALOG_PAGE_SIZE,
  };
}

/** Applies a change. Any filter change returns to page 1; changing the manufacturer drops the model. */
export function applyChange(
  current: CatalogFilters,
  change: Partial<CatalogFilters>,
): CatalogFilters {
  const next = { ...current, ...change };
  if (!('page' in change)) next.page = 1;
  if (change.manufacturer !== undefined && change.manufacturer !== current.manufacturer)
    next.model = '';
  return next;
}

export interface FilterChip {
  key: keyof CatalogFilters | 'year' | 'price';
  label: string;
}

/** One chip per active filter; year and price ranges collapse into a single chip each. */
export function activeChips(filters: CatalogFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.q.trim()) chips.push({ key: 'q', label: `“${filters.q.trim()}”` });
  if (filters.manufacturer) chips.push({ key: 'manufacturer', label: filters.manufacturer });
  if (filters.model) chips.push({ key: 'model', label: filters.model });
  if (filters.vehicleType)
    chips.push({ key: 'vehicleType', label: enumLabel(filters.vehicleType) });
  if (filters.fuelType) chips.push({ key: 'fuelType', label: enumLabel(filters.fuelType) });
  if (filters.transmission)
    chips.push({ key: 'transmission', label: enumLabel(filters.transmission) });
  if (filters.city) chips.push({ key: 'city', label: filters.city });
  if (filters.minYear || filters.maxYear) {
    chips.push({
      key: 'year',
      label: `Year ${filters.minYear || 'any'} to ${filters.maxYear || 'any'}`,
    });
  }
  if (filters.minPrice || filters.maxPrice) {
    const low = filters.minPrice ? formatPrice(Number(filters.minPrice)) : 'any';
    const high = filters.maxPrice ? formatPrice(Number(filters.maxPrice)) : 'any';
    chips.push({ key: 'price', label: `Price ${low} to ${high}` });
  }
  if (filters.availableOnly) chips.push({ key: 'availableOnly', label: 'Has available slots' });
  return chips;
}

export function removeChip(filters: CatalogFilters, key: FilterChip['key']): CatalogFilters {
  if (key === 'year') return applyChange(filters, { minYear: '', maxYear: '' });
  if (key === 'price') return applyChange(filters, { minPrice: '', maxPrice: '' });
  return applyChange(filters, { [key]: DEFAULT_FILTERS[key] } as Partial<CatalogFilters>);
}

export function clearAll(filters: CatalogFilters): CatalogFilters {
  return { ...DEFAULT_FILTERS, sort: filters.sort };
}

/** Models of the chosen manufacturer, or every model when none is chosen. */
export function modelOptions(options: VehicleFilters | undefined, manufacturer: string): string[] {
  if (!options) return [];
  const groups = manufacturer
    ? options.models.filter(group => group.manufacturer === manufacturer)
    : options.models;
  return groups.flatMap(group => group.models);
}
