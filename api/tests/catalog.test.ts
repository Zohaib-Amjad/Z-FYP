import { addDays, setHours, startOfDay } from 'date-fns';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/config/prisma';
import {
  createBooking,
  createDealership,
  createSlot,
  createVehicle,
  linkVehicle,
  resetDatabase,
  seedMinimalData,
} from './helpers/db';

let app: ReturnType<typeof createApp>;
let data: Awaited<ReturnType<typeof seedMinimalData>>;
let london: { id: string };
let manchester: { id: string };
let audi: { id: string };
let bentley: { id: string };
let rangeRover: { id: string };
let ferrari: { id: string };
let lamborghini: { id: string };

const withVehicle = (vehicle: { id: string }, dealership: { id: string }) => ({
  staff: data.staff,
  vehicle,
  dealership,
});
const slotStart = (days: number, hour: number): Date =>
  setHours(startOfDay(addDays(new Date(), days)), hour);

beforeEach(async () => {
  app = createApp();
  await resetDatabase();
  data = await seedMinimalData();
  london = data.dealership;
  manchester = await createDealership('Prestige Deansgate', 'Manchester');

  audi = await createVehicle({
    manufacturer: 'Audi',
    model: 'RS e-tron GT',
    year: 2024,
    vehicleType: 'GRAND_TOURER',
    fuelType: 'ELECTRIC',
    transmission: 'AUTOMATIC',
    powerHp: 637,
    priceFrom: 134000,
    description: 'A sculpted electric grand tourer with supercar acceleration.',
    features: ['Carbon roof', 'Matrix LED laser lights'],
  });
  bentley = await createVehicle({
    manufacturer: 'Bentley',
    model: 'Continental GT Speed',
    year: 2025,
    vehicleType: 'GRAND_TOURER',
    fuelType: 'PETROL',
    transmission: 'DUAL_CLUTCH',
    powerHp: 650,
    priceFrom: 245000,
    description: 'Hand-crafted in Crewe with diamond-quilted leather.',
    features: ['Rotating display dashboard', 'Naim for Bentley audio'],
  });
  rangeRover = await createVehicle({
    manufacturer: 'Land Rover',
    model: 'Range Rover Autobiography',
    year: 2023,
    vehicleType: 'SUV',
    fuelType: 'DIESEL',
    transmission: 'AUTOMATIC',
    powerHp: 350,
    priceFrom: 148000,
    description: 'The definitive luxury SUV.',
    features: ['Panoramic roof', 'Terrain Response 2'],
  });
  ferrari = await createVehicle({
    manufacturer: 'Ferrari',
    model: 'Roma Spider',
    year: 2022,
    vehicleType: 'CONVERTIBLE',
    fuelType: 'PETROL',
    transmission: 'DUAL_CLUTCH',
    powerHp: 612,
    priceFrom: null,
    description: 'La Nuova Dolce Vita in soft-top form.',
    features: ['Retractable fabric roof'],
  });
  lamborghini = await createVehicle({
    manufacturer: 'Lamborghini',
    model: 'Urus SE',
    year: 2025,
    vehicleType: 'SUV',
    fuelType: 'PLUG_IN_HYBRID',
    transmission: 'AUTOMATIC',
    powerHp: 789,
    priceFrom: 235000,
    isActive: false,
  });

  await linkVehicle(manchester.id, audi.id);
  await linkVehicle(london.id, bentley.id);
  await linkVehicle(manchester.id, bentley.id);
  await linkVehicle(london.id, rangeRover.id);
  await linkVehicle(manchester.id, ferrari.id);
  await linkVehicle(london.id, lamborghini.id);

  await createSlot(withVehicle(audi, manchester), 4, 10);
  await createSlot(withVehicle(bentley, london), 6, 10);
  await createSlot(withVehicle(bentley, manchester), 2, 10);
  await createSlot(withVehicle(rangeRover, london), 5, 10);
  await createSlot(withVehicle(lamborghini, london), 3, 10);
});

afterAll(async () => {
  await resetDatabase();
  await disconnectPrisma();
});

const list = (query = '') => request(app).get(`/api/vehicles${query}`);
const models = (res: request.Response): string[] =>
  res.body.data.items.map((v: { model: string }) => v.model);
