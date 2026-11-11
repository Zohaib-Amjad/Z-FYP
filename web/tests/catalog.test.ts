import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  activeChips,
  applyChange,
  clearAll,
  modelOptions,
  parseFilters,
  removeChip,
  toApiQuery,
  toSearchParams,
} from '@/lib/catalog';
import type { VehicleFilters } from '@/types';

const parse = (query: string) => parseFilters(new URLSearchParams(query));

describe('parseFilters', () => {
  it('returns the defaults for an empty query', () => {
    expect(parse('')).toEqual(DEFAULT_FILTERS);
  });

  it('reads valid values', () => {
    const filters = parse(
      'q=ghost&manufacturer=Rolls-Royce&fuelType=ELECTRIC&minPrice=50000&availableOnly=true&sort=priceAsc&page=3',
    );
    expect(filters).toMatchObject({
      q: 'ghost',
      manufacturer: 'Rolls-Royce',
      fuelType: 'ELECTRIC',
      minPrice: '50000',
      availableOnly: true,
      sort: 'priceAsc',
      page: 3,
    });
  });

  it('ignores invalid enums, numbers, sorts and pages', () => {
    const filters = parse(
      'vehicleType=TRUCK&minYear=abc&maxPrice=-5&sort=random&page=0&availableOnly=yes',
    );
    expect(filters).toEqual(DEFAULT_FILTERS);
    expect(parse('page=2.5').page).toBe(1);
  });
});

describe('toSearchParams', () => {
  it('omits defaults and round-trips with parseFilters', () => {
    const filters = applyChange(DEFAULT_FILTERS, {
      manufacturer: 'Audi',
      vehicleType: 'SUV',
      availableOnly: true,
    });
    const query = toSearchParams(filters).toString();

    expect(query).toBe('manufacturer=Audi&vehicleType=SUV&availableOnly=true');
    expect(parse(query)).toEqual(filters);
    expect(toSearchParams(DEFAULT_FILTERS).toString()).toBe('');
  });
});

describe('toApiQuery', () => {
  it('drops empty filters and always sends sort, page and page size', () => {
    expect(toApiQuery({ ...DEFAULT_FILTERS, q: '  ', fuelType: 'HYBRID' })).toMatchObject({
      q: undefined,
      fuelType: 'HYBRID',
      availableOnly: undefined,
      sort: 'newest',
      page: 1,
      pageSize: 12,
    });
  });

  it('sends availableOnly only when on', () => {
    expect(toApiQuery({ ...DEFAULT_FILTERS, availableOnly: true }).availableOnly).toBe(true);
  });
});

describe('applyChange', () => {
  it('returns to page 1 on any filter change but keeps an explicit page', () => {
    const onPageFive = { ...DEFAULT_FILTERS, page: 5 };
    expect(applyChange(onPageFive, { fuelType: 'PETROL' }).page).toBe(1);
    expect(applyChange(onPageFive, { page: 6 }).page).toBe(6);
  });

  it('drops the model when the manufacturer changes, keeps it otherwise', () => {
    const base = { ...DEFAULT_FILTERS, manufacturer: 'Porsche', model: '911 Carrera T' };
    expect(applyChange(base, { manufacturer: 'Audi' }).model).toBe('');
    expect(applyChange(base, { manufacturer: 'Porsche' }).model).toBe('911 Carrera T');
    expect(applyChange(base, { fuelType: 'PETROL' }).model).toBe('911 Carrera T');
  });
});

describe('chips', () => {
  it('lists one chip per active filter and merges ranges', () => {
    const filters = {
      ...DEFAULT_FILTERS,
      q: 'coupe',
      fuelType: 'PLUG_IN_HYBRID' as const,
      minYear: '2024',
      minPrice: '70000',
      maxPrice: '150000',
      availableOnly: true,
    };
    expect(activeChips(filters).map(chip => chip.label)).toEqual([
      '“coupe”',
      'Plug-in hybrid',
      'Year 2024 to any',
      'Price £70,000 to £150,000',
      'Has available slots',
    ]);
  });

  it('has no chips by default, and sort is not a chip', () => {
    expect(activeChips({ ...DEFAULT_FILTERS, sort: 'priceAsc' })).toEqual([]);
  });

  it('removes a single chip, including merged ranges, and returns to page 1', () => {
    const filters = {
      ...DEFAULT_FILTERS,
      minYear: '2024',
      maxYear: '2025',
      fuelType: 'DIESEL' as const,
      page: 4,
    };
    const withoutYear = removeChip(filters, 'year');
    expect(withoutYear).toMatchObject({ minYear: '', maxYear: '', fuelType: 'DIESEL', page: 1 });
    expect(removeChip(filters, 'fuelType').fuelType).toBe('');
  });

  it('clears everything but keeps the chosen sort', () => {
    const cleared = clearAll({
      ...DEFAULT_FILTERS,
      fuelType: 'DIESEL',
      sort: 'priceDesc',
      page: 3,
    });
    expect(cleared).toEqual({ ...DEFAULT_FILTERS, sort: 'priceDesc' });
  });
});

describe('modelOptions', () => {
  const options = {
    models: [
      { manufacturer: 'Audi', models: ['RS e-tron GT'] },
      { manufacturer: 'Porsche', models: ['911 Carrera T', 'Taycan'] },
    ],
  } as VehicleFilters;

  it('narrows models to the chosen manufacturer', () => {
    expect(modelOptions(options, 'Porsche')).toEqual(['911 Carrera T', 'Taycan']);
  });

  it('lists every model without a manufacturer, and none before options load', () => {
    expect(modelOptions(options, '')).toEqual(['RS e-tron GT', '911 Carrera T', 'Taycan']);
    expect(modelOptions(undefined, 'Audi')).toEqual([]);
  });
});
