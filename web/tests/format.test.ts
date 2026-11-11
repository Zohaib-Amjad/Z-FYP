import { describe, expect, it } from 'vitest';
import { enumLabel, formatDateTime, formatPrice, fullName, initials } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';

describe('enumLabel', () => {
  it('uses curated labels for tricky values', () => {
    expect(enumLabel('PLUG_IN_HYBRID')).toBe('Plug-in hybrid');
    expect(enumLabel('SUV')).toBe('SUV');
    expect(enumLabel('GRAND_TOURER')).toBe('Grand tourer');
  });

  it('sentence-cases everything else', () => {
    expect(enumLabel('CONVERTIBLE')).toBe('Convertible');
    expect(enumLabel('DUAL_CLUTCH')).toBe('Dual-clutch');
  });
});

describe('formatters', () => {
  it('formats prices in pounds without decimals', () => {
    expect(formatPrice(68000)).toBe('£68,000');
    expect(formatPrice(null)).toBe('Price on request');
  });

  it('formats local date and time from an ISO instant', () => {
    expect(formatDateTime('2026-11-10T04:00:00.000Z')).toMatch(/^Tue 10 Nov 2026, \d{2}:\d{2}$/);
  });

  it('returns an empty string for invalid dates', () => {
    expect(formatDateTime('not-a-date')).toBe('');
  });

  it('builds names and initials', () => {
    const user = { firstName: 'Amelia', lastName: 'Hart' };
    expect(fullName(user)).toBe('Amelia Hart');
    expect(initials(user)).toBe('AH');
  });
});

describe('queryKeys', () => {
  it('namespaces every key under its domain so a domain can be invalidated at once', () => {
    expect(queryKeys.bookings.mine({ view: 'upcoming' })[0]).toBe(queryKeys.bookings.all[0]);
    expect(queryKeys.vehicles.detail('1')[0]).toBe(queryKeys.vehicles.all[0]);
    expect(queryKeys.admin.slots({})[0]).toBe(queryKeys.admin.all[0]);
  });

  it('includes parameters so different filters get different caches', () => {
    expect(queryKeys.vehicles.list({ page: 1 })).not.toEqual(queryKeys.vehicles.list({ page: 2 }));
  });
});