const sorted = (values: string[]): string[] => [...values].sort();

describe('GET /api/vehicles: basics', () => {
  it('is public and lists active vehicles only, in the documented item shape', async () => {
    const res = await list('?pageSize=50');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 5, page: 1, pageSize: 50, totalPages: 1 });
    expect(sorted(models(res))).toEqual(
      sorted([
        '911 Carrera T',
        'RS e-tron GT',
        'Continental GT Speed',
        'Range Rover Autobiography',
        'Roma Spider',
      ]),
    );
    const item = res.body.data.items.find((v: { id: string }) => v.id === audi.id);
    expect(Object.keys(item).sort()).toEqual(
      [
        'dealerships',
        'fuelType',
        'id',
        'manufacturer',
        'model',
        'nextAvailableSlotAt',
        'primaryImage',
        'priceFrom',
        'transmission',
        'vehicleType',
        'year',
      ].sort(),
    );
    expect(item).toMatchObject({
      manufacturer: 'Audi',
      priceFrom: 134000,
      primaryImage: null,
      dealerships: [{ id: manchester.id, name: 'Prestige Deansgate', city: 'Manchester' }],
    });
    expect(typeof item.nextAvailableSlotAt).toBe('string');
  });

  it('includes the primary image', async () => {
    await prisma.vehicleImage.createMany({
      data: [
        { vehicleId: audi.id, url: '/uploads/x/2.png', altText: 'Interior', sortOrder: 2 },
        {
          vehicleId: audi.id,
          url: '/uploads/x/1.png',
          altText: 'Exterior',
          isPrimary: true,
          sortOrder: 1,
        },
      ],
    });
    const res = await list('?manufacturer=Audi');

    expect(res.body.data.items[0].primaryImage).toEqual(
      expect.objectContaining({ url: '/uploads/x/1.png', altText: 'Exterior', isPrimary: true }),
    );
  });

  it('lists every dealership offering a vehicle, ordered by name, and hides unavailable links and inactive dealerships', async () => {
    const inactive = await createDealership('Prestige Edinburgh', 'Edinburgh', { isActive: false });
    const unavailable = await createDealership('Prestige Windsor', 'Windsor');
    await linkVehicle(inactive.id, bentley.id);
    await linkVehicle(unavailable.id, bentley.id, false);
    const res = await list('?model=Continental%20GT%20Speed');

    expect(res.body.data.items[0].dealerships.map((d: { city: string }) => d.city)).toEqual([
      'Manchester',
      'London',
    ]);
  });

  it('reports the earliest available slot as nextAvailableSlotAt, and null when none', async () => {
    const res = await list('?pageSize=50');
    const byModel = (model: string) =>
      res.body.data.items.find((v: { model: string }) => v.model === model);

    expect(byModel('Continental GT Speed').nextAvailableSlotAt).toBe(
      slotStart(2, 10).toISOString(),
    );
    expect(byModel('Roma Spider').nextAvailableSlotAt).toBeNull();
  });

  it('ignores booked, past, inactive and unavailable-link slots for nextAvailableSlotAt', async () => {
    const earliest = await prisma.timeSlot.findFirstOrThrow({
      where: { vehicleId: bentley.id, dealershipId: manchester.id },
    });
    await createBooking(data.customer.id, earliest.id, 'PENDING');
    await createSlot(withVehicle(bentley, london), -2, 10);
    const inactiveSlot = await createSlot(withVehicle(bentley, london), 1, 10);
    await prisma.timeSlot.update({ where: { id: inactiveSlot.id }, data: { isActive: false } });
    const res = await list('?model=Continental%20GT%20Speed');

    expect(res.body.data.items[0].nextAvailableSlotAt).toBe(slotStart(6, 10).toISOString());
  });

  it('frees a slot again when its booking is cancelled', async () => {
    const earliest = await prisma.timeSlot.findFirstOrThrow({
      where: { vehicleId: bentley.id, dealershipId: manchester.id },
    });
    await createBooking(data.customer.id, earliest.id, 'CANCELLED');
    const res = await list('?model=Continental%20GT%20Speed');

    expect(res.body.data.items[0].nextAvailableSlotAt).toBe(slotStart(2, 10).toISOString());
  });

  it('hides inactive vehicles', async () => {
    const res = await list('?manufacturer=Lamborghini');

    expect(res.body.data.total).toBe(0);
  });
});

