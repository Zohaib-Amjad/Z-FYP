import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CUSTOMER_FILTERS,
  DEFAULT_DEALERSHIP_FILTERS,
  DEFAULT_SLOT_FILTERS,
  DEFAULT_VEHICLE_FILTERS,
  applyListChange,
  parseCustomerFilters,
  parseDealershipFilters,
  parseSlotFilters,
  parseVehicleFilters,
  toCustomerApiQuery,
  toParams,
  toSlotApiQuery,
  toVehicleApiQuery,
} from '@/lib/adminLists';

const params = (query: string) => new URLSearchParams(query);

describe('vehicle list filters', () => {
  it('defaults an empty query and ignores invalid values', () => {
    expect(parseVehicleFilters(params(''))).toEqual(DEFAULT_VEHICLE_FILTERS);
    expect(
      parseVehicleFilters(
        params('vehicleType=TRUCK&fuelType=NUCLEAR&isActive=maybe&sort=random&page=-3'),
      ),
    ).toEqual(DEFAULT_VEHICLE_FILTERS);
  });

  it('round-trips through the URL, omitting defaults', () => {
    const filters = {
      ...DEFAULT_VEHICLE_FILTERS,
      q: 'ghost',
      fuelType: 'ELECTRIC' as const,
      isActive: 'false' as const,
      page: 2,
    };
    const query = toParams(filters, DEFAULT_VEHICLE_FILTERS).toString();

    expect(query).toBe('q=ghost&fuelType=ELECTRIC&isActive=false&page=2');
    expect(parseVehicleFilters(params(query))).toEqual(filters);
  });

  it('splits the combined sort into API sortBy and sortOrder, and includes inactive by default', () => {
    expect(toVehicleApiQuery({ ...DEFAULT_VEHICLE_FILTERS, sort: 'priceFrom:asc' })).toMatchObject({
      sortBy: 'priceFrom',
      sortOrder: 'asc',
      isActive: undefined,
      pageSize: 12,
    });
    expect(toVehicleApiQuery({ ...DEFAULT_VEHICLE_FILTERS, isActive: 'false' }).isActive).toBe(
      'false',
    );
  });
});

describe('other list filters', () => {
  it('parses dealership and customer filters', () => {
    expect(parseDealershipFilters(params('q=may&isActive=true&page=2'))).toEqual({
      q: 'may',
      isActive: 'true',
      page: 2,
    });
    expect(parseDealershipFilters(params(''))).toEqual(DEFAULT_DEALERSHIP_FILTERS);
    expect(parseCustomerFilters(params('sort=lastName:asc&isActive=false'))).toMatchObject({
      sort: 'lastName:asc',
      isActive: 'false',
    });
    expect(parseCustomerFilters(params(''))).toEqual(DEFAULT_CUSTOMER_FILTERS);
    expect(
      toCustomerApiQuery({ ...DEFAULT_CUSTOMER_FILTERS, sort: 'bookingCount:desc' }),
    ).toMatchObject({
      sortBy: 'bookingCount',
      sortOrder: 'desc',
    });
  });

  it('returns to page 1 when a filter changes, but keeps an explicit page', () => {
    const base = { ...DEFAULT_CUSTOMER_FILTERS, page: 4 };
    expect(applyListChange(base, { q: 'a' }).page).toBe(1);
    expect(applyListChange(base, { page: 5 }).page).toBe(5);
  });
});

describe('slot filters', () => {
  const id = '3b2eeacc-b2df-4b3d-a64c-4177a9369608';

  it('parses ids, dates, views and tri-state flags safely', () => {
    expect(
      parseSlotFilters(
        params(
          `dealershipId=${id}&vehicleId=nope&from=2026-11-01&to=11/05&booked=true&isActive=false&view=week&day=2026-11-10`,
        ),
      ),
    ).toEqual({
      ...DEFAULT_SLOT_FILTERS,
      dealershipId: id,
      from: '2026-11-01',
      booked: 'true',
      isActive: 'false',
      view: 'week',
      day: '2026-11-10',
    });
    expect(parseSlotFilters(params('view=year&booked=x'))).toEqual(DEFAULT_SLOT_FILTERS);
  });

  it('turns local days into whole-day instants and maps booked to hasBooking', () => {
    const query = toSlotApiQuery(
      { dealershipId: id, vehicleId: '', booked: 'false', isActive: '' },
      { from: '2026-11-10', to: '2026-11-10' },
      { page: 2, pageSize: 50 },
    );

    expect(query).toMatchObject({ dealershipId: id, hasBooking: 'false', page: 2, pageSize: 50 });
    expect(query.vehicleId).toBeUndefined();
    expect(new Date(query.from as string).getHours()).toBe(0);
    expect(new Date(query.to as string).getHours()).toBe(23);
  });
});
