import { endOfDay, startOfDay } from 'date-fns';
import { FUEL_TYPES, VEHICLE_TYPES, type FuelType, type VehicleType } from '@/types';

type RawParams = { get: (name: string) => string | null };

export type ActiveFilter = '' | 'true' | 'false';

const ACTIVE_VALUES: ActiveFilter[] = ['', 'true', 'false'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const oneOf = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const page = (params: RawParams): number => {
  const value = Number(params.get('page'));
  return Number.isInteger(value) && value > 1 ? value : 1;
};

const text = (params: RawParams, name: string, max = 100): string =>
  (params.get(name) ?? '').slice(0, max);

const id = (params: RawParams, name: string): string => {
  const value = params.get(name);
  return value && UUID.test(value) ? value : '';
};

const date = (params: RawParams, name: string): string => {
  const value = params.get(name);
  return value && DATE.test(value) ? value : '';
};

/** Query string with only the values that differ from the defaults. */
export function toParams<T extends object>(filters: T, defaults: T): URLSearchParams {
  const params = new URLSearchParams();
  (Object.keys(defaults) as (keyof T)[]).forEach(key => {
    const value = filters[key];
    if (value !== defaults[key] && value !== undefined && value !== null)
      params.set(String(key), String(value));
  });
  return params;
}

/** Any filter change returns to page 1 unless the page itself is being changed. */
export function applyListChange<T extends { page: number }>(current: T, change: Partial<T>): T {
  const next = { ...current, ...change };
  if (!('page' in change)) next.page = 1;
  return next;
}

/* --------------------------------------------------------------- vehicles */

export const VEHICLE_SORTS = [
  { value: 'createdAt:desc', label: 'Recently added' },
  { value: 'manufacturer:asc', label: 'Manufacturer A to Z' },
  { value: 'year:desc', label: 'Newest model year' },
  { value: 'priceFrom:desc', label: 'Price: high to low' },
  { value: 'priceFrom:asc', label: 'Price: low to high' },
  { value: 'powerHp:desc', label: 'Most powerful' },
] as const;

export interface VehicleListFilters {
  q: string;
  vehicleType: VehicleType | '';
  fuelType: FuelType | '';
  isActive: ActiveFilter;
  sort: (typeof VEHICLE_SORTS)[number]['value'];
  page: number;
}

export const DEFAULT_VEHICLE_FILTERS: VehicleListFilters = {
  q: '',
  vehicleType: '',
  fuelType: '',
  isActive: '',
  sort: 'createdAt:desc',
  page: 1,
};

export function parseVehicleFilters(params: RawParams): VehicleListFilters {
  return {
    q: text(params, 'q'),
    vehicleType: oneOf(params.get('vehicleType'), VEHICLE_TYPES, '' as VehicleType | ''),
    fuelType: oneOf(params.get('fuelType'), FUEL_TYPES, '' as FuelType | ''),
    isActive: oneOf(params.get('isActive'), ACTIVE_VALUES, ''),
    sort: oneOf(
      params.get('sort'),
      VEHICLE_SORTS.map(option => option.value),
      DEFAULT_VEHICLE_FILTERS.sort,
    ),
    page: page(params),
  };
}

const ADMIN_LIST_PAGE_SIZE = 12;

export function toVehicleApiQuery(filters: VehicleListFilters) {
  const [sortBy, sortOrder] = filters.sort.split(':');
  return {
    q: filters.q.trim() || undefined,
    vehicleType: filters.vehicleType || undefined,
    fuelType: filters.fuelType || undefined,
    isActive: filters.isActive || undefined,
    sortBy,
    sortOrder,
    page: filters.page,
    pageSize: ADMIN_LIST_PAGE_SIZE,
  };
}

/* ------------------------------------------------------------ dealerships */

export interface DealershipListFilters {
  q: string;
  isActive: ActiveFilter;
  page: number;
}

export const DEFAULT_DEALERSHIP_FILTERS: DealershipListFilters = { q: '', isActive: '', page: 1 };

export function parseDealershipFilters(params: RawParams): DealershipListFilters {
  return {
    q: text(params, 'q'),
    isActive: oneOf(params.get('isActive'), ACTIVE_VALUES, ''),
    page: page(params),
  };
}

export function toDealershipApiQuery(filters: DealershipListFilters) {
  return {
    q: filters.q.trim() || undefined,
    isActive: filters.isActive || undefined,
    page: filters.page,
    pageSize: ADMIN_LIST_PAGE_SIZE,
  };
}

/* -------------------------------------------------------------- customers */

export const CUSTOMER_SORTS = [
  { value: 'createdAt:desc', label: 'Newest accounts' },
  { value: 'lastName:asc', label: 'Surname A to Z' },
  { value: 'bookingCount:desc', label: 'Most bookings' },
] as const;

export interface CustomerListFilters {
  q: string;
  isActive: ActiveFilter;
  sort: (typeof CUSTOMER_SORTS)[number]['value'];
  page: number;
}

export const DEFAULT_CUSTOMER_FILTERS: CustomerListFilters = {
  q: '',
  isActive: '',
  sort: 'createdAt:desc',
  page: 1,
};

export function parseCustomerFilters(params: RawParams): CustomerListFilters {
  return {
    q: text(params, 'q'),
    isActive: oneOf(params.get('isActive'), ACTIVE_VALUES, ''),
    sort: oneOf(
      params.get('sort'),
      CUSTOMER_SORTS.map(option => option.value),
      DEFAULT_CUSTOMER_FILTERS.sort,
    ),
    page: page(params),
  };
}

export function toCustomerApiQuery(filters: CustomerListFilters) {
  const [sortBy, sortOrder] = filters.sort.split(':');
  return {
    q: filters.q.trim() || undefined,
    isActive: filters.isActive || undefined,
    sortBy,
    sortOrder,
    page: filters.page,
    pageSize: ADMIN_LIST_PAGE_SIZE,
  };
}

/* ------------------------------------------------------------------ slots */

export type SlotBooked = '' | 'true' | 'false';

export interface SlotListFilters {
  dealershipId: string;
  vehicleId: string;
  /** Local calendar days, yyyy-MM-dd. */
  from: string;
  to: string;
  booked: SlotBooked;
  isActive: ActiveFilter;
  view: 'list' | 'week' | 'month';
  /** Anchor day of the calendar views, yyyy-MM-dd; empty means today. */
  day: string;
  page: number;
}

export const DEFAULT_SLOT_FILTERS: SlotListFilters = {
  dealershipId: '',
  vehicleId: '',
  from: '',
  to: '',
  booked: '',
  isActive: '',
  view: 'list',
  day: '',
  page: 1,
};

export function parseSlotFilters(params: RawParams): SlotListFilters {
  return {
    dealershipId: id(params, 'dealershipId'),
    vehicleId: id(params, 'vehicleId'),
    from: date(params, 'from'),
    to: date(params, 'to'),
    booked: oneOf(params.get('booked'), ['', 'true', 'false'] as SlotBooked[], ''),
    isActive: oneOf(params.get('isActive'), ACTIVE_VALUES, ''),
    view: oneOf(params.get('view'), ['list', 'week', 'month'] as const, 'list'),
    day: date(params, 'day'),
    page: page(params),
  };
}

const parseLocalDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** Range filters for an admin slots request; local days become whole-day UTC instants. */
export function toSlotApiQuery(
  filters: Pick<SlotListFilters, 'dealershipId' | 'vehicleId' | 'booked' | 'isActive'>,
  range: { from?: string; to?: string },
  paging: { page: number; pageSize: number },
) {
  return {
    dealershipId: filters.dealershipId || undefined,
    vehicleId: filters.vehicleId || undefined,
    hasBooking: filters.booked || undefined,
    isActive: filters.isActive || undefined,
    from: range.from ? startOfDay(parseLocalDate(range.from)).toISOString() : undefined,
    to: range.to ? endOfDay(parseLocalDate(range.to)).toISOString() : undefined,
    page: paging.page,
    pageSize: paging.pageSize,
  };
}