describe('GET /api/vehicles: filters', () => {
  it('filters by manufacturer, ignoring case', async () => {
    expect(models(await list('?manufacturer=BENTLEY'))).toEqual(['Continental GT Speed']);
  });

  it('accepts several manufacturers as a comma-separated list or repeated parameters', async () => {
    const comma = await list('?manufacturer=Audi,Bentley');
    const repeated = await list('?manufacturer=Audi&manufacturer=Bentley');

    expect(sorted(models(comma))).toEqual(['Continental GT Speed', 'RS e-tron GT']);
    expect(sorted(models(repeated))).toEqual(sorted(models(comma)));
  });

  it('filters by model', async () => {
    expect(models(await list('?model=Roma%20Spider'))).toEqual(['Roma Spider']);
    expect(sorted(models(await list('?model=Roma%20Spider,RS%20e-tron%20GT')))).toEqual([
      'RS e-tron GT',
      'Roma Spider',
    ]);
  });

  it('filters by vehicle type, with several values', async () => {
    expect(models(await list('?vehicleType=SUV'))).toEqual(['Range Rover Autobiography']);
    expect(sorted(models(await list('?vehicleType=SUV,CONVERTIBLE')))).toEqual([
      'Range Rover Autobiography',
      'Roma Spider',
    ]);
  });

  it('filters by fuel type', async () => {
    expect(models(await list('?fuelType=ELECTRIC'))).toEqual(['RS e-tron GT']);
    expect(sorted(models(await list('?fuelType=PETROL')))).toEqual(
      sorted(['911 Carrera T', 'Continental GT Speed', 'Roma Spider']),
    );
  });

  it('filters by transmission', async () => {
    expect(models(await list('?transmission=MANUAL'))).toEqual(['911 Carrera T']);
    expect(sorted(models(await list('?transmission=DUAL_CLUTCH')))).toEqual([
      'Continental GT Speed',
      'Roma Spider',
    ]);
  });

  it('filters by dealership', async () => {
    const res = await list(`?dealershipId=${manchester.id}`);

    expect(sorted(models(res))).toEqual(['Continental GT Speed', 'RS e-tron GT', 'Roma Spider']);
  });

  it('filters by city, ignoring case', async () => {
    const res = await list('?city=LONDON');

    expect(sorted(models(res))).toEqual(
      sorted(['911 Carrera T', 'Continental GT Speed', 'Range Rover Autobiography']),
    );
  });

  it('does not match vehicles through unavailable links or inactive dealerships', async () => {
    const inactive = await createDealership('Prestige Edinburgh', 'Edinburgh', { isActive: false });
    const unavailable = await createDealership('Prestige Windsor', 'Windsor');
    await linkVehicle(inactive.id, audi.id);
    await linkVehicle(unavailable.id, audi.id, false);

    expect((await list('?city=Edinburgh')).body.data.total).toBe(0);
    expect((await list('?city=Windsor')).body.data.total).toBe(0);
    expect((await list(`?dealershipId=${inactive.id}`)).body.data.total).toBe(0);
  });

  it('filters by year range', async () => {
    expect(sorted(models(await list('?minYear=2024')))).toEqual(
      sorted(['911 Carrera T', 'Continental GT Speed', 'RS e-tron GT']),
    );
    expect(sorted(models(await list('?maxYear=2023')))).toEqual([
      'Range Rover Autobiography',
      'Roma Spider',
    ]);
    expect(models(await list('?minYear=2023&maxYear=2023'))).toEqual(['Range Rover Autobiography']);
  });

  it('filters by price range, leaving out vehicles without a price', async () => {
    expect(models(await list('?minPrice=200000'))).toEqual(['Continental GT Speed']);
    expect(sorted(models(await list('?maxPrice=150000')))).toEqual([
      'RS e-tron GT',
      'Range Rover Autobiography',
    ]);
    expect(models(await list('?minPrice=140000&maxPrice=150000'))).toEqual([
      'Range Rover Autobiography',
    ]);
  });

  it('shows only vehicles with an available future slot when availableOnly is true', async () => {
    const res = await list('?availableOnly=true');

    expect(sorted(models(res))).toEqual(
      sorted([
        '911 Carrera T',
        'Continental GT Speed',
        'RS e-tron GT',
        'Range Rover Autobiography',
      ]),
    );
    expect((await list('?availableOnly=false')).body.data.total).toBe(5);
  });

  it('drops a vehicle from availableOnly when its only slot is booked, past or inactive', async () => {
    await prisma.timeSlot.update({ where: { id: data.slot.id }, data: { isActive: false } });
    const audiSlot = await prisma.timeSlot.findFirstOrThrow({ where: { vehicleId: audi.id } });
    await createBooking(data.customer.id, audiSlot.id, 'APPROVED');
    const res = await list('?availableOnly=true');

    expect(sorted(models(res))).toEqual(['Continental GT Speed', 'Range Rover Autobiography']);
  });

  it('restricts availableOnly to the selected dealership', async () => {
    const res = await list(
      `?availableOnly=true&dealershipId=${london.id}&model=Continental%20GT%20Speed`,
    );

    expect(res.body.data.items[0].nextAvailableSlotAt).toBe(slotStart(6, 10).toISOString());
    const manchesterOnly = await list(
      `?availableOnly=true&dealershipId=${manchester.id}&model=Roma%20Spider`,
    );
    expect(manchesterOnly.body.data.total).toBe(0);
  });

  it('combines filters', async () => {
    const res = await list(
      '?fuelType=PETROL&vehicleType=GRAND_TOURER,COUPE&city=London&minYear=2025&availableOnly=true',
    );

    expect(sorted(models(res))).toEqual(['911 Carrera T', 'Continental GT Speed']);
    const none = await list('?fuelType=ELECTRIC&city=London');
    expect(none.body.data.total).toBe(0);
  });
});

describe('GET /api/vehicles: text search', () => {
  it.each([
    ['manufacturer', 'bentley', ['Continental GT Speed']],
    ['model', 'e-tron', ['RS e-tron GT']],
    ['description', 'diamond-quilted', ['Continental GT Speed']],
    ['a feature, in the middle of a word and ignoring case', 'LASER', ['RS e-tron GT']],
    ['a feature phrase', 'naim for', ['Continental GT Speed']],
  ])('matches %s', async (_label, q, expected) => {
    expect(models(await list(`?q=${encodeURIComponent(q)}`))).toEqual(expected);
  });

  it('matches vehicles across several fields when each word matches something', async () => {
    const res = await list('?q=audi%20carbon');

    expect(models(res)).toEqual(['RS e-tron GT']);
  });

  it('requires every word to match', async () => {
    expect((await list('?q=ferrari%20bentley')).body.data.total).toBe(0);
    expect((await list('?q=roof')).body.data.total).toBe(3);
  });

  it('does not treat wildcard characters as special in features', async () => {
    expect((await list('?q=%25')).body.data.total).toBe(0);
    expect((await list('?q=_')).body.data.total).toBe(0);
  });

  it('finds a literal percent sign or underscore when one really is present', async () => {
    await prisma.vehicle.update({
      where: { id: ferrari.id },
      data: { description: 'Reserved at 50% of list price', features: ['Seat_Heating'] },
    });

    expect(models(await list('?q=50%25'))).toEqual(['Roma Spider']);
    expect(models(await list('?q=Seat_'))).toEqual(['Roma Spider']);
    expect((await list('?q=5_%25')).body.data.total).toBe(0);
    expect(models(await list('?q=_Heating'))).toEqual(['Roma Spider']);
  });

  it('never returns inactive vehicles from a text search', async () => {
    await prisma.vehicle.update({
      where: { id: lamborghini.id },
      data: { features: ['Carbon roof'] },
    });

    expect((await list('?q=urus')).body.data.total).toBe(0);
    expect(models(await list('?q=carbon'))).toEqual(['RS e-tron GT']);
  });

  it('combines text search with filters', async () => {
    expect(models(await list('?q=roof&vehicleType=SUV'))).toEqual(['Range Rover Autobiography']);
  });
});

describe('GET /api/vehicles: sorting and pagination', () => {
  it('sorts by manufacturer A to Z', async () => {
    const res = await list('?sort=manufacturerAsc');

    expect(res.body.data.items.map((v: { manufacturer: string }) => v.manufacturer)).toEqual([
      'Audi',
      'Bentley',
      'Ferrari',
      'Land Rover',
      'Porsche',
    ]);
  });

  it('sorts by price, with vehicles without a price last in both directions', async () => {
    const asc = await list('?sort=priceAsc');
    const desc = await list('?sort=priceDesc');

    const prices = (res: request.Response) =>
      res.body.data.items.map((v: { priceFrom: number | null }) => v.priceFrom);
    expect(prices(asc).slice(-1)).toEqual([null]);
    expect(prices(desc).slice(-1)).toEqual([null]);
    const known = (list: (number | null)[]) => list.filter((p): p is number => p !== null);
    expect(known(prices(asc))).toEqual([...known(prices(asc))].sort((a, b) => a - b));
    expect(known(prices(desc))).toEqual([...known(prices(desc))].sort((a, b) => b - a));
  });

  it('sorts by power, highest first', async () => {
    const res = await list('?sort=powerDesc');

    expect(models(res)).toEqual([
      'Continental GT Speed',
      'RS e-tron GT',
      'Roma Spider',
      '911 Carrera T',
      'Range Rover Autobiography',
    ]);
  });

  it('sorts newest first by default', async () => {
    const res = await list();

    expect(models(res)[0]).toBe('Roma Spider');
    expect(models(res).at(-1)).toBe('911 Carrera T');
    expect(models(await list('?sort=newest'))).toEqual(models(res));
  });

  it('paginates consistently across pages', async () => {
    const first = await list('?pageSize=2&page=1&sort=manufacturerAsc');
    const second = await list('?pageSize=2&page=2&sort=manufacturerAsc');
    const third = await list('?pageSize=2&page=3&sort=manufacturerAsc');

    expect(first.body.data).toMatchObject({ total: 5, totalPages: 3, page: 1, pageSize: 2 });
    expect([...models(first), ...models(second), ...models(third)]).toEqual(
      models(await list('?sort=manufacturerAsc&pageSize=50')),
    );
    expect(models(third)).toHaveLength(1);
  });

  it('returns an empty page, with the true total, beyond the last page', async () => {
    const res = await list('?page=9&pageSize=10');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data).toMatchObject({ total: 5, totalPages: 1, page: 9 });
  });

  it('returns an empty list when nothing matches', async () => {
    const res = await list('?manufacturer=Tesla');

    expect(res.body.data).toMatchObject({ items: [], total: 0, totalPages: 0 });
  });

  it('defaults to a page size of 10 and allows exactly 50', async () => {
    expect((await list()).body.data.pageSize).toBe(10);
    expect((await list('?pageSize=50')).status).toBe(200);
  });
});

describe('GET /api/vehicles: validation', () => {
  it('rejects unknown enum values with a helpful message', async () => {
    const res = await list('?vehicleType=TRUCK&fuelType=STEAM&transmission=CVT');

    expect(res.status).toBe(422);
    const message = (field: string): string =>
      res.body.error.details.find((d: { field: string }) => d.field.startsWith(field))?.message;
    expect(message('vehicleType')).toContain('SEDAN, SUV, COUPE');
    expect(message('fuelType')).toContain('PLUG_IN_HYBRID');
    expect(message('transmission')).toContain('DUAL_CLUTCH');
  });

  it('rejects an invalid value inside a list', async () => {
    expect((await list('?fuelType=PETROL,STEAM')).status).toBe(422);
  });

  it('rejects an invalid sort, listing the valid options', async () => {
    const res = await list('?sort=cheapest');

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].message).toContain('priceAsc');
  });

  it.each([
    'minYear=abc',
    'minYear=2020.5',
    'maxYear=1800',
    'minPrice=-5',
    'maxPrice=lots',
    'dealershipId=abc',
    'availableOnly=maybe',
    'page=0',
    'page=abc',
    'pageSize=51',
    'pageSize=0',
  ])('rejects %s', async query => {
    expect((await list(`?${query}`)).status).toBe(422);
  });

  it('rejects an inverted year or price range', async () => {
    const years = await list('?minYear=2025&maxYear=2020');
    const prices = await list('?minPrice=200000&maxPrice=100000');

    expect(years.status).toBe(422);
    expect(prices.status).toBe(422);
    expect(prices.body.error.details[0].field).toBe('minPrice');
  });

  it('rejects unknown query parameters instead of ignoring them', async () => {
    const res = await list('?colour=red&fuel=PETROL');

    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual([
      'colour',
      'fuel',
    ]);
  });

  it('treats empty parameters as not provided', async () => {
    const res = await list('?q=&manufacturer=&minPrice=&city=');

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(5);
  });
});

describe('GET /api/vehicles/filters', () => {
  it('returns the options present in the data for active vehicles only', async () => {
    const res = await request(app).get('/api/vehicles/filters');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      manufacturers: ['Audi', 'Bentley', 'Ferrari', 'Land Rover', 'Porsche'],
      models: [
        { manufacturer: 'Audi', models: ['RS e-tron GT'] },
        { manufacturer: 'Bentley', models: ['Continental GT Speed'] },
        { manufacturer: 'Ferrari', models: ['Roma Spider'] },
        { manufacturer: 'Land Rover', models: ['Range Rover Autobiography'] },
        { manufacturer: 'Porsche', models: ['911 Carrera T'] },
      ],
      vehicleTypes: ['COUPE', 'CONVERTIBLE', 'GRAND_TOURER', 'SUV'].sort(),
      fuelTypes: ['DIESEL', 'ELECTRIC', 'PETROL'],
      transmissions: ['AUTOMATIC', 'DUAL_CLUTCH', 'MANUAL'],
      yearRange: { min: 2022, max: 2025 },
      priceRange: { min: 134000, max: 245000 },
      cities: ['London', 'Manchester'],
    });
  });

  it('does not offer values that belong only to inactive vehicles', async () => {
    const res = await request(app).get('/api/vehicles/filters');

    expect(res.body.data.manufacturers).not.toContain('Lamborghini');
    expect(res.body.data.fuelTypes).not.toContain('PLUG_IN_HYBRID');
  });

  it('follows changes in the data', async () => {
    await prisma.vehicle.update({ where: { id: audi.id }, data: { isActive: false } });
    await prisma.vehicle.update({ where: { id: ferrari.id }, data: { model: 'Roma' } });
    const res = await request(app).get('/api/vehicles/filters');

    expect(res.body.data.manufacturers).not.toContain('Audi');
    expect(res.body.data.fuelTypes).not.toContain('ELECTRIC');
    expect(
      res.body.data.models.find((m: { manufacturer: string }) => m.manufacturer === 'Ferrari')
        .models,
    ).toEqual(['Roma']);
  });

  it('only lists cities of active dealerships that offer an active vehicle', async () => {
    await createDealership('Prestige Edinburgh', 'Edinburgh', { isActive: false });
    const empty = await createDealership('Prestige Windsor', 'Windsor');
    const unavailableOnly = await createDealership('Prestige Bath', 'Bath');
    await linkVehicle(unavailableOnly.id, audi.id, false);
    const inactiveVehicleOnly = await createDealership('Prestige Leeds', 'Leeds');
    await linkVehicle(inactiveVehicleOnly.id, lamborghini.id);
    void empty;
    const res = await request(app).get('/api/vehicles/filters');

    expect(res.body.data.cities).toEqual(['London', 'Manchester']);
  });

  it('returns empty options and null ranges when there are no vehicles', async () => {
    await prisma.vehicle.updateMany({ data: { isActive: false } });
    const res = await request(app).get('/api/vehicles/filters');

    expect(res.body.data).toEqual({
      manufacturers: [],
      models: [],
      vehicleTypes: [],
      fuelTypes: [],
      transmissions: [],
      yearRange: null,
      priceRange: null,
      cities: [],
    });
  });

  it('every offered filter value returns at least one vehicle', async () => {
    const filters = (await request(app).get('/api/vehicles/filters')).body.data;
    const checks: string[] = [
      ...filters.manufacturers.map((m: string) => `manufacturer=${encodeURIComponent(m)}`),
      ...filters.vehicleTypes.map((t: string) => `vehicleType=${t}`),
      ...filters.fuelTypes.map((f: string) => `fuelType=${f}`),
      ...filters.transmissions.map((t: string) => `transmission=${t}`),
      ...filters.cities.map((c: string) => `city=${encodeURIComponent(c)}`),
    ];

    for (const check of checks) {
      expect((await list(`?${check}`)).body.data.total, check).toBeGreaterThan(0);
    }
  });
});

describe('GET /api/vehicles/:id', () => {
  it('returns full details with ordered images and dealerships with slot counts', async () => {
    await prisma.vehicleImage.createMany({
      data: [
        { vehicleId: bentley.id, url: '/uploads/x/2.png', altText: 'Interior', sortOrder: 2 },
        {
          vehicleId: bentley.id,
          url: '/uploads/x/1.png',
          altText: 'Exterior',
          isPrimary: true,
          sortOrder: 1,
        },
      ],
    });
    await createSlot(withVehicle(bentley, london), 8, 11);
    const res = await request(app).get(`/api/vehicles/${bentley.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: bentley.id,
      manufacturer: 'Bentley',
      model: 'Continental GT Speed',
      year: 2025,
      vehicleType: 'GRAND_TOURER',
      fuelType: 'PETROL',
      transmission: 'DUAL_CLUTCH',
      engine: '6.0L twin-turbo W12',
      powerHp: 650,
      seats: 4,
      color: 'Verdant Green',
      priceFrom: 245000,
      features: ['Rotating display dashboard', 'Naim for Bentley audio'],
    });
    expect(res.body.data.images.map((i: { url: string }) => i.url)).toEqual([
      '/uploads/x/1.png',
      '/uploads/x/2.png',
    ]);
    expect(res.body.data.dealerships).toEqual([
      expect.objectContaining({
        name: 'Prestige Deansgate',
        city: 'Manchester',
        upcomingAvailableSlots: 1,
      }),
      expect.objectContaining({
        name: 'Prestige Mayfair',
        city: 'London',
        upcomingAvailableSlots: 2,
      }),
    ]);
    expect(res.body.data.dealerships[0]).toHaveProperty('openingHours');
    expect(res.body.data.dealerships[0]).toHaveProperty('address');
  });

  it('does not expose internal fields', async () => {
    const res = await request(app).get(`/api/vehicles/${bentley.id}`);

    for (const field of ['isActive', 'createdAt', 'updatedAt']) {
      expect(res.body.data).not.toHaveProperty(field);
    }
    expect(typeof res.body.data.priceFrom).toBe('number');
  });

  it('counts only genuinely available slots', async () => {
    const slot = await prisma.timeSlot.findFirstOrThrow({
      where: { vehicleId: bentley.id, dealershipId: manchester.id },
    });
    await createBooking(data.customer.id, slot.id, 'APPROVED');
    await createSlot(withVehicle(bentley, london), -3, 10);
    const res = await request(app).get(`/api/vehicles/${bentley.id}`);
    const byCity = Object.fromEntries(
      res.body.data.dealerships.map((d: { city: string; upcomingAvailableSlots: number }) => [
        d.city,
        d.upcomingAvailableSlots,
      ]),
    );

    expect(byCity).toEqual({ Manchester: 0, London: 1 });
  });

  it('shows zero slots for a vehicle with none and leaves out unavailable or inactive dealerships', async () => {
    const inactive = await createDealership('Prestige Edinburgh', 'Edinburgh', { isActive: false });
    const unavailable = await createDealership('Prestige Windsor', 'Windsor');
    await linkVehicle(inactive.id, ferrari.id);
    await linkVehicle(unavailable.id, ferrari.id, false);
    const res = await request(app).get(`/api/vehicles/${ferrari.id}`);

    expect(res.body.data.dealerships).toEqual([
      expect.objectContaining({ city: 'Manchester', upcomingAvailableSlots: 0 }),
    ]);
  });

  it('returns 404 for an inactive vehicle, an unknown vehicle, and 422 for a malformed id', async () => {
    expect((await request(app).get(`/api/vehicles/${lamborghini.id}`)).status).toBe(404);
    expect(
      (await request(app).get('/api/vehicles/0bbe7e55-75e7-4355-b1e3-af30b7b9ee11')).status,
    ).toBe(404);
    expect((await request(app).get('/api/vehicles/nope')).status).toBe(422);
  });

  it('is not shadowed by the filters route', async () => {
    const res = await request(app).get('/api/vehicles/filters');

    expect(res.body.data).toHaveProperty('manufacturers');
  });
});
